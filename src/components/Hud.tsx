import {useGame} from '../game/GameContext';
import {getLevelInfo, getPet, getStreak} from '../game/rules';

export function Hud() {
	const {state, now, actions} = useGame();
	const {breed, species} = getPet(state);
	const levelInfo = getLevelInfo(state);

	function handleRename() {
		const name = prompt(`${breed.name}の名前を入力してね（10文字まで）`, state.catName);
		if (name !== null) {
			actions.rename(name);
		}
	}

	return (
		<header className="hud">
			<div className="hud-name">
				<button className="cat-name" type="button" title="なまえを変える" onClick={handleRename}>{state.catName}</button>
				<span className="badge">Lv.{levelInfo.level}</span>
				<span className="badge badge-stage">{species.stageNames[levelInfo.stage.id]}</span>
			</div>
			<div className="hud-counters">
				<div className="counter"><span aria-hidden="true">💰</span><b>{state.points}</b>pt</div>
				<div className="counter"><span aria-hidden="true">🔥</span><b>{getStreak(state, now)}</b>日連続</div>
			</div>
		</header>
	);
}
