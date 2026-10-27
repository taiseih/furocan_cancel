import {useState, type FormEvent} from 'react';
import {useGame} from '../game/GameContext';
import {getPet, NAME_MAX_LENGTH, sanitizeName} from '../game/rules';
import {Modal} from './Modal';
import {BreedPicker, ColorPicker} from './PetPicker';

const STEPS = ['welcome', 'breed', 'color', 'name'] as const;
type Step = (typeof STEPS)[number];

const STEP_TITLES: Record<Step, string> = {
	welcome: 'ふろねこへようこそ！',
	breed: '育てるペットをえらんでね',
	color: '毛色をえらんでね',
	name: 'なまえをつけてね',
};

const NAME_FORM_ID = 'intro-name-form';

// はじめて遊ぶときの説明とペット選び。スマホでも1画面に収まるよう、1ステップずつ進める
export function IntroWizard({onSelectBreed, onSelectColor, onFinish}: {
	onSelectBreed: (breedId: string) => void;
	onSelectColor: (colorId: string) => void;
	onFinish: () => void;
}) {
	const {state, actions} = useGame();
	const [stepIndex, setStepIndex] = useState(0);
	// 入力するまでは今の名前（品種を変えるとその品種のデフォルトの名前）を出す
	const [nameInput, setNameInput] = useState<string | null>(null);
	const name = nameInput ?? state.catName;
	const step = STEPS[stepIndex] ?? 'welcome';
	const isLastStep = stepIndex === STEPS.length - 1;
	const pet = getPet(state);

	function goNext() {
		setStepIndex(index => Math.min(index + 1, STEPS.length - 1));
	}

	function finish(event?: FormEvent) {
		event?.preventDefault();
		actions.rename(name);
		onFinish();
	}

	const canFinish = sanitizeName(name) !== '';
	const footer = (
		<div className="wizard-nav">
			{stepIndex > 0 && (
				<button className="btn btn-secondary" type="button" onClick={() => setStepIndex(index => Math.max(index - 1, 0))}>もどる</button>
			)}
			{/* key を分けておかないと、押した「つぎへ」がその場で送信ボタンに変わり、同じクリックで送信まで進んでしまう */}
			{isLastStep
				? <button key="finish" className="btn btn-primary" type="submit" form={NAME_FORM_ID} disabled={!canFinish}>はじめる！</button>
				: <button key="next" className="btn btn-primary" type="button" onClick={goNext}>つぎへ</button>}
		</div>
	);

	return (
		<Modal labelledBy="intro-title" footer={footer} placement="bottom">
			<ol className="wizard-steps" aria-label={`ステップ ${stepIndex + 1} / ${STEPS.length}`}>
				{STEPS.map((candidate, index) => (
					<li key={candidate} className={index === stepIndex ? 'is-current' : (index < stepIndex ? 'is-done' : '')} />
				))}
			</ol>
			{step === 'welcome' && <div className="modal-emoji">🐱🐶🛁</div>}
			<h2 id="intro-title">{STEP_TITLES[step]}</h2>

			{step === 'welcome' && (
				<>
					<p>この子は <b>あなたがお風呂に入らないと</b> どんどん汚れていっちゃうよ。</p>
					<p>お風呂に入ったら「お風呂に入ったよ！」ボタンを押してね。この子もぴかぴかになるよ✨</p>
					<p>毎日入るとボーナスポイント！ごはん・アクセサリー・模様替えと交換して育てよう。</p>
				</>
			)}

			{step === 'breed' && (
				<>
					<p className="wizard-hint">あとから「✨ コーデ」でかえられるよ</p>
					<div className="pet-chooser">
						<BreedPicker onSelect={onSelectBreed} />
					</div>
				</>
			)}

			{step === 'color' && (
				<>
					<p className="wizard-hint">{pet.breed.icon} {pet.breed.name}・{pet.color.name}</p>
					<div className="pet-chooser">
						<ColorPicker onSelect={onSelectColor} />
					</div>
				</>
			)}

			{step === 'name' && (
				<form id={NAME_FORM_ID} className="name-form" onSubmit={finish}>
					<p className="wizard-hint">{pet.breed.icon} {pet.breed.name}・{pet.color.name}</p>
					<input
						className="name-input"
						type="text"
						value={name}
						maxLength={NAME_MAX_LENGTH}
						aria-label="ペットのなまえ"
						placeholder={pet.breed.defaultName}
						onChange={event => setNameInput(event.target.value)}
					/>
					<p className="wizard-hint">あとから名前をタップして変えられるよ</p>
				</form>
			)}
		</Modal>
	);
}
