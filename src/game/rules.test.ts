import {describe, expect, it} from 'vitest';
import {buy, createInitialState, feed, HOUR_MS, sanitizeState, setPetBreed, takeBath, type GameState} from './rules';

const NOW = new Date(2026, 9, 27, 12).getTime();
const DAY_MS = 24 * HOUR_MS;

function stateWith(overrides: Partial<GameState>): GameState {
	return {...createInitialState(NOW), ...overrides};
}

describe('takeBath', () => {
	it('その日最初のお風呂だけポイントと連続日数が増え、元の状態は変えない', () => {
		const initial = stateWith({});
		const first = takeBath(initial, NOW);
		expect(first.result).toMatchObject({isFirstToday: true, earned: 10, nextStreak: 1});
		expect(first.state.points).toBe(initial.points + 10);
		expect(initial.lastBathDate).toBeNull();

		const second = takeBath(first.state, NOW + HOUR_MS);
		expect(second.result.isFirstToday).toBe(false);
		expect(second.state.points).toBe(first.state.points);
	});

	it('7日連続で1週間ボーナスがもらえる', () => {
		let state = stateWith({});
		for (let day = 0; day < 6; day++) {
			state = takeBath(state, NOW + (day * DAY_MS)).state;
		}

		const {result} = takeBath(state, NOW + (6 * DAY_MS));
		expect(result).toMatchObject({nextStreak: 7, isWeeklyBonus: true, earned: 10 + 30 + 50});
	});
});

describe('feed', () => {
	it('とても汚れているとなかよしが半分になる', () => {
		const dirty = stateWith({lastBathAt: NOW - (48 * HOUR_MS), hungerAtFeed: 10, lastFedAt: NOW, inventory: {'food-snack': 1}});
		const {result} = feed(dirty, NOW, 'food-snack');
		expect(result).toMatchObject({isOk: true, isTooDirty: true, gainedXp: 7});
	});

	it('ごはんを持っていなければあげられない', () => {
		const {state, result} = feed(stateWith({inventory: {}}), NOW, 'food-kibble');
		expect(result).toEqual({isOk: false, reason: 'ごはんがないよ'});
		expect(state.inventory).toEqual({});
	});
});

describe('buy', () => {
	it('アクセサリーは買うとすぐ装備される', () => {
		const {state, result} = buy(stateWith({points: 100}), 'acc-ribbon');
		expect(result.isOk).toBe(true);
		expect(state.points).toBe(70);
		expect(state.equipped.head).toBe('acc-ribbon');
	});

	it('ポイントが足りなければ買えない', () => {
		expect(buy(stateWith({points: 0}), 'acc-crown').result).toEqual({isOk: false, reason: 'ポイントが足りないよ'});
	});
});

describe('setPetBreed', () => {
	it('名前を変えていなければ品種のデフォルトの名前になり、毛色は最初の色になる', () => {
		const state = setPetBreed(stateWith({petColor: 'black'}), 'shiba');
		expect(state).toMatchObject({petBreed: 'shiba', petColor: 'red', catName: 'コタロウ'});
	});

	it('名前を変えていればそのまま', () => {
		expect(setPetBreed(stateWith({catName: 'ポチ'}), 'shiba').catName).toBe('ポチ');
	});
});

describe('sanitizeState', () => {
	it('知らない項目・型・範囲外の値は取り込まない', () => {
		const base = createInitialState(NOW);
		const state = sanitizeState({
			points: -5,
			xp: Number.POSITIVE_INFINITY,
			owned: ['acc-crown', 'food-kibble', '__proto__'],
			equipped: {head: 'acc-crown', face: 'acc-glasses'},
			petBreed: 'unknown',
			catName: 'た‮ま\u0000',
			hasSeenIntro: 'yes',
		}, base);

		expect(state.points).toBe(0);
		expect(state.xp).toBe(base.xp);
		expect(state.owned).toEqual(['acc-crown']);
		expect(state.equipped).toEqual({head: 'acc-crown', face: null, neck: null});
		expect(state.petBreed).toBe('mix');
		expect(state.catName).toBe('たま');
		expect(state.hasSeenIntro).toBe(false);
	});
});
