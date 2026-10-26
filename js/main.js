import {createCatAvatar} from './cat3d/avatar.js';

(() => {
	const TICK_MS = 30 * 1000;
	const SPEECH_DURATION_MS = 3500;
	const TOAST_DURATION_MS = 2600;
	const RECORD_DAYS = 14;

	let avatar = null;
	const ui = {activeTab: 'food', shopCategory: 'food', isBathing: false, speechTimerId: null, toastTimerId: null};

	const byId = id => document.getElementById(id);
	const elements = {
		points: byId('points'),
		streak: byId('streak'),
		catName: byId('catName'),
		levelLabel: byId('levelLabel'),
		stageLabel: byId('stageLabel'),
		cleanBar: byId('cleanBar'),
		cleanValue: byId('cleanValue'),
		hungerBar: byId('hungerBar'),
		hungerValue: byId('hungerValue'),
		xpBar: byId('xpBar'),
		xpValue: byId('xpValue'),
		bathButton: byId('bathButton'),
		bathSub: byId('bathSub'),
		lastBath: byId('lastBath'),
		room: byId('room'),
		furnitureLayer: byId('furnitureLayer'),
		avatarContainer: byId('avatarContainer'),
		catStage: byId('catStage'),
		stink: byId('stink'),
		speech: byId('speech'),
		tabs: byId('tabs'),
		panelBody: byId('panelBody'),
		toast: byId('toast'),
		modal: byId('modal'),
		modalBody: byId('modalBody'),
		modalClose: byId('modalClose'),
		debugPanel: byId('debugPanel'),
	};

	function escapeHtml(text) {
		return String(text).replace(/[&<>"']/g, char => `&#${char.codePointAt(0)};`);
	}

	function formatElapsed(ms) {
		const hours = Math.floor(ms / HOUR_MS);
		if (hours < 1) {
			return 'さっき';
		}

		if (hours < 24) {
			return `${hours}時間前`;
		}

		return `${Math.floor(hours / 24)}日${hours % 24}時間前`;
	}

	function getCleanLabel(dirt) {
		if (dirt < 15) {
			return 'ぴかぴか';
		}

		if (dirt < 40) {
			return 'きれい';
		}

		if (dirt < 65) {
			return 'ちょい汚れ';
		}

		if (dirt < 85) {
			return 'よごれ';
		}

		return 'どろどろ';
	}

	function getCatLine() {
		const dirt = Game.getDirt();
		const hunger = Game.getHunger();
		if (dirt >= 85) {
			return 'くさいにゃ…かゆいにゃ…お風呂入ってほしいにゃ…';
		}

		if (dirt >= 60) {
			return 'からだがベタベタするにゃ…';
		}

		if (hunger <= 20) {
			return 'おなかすいたにゃ〜';
		}

		if (dirt < 15) {
			return 'ぴかぴかで気分いいにゃ！';
		}

		return ['にゃーん', 'なでてくれるのにゃ？', 'ごろごろ…'][Math.floor(Math.random() * 3)];
	}

	function setBar(bar, label, percent, text) {
		bar.style.width = `${percent}%`;
		bar.dataset.level = percent < 25 ? 'low' : (percent < 60 ? 'mid' : 'high');
		label.textContent = text;
	}

	function renderCat(dirt, levelInfo) {
		elements.stink.classList.toggle('is-off', dirt < 50);
		elements.catStage.classList.toggle('is-sparkling', dirt < 10);
		avatar?.setState({
			dirt: dirt / 100,
			mood: Game.getMood(),
			scale: levelInfo.stage.scale,
			equippedIds: new Set(Object.values(Game.state.equipped)),
		});
	}

	function renderRoom() {
		const {room} = Game.state;
		elements.room.dataset.wall = room.wall;
		elements.room.dataset.floor = room.floor;
		elements.furnitureLayer.innerHTML = room.furniture
			.map(id => `<span class="furniture ${id}" title="${escapeHtml(ITEM_BY_ID[id].name)}">${ITEM_BY_ID[id].icon}</span>`)
			.join('');
	}

	function renderBathButton() {
		if (Game.hasBathedToday()) {
			elements.bathSub.textContent = '今日のボーナスはもらったよ（何回でも洗えるよ）';
			return;
		}

		const reward = Game.calculateBathReward();
		const weeklyNote = reward.isWeeklyBonus ? ' 🎉1週間ボーナス！' : '';
		elements.bathSub.textContent = `今日のボーナス +${reward.earned}pt（${reward.nextStreak}日目）${weeklyNote}`;
	}

	function renderStatus() {
		const {state} = Game;
		const dirt = Game.getDirt();
		const hunger = Game.getHunger();
		const levelInfo = Game.getLevelInfo();

		elements.points.textContent = state.points;
		elements.streak.textContent = Game.getStreak();
		elements.catName.textContent = state.catName;
		elements.levelLabel.textContent = `Lv.${levelInfo.level}`;
		elements.stageLabel.textContent = levelInfo.stage.name;

		setBar(elements.cleanBar, elements.cleanValue, 100 - dirt, getCleanLabel(dirt));
		setBar(elements.hungerBar, elements.hungerValue, hunger, `${Math.round(hunger)}%`);
		setBar(elements.xpBar, elements.xpValue, (levelInfo.xpInLevel / levelInfo.xpForNext) * 100, `${levelInfo.xpInLevel}/${levelInfo.xpForNext}`);

		elements.lastBath.textContent = `最後にお風呂に入ったのは ${formatElapsed(Game.now() - state.lastBathAt)}`;
		renderBathButton();
		renderCat(dirt, levelInfo);
		renderRoom();
	}

	function renderItemCard(item, actionHtml, extraClass = '') {
		return `
			<div class="item-card ${extraClass}">
				<div class="item-icon">${item.icon}</div>
				<div class="item-info">
					<div class="item-name">${escapeHtml(item.name)}</div>
					<div class="item-desc">${escapeHtml(item.description)}</div>
				</div>
				${actionHtml}
			</div>`;
	}

	function renderFoodTab() {
		const foods = ITEM_CATALOG.filter(item => item.category === 'food' && Game.state.inventory[item.id] > 0);
		if (foods.length === 0) {
			return '<p class="empty">ごはんがないよ。<button type="button" class="link" data-action="goto-shop" data-category="food">ショップで買おう</button></p>';
		}

		return foods.map(item => renderItemCard(
			item,
			`<button type="button" class="btn btn-primary" data-action="feed" data-id="${item.id}">あげる <small>×${Game.state.inventory[item.id]}</small></button>`,
		)).join('');
	}

	function renderShopTab() {
		const chips = SHOP_CATEGORIES.map(category => `
			<button type="button" class="chip ${category.id === ui.shopCategory ? 'is-active' : ''}" data-action="shop-category" data-category="${category.id}">${category.label}</button>`).join('');

		const items = ITEM_CATALOG
			.filter(item => item.category === ui.shopCategory && item.price > 0)
			.map(item => {
				const isOwnedItem = item.category !== 'food' && Game.isOwned(item.id);
				const canAfford = Game.state.points >= item.price;
				const label = isOwnedItem ? '持ってる' : `${item.price}pt`;
				const ownedCount = item.category === 'food' ? (Game.state.inventory[item.id] ?? 0) : 0;
				const countNote = ownedCount > 0 ? `<small class="owned-count">所持 ${ownedCount}</small>` : '';
				return renderItemCard(
					item,
					`<div class="buy-area">${countNote}<button type="button" class="btn btn-buy" data-action="buy" data-id="${item.id}" ${isOwnedItem || !canAfford ? 'disabled' : ''}>${label}</button></div>`,
					isOwnedItem ? 'is-owned' : '',
				);
			})
			.join('');

		return `<div class="chips">${chips}</div>${items}`;
	}

	function renderToggleGrid(items, isActive, action) {
		return `<div class="toggle-grid">${items.map(item => `
			<button type="button" class="toggle ${isActive(item) ? 'is-active' : ''}" data-action="${action}" data-id="${item.id}">
				<span class="toggle-icon">${item.icon}</span><span>${escapeHtml(item.name)}</span>
			</button>`).join('')}</div>`;
	}

	function renderStyleTab() {
		const {state} = Game;
		const ownedItems = ITEM_CATALOG.filter(item => Game.isOwned(item.id));
		const accessories = ownedItems.filter(item => item.category === 'accessory');
		const sections = [];

		for (const slot of ACCESSORY_SLOTS) {
			const slotItems = accessories.filter(item => item.slot === slot.id);
			if (slotItems.length > 0) {
				sections.push(`<h3>🎀 ${slot.label}</h3>${renderToggleGrid(slotItems, item => state.equipped[slot.id] === item.id, 'equip')}`);
			}
		}

		if (accessories.length === 0) {
			sections.push('<p class="empty">アクセサリーはショップで買えるよ</p>');
		}

		for (const [kind, label] of [['wall', '🧱 壁紙'], ['floor', '🟫 床']]) {
			const kindItems = ownedItems.filter(item => item.kind === kind);
			sections.push(`<h3>${label}</h3>${renderToggleGrid(kindItems, item => state.room[kind] === item.id, 'room')}`);
		}

		const furniture = ownedItems.filter(item => item.kind === 'furniture');
		sections.push(`<h3>🪑 家具</h3>${furniture.length > 0
			? renderToggleGrid(furniture, item => state.room.furniture.includes(item.id), 'furniture')
			: '<p class="empty">家具はショップの「模様替え」で買えるよ</p>'}`);

		return sections.join('');
	}

	function renderRecordTab() {
		const {state} = Game;
		const days = Game.getRecentBathDays(RECORD_DAYS);
		const calendar = days.map(day => {
			const [, month, date] = day.key.split('-');
			return `<div class="day ${day.hasBathed ? 'is-bathed' : ''}"><span>${Number(month)}/${Number(date)}</span><b>${day.hasBathed ? '🛁' : '・'}</b></div>`;
		}).join('');

		return `
			<h3>📅 さいきん${RECORD_DAYS}日のお風呂</h3>
			<div class="calendar">${calendar}</div>
			<div class="stats">
				<div><span>いまの連続</span><b>${Game.getStreak()}日</b></div>
				<div><span>さいこう連続</span><b>${state.bestStreak}日</b></div>
				<div><span>お風呂に入った日</span><b>${state.bathDates.length}日</b></div>
			</div>
			<p class="hint">毎日入ると連続ボーナスが増えるよ（最大 +${BATH_BASE_POINTS + (STREAK_BONUS_MAX_DAYS * STREAK_BONUS_PER_DAY)}pt/日）。7日ごとに +${WEEKLY_BONUS_POINTS}pt！</p>`;
	}

	const TAB_RENDERERS = {food: renderFoodTab, shop: renderShopTab, style: renderStyleTab, record: renderRecordTab};

	function renderPanel() {
		for (const tab of elements.tabs.querySelectorAll('[data-tab]')) {
			const isActive = tab.dataset.tab === ui.activeTab;
			tab.classList.toggle('is-active', isActive);
			tab.setAttribute('aria-selected', String(isActive));
		}

		elements.panelBody.innerHTML = TAB_RENDERERS[ui.activeTab]();
	}

	function renderAll() {
		renderStatus();
		renderPanel();
	}

	function showSpeech(text) {
		elements.speech.textContent = text;
		elements.speech.hidden = false;
		clearTimeout(ui.speechTimerId);
		ui.speechTimerId = setTimeout(() => {
			elements.speech.hidden = true;
		}, SPEECH_DURATION_MS);
	}

	function showToast(text) {
		elements.toast.textContent = text;
		elements.toast.classList.add('is-visible');
		clearTimeout(ui.toastTimerId);
		ui.toastTimerId = setTimeout(() => elements.toast.classList.remove('is-visible'), TOAST_DURATION_MS);
	}

	function showModal(html) {
		elements.modalBody.innerHTML = html;
		elements.modal.hidden = false;
		elements.modalClose.focus();
	}

	function closeModal() {
		elements.modal.hidden = true;
		if (!Game.state.hasSeenIntro) {
			Game.markIntroSeen();
		}
	}

	function announceGrowth(result) {
		if (result.grewTo) {
			showModal(`<div class="modal-emoji">🌟</div><h2>${escapeHtml(Game.state.catName)}が<br>${result.grewTo}に成長した！</h2><p>Lv.${result.leveledUpTo} になったよ</p>`);
			return true;
		}

		if (result.leveledUpTo) {
			showToast(`🎉 レベルアップ！ Lv.${result.leveledUpTo}`);
		}

		return false;
	}

	function handleBath() {
		if (ui.isBathing) {
			return;
		}

		ui.isBathing = true;
		elements.bathButton.disabled = true;
		showSpeech('あわあわ〜♪ きもちいいにゃ〜');
		Effects.bubbles(elements.catStage);
		let result = null;

		const onRinse = () => {
			result = Game.takeBath();
			renderAll();
			showSpeech('ぶるぶるぶる〜っ！');
		};

		const onDry = () => {
			Effects.sparkleBurst(elements.catStage);
			if (result.isFirstToday) {
				Effects.floatText(elements.catStage, `+${result.earned}pt`);
			}
		};

		const onDone = () => {
			ui.isBathing = false;
			elements.bathButton.disabled = false;
			showSpeech('ぴかぴかになったにゃ！ありがとにゃ！');

			const hasModal = announceGrowth(result);
			if (!result.isFirstToday) {
				showToast('✨ ぴかぴか！（ボーナスは1日1回だよ）');
			} else if (result.isWeeklyBonus && !hasModal) {
				showModal(`<div class="modal-emoji">🏆</div><h2>${result.nextStreak}日連続お風呂達成！</h2><p>1週間ボーナス込みで <b>+${result.earned}pt</b> もらったよ</p>`);
			} else {
				showToast(`🛁 お風呂ボーナス +${result.earned}pt（${result.nextStreak}日連続）`);
			}
		};

		if (avatar) {
			avatar.playBath({onRinse, onDry, onDone});
			return;
		}

		onRinse();
		onDry();
		onDone();
	}

	function handleFeed(itemId) {
		const result = Game.feed(itemId);
		if (!result.isOk) {
			showSpeech(result.reason);
			return;
		}

		renderAll();
		avatar?.eat();
		Effects.hearts(elements.catStage, 3);
		showSpeech(result.isTooDirty
			? `もぐもぐ…でも汚れてて元気が出ないにゃ…（なかよし +${result.gainedXp}）`
			: `${result.item.name}おいしいにゃ！（なかよし +${result.gainedXp}）`);
		announceGrowth(result);
	}

	function handleBuy(itemId) {
		const result = Game.buy(itemId);
		if (!result.isOk) {
			showToast(result.reason);
			return;
		}

		renderAll();
		const note = result.item.category === 'food' ? 'ごはんタブからあげられるよ' : 'さっそく使ってみたよ';
		showToast(`${result.item.icon} ${result.item.name}を買った！ ${note}`);
		if (result.item.category === 'accessory') {
			showSpeech('にあうかにゃ？');
		}
	}

	function handlePanelClick(event) {
		const target = event.target.closest('[data-action]');
		if (!target) {
			return;
		}

		const {action, id, category} = target.dataset;
		switch (action) {
			case 'feed': {
				handleFeed(id);
				break;
			}

			case 'buy': {
				handleBuy(id);
				break;
			}

			case 'shop-category':
			case 'goto-shop': {
				ui.activeTab = 'shop';
				ui.shopCategory = category;
				renderPanel();
				break;
			}

			case 'equip': {
				Game.toggleEquip(id);
				renderAll();
				break;
			}

			case 'room': {
				Game.applyRoom(id);
				renderAll();
				break;
			}

			case 'furniture': {
				Game.toggleFurniture(id);
				renderAll();
				break;
			}

			default: {
				break;
			}
		}
	}

	function handlePet() {
		if (ui.isBathing) {
			return;
		}

		Effects.hearts(elements.catStage);
		showSpeech(getCatLine());
		avatar?.pet();
	}

	function handleRename() {
		const name = prompt('ねこの名前を入力してね（10文字まで）', Game.state.catName);
		if (name !== null) {
			Game.rename(name);
			renderStatus();
		}
	}

	function handleDebug(event) {
		const value = event.target.dataset.debug;
		if (!value) {
			return;
		}

		if (value === 'reset') {
			if (confirm('セーブデータを消して最初からにしますか？')) {
				Game.reset();
				location.reload();
			}

			return;
		}

		Game.debugAdvance(Number(value));
		renderAll();
		showToast(`⏩ ${value}時間すすめたよ`);
	}

	function showIntro() {
		showModal(`
			<div class="modal-emoji">🐱🛁</div>
			<h2>ふろねこへようこそ！</h2>
			<p>このねこは <b>あなたがお風呂に入らないと</b> どんどん汚れていっちゃうよ。</p>
			<p>お風呂に入ったら「お風呂に入ったよ！」ボタンを押してね。ねこもぴかぴかになるよ✨</p>
			<p>毎日入るとボーナスポイント！ごはん・アクセサリー・模様替えと交換して育てよう。</p>`);
	}

	elements.bathButton.addEventListener('click', handleBath);
	elements.panelBody.addEventListener('click', handlePanelClick);
	elements.tabs.addEventListener('click', event => {
		const tab = event.target.closest('[data-tab]');
		if (tab) {
			ui.activeTab = tab.dataset.tab;
			renderPanel();
		}
	});
	elements.catName.addEventListener('click', handleRename);
	elements.modalClose.addEventListener('click', closeModal);
	elements.debugPanel.addEventListener('click', handleDebug);
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) {
			renderStatus();
		}
	});

	try {
		avatar = createCatAvatar(elements.avatarContainer, {onPet: handlePet});
	} catch (error) {
		// WebGL が使えない環境でもゲーム自体は遊べるようにする
		console.error(error);
		elements.avatarContainer.textContent = 'この端末では3Dのねこを表示できませんでした';
	}

	const isDebugMode = new URLSearchParams(location.search).has('debug');
	elements.debugPanel.hidden = !isDebugMode;
	if (isDebugMode) {
		window.catAvatar = avatar;
	}
	renderAll();
	setInterval(renderStatus, TICK_MS);

	if (Game.state.hasSeenIntro) {
		setTimeout(() => showSpeech(getCatLine()), 600);
	} else {
		showIntro();
	}
})();
