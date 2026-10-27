import {createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import * as rules from './rules';
import type {GameState, Outcome} from './rules';

// きれい度・おなかは時間で変わるので、表示用の時刻をこの間隔で進める
const TICK_MS = 30 * 1000;

export type GameActions = {
	takeBath(): rules.BathResult;
	feed(itemId: string): rules.FeedResult;
	buy(itemId: string): rules.BuyResult;
	toggleEquip(itemId: string): void;
	applyRoom(itemId: string): void;
	toggleFurniture(itemId: string): void;
	rename(name: string): void;
	setPetBreed(breedId: string): void;
	setPetColor(colorId: string): void;
	finishIntro(): void;
	debugAdvance(hours: number): void;
	reset(): void;
};

type GameContextValue = {
	state: GameState;
	// ゲーム内の現在時刻（デバッグで進めた分を含む）
	now: number;
	actions: GameActions;
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({children}: {children: ReactNode}) {
	const [state, setState] = useState(() => rules.loadState());
	const [realNow, setRealNow] = useState(() => Date.now());
	// 操作の結果（ポイントが足りない等）をその場で返すため、最新の状態を ref にも持つ
	const stateRef = useRef(state);

	useEffect(() => {
		rules.saveState(state);
	}, [state]);

	useEffect(() => {
		const refresh = () => setRealNow(Date.now());
		const intervalId = setInterval(refresh, TICK_MS);
		const onVisibilityChange = () => {
			if (!document.hidden) {
				refresh();
			}
		};

		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			clearInterval(intervalId);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	}, []);

	const actions = useMemo<GameActions>(() => {
		function commit(next: GameState) {
			if (next !== stateRef.current) {
				stateRef.current = next;
				setState(next);
			}

			setRealNow(Date.now());
		}

		function run<Result>(operation: (current: GameState, now: number) => Outcome<Result>): Result {
			const current = stateRef.current;
			const {state: next, result} = operation(current, rules.gameNow(current));
			commit(next);
			return result;
		}

		function update(operation: (current: GameState) => GameState) {
			commit(operation(stateRef.current));
		}

		return {
			takeBath: () => run(rules.takeBath),
			feed: itemId => run((current, now) => rules.feed(current, now, itemId)),
			buy: itemId => run(current => rules.buy(current, itemId)),
			toggleEquip: itemId => update(current => rules.toggleEquip(current, itemId)),
			applyRoom: itemId => update(current => rules.applyRoom(current, itemId)),
			toggleFurniture: itemId => update(current => rules.toggleFurniture(current, itemId)),
			rename: name => update(current => rules.rename(current, name)),
			setPetBreed: breedId => update(current => rules.setPetBreed(current, breedId)),
			setPetColor: colorId => update(current => rules.setPetColor(current, colorId)),
			finishIntro: () => update(rules.markIntroSeen),
			debugAdvance: hours => update(current => rules.debugAdvance(current, hours)),
			reset() {
				rules.clearSave();
				commit(rules.createInitialState(Date.now()));
			},
		};
	}, []);

	const now = rules.gameNow(state, realNow);
	const value = useMemo(() => ({state, now, actions}), [state, now, actions]);
	return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
	const value = useContext(GameContext);
	if (!value) {
		throw new Error('useGame は GameProvider の中で使ってください');
	}

	return value;
}
