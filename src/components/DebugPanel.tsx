import {useGame} from '../game/GameContext';

export function DebugPanel({onAdvanced}: {onAdvanced: (hours: number) => void}) {
	const {actions} = useGame();

	function advance(hours: number) {
		actions.debugAdvance(hours);
		onAdvanced(hours);
	}

	function reset() {
		if (confirm('セーブデータを消して最初からにしますか？')) {
			actions.reset();
			location.reload();
		}
	}

	return (
		<div className="debug">
			<span>🛠 デバッグ:</span>
			<button type="button" onClick={() => advance(6)}>+6時間</button>
			<button type="button" onClick={() => advance(24)}>+1日</button>
			<button type="button" onClick={reset}>リセット</button>
		</div>
	);
}
