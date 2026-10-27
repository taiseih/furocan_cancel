import {useGame} from '../../game/GameContext';
import {BATH_BASE_POINTS, getRecentBathDays, getStreak, STREAK_BONUS_MAX_DAYS, STREAK_BONUS_PER_DAY, WEEKLY_BONUS_POINTS} from '../../game/rules';

const RECORD_DAYS = 14;

export function RecordTab() {
	const {state, now} = useGame();
	return (
		<>
			<h3>📅 さいきん{RECORD_DAYS}日のお風呂</h3>
			<div className="calendar">
				{getRecentBathDays(state, now, RECORD_DAYS).map(day => {
					const [, month, date] = day.key.split('-');
					return (
						<div key={day.key} className={`day ${day.hasBathed ? 'is-bathed' : ''}`}>
							<span>{Number(month)}/{Number(date)}</span>
							<b>{day.hasBathed ? '🛁' : '・'}</b>
						</div>
					);
				})}
			</div>
			<div className="stats">
				<div><span>いまの連続</span><b>{getStreak(state, now)}日</b></div>
				<div><span>さいこう連続</span><b>{state.bestStreak}日</b></div>
				<div><span>お風呂に入った日</span><b>{state.bathDates.length}日</b></div>
			</div>
			<p className="hint">毎日入ると連続ボーナスが増えるよ（最大 +{BATH_BASE_POINTS + (STREAK_BONUS_MAX_DAYS * STREAK_BONUS_PER_DAY)}pt/日）。7日ごとに +{WEEKLY_BONUS_POINTS}pt！</p>
		</>
	);
}
