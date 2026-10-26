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

// プロトタイプを持たせず、"__proto__" などの ID で Object.prototype を引けないようにする
const ITEM_BY_ID = Object.assign(Object.create(null), Object.fromEntries(ITEM_CATALOG.map(item => [item.id, item])));

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

// 種類ごとの語尾や鳴き声、成長段階の呼び名
const PET_SPECIES = {
	cat: {
		name: 'ねこ',
		icon: '🐱',
		suffix: 'にゃ',
		voice: 'にゃーん',
		happySound: 'ごろごろ…',
		stageNames: {baby: 'こねこ', young: 'わかねこ', adult: 'おとなねこ'},
	},
	dog: {
		name: 'いぬ',
		icon: '🐶',
		suffix: 'わん',
		voice: 'わんっ',
		happySound: 'くぅ〜ん…',
		stageNames: {baby: 'こいぬ', young: 'わかいぬ', adult: 'おとないぬ'},
	},
};

// 育てられる品種と毛色。palette の色は 3D モデルの塗り分けにそのまま使う
// ねこ: pattern で模様の種類（calico 三毛 / tabby しま / solid 単色 / bicolor ハチワレ / point ポイント）を決める
// いぬ: base 地の色 / light 胸・ほほの明るい色 / dark 耳や顔の濃い色
// eyeRing は黒っぽい毛で目が埋もれないように、黒目のまわりに付ける色
const PET_BREEDS = [
	{id: 'mix', species: 'cat', name: 'ミックス', icon: '🐱', defaultName: 'ミケ', colors: [
		{id: 'calico', name: '三毛', palette: {pattern: 'calico', base: '#fffaf2', accent: '#f5b066', sub: '#f8d9aa'}},
		{id: 'red-tabby', name: '茶トラ', palette: {pattern: 'tabby', base: '#f7c27f', accent: '#e08a3c', sub: '#fff3e2'}},
		{id: 'silver-tabby', name: 'サバトラ', palette: {pattern: 'tabby', base: '#d6d3cf', accent: '#7f7a76', sub: '#f7f5f2'}},
		{id: 'hachiware', name: 'ハチワレ', palette: {pattern: 'bicolor', base: '#fffaf2', accent: '#3f3936', sub: '#fffaf2', eyeRing: '#f2c14e'}},
		{id: 'black', name: '黒', palette: {pattern: 'solid', base: '#433c39', accent: '#433c39', sub: '#433c39', eyeRing: '#f2c14e'}},
		{id: 'white', name: '白', palette: {pattern: 'solid', base: '#fffcf7', accent: '#fffcf7', sub: '#fffcf7'}},
	]},
	{id: 'scottish', species: 'cat', name: 'スコティッシュ', icon: '🐱', defaultName: 'ムギ', colors: [
		{id: 'blue', name: 'ブルー', palette: {pattern: 'solid', base: '#b9bfc8', accent: '#b9bfc8', sub: '#e4e7eb', eyeRing: '#f0b85a'}},
		{id: 'cream', name: 'クリーム', palette: {pattern: 'tabby', base: '#f9e2bd', accent: '#eec48d', sub: '#fff7ea'}},
		{id: 'silver-tabby', name: 'シルバー', palette: {pattern: 'tabby', base: '#e3e3e3', accent: '#8a8786', sub: '#fafafa'}},
	]},
	{id: 'persian', species: 'cat', name: 'ペルシャ', icon: '🐱', defaultName: 'ルナ', colors: [
		{id: 'white', name: 'ホワイト', palette: {pattern: 'solid', base: '#fffcf7', accent: '#fffcf7', sub: '#fffcf7', eyeRing: '#7fb6e8'}},
		{id: 'cream', name: 'クリーム', palette: {pattern: 'solid', base: '#f8dfb8', accent: '#f8dfb8', sub: '#fff3e0'}},
		{id: 'chinchilla', name: 'チンチラ', palette: {pattern: 'solid', base: '#e9eaee', accent: '#e9eaee', sub: '#fbfbfc', eyeRing: '#79c27a'}},
	]},
	{id: 'siamese', species: 'cat', name: 'シャム', icon: '🐱', defaultName: 'ソラ', colors: [
		{id: 'seal-point', name: 'シールポイント', palette: {pattern: 'point', base: '#f6ead8', accent: '#6b4a3a', sub: '#f6ead8', eyeRing: '#6aa7e0'}},
		{id: 'blue-point', name: 'ブルーポイント', palette: {pattern: 'point', base: '#f1f1f2', accent: '#8b90a0', sub: '#f1f1f2', eyeRing: '#6aa7e0'}},
	]},
	{id: 'pekingese', species: 'dog', name: 'ペキニーズ', icon: '🐶', defaultName: 'ペキ', colors: [
		{id: 'fawn', name: 'フォーン', palette: {base: '#ecc082', light: '#fcebcf', dark: '#cf9459', mask: '#4d3b33'}},
		{id: 'red', name: 'レッド', palette: {base: '#d98a4e', light: '#f8dcc0', dark: '#b4673a', mask: '#4d3b33'}},
		{id: 'white', name: 'ホワイト', palette: {base: '#fbf5ea', light: '#ffffff', dark: '#efe1cb', mask: '#fbf5ea'}},
	]},
	{id: 'shiba', species: 'dog', name: '柴犬', icon: '🐕', defaultName: 'コタロウ', colors: [
		{id: 'red', name: '赤', palette: {base: '#e39550', light: '#fff4e3', dark: '#e39550'}},
		{id: 'black', name: '黒', palette: {base: '#3d3532', light: '#fff4e3', dark: '#3d3532', eyeRing: '#c98a4b'}},
		{id: 'white', name: '白', palette: {base: '#f8eedd', light: '#fffaf2', dark: '#f8eedd'}},
	]},
	{id: 'poodle', species: 'dog', name: 'トイプードル', icon: '🐩', defaultName: 'ココ', colors: [
		{id: 'apricot', name: 'アプリコット', palette: {base: '#f0b981', light: '#f6caa0', dark: '#e3a167'}},
		{id: 'red', name: 'レッド', palette: {base: '#c9733f', light: '#d98a56', dark: '#b3622f'}},
		{id: 'white', name: 'ホワイト', palette: {base: '#fdf8f0', light: '#ffffff', dark: '#f1e8d8'}},
		{id: 'black', name: 'ブラック', palette: {base: '#3d3735', light: '#4a4341', dark: '#332e2c', eyeRing: '#8a6a55'}},
	]},
	{id: 'dachshund', species: 'dog', name: 'ダックス', icon: '🌭', defaultName: 'チョコ', colors: [
		{id: 'red', name: 'レッド', palette: {base: '#c9763f', light: '#e0a066', dark: '#a85d2f'}},
		{id: 'black-tan', name: 'ブラックタン', palette: {base: '#3b3130', light: '#cf8f52', dark: '#3b3130', eyeRing: '#cf8f52'}},
		{id: 'chocolate', name: 'チョコタン', palette: {base: '#6e4632', light: '#d39a62', dark: '#5c3a29'}},
	]},
];

const PET_BREED_BY_ID = Object.assign(Object.create(null), Object.fromEntries(PET_BREEDS.map(breed => [breed.id, breed])));

// 毛色ボタンに出す見本の色
function petColorSwatch({palette}) {
	return palette.pattern
		? [palette.base, palette.accent, palette.sub]
		: [palette.base, palette.light, palette.dark];
}
