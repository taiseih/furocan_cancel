import {useEffect, useState} from 'react';
import * as Effects from './effects';
import type {GrowthStageId, ItemCategory} from './game/data';
import {useGame} from './game/GameContext';
import {getPetLine, talk} from './game/lines';
import {getDirt, getHunger, getLevelInfo, getMood, getPet, getPetModel, type BathResult, type LevelChange} from './game/rules';
import {useCatAvatar} from './hooks/useCatAvatar';
import {useTimedMessage} from './hooks/useTimedMessage';
import {BathSection} from './components/BathSection';
import {DebugPanel} from './components/DebugPanel';
import {Hud} from './components/Hud';
import {IntroWizard} from './components/IntroWizard';
import {MessageModal} from './components/Modal';
import {StatusPanel} from './components/StatusPanel';
import {FoodTab} from './components/tabs/FoodTab';
import {RecordTab} from './components/tabs/RecordTab';
import {ShopTab} from './components/tabs/ShopTab';
import {StyleTab} from './components/tabs/StyleTab';

const SPEECH_DURATION_MS = 3500;
const TOAST_DURATION_MS = 2600;
const FIRST_LINE_DELAY_MS = 600;

const TABS = [
	{id: 'food', label: '🍚 ごはん'},
	{id: 'shop', label: '🛍️ ショップ'},
	{id: 'style', label: '✨ コーデ'},
	{id: 'record', label: '📅 きろく'},
] as const;
type TabId = (typeof TABS)[number]['id'];

type Announcement =
	| {kind: 'growth'; name: string; stageId: GrowthStageId; level: number | null}
	| {kind: 'weekly'; streak: number; earned: number};

const isDebugMode = new URLSearchParams(location.search).has('debug');

export function App() {
	const {state, now, actions} = useGame();
	const [activeTab, setActiveTab] = useState<TabId>('food');
	const [shopCategory, setShopCategory] = useState<ItemCategory>('food');
	const [isBathing, setIsBathing] = useState(false);
	const [announcement, setAnnouncement] = useState<Announcement | null>(null);
	const [speech, showSpeech] = useTimedMessage(SPEECH_DURATION_MS);
	const [toast, showToast] = useTimedMessage(TOAST_DURATION_MS);

	const {species} = getPet(state);
	const dirt = getDirt(state, now);
	const hunger = getHunger(state, now);
	const levelInfo = getLevelInfo(state);
	const mood = getMood(state, now);
	const petModel = getPetModel(state);
	const say = (text: string) => showSpeech(talk(species, text));

	const {containerRef, stageRef, avatarRef, error: avatarError} = useCatAvatar(petModel, {
		isDebugMode,
		onPet() {
			if (isBathing || !stageRef.current) {
				return;
			}

			Effects.hearts(stageRef.current);
			showSpeech(getPetLine(species, dirt, hunger));
			avatarRef.current?.pet();
		},
	});

	// ゲームの状態を 3D のお部屋に反映する（3D 側は同じ値なら何もしない）
	const {equipped, room} = state;
	useEffect(() => {
		avatarRef.current?.setPet(petModel);
	}, [avatarRef, petModel.species, petModel.breed, petModel.palette]);
	useEffect(() => {
		avatarRef.current?.setState({dirt: dirt / 100, mood, scale: levelInfo.stage.scale, equippedIds: new Set(Object.values(equipped).filter(id => id !== null))});
	}, [avatarRef, dirt, mood, levelInfo.stage.scale, equipped]);
	useEffect(() => {
		avatarRef.current?.setRoom(room);
	}, [avatarRef, room]);

	// 開いたときに一度だけ話しかける（はじめての人には説明を先に見せる）
	useEffect(() => {
		if (!state.hasSeenIntro) {
			return undefined;
		}

		const timerId = setTimeout(() => showSpeech(getPetLine(species, dirt, hunger)), FIRST_LINE_DELAY_MS);
		return () => clearTimeout(timerId);
	}, []);

	function announceGrowth(result: LevelChange): boolean {
		if (result.grewTo) {
			setAnnouncement({kind: 'growth', name: state.catName, stageId: result.grewTo, level: result.leveledUpTo});
			return true;
		}

		if (result.leveledUpTo) {
			showToast(`🎉 レベルアップ！ Lv.${result.leveledUpTo}`);
		}

		return false;
	}

	function handleBath() {
		if (isBathing) {
			return;
		}

		setIsBathing(true);
		say('あわあわ〜♪ きもちいい{nya}〜');
		if (stageRef.current) {
			Effects.bubbles(stageRef.current);
		}

		let result: BathResult | null = null;
		const onRinse = () => {
			result = actions.takeBath();
			showSpeech('ぶるぶるぶる〜っ！');
		};

		const onDry = () => {
			if (stageRef.current) {
				Effects.sparkleBurst(stageRef.current);
				if (result?.isFirstToday) {
					Effects.floatText(stageRef.current, `+${result.earned}pt`);
				}
			}
		};

		const onDone = () => {
			setIsBathing(false);
			say('ぴかぴかになった{nya}！ありがと{nya}！');
			if (!result) {
				return;
			}

			const hasModal = announceGrowth(result);
			if (!result.isFirstToday) {
				showToast('✨ ぴかぴか！（ボーナスは1日1回だよ）');
			} else if (result.isWeeklyBonus && !hasModal) {
				setAnnouncement({kind: 'weekly', streak: result.nextStreak, earned: result.earned});
			} else {
				showToast(`🛁 お風呂ボーナス +${result.earned}pt（${result.nextStreak}日連続）`);
			}
		};

		const avatar = avatarRef.current;
		if (avatar) {
			avatar.playBath({onRinse, onDry, onDone});
			return;
		}

		onRinse();
		onDry();
		onDone();
	}

	function handleFeed(itemId: string) {
		const result = actions.feed(itemId);
		if (!result.isOk) {
			showSpeech(result.reason);
			return;
		}

		avatarRef.current?.eat();
		if (stageRef.current) {
			Effects.hearts(stageRef.current, 3);
		}

		say(result.isTooDirty
			? `もぐもぐ…でも汚れてて元気が出ない{nya}…（なかよし +${result.gainedXp}）`
			: `${result.item.name}おいしい{nya}！（なかよし +${result.gainedXp}）`);
		announceGrowth(result);
	}

	function handleBuy(itemId: string) {
		const result = actions.buy(itemId);
		if (!result.isOk) {
			showToast(result.reason);
			return;
		}

		const note = result.item.category === 'food' ? 'ごはんタブからあげられるよ' : 'さっそく使ってみたよ';
		showToast(`${result.item.icon} ${result.item.name}を買った！ ${note}`);
		if (result.item.category === 'accessory') {
			say('にあうか{nya}？');
		}
	}

	function handleSelectBreed(breedId: string) {
		actions.setPetBreed(breedId);
		say('よろしく{nya}！');
	}

	function handleSelectColor(colorId: string) {
		actions.setPetColor(colorId);
		say('にあう{nya}？');
	}

	function goToShop(category: ItemCategory) {
		setActiveTab('shop');
		setShopCategory(category);
	}

	return (
		<>
			<main className="app">
				<Hud />

				<section className="room">
					<div ref={containerRef} className="avatar-container">{avatarError}</div>
					<div ref={stageRef} className={`cat-stage ${dirt < 10 ? 'is-sparkling' : ''}`}>
						<div className="speech" hidden={!speech.isVisible}>{speech.text}</div>
						<svg className={`stink ${dirt < 50 ? 'is-off' : ''}`} viewBox="0 0 220 220" aria-hidden="true">
							<path d="M30 120 q-9 -9 0 -18 q9 -9 0 -18 q-9 -9 0 -18" />
							<path d="M190 120 q9 -9 0 -18 q-9 -9 0 -18 q9 -9 0 -18" />
							<path d="M200 180 q9 -8 0 -16 q-9 -8 0 -16" />
						</svg>
					</div>
				</section>

				<StatusPanel />
				<BathSection isBathing={isBathing} onBath={handleBath} />

				<nav className="tabs" role="tablist">
					{TABS.map(tab => (
						<button key={tab.id} type="button" role="tab" className={tab.id === activeTab ? 'is-active' : ''} aria-selected={tab.id === activeTab} onClick={() => setActiveTab(tab.id)}>
							{tab.label}
						</button>
					))}
				</nav>
				<section className="panel" role="tabpanel">
					{activeTab === 'food' && <FoodTab onFeed={handleFeed} onGoToShop={() => goToShop('food')} />}
					{activeTab === 'shop' && <ShopTab category={shopCategory} onChangeCategory={setShopCategory} onBuy={handleBuy} />}
					{activeTab === 'style' && <StyleTab onSelectBreed={handleSelectBreed} onSelectColor={handleSelectColor} />}
					{activeTab === 'record' && <RecordTab />}
				</section>

				{isDebugMode && <DebugPanel onAdvanced={hours => showToast(`⏩ ${hours}時間すすめたよ`)} />}
			</main>

			<div className={`toast ${toast.isVisible ? 'is-visible' : ''}`} role="status" aria-live="polite">{toast.text}</div>

			{!state.hasSeenIntro && <IntroWizard onSelectBreed={handleSelectBreed} onSelectColor={handleSelectColor} onFinish={actions.finishIntro} />}

			{announcement?.kind === 'growth' && (
				<MessageModal emoji="🌟" title={<>{announcement.name}が<br />{species.stageNames[announcement.stageId]}に成長した！</>} onClose={() => setAnnouncement(null)}>
					<p>Lv.{announcement.level} になったよ</p>
				</MessageModal>
			)}
			{announcement?.kind === 'weekly' && (
				<MessageModal emoji="🏆" title={`${announcement.streak}日連続お風呂達成！`} onClose={() => setAnnouncement(null)}>
					<p>1週間ボーナス込みで <b>+{announcement.earned}pt</b> もらったよ</p>
				</MessageModal>
			)}
		</>
	);
}
