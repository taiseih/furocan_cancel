'use strict';

const ITEM_CATALOG = [
	// ごはん（消耗品）
	{id: 'food-kibble', category: 'food', name: 'カリカリ', icon: '🥣', price: 5, hunger: 30, xp: 5, description: 'いつものごはん。おなか +30'},
	{id: 'food-snack', category: 'food', name: 'とろとろおやつ', icon: '🍮', price: 8, hunger: 15, xp: 15, description: '大好物。なかよし度がぐんと上がる'},
	{id: 'food-sasami', category: 'food', name: 'ささみ', icon: '🍗', price: 12, hunger: 50, xp: 12, description: 'ごちそう。おなか +50'},
	{id: 'food-fish', category: 'food', name: 'おさかな', icon: '🐟', price: 18, hunger: 60, xp: 20, description: '新鮮なおさかな。おなか +60'},
	{id: 'food-can', category: 'food', name: '高級缶詰', icon: '🥫', price: 30, hunger: 90, xp: 35, description: '特別な日に。おなか +90'},

	// アクセサリー
	{id: 'acc-ribbon', category: 'accessory', slot: 'head', name: '赤いリボン', icon: '🎀', price: 30, description: '頭につける かわいいリボン'},
	{id: 'acc-strawhat', category: 'accessory', slot: 'head', name: '麦わら帽子', icon: '👒', price: 60, description: '夏気分になれる帽子'},
	{id: 'acc-crown', category: 'accessory', slot: 'head', name: '王冠', icon: '👑', price: 200, description: 'お風呂マスターのあかし'},
	{id: 'acc-glasses', category: 'accessory', slot: 'face', name: '丸メガネ', icon: '👓', price: 45, description: 'かしこそうに見える'},
	{id: 'acc-sunglasses', category: 'accessory', slot: 'face', name: 'サングラス', icon: '🕶️', price: 70, description: 'ちょっとワルな雰囲気'},
	{id: 'acc-bell', category: 'accessory', slot: 'neck', name: '鈴つき首輪', icon: '🔔', price: 40, description: 'ちりんと鳴る首輪'},
	{id: 'acc-scarf', category: 'accessory', slot: 'neck', name: 'スカーフ', icon: '🧣', price: 55, description: 'おしゃれな青いスカーフ'},

	// 模様替え
	{id: 'wall-default', category: 'room', kind: 'wall', name: 'クリーム壁紙', icon: '🟨', price: 0, description: 'はじめの壁紙'},
	{id: 'wall-mint', category: 'room', kind: 'wall', name: 'ミントストライプ', icon: '🌿', price: 60, description: 'さわやかなストライプ'},
	{id: 'wall-sakura', category: 'room', kind: 'wall', name: 'さくら壁紙', icon: '🌸', price: 80, description: '春いっぱいの壁紙'},
	{id: 'wall-night', category: 'room', kind: 'wall', name: '星空壁紙', icon: '🌙', price: 120, description: 'ねむくなる夜空'},
	{id: 'floor-wood', category: 'room', kind: 'floor', name: 'フローリング', icon: '🪵', price: 0, description: 'はじめの床'},
	{id: 'floor-tatami', category: 'room', kind: 'floor', name: '畳', icon: '🟩', price: 70, description: 'ペットが喜ぶ和の床'},
	{id: 'floor-carpet', category: 'room', kind: 'floor', name: 'ふわふわカーペット', icon: '🧶', price: 90, description: 'ごろごろしたくなる'},
	{id: 'furn-plant', category: 'room', kind: 'furniture', name: '観葉植物', icon: '🪴', price: 50, description: '部屋にみどりを'},
	{id: 'furn-picture', category: 'room', kind: 'furniture', name: '絵画', icon: '🖼️', price: 60, description: '壁にかざる名画'},
	{id: 'furn-teddy', category: 'room', kind: 'furniture', name: 'ぬいぐるみ', icon: '🧸', price: 70, description: 'ペットのお友だち'},
	{id: 'furn-window', category: 'room', kind: 'furniture', name: '出窓', icon: '🪟', price: 100, description: 'ひなたぼっこ用の窓'},
	{id: 'furn-sofa', category: 'room', kind: 'furniture', name: 'ソファ', icon: '🛋️', price: 120, description: 'ふかふかのソファ'},
];

const ITEM_BY_ID = Object.fromEntries(ITEM_CATALOG.map(item => [item.id, item]));

const SHOP_CATEGORIES = [
	{id: 'food', label: '🍗 ごはん'},
	{id: 'accessory', label: '🎀 アクセサリー'},
	{id: 'room', label: '🏠 模様替え'},
];

const ACCESSORY_SLOTS = [
	{id: 'head', label: 'あたま'},
	{id: 'face', label: 'かお'},
	{id: 'neck', label: 'くび'},
];

const GROWTH_STAGES = [
	{id: 'baby', minLevel: 1, scale: 0.78},
	{id: 'young', minLevel: 5, scale: 0.9},
	{id: 'adult', minLevel: 10, scale: 1},
];

// 育てられるペット。語尾や鳴き声、成長段階の呼び名がペットごとに変わる
const PET_TYPES = {
	cat: {
		name: 'ねこ',
		icon: '🐱',
		defaultName: 'ミケ',
		suffix: 'にゃ',
		voice: 'にゃーん',
		happySound: 'ごろごろ…',
		stageNames: {baby: 'こねこ', young: 'わかねこ', adult: 'おとなねこ'},
	},
	pekingese: {
		name: 'ペキニーズ',
		icon: '🐶',
		defaultName: 'ペキ',
		suffix: 'わん',
		voice: 'わんっ',
		happySound: 'くぅ〜ん…',
		stageNames: {baby: 'こいぬ', young: 'わかいぬ', adult: 'おとないぬ'},
	},
};
