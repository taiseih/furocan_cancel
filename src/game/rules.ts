import {
	findBreed,
	findItem,
	GROWTH_STAGES,
	PET_BREEDS,
	PET_SPECIES,
	type AccessorySlot,
	type FoodItem,
	type GrowthStage,
	type GrowthStageId,
	type Item,
	type Mood,
	type PetModel,
	type RoomState,
} from './data';

// ゲームのルール。どの関数も状態を書き換えず、新しい状態を返す（React の state としてそのまま扱えるようにする）
// 時刻 now はデバッグ用のずらしを足した「ゲーム内の時刻」で、gameNow() で求める

export const SAVE_KEY = 'furoneko-save-v1';
export const HOUR_MS = 60 * 60 * 1000;
const DIRT_FULL_HOURS = 48;
const HUNGER_EMPTY_HOURS = 24;
const BATH_XP = 20;
export const BATH_BASE_POINTS = 10;
export const STREAK_BONUS_PER_DAY = 5;
export const STREAK_BONUS_MAX_DAYS = 6;
export const WEEKLY_BONUS_POINTS = 50;
const TOO_DIRTY_THRESHOLD = 80;
const FULL_HUNGER_THRESHOLD = 95;
const BATH_HISTORY_LIMIT = 60;
// 改ざんされたセーブデータで、レベル計算のループが終わらなくなったり表示が崩れたりしないようにする上限
const MAX_COUNTER = 1_000_000;
const MAX_ITEM_COUNT = 999;
export const NAME_MAX_LENGTH = 10;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// 制御文字と、文字の並びを入れ替えて見た目を偽装できる双方向テキスト制御文字
const UNSAFE_NAME_CHARS = /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

export type GameState = {
	points: number;
	streak: number;
	bestStreak: number;
	lastBathAt: number;
	lastBathDate: string | null;
	bathDates: string[];
	hungerAtFeed: number;
	lastFedAt: number;
	xp: number;
	inventory: Record<string, number>;
	owned: string[];
	equipped: Record<AccessorySlot, string | null>;
	room: RoomState;
	catName: string;
	petBreed: string;
	petColor: string;
	hasSeenIntro: boolean;
	debugOffsetMs: number;
};

// 状態を変える操作の戻り値。新しい状態と、画面に伝えたい結果
export type Outcome<Result> = {state: GameState; result: Result};

export type LevelChange = {leveledUpTo: number | null; grewTo: GrowthStageId | null};
export type BathReward = {earned: number; nextStreak: number; isWeeklyBonus: boolean};
export type BathResult = BathReward & LevelChange & {isFirstToday: boolean};
export type FeedResult = ({isOk: true; item: FoodItem; gainedXp: number; isTooDirty: boolean} & LevelChange) | {isOk: false; reason: string};
export type BuyResult = {isOk: true; item: Item} | {isOk: false; reason: string};

const DEFAULT_BREED = PET_BREEDS[0];

export function createInitialState(nowMs: number): GameState {
	return {
		points: 20,
		streak: 0,
		bestStreak: 0,
		// 初回から少し汚れた状態にして、最初のお風呂の気持ちよさを体験してもらう
		lastBathAt: nowMs - (30 * HOUR_MS),
		lastBathDate: null,
		bathDates: [],
		hungerAtFeed: 60,
		lastFedAt: nowMs,
		xp: 0,
		inventory: {'food-kibble': 3},
		owned: ['wall-default', 'floor-wood'],
		equipped: {head: null, face: null, neck: null},
		room: {wall: 'wall-default', floor: 'floor-wood', furniture: []},
		catName: DEFAULT_BREED.defaultName,
		petBreed: DEFAULT_BREED.id,
		petColor: DEFAULT_BREED.colors[0].id,
		hasSeenIntro: false,
		debugOffsetMs: 0,
	};
}

// ---------- セーブデータ ----------

type SavedData = Record<string, unknown>;

function isObject(value: unknown): value is SavedData {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// 品種を選べるようになる前のセーブデータ（ねこ / ペキニーズの2択）を品種と毛色に置き換える
function migratePetType(saved: SavedData): SavedData {
	if (!saved.petType) {
		return saved;
	}

	const {petType, ...rest} = saved;
	return {...rest, petBreed: saved.petBreed ?? (petType === 'pekingese' ? 'pekingese' : 'mix')};
}

export function sanitizeName(name: string): string {
	return name.replace(UNSAFE_NAME_CHARS, '').trim().slice(0, NAME_MAX_LENGTH);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function toCount(value: unknown, fallback: number, max = MAX_COUNTER): number {
	return isFiniteNumber(value) ? clamp(Math.floor(value), 0, max) : fallback;
}

function toTime(value: unknown, fallback: number): number {
	return isFiniteNumber(value) ? value : fallback;
}

function isItemOf(id: unknown, predicate: (item: Item) => boolean): id is string {
	const item = findItem(id);
	return item !== undefined && predicate(item);
}

function isDateKey(value: unknown): value is string {
	return typeof value === 'string' && DATE_KEY_PATTERN.test(value);
}

// localStorage の中身は利用者や拡張機能が自由に書き換えられるので、知っている項目・型・範囲の値だけを取り込む
export function sanitizeState(saved: unknown, base: GameState): GameState {
	if (!isObject(saved)) {
		return base;
	}

	const owned = Array.isArray(saved.owned)
		? [...new Set(saved.owned.filter(id => isItemOf(id, item => item.category !== 'food')))]
		: base.owned;
	const isOwnedId = (id: string) => owned.includes(id) || findItem(id)?.price === 0;

	const inventory: Record<string, number> = {};
	if (isObject(saved.inventory)) {
		for (const [id, count] of Object.entries(saved.inventory)) {
			if (isItemOf(id, item => item.category === 'food')) {
				inventory[id] = toCount(count, 0, MAX_ITEM_COUNT);
			}
		}
	}

	const equipped = {...base.equipped};
	const savedEquipped = isObject(saved.equipped) ? saved.equipped : {};
	for (const slot of Object.keys(equipped) as AccessorySlot[]) {
		const id = savedEquipped[slot];
		if (isItemOf(id, item => item.category === 'accessory' && item.slot === slot) && isOwnedId(id)) {
			equipped[slot] = id;
		}
	}

	const savedRoom = isObject(saved.room) ? saved.room : {};
	const pickRoomItem = (kind: 'wall' | 'floor') => {
		const id = savedRoom[kind];
		return isItemOf(id, item => item.category === 'room' && item.kind === kind) && isOwnedId(id) ? id : base.room[kind];
	};
	const room: RoomState = {
		wall: pickRoomItem('wall'),
		floor: pickRoomItem('floor'),
		furniture: Array.isArray(savedRoom.furniture)
			? [...new Set(savedRoom.furniture.filter(id => isItemOf(id, item => item.category === 'room' && item.kind === 'furniture') && isOwnedId(id)))]
			: [],
	};

	const breed = findBreed(saved.petBreed) ?? DEFAULT_BREED;
	const color = breed.colors.find(candidate => candidate.id === saved.petColor) ?? breed.colors[0];
	const catName = typeof saved.catName === 'string' ? sanitizeName(saved.catName) : '';

	return {
		points: toCount(saved.points, base.points),
		streak: toCount(saved.streak, base.streak),
		bestStreak: toCount(saved.bestStreak, base.bestStreak),
		lastBathAt: toTime(saved.lastBathAt, base.lastBathAt),
		lastBathDate: isDateKey(saved.lastBathDate) ? saved.lastBathDate : null,
		bathDates: Array.isArray(saved.bathDates) ? saved.bathDates.filter(isDateKey).slice(-BATH_HISTORY_LIMIT) : [],
		hungerAtFeed: isFiniteNumber(saved.hungerAtFeed) ? clamp(saved.hungerAtFeed, 0, 100) : base.hungerAtFeed,
		lastFedAt: toTime(saved.lastFedAt, base.lastFedAt),
		xp: toCount(saved.xp, base.xp),
		inventory,
		owned,
		equipped,
		room,
		catName: catName || breed.defaultName,
		petBreed: breed.id,
		petColor: color.id,
		hasSeenIntro: saved.hasSeenIntro === true,
		debugOffsetMs: toTime(saved.debugOffsetMs, 0),
	};
}

export function loadState(nowMs = Date.now()): GameState {
	const base = createInitialState(nowMs);
	try {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) {
			return base;
		}

		const saved: unknown = JSON.parse(raw);
		return sanitizeState(isObject(saved) ? migratePetType(saved) : saved, base);
	} catch {
		return base;
	}
}

export function saveState(state: GameState): void {
	try {
		localStorage.setItem(SAVE_KEY, JSON.stringify(state));
	} catch {
		// プライベートブラウズ等で保存できなくても、そのセッション中は遊べるようにする
	}
}

export function clearSave(): void {
	try {
		localStorage.removeItem(SAVE_KEY);
	} catch {
		// 保存できない環境では消すものもない
	}
}

// ---------- 状態から求める値 ----------

export function gameNow(state: GameState, realNowMs = Date.now()): number {
	return realNowMs + state.debugOffsetMs;
}

function toDateKey(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

function dateKeyDaysAgo(now: number, daysAgo: number): string {
	const date = new Date(now);
	date.setDate(date.getDate() - daysAgo);
	return toDateKey(date);
}

export function getDirt(state: GameState, now: number): number {
	const hours = (now - state.lastBathAt) / HOUR_MS;
	return clamp((hours / DIRT_FULL_HOURS) * 100, 0, 100);
}

export function getHunger(state: GameState, now: number): number {
	const hours = (now - state.lastFedAt) / HOUR_MS;
	return clamp(state.hungerAtFeed - ((hours / HUNGER_EMPTY_HOURS) * 100), 0, 100);
}

function xpForLevel(level: number): number {
	return 40 + (level * 20);
}

export type LevelInfo = {level: number; xpInLevel: number; xpForNext: number; stage: GrowthStage};

export function getLevelInfo(state: GameState): LevelInfo {
	let level = 1;
	let rest = state.xp;
	while (rest >= xpForLevel(level)) {
		rest -= xpForLevel(level);
		level++;
	}

	const stage = GROWTH_STAGES.filter(candidate => candidate.minLevel <= level).at(-1) ?? GROWTH_STAGES[0];
	return {level, xpInLevel: rest, xpForNext: xpForLevel(level), stage};
}

export function getMood(state: GameState, now: number): Mood {
	const dirt = getDirt(state, now);
	const hunger = getHunger(state, now);
	if (dirt >= 75 || hunger <= 15) {
		return 'sad';
	}

	if (dirt < 25 && hunger >= 50) {
		return 'happy';
	}

	return 'normal';
}

export function hasBathedToday(state: GameState, now: number): boolean {
	return state.lastBathDate === dateKeyDaysAgo(now, 0);
}

// 昨日も今日も入っていなければ連続記録は途切れている
export function getStreak(state: GameState, now: number): number {
	const isStreakAlive = state.lastBathDate === dateKeyDaysAgo(now, 0) || state.lastBathDate === dateKeyDaysAgo(now, 1);
	return isStreakAlive ? state.streak : 0;
}

export function calculateBathReward(state: GameState, now: number): BathReward {
	if (hasBathedToday(state, now)) {
		return {earned: 0, nextStreak: state.streak, isWeeklyBonus: false};
	}

	const nextStreak = state.lastBathDate === dateKeyDaysAgo(now, 1) ? state.streak + 1 : 1;
	const isWeeklyBonus = nextStreak % 7 === 0;
	const streakBonus = Math.min(nextStreak - 1, STREAK_BONUS_MAX_DAYS) * STREAK_BONUS_PER_DAY;
	const earned = BATH_BASE_POINTS + streakBonus + (isWeeklyBonus ? WEEKLY_BONUS_POINTS : 0);
	return {earned, nextStreak, isWeeklyBonus};
}

export function isOwned(state: GameState, itemId: string): boolean {
	return state.owned.includes(itemId);
}

export function getPet(state: GameState) {
	const breed = findBreed(state.petBreed) ?? DEFAULT_BREED;
	const color = breed.colors.find(candidate => candidate.id === state.petColor) ?? breed.colors[0];
	return {breed, color, species: PET_SPECIES[breed.species]};
}

// 3D モデルに渡す品種と毛色
export function getPetModel(state: GameState): PetModel {
	const breed = findBreed(state.petBreed) ?? DEFAULT_BREED;
	if (breed.species === 'cat') {
		const color = breed.colors.find(candidate => candidate.id === state.petColor) ?? breed.colors[0];
		return {species: 'cat', breed: breed.id, palette: color.palette};
	}

	const color = breed.colors.find(candidate => candidate.id === state.petColor) ?? breed.colors[0];
	return {species: 'dog', breed: breed.id, palette: color.palette};
}

export function getRecentBathDays(state: GameState, now: number, days: number): {key: string; hasBathed: boolean}[] {
	const bathDateSet = new Set(state.bathDates);
	return Array.from({length: days}, (_, index) => {
		const key = dateKeyDaysAgo(now, days - 1 - index);
		return {key, hasBathed: bathDateSet.has(key)};
	});
}

// ---------- 状態を変える操作 ----------

function describeLevelChange(before: GameState, after: GameState): LevelChange {
	const levelBefore = getLevelInfo(before);
	const levelAfter = getLevelInfo(after);
	return {
		leveledUpTo: levelAfter.level > levelBefore.level ? levelAfter.level : null,
		grewTo: levelAfter.stage.id === levelBefore.stage.id ? null : levelAfter.stage.id,
	};
}

export function takeBath(state: GameState, now: number): Outcome<BathResult> {
	const isFirstToday = !hasBathedToday(state, now);
	const reward = calculateBathReward(state, now);

	let next: GameState = {...state, lastBathAt: now};
	if (isFirstToday) {
		const lastBathDate = dateKeyDaysAgo(now, 0);
		next = {
			...next,
			streak: reward.nextStreak,
			bestStreak: Math.max(state.bestStreak, reward.nextStreak),
			points: state.points + reward.earned,
			xp: state.xp + BATH_XP,
			lastBathDate,
			bathDates: [...state.bathDates, lastBathDate].slice(-BATH_HISTORY_LIMIT),
		};
	}

	return {state: next, result: {isFirstToday, ...reward, ...describeLevelChange(state, next)}};
}

export function feed(state: GameState, now: number, itemId: string): Outcome<FeedResult> {
	const item = findItem(itemId);
	if (item?.category !== 'food' || !((state.inventory[itemId] ?? 0) > 0)) {
		return {state, result: {isOk: false, reason: 'ごはんがないよ'}};
	}

	const hunger = getHunger(state, now);
	if (hunger >= FULL_HUNGER_THRESHOLD) {
		return {state, result: {isOk: false, reason: 'おなかいっぱいみたい'}};
	}

	// 汚れていると元気が出ず、ごはんの効果も半分になる
	const isTooDirty = getDirt(state, now) >= TOO_DIRTY_THRESHOLD;
	const gainedXp = isTooDirty ? Math.floor(item.xp / 2) : item.xp;
	const next: GameState = {
		...state,
		inventory: {...state.inventory, [itemId]: (state.inventory[itemId] ?? 0) - 1},
		hungerAtFeed: Math.min(100, hunger + item.hunger),
		lastFedAt: now,
		xp: state.xp + gainedXp,
	};
	return {state: next, result: {isOk: true, item, gainedXp, isTooDirty, ...describeLevelChange(state, next)}};
}

export function buy(state: GameState, itemId: string): Outcome<BuyResult> {
	const item = findItem(itemId);
	if (!item) {
		return {state, result: {isOk: false, reason: 'そのアイテムは売っていないよ'}};
	}

	if (item.category !== 'food' && isOwned(state, itemId)) {
		return {state, result: {isOk: false, reason: 'もう持っているよ'}};
	}

	if (state.points < item.price) {
		return {state, result: {isOk: false, reason: 'ポイントが足りないよ'}};
	}

	const paid = {...state, points: state.points - item.price};
	if (item.category === 'food') {
		return {state: {...paid, inventory: {...state.inventory, [itemId]: (state.inventory[itemId] ?? 0) + 1}}, result: {isOk: true, item}};
	}

	const owned = [...state.owned, itemId];
	// 買ってすぐ見た目に反映されるほうが嬉しいので自動で装備・配置する
	if (item.category === 'accessory') {
		return {state: {...paid, owned, equipped: {...state.equipped, [item.slot]: itemId}}, result: {isOk: true, item}};
	}

	const room = item.kind === 'furniture'
		? {...state.room, furniture: [...state.room.furniture, itemId]}
		: {...state.room, [item.kind]: itemId};
	return {state: {...paid, owned, room}, result: {isOk: true, item}};
}

export function toggleEquip(state: GameState, itemId: string): GameState {
	const item = findItem(itemId);
	if (item?.category !== 'accessory' || !isOwned(state, itemId)) {
		return state;
	}

	return {...state, equipped: {...state.equipped, [item.slot]: state.equipped[item.slot] === itemId ? null : itemId}};
}

export function applyRoom(state: GameState, itemId: string): GameState {
	const item = findItem(itemId);
	if (item?.category !== 'room' || item.kind === 'furniture' || !isOwned(state, itemId)) {
		return state;
	}

	return {...state, room: {...state.room, [item.kind]: itemId}};
}

export function toggleFurniture(state: GameState, itemId: string): GameState {
	const item = findItem(itemId);
	if (item?.category !== 'room' || item.kind !== 'furniture' || !isOwned(state, itemId)) {
		return state;
	}

	const {furniture} = state.room;
	return {
		...state,
		room: {
			...state.room,
			furniture: furniture.includes(itemId) ? furniture.filter(id => id !== itemId) : [...furniture, itemId],
		},
	};
}

export function rename(state: GameState, name: string): GameState {
	const trimmed = sanitizeName(name);
	return trimmed ? {...state, catName: trimmed} : state;
}

export function setPetBreed(state: GameState, breedId: string): GameState {
	const breed = findBreed(breedId);
	if (!breed || state.petBreed === breedId) {
		return state;
	}

	// 名前を変えていなければ、新しい品種のデフォルトの名前にする
	const isDefaultName = PET_BREEDS.some(candidate => candidate.defaultName === state.catName);
	return {
		...state,
		catName: isDefaultName ? breed.defaultName : state.catName,
		petBreed: breedId,
		petColor: breed.colors[0].id,
	};
}

export function setPetColor(state: GameState, colorId: string): GameState {
	if (!getPet(state).breed.colors.some(color => color.id === colorId)) {
		return state;
	}

	return {...state, petColor: colorId};
}

export function markIntroSeen(state: GameState): GameState {
	return state.hasSeenIntro ? state : {...state, hasSeenIntro: true};
}

export function debugAdvance(state: GameState, hours: number): GameState {
	return {...state, debugOffsetMs: state.debugOffsetMs + (hours * HOUR_MS)};
}
