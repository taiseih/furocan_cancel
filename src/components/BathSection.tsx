import {useGame} from '../game/GameContext';
import {formatElapsed} from '../game/lines';
import {calculateBathReward, hasBathedToday} from '../game/rules';

export function BathSection({isBathing, onBath}: {isBathing: boolean; onBath: () => void}) {
	const {state, now} = useGame();
	let note: string;
	if (hasBathedToday(state, now)) {
		note = '今日のボーナスはもらったよ（何回でも洗えるよ）';
	} else {
		const reward = calculateBathReward(state, now);
		note = `今日のボーナス +${reward.earned}pt（${reward.nextStreak}日目）${reward.isWeeklyBonus ? ' 🎉1週間ボーナス！' : ''}`;
	}

	return (
		<section className="bath">
			<button className="bath-button" type="button" disabled={isBathing} onClick={onBath}>
				<span className="bath-main">🛁 お風呂に入ったよ！</span>
				<span className="bath-sub">{note}</span>
			</button>
			<p className="last-bath">最後にお風呂に入ったのは {formatElapsed(now - state.lastBathAt)}</p>
		</section>
	);
}
