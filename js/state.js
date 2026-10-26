'use strict';

const SAVE_KEY = 'furoneko-save-v1';
const HOUR_MS = 60 * 60 * 1000;
const DIRT_FULL_HOURS = 48;
const HUNGER_EMPTY_HOURS = 24;
const BATH_XP = 20;
const BATH_BASE_POINTS = 10;
const STREAK_BONUS_PER_DAY = 5;
const STREAK_BONUS_MAX_DAYS = 6;
const WEEKLY_BONUS_POINTS = 50;
const TOO_DIRTY_THRESHOLD = 80;
const FULL_HUNGER_THRESHOLD = 95;
const BATH_HISTORY_LIMIT = 60;
// 改ざんされたセーブデータで、レベル計算のループが終わらなくなったり表示が崩れたりしないようにする上限
const MAX_COUNTER = 1_000_000;
const MAX_ITEM_COUNT = 999;
const NAME_MAX_LENGTH = 10;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// 制御文字と、文字の並びを入れ替えて見た目を偽装できる双方向テキスト制御文字
const UNSAFE_NAME_CHARS = /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

const Game = (() => {
	function createInitialState(nowMs) {
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
			catName: PET_BREEDS[0].defaultName,
			petBreed: PET_BREEDS[0].id,
			petColor: PET_BREEDS[0].colors[0].id,
			hasSeenIntro: false,
			debugOffsetMs: 0,
		};
	}

	// 品種を選べるようになる前のセーブデータ（ねこ / ペキニーズの2択）を品種と毛色に置き換える
	function migratePetType(saved) {
		if (!saved.petType) {
			return;
		}

		if (!saved.petBreed) {
			saved.petBreed = saved.petType === 'pekingese' ? 'pekingese' : 'mix';
		}

		delete saved.petType;
	}

	function sanitizeName(name) {
		return String(name).replace(UNSAFE_NAME_CHARS, '').trim().slice(0, NAME_MAX_LENGTH);
	}

	function toCount(value, fallback, max = MAX_COUNTER) {
		return Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : fallback;
	}

	function toTime(value, fallback) {
		return Number.isFinite(value) ? value : fallback;
	}

	function isObject(value) {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}

	function isItemOf(id, predicate) {
		const item = Object.hasOwn(ITEM_BY_ID, id) ? ITEM_BY_ID[id] : undefined;
		return item !== undefined && predicate(item);
	}

	// localStorage の中身は利用者や拡張機能が自由に書き換えられるので、知っている項目・型・範囲の値だけを取り込む
	function sanitizeState(saved, base) {
		if (!isObject(saved)) {
			return base;
		}

		const owned = Array.isArray(saved.owned)
			? [...new Set(saved.owned.filter(id => isItemOf(id, item => item.category !== 'food')))]
			: base.owned;
		const isOwnedId = id => owned.includes(id) || ITEM_BY_ID[id].price === 0;

		const inventory = {};
		if (isObject(saved.inventory)) {
			for (const [id, count] of Object.entries(saved.inventory)) {
				if (isItemOf(id, item => item.category === 'food')) {
					inventory[id] = toCount(count, 0, MAX_ITEM_COUNT);
				}
			}
		}

		const equipped = {...base.equipped};
		const savedEquipped = isObject(saved.equipped) ? saved.equipped : {};
		for (const slot of Object.keys(equipped)) {
			const id = savedEquipped[slot];
			if (isItemOf(id, item => item.slot === slot) && isOwnedId(id)) {
				equipped[slot] = id;
			}
		}

		const savedRoom = isObject(saved.room) ? saved.room : {};
		const pickRoomItem = kind => (isItemOf(savedRoom[kind], item => item.kind === kind) && isOwnedId(savedRoom[kind]) ? savedRoom[kind] : base.room[kind]);
		const room = {
			wall: pickRoomItem('wall'),
			floor: pickRoomItem('floor'),
			furniture: Array.isArray(savedRoom.furniture)
				? [...new Set(savedRoom.furniture.filter(id => isItemOf(id, item => item.kind === 'furniture') && isOwnedId(id)))]
				: [],
		};

		const breed = Object.hasOwn(PET_BREED_BY_ID, saved.petBreed) ? PET_BREED_BY_ID[saved.petBreed] : PET_BREEDS[0];
		const color = breed.colors.find(candidate => candidate.id === saved.petColor) ?? breed.colors[0];
		const catName = typeof saved.catName === 'string' ? sanitizeName(saved.catName) : '';
		const isDateKey = value => typeof value === 'string' && DATE_KEY_PATTERN.test(value);

		return {
			points: toCount(saved.points, base.points),
			streak: toCount(saved.streak, base.streak),
			bestStreak: toCount(saved.bestStreak, base.bestStreak),
			lastBathAt: toTime(saved.lastBathAt, base.lastBathAt),
			lastBathDate: isDateKey(saved.lastBathDate) ? saved.lastBathDate : null,
			bathDates: Array.isArray(saved.bathDates) ? saved.bathDates.filter(isDateKey).slice(-BATH_HISTORY_LIMIT) : [],
			hungerAtFeed: Number.isFinite(saved.hungerAtFeed) ? clamp(saved.hungerAtFeed, 0, 100) : base.hungerAtFeed,
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

	function load() {
		const base = createInitialState(Date.now());
		try {
			const raw = localStorage.getItem(SAVE_KEY);
			if (!raw) {
				return base;
			}

			const saved = JSON.parse(raw);
			if (isObject(saved)) {
				migratePetType(saved);
			}

			return sanitizeState(saved, base);
		} catch {
			return base;
		}
	}

	let state = load();

	function save() {
		try {
			localStorage.setItem(SAVE_KEY, JSON.stringify(state));
		} catch {
			// プライベートブラウズ等で保存できなくても、そのセッション中は遊べるようにする
		}
	}

	function now() {
		return Date.now() + state.debugOffsetMs;
	}

	function clamp(value, min, max) {
		return Math.min(max, Math.max(min, value));
	}

	function toDateKey(date) {
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${date.getFullYear()}-${month}-${day}`;
	}

	function dateKeyDaysAgo(daysAgo) {
		const date = new Date(now());
		date.setDate(date.getDate() - daysAgo);
		return toDateKey(date);
	}

	function getDirt() {
		const hours = (now() - state.lastBathAt) / HOUR_MS;
		return clamp((hours / DIRT_FULL_HOURS) * 100, 0, 100);
	}

	function getHunger() {
		const hours = (now() - state.lastFedAt) / HOUR_MS;
		return clamp(state.hungerAtFeed - ((hours / HUNGER_EMPTY_HOURS) * 100), 0, 100);
	}

	function xpForLevel(level) {
		return 40 + (level * 20);
	}

	function getLevelInfo() {
		let level = 1;
		let rest = state.xp;
		while (rest >= xpForLevel(level)) {
			rest -= xpForLevel(level);
			level++;
		}

		const stage = GROWTH_STAGES.filter(candidate => candidate.minLevel <= level).at(-1);
		return {level, xpInLevel: rest, xpForNext: xpForLevel(level), stage};
	}

	function getMood() {
		const dirt = getDirt();
		const hunger = getHunger();
		if (dirt >= 75 || hunger <= 15) {
			return 'sad';
		}

		if (dirt < 25 && hunger >= 50) {
			return 'happy';
		}

		return 'normal';
	}

	function hasBathedToday() {
		return state.lastBathDate === dateKeyDaysAgo(0);
	}

	// 昨日も今日も入っていなければ連続記録は途切れている
	function getStreak() {
		const isStreakAlive = state.lastBathDate === dateKeyDaysAgo(0) || state.lastBathDate === dateKeyDaysAgo(1);
		return isStreakAlive ? state.streak : 0;
	}

	function calculateBathReward() {
		if (hasBathedToday()) {
			return {earned: 0, nextStreak: state.streak, isWeeklyBonus: false};
		}

		const nextStreak = state.lastBathDate === dateKeyDaysAgo(1) ? state.streak + 1 : 1;
		const isWeeklyBonus = nextStreak % 7 === 0;
		const streakBonus = Math.min(nextStreak - 1, STREAK_BONUS_MAX_DAYS) * STREAK_BONUS_PER_DAY;
		const earned = BATH_BASE_POINTS + streakBonus + (isWeeklyBonus ? WEEKLY_BONUS_POINTS : 0);
		return {earned, nextStreak, isWeeklyBonus};
	}

	function describeLevelChange(levelBefore, stageBefore) {
		const after = getLevelInfo();
		return {
			leveledUpTo: after.level > levelBefore ? after.level : null,
			grewTo: after.stage.id === stageBefore ? null : after.stage.id,
		};
	}

	function takeBath() {
		const {level, stage} = getLevelInfo();
		const isFirstToday = !hasBathedToday();
		const reward = calculateBathReward();

		state.lastBathAt = now();
		if (isFirstToday) {
			state.streak = reward.nextStreak;
			state.bestStreak = Math.max(state.bestStreak, state.streak);
			state.points += reward.earned;
			state.xp += BATH_XP;
			state.lastBathDate = dateKeyDaysAgo(0);
			state.bathDates = [...state.bathDates, state.lastBathDate].slice(-BATH_HISTORY_LIMIT);
		}

		save();
		return {isFirstToday, ...reward, ...describeLevelChange(level, stage.id)};
	}

	function feed(itemId) {
		const item = ITEM_BY_ID[itemId];
		if (!item || item.category !== 'food' || !(state.inventory[itemId] > 0)) {
			return {isOk: false, reason: 'ごはんがないよ'};
		}

		const hunger = getHunger();
		if (hunger >= FULL_HUNGER_THRESHOLD) {
			return {isOk: false, reason: 'おなかいっぱいみたい'};
		}

		const {level, stage} = getLevelInfo();
		// 汚れていると元気が出ず、ごはんの効果も半分になる
		const isTooDirty = getDirt() >= TOO_DIRTY_THRESHOLD;
		const gainedXp = isTooDirty ? Math.floor(item.xp / 2) : item.xp;

		state.inventory[itemId] -= 1;
		state.hungerAtFeed = Math.min(100, hunger + item.hunger);
		state.lastFedAt = now();
		state.xp += gainedXp;
		save();
		return {isOk: true, item, gainedXp, isTooDirty, ...describeLevelChange(level, stage.id)};
	}

	function isOwned(itemId) {
		return state.owned.includes(itemId);
	}

	function buy(itemId) {
		const item = ITEM_BY_ID[itemId];
		if (!item) {
			return {isOk: false, reason: 'そのアイテムは売っていないよ'};
		}

		const isConsumable = item.category === 'food';
		if (!isConsumable && isOwned(itemId)) {
			return {isOk: false, reason: 'もう持っているよ'};
		}

		if (state.points < item.price) {
			return {isOk: false, reason: 'ポイントが足りないよ'};
		}

		state.points -= item.price;
		if (isConsumable) {
			state.inventory[itemId] = (state.inventory[itemId] ?? 0) + 1;
		} else {
			state.owned.push(itemId);
			// 買ってすぐ見た目に反映されるほうが嬉しいので自動で装備・配置する
			if (item.category === 'accessory') {
				state.equipped[item.slot] = itemId;
			} else if (item.kind === 'furniture') {
				state.room.furniture.push(itemId);
			} else {
				state.room[item.kind] = itemId;
			}
		}

		save();
		return {isOk: true, item};
	}

	function toggleEquip(itemId) {
		const item = ITEM_BY_ID[itemId];
		if (!item || item.category !== 'accessory' || !isOwned(itemId)) {
			return;
		}

		state.equipped[item.slot] = state.equipped[item.slot] === itemId ? null : itemId;
		save();
	}

	function applyRoom(itemId) {
		const item = ITEM_BY_ID[itemId];
		if (!item || item.category !== 'room' || item.kind === 'furniture' || !isOwned(itemId)) {
			return;
		}

		state.room[item.kind] = itemId;
		save();
	}

	function toggleFurniture(itemId) {
		const item = ITEM_BY_ID[itemId];
		if (!item || item.kind !== 'furniture' || !isOwned(itemId)) {
			return;
		}

		const {furniture} = state.room;
		state.room.furniture = furniture.includes(itemId)
			? furniture.filter(id => id !== itemId)
			: [...furniture, itemId];
		save();
	}

	function rename(name) {
		const trimmed = sanitizeName(name);
		if (trimmed) {
			state.catName = trimmed;
			save();
		}
	}

	function getPet() {
		const breed = PET_BREED_BY_ID[state.petBreed] ?? PET_BREEDS[0];
		const color = breed.colors.find(candidate => candidate.id === state.petColor) ?? breed.colors[0];
		return {breed, color, species: PET_SPECIES[breed.species]};
	}

	function setPetBreed(breedId) {
		const breed = PET_BREED_BY_ID[breedId];
		if (!breed || state.petBreed === breedId) {
			return;
		}

		// 名前を変えていなければ、新しい品種のデフォルトの名前にする
		if (PET_BREEDS.some(candidate => candidate.defaultName === state.catName)) {
			state.catName = breed.defaultName;
		}

		state.petBreed = breedId;
		state.petColor = breed.colors[0].id;
		save();
	}

	function setPetColor(colorId) {
		if (!getPet().breed.colors.some(color => color.id === colorId)) {
			return;
		}

		state.petColor = colorId;
		save();
	}

	function markIntroSeen() {
		state.hasSeenIntro = true;
		save();
	}

	function getRecentBathDays(days) {
		const bathDateSet = new Set(state.bathDates);
		return Array.from({length: days}, (_, index) => {
			const key = dateKeyDaysAgo(days - 1 - index);
			return {key, hasBathed: bathDateSet.has(key)};
		});
	}

	function debugAdvance(hours) {
		state.debugOffsetMs += hours * HOUR_MS;
		save();
	}

	function reset() {
		try {
			localStorage.removeItem(SAVE_KEY);
		} catch {}

		state = createInitialState(Date.now());
	}

	return {
		get state() {
			return state;
		},
		now,
		getDirt,
		getHunger,
		getLevelInfo,
		getMood,
		getStreak,
		hasBathedToday,
		calculateBathReward,
		takeBath,
		feed,
		buy,
		isOwned,
		toggleEquip,
		applyRoom,
		toggleFurniture,
		rename,
		getPet,
		setPetBreed,
		setPetColor,
		markIntroSeen,
		getRecentBathDays,
		debugAdvance,
		reset,
	};
})();
