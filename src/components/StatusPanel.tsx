import {useGame} from '../game/GameContext';
import {getCleanLabel} from '../game/lines';
import {getDirt, getHunger, getLevelInfo} from '../game/rules';

function StatusBar({label, barClassName, percent, text}: {label: string; barClassName: string; percent: number; text: string}) {
	return (
		<div className="status-row">
			<span className="status-label">{label}</span>
			<div className="bar">
				<div className={`bar-fill ${barClassName}`} data-level={percent < 25 ? 'low' : (percent < 60 ? 'mid' : 'high')} style={{width: `${percent}%`}} />
			</div>
			<span className="status-value">{text}</span>
		</div>
	);
}

export function StatusPanel() {
	const {state, now} = useGame();
	const dirt = getDirt(state, now);
	const hunger = getHunger(state, now);
	const levelInfo = getLevelInfo(state);
	return (
		<section className="status" aria-label="ステータス">
			<StatusBar label="🫧 きれい度" barClassName="bar-clean" percent={100 - dirt} text={getCleanLabel(dirt)} />
			<StatusBar label="🍚 おなか" barClassName="bar-hunger" percent={hunger} text={`${Math.round(hunger)}%`} />
			<StatusBar label="💗 なかよし" barClassName="bar-xp" percent={(levelInfo.xpInLevel / levelInfo.xpForNext) * 100} text={`${levelInfo.xpInLevel}/${levelInfo.xpForNext}`} />
		</section>
	);
}
