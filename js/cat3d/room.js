import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mesh, toon, OUTLINE_COLOR} from './toon.js';

// 床は x, z ともに -ROOM_HALF〜ROOM_HALF。奥の2面（x = -ROOM_HALF と z = -ROOM_HALF）に壁がある
export const ROOM_HALF = 3;
const WALL_HEIGHT = 3.2;
const WALL_THICKNESS = 0.2;

const COLORS = {
	wood: '#e8a865',
	woodDark: '#c98a4c',
	white: '#fffdf9',
	pink: '#f7a8bb',
	pinkTrim: '#f4a3b6',
	cardboard: '#dcae74',
};

const roundedBox = (width, height, depth, radius = 0.04) => new RoundedBoxGeometry(width, height, depth, 3, Math.min(radius, (Math.min(width, height, depth) / 2) - 0.001));

function canvasTexture(width, height, draw) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	draw(canvas.getContext('2d'), width, height);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 4;
	return texture;
}

function drawCloud(context, x, y, scale) {
	context.save();
	context.translate(x, y);
	context.scale(scale, scale);
	context.beginPath();
	context.moveTo(-50, 18);
	context.bezierCurveTo(-75, 18, -72, -14, -46, -10);
	context.bezierCurveTo(-42, -38, -6, -40, 2, -18);
	context.bezierCurveTo(14, -36, 48, -30, 44, -6);
	context.bezierCurveTo(70, -6, 70, 18, 46, 18);
	context.closePath();
	context.fillStyle = '#ffffff';
	context.fill();
	context.lineWidth = 5;
	context.strokeStyle = OUTLINE_COLOR;
	context.stroke();
	context.restore();
}

const WALL_THEMES = {
	'wall-default': {base: '#fbe9d6', decorate: 'clouds'},
	'wall-mint': {base: '#e3f6ec', stripe: '#cdeedd', decorate: 'clouds'},
	'wall-sakura': {base: '#ffeef3', decorate: 'petals'},
	'wall-night': {base: '#2c336e', decorate: 'stars'},
};

function wallTexture(themeId, clouds) {
	const theme = WALL_THEMES[themeId] ?? WALL_THEMES['wall-default'];
	return canvasTexture(1200, 640, (context, width, height) => {
		context.fillStyle = theme.base;
		context.fillRect(0, 0, width, height);
		if (theme.stripe) {
			context.fillStyle = theme.stripe;
			for (let x = 0; x < width; x += 60) {
				context.fillRect(x, 0, 30, height);
			}
		}

		if (theme.decorate === 'clouds') {
			for (const [x, y, scale] of clouds) {
				drawCloud(context, x * width, y * height, scale);
			}
		} else if (theme.decorate === 'petals') {
			for (let index = 0; index < 60; index++) {
				const x = ((index * 197) % width) + 20;
				const y = ((index * 113) % (height - 80)) + 50;
				context.fillStyle = index % 2 ? '#ffc4d6' : '#ffd9e5';
				context.beginPath();
				context.ellipse(x, y, 10, 6, index, 0, Math.PI * 2);
				context.fill();
			}
		} else if (theme.decorate === 'stars') {
			for (let index = 0; index < 90; index++) {
				context.fillStyle = index % 3 ? '#ffffff' : '#fff3a6';
				context.beginPath();
				context.arc((index * 271) % width, ((index * 157) % (height - 60)) + 30, 2 + (index % 3), 0, Math.PI * 2);
				context.fill();
			}
		}

		// 天井側のピンクのライン
		context.fillStyle = COLORS.pinkTrim;
		context.fillRect(0, 10, width, 18);
		context.fillStyle = OUTLINE_COLOR;
		context.fillRect(0, 8, width, 3);
		context.fillRect(0, 28, width, 3);
		// 幅木
		context.fillStyle = COLORS.pinkTrim;
		context.fillRect(0, height - 26, width, 26);
		context.fillStyle = OUTLINE_COLOR;
		context.fillRect(0, height - 29, width, 4);
	});
}

const FLOOR_THEMES = {
	'floor-wood': (context, width, height) => {
		context.fillStyle = '#fbf7f2';
		context.fillRect(0, 0, width, height);
		context.strokeStyle = '#efe6db';
		context.lineWidth = 3;
		for (let y = 0; y < height; y += 64) {
			context.beginPath();
			context.moveTo(0, y);
			context.lineTo(width, y);
			context.stroke();
		}
	},
	'floor-tatami': (context, width, height) => {
		context.fillStyle = '#d4dd9b';
		context.fillRect(0, 0, width, height);
		context.strokeStyle = '#bfca83';
		context.lineWidth = 2;
		for (let y = 0; y < height; y += 8) {
			context.beginPath();
			context.moveTo(0, y);
			context.lineTo(width, y);
			context.stroke();
		}

		context.strokeStyle = '#6f7f3a';
		context.lineWidth = 8;
		for (let x = 0; x <= width; x += width / 3) {
			context.strokeRect(x, 0, width / 3, height / 2);
			context.strokeRect(x, height / 2, width / 3, height / 2);
		}
	},
	'floor-carpet': (context, width, height) => {
		context.fillStyle = '#f9c3d4';
		context.fillRect(0, 0, width, height);
		context.fillStyle = '#ffe6ee';
		for (let y = 16; y < height; y += 40) {
			for (let x = (y / 40) % 2 ? 36 : 16; x < width; x += 40) {
				context.beginPath();
				context.arc(x, y, 6, 0, Math.PI * 2);
				context.fill();
			}
		}
	},
};

function floorTexture(themeId) {
	return canvasTexture(768, 768, FLOOR_THEMES[themeId] ?? FLOOR_THEMES['floor-wood']);
}

// ---------- 家具 ----------
function bed() {
	const group = new THREE.Group();
	const wood = toon(COLORS.wood);
	group.add(mesh(roundedBox(1.4, 0.18, 2.2), wood, {position: [0, 0.25, 0]}));
	for (const [x, z] of [[-0.62, -1.02], [0.62, -1.02], [-0.62, 1.02], [0.62, 1.02]]) {
		group.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 12), wood, {position: [x, 0.1, z]}));
	}

	// ヘッドボード: 2本の柱と横木
	for (const x of [-0.66, 0.66]) {
		group.add(mesh(roundedBox(0.1, 0.95, 0.1, 0.04), wood, {position: [x, 0.48, -1.08]}));
	}

	group.add(mesh(roundedBox(1.3, 0.1, 0.08), wood, {position: [0, 0.82, -1.08]}));
	group.add(mesh(roundedBox(1.3, 0.1, 0.08), wood, {position: [0, 0.58, -1.08]}));
	group.add(mesh(roundedBox(1.3, 0.2, 2.05, 0.08), toon(COLORS.white), {position: [0, 0.43, -0.02]}));
	group.add(mesh(roundedBox(0.95, 0.16, 0.42, 0.07), toon(COLORS.white), {position: [0, 0.59, -0.75]}));
	// 掛け布団は少し大きくして側面に垂らす
	group.add(mesh(roundedBox(1.42, 0.26, 1.35, 0.06), toon(COLORS.pink), {position: [0, 0.45, 0.33]}));
	return group;
}

function cabinet() {
	const group = new THREE.Group();
	const wood = toon(COLORS.wood);
	group.add(mesh(roundedBox(0.8, 0.7, 1.5), wood, {position: [0, 0.35, 0]}));
	const knob = toon('#fff4e0');
	for (const z of [-0.2, 0.2]) {
		group.add(mesh(new THREE.SphereGeometry(0.035, 12, 8), knob, {position: [0.41, 0.45, z], outline: 0.012}));
	}

	group.add(mesh(new THREE.BoxGeometry(0.01, 0.6, 0.012), toon(OUTLINE_COLOR), {position: [0.405, 0.35, 0], outline: 0}));
	const box = mesh(roundedBox(0.7, 0.38, 0.85, 0.03), toon(COLORS.cardboard), {position: [0, 0.89, -0.2]});
	box.add(mesh(new THREE.BoxGeometry(0.2, 0.012, 0.86), toon('#c4935a'), {position: [0, 0.19, 0], outline: 0}));
	box.add(mesh(new THREE.BoxGeometry(0.24, 0.01, 0.18), toon('#ffffff'), {position: [0.1, 0.195, 0.2], outline: 0.008}));
	group.add(box);
	return group;
}

function lamp() {
	const group = new THREE.Group();
	const wood = toon(COLORS.wood);
	group.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 24), wood, {position: [0, 0.03, 0]}));
	group.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 12), wood, {position: [0, 0.78, 0]}));
	group.add(mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.42, 28), toon('#ffffff'), {position: [0, 1.6, 0]}));
	group.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6), toon(OUTLINE_COLOR), {position: [0.12, 1.32, 0.05], outline: 0}));
	return group;
}

function door() {
	const group = new THREE.Group();
	group.add(mesh(roundedBox(1.12, 2.1, 0.06, 0.02), toon(COLORS.woodDark), {position: [0, 1.05, 0]}));
	group.add(mesh(roundedBox(0.96, 1.98, 0.08, 0.02), toon(COLORS.wood), {position: [0, 1.0, 0.02]}));
	group.add(mesh(new THREE.SphereGeometry(0.05, 12, 8), toon('#fff6e8'), {position: [0.36, 1.0, 0.09], outline: 0.012}));
	return group;
}

function doorMat() {
	return mesh(roundedBox(1.0, 0.04, 0.6, 0.02), toon('#f4f1ee'), {position: [0, 0.02, 0]});
}

function clock() {
	const group = new THREE.Group();
	const rim = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 32), toon(COLORS.wood), {rotation: [Math.PI / 2, 0, 0]});
	group.add(rim);
	group.add(mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 32), toon('#ffffff'), {position: [0, 0, 0.03], rotation: [Math.PI / 2, 0, 0], outline: 0}));
	const hand = toon(OUTLINE_COLOR);
	group.add(mesh(new THREE.BoxGeometry(0.02, 0.13, 0.01), hand, {position: [0, 0.055, 0.045], outline: 0}));
	group.add(mesh(new THREE.BoxGeometry(0.1, 0.02, 0.01), hand, {position: [0.045, 0, 0.045], outline: 0}));
	return group;
}

function lowTable() {
	const group = new THREE.Group();
	group.add(mesh(roundedBox(1.5, 0.1, 1.1, 0.03), toon(COLORS.wood), {position: [0, 0.4, 0]}));
	const leg = toon('#f4f1ee');
	for (const [x, z] of [[-0.62, -0.42], [0.62, -0.42], [-0.62, 0.42], [0.62, 0.42]]) {
		group.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.36, 10), leg, {position: [x, 0.18, z]}));
	}

	return group;
}

function stool() {
	const group = new THREE.Group();
	group.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 28), toon(COLORS.wood), {position: [0, 0.3, 0]}));
	const leg = toon('#f4f1ee');
	for (let index = 0; index < 3; index++) {
		const angle = (index / 3) * Math.PI * 2;
		group.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 8), leg, {position: [Math.cos(angle) * 0.2, 0.14, Math.sin(angle) * 0.2]}));
	}

	return group;
}

function plant() {
	const group = new THREE.Group();
	group.add(mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.24, 20), toon('#c8693e'), {position: [0, 0.12, 0]}));
	group.add(mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.05, 20), toon('#d77a4c'), {position: [0, 0.24, 0]}));
	const leaf = toon('#5fb36a');
	for (const [x, y, z, rx, rz] of [[0.1, 0.42, 0, 0.2, -0.7], [-0.1, 0.44, 0.03, 0.1, 0.7], [0, 0.5, -0.08, -0.6, 0], [0.02, 0.38, 0.1, 0.8, 0.1]]) {
		const geometry = new THREE.SphereGeometry(1, 16, 10);
		geometry.scale(0.08, 0.15, 0.03);
		group.add(mesh(geometry, leaf, {position: [x, y, z], rotation: [rx, 0, rz], outline: 0.012}));
	}

	group.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), leaf, {position: [0, 0.34, 0], outline: 0}));
	return group;
}

function picture() {
	const group = new THREE.Group();
	group.add(mesh(roundedBox(0.9, 0.7, 0.06, 0.02), toon(COLORS.wood)));
	const art = canvasTexture(256, 200, (context, width, height) => {
		context.fillStyle = '#bfe6ff';
		context.fillRect(0, 0, width, height);
		context.fillStyle = '#8fd18a';
		context.beginPath();
		context.moveTo(0, height);
		context.quadraticCurveTo(width * 0.3, height * 0.45, width * 0.6, height * 0.75);
		context.quadraticCurveTo(width * 0.8, height * 0.55, width, height * 0.7);
		context.lineTo(width, height);
		context.fill();
		context.fillStyle = '#ffd23f';
		context.beginPath();
		context.arc(width * 0.75, height * 0.3, 22, 0, Math.PI * 2);
		context.fill();
	});
	group.add(mesh(new THREE.PlaneGeometry(0.76, 0.56), new THREE.MeshBasicMaterial({map: art}), {position: [0, 0, 0.035], outline: 0}));
	return group;
}

function teddy() {
	const group = new THREE.Group();
	const fur = toon('#c98b5a');
	const light = toon('#f1d2b0');
	group.add(mesh(new THREE.SphereGeometry(0.17, 20, 14), fur, {position: [0, 0.17, 0]}));
	group.add(mesh(new THREE.SphereGeometry(0.13, 20, 14), fur, {position: [0, 0.4, 0.02]}));
	for (const x of [-0.1, 0.1]) {
		group.add(mesh(new THREE.SphereGeometry(0.045, 12, 8), fur, {position: [x, 0.52, 0], outline: 0.012}));
		group.add(mesh(new THREE.SphereGeometry(0.06, 12, 8), fur, {position: [x * 1.5, 0.12, 0.12], outline: 0.012}));
	}

	group.add(mesh(new THREE.SphereGeometry(0.05, 12, 8), light, {position: [0, 0.37, 0.12], outline: 0.01}));
	const eye = toon(OUTLINE_COLOR);
	for (const x of [-0.045, 0.045]) {
		group.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), eye, {position: [x, 0.43, 0.12], outline: 0}));
	}

	return group;
}

function windowFrame() {
	const group = new THREE.Group();
	const wood = toon(COLORS.wood);
	group.add(mesh(roundedBox(0.08, 1.05, 1.3, 0.04), wood));
	group.add(mesh(new THREE.BoxGeometry(0.02, 0.9, 1.15), toon('#a9dcf5'), {position: [0.04, 0, 0], outline: 0}));
	group.add(mesh(new THREE.BoxGeometry(0.05, 0.9, 0.06), wood, {position: [0.05, 0, 0], outline: 0.01}));
	group.add(mesh(new THREE.BoxGeometry(0.05, 0.06, 1.15), wood, {position: [0.05, 0, 0], outline: 0.01}));
	return group;
}

function sofa() {
	const group = new THREE.Group();
	const wood = toon(COLORS.wood);
	group.add(mesh(roundedBox(0.8, 0.12, 1.7, 0.04), wood, {position: [0, 0.32, 0]}));
	for (const [x, z] of [[-0.3, -0.75], [0.3, -0.75], [-0.3, 0.75], [0.3, 0.75]]) {
		group.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 10), toon('#f4f1ee'), {position: [x, 0.14, z]}));
	}

	group.add(mesh(roundedBox(0.72, 0.14, 1.6, 0.06), toon('#f7b9c8'), {position: [0, 0.44, 0]}));
	group.add(mesh(roundedBox(0.14, 0.5, 1.6, 0.06), toon('#f7b9c8'), {position: [0.33, 0.66, 0]}));
	return group;
}

// 家具の配置と、ねこが通れない範囲（床の上の矩形 [x1, z1, x2, z2]）
const BASE_FURNITURE = [
	{build: bed, position: [-2.15, 0, -1.75], blocks: [-2.9, -2.95, -1.4, -0.6]},
	{build: cabinet, position: [-2.55, 0, 1.45], blocks: [-2.95, 0.65, -2.1, 2.25]},
	{build: lamp, position: [-0.35, 0, -2.6], blocks: [-0.6, -2.9, -0.1, -2.3]},
	{build: door, position: [1.4, 0, -2.95]},
	{build: doorMat, position: [1.4, 0, -2.45]},
	{build: clock, position: [2.45, 2.35, -2.93]},
	{build: lowTable, position: [0.45, 0, 0.35], blocks: [-0.35, -0.25, 1.25, 0.95]},
	{build: stool, position: [1.35, 0, 1.85], blocks: [1.0, 1.5, 1.7, 2.2]},
];

const SHOP_FURNITURE = {
	'furn-plant': {build: plant, position: [0.75, 0.45, 0.4]},
	'furn-picture': {build: picture, position: [-1.4, 1.95, -2.93]},
	'furn-teddy': {build: teddy, position: [-2.15, 0.56, -2.35], rotation: [0, 0.4, 0]},
	'furn-window': {build: windowFrame, position: [-2.93, 1.9, -1.0]},
	'furn-sofa': {build: sofa, position: [2.4, 0, 0.2], blocks: [1.95, -0.7, 2.9, 1.1]},
};

export function createRoom() {
	const group = new THREE.Group();

	const slab = mesh(roundedBox((ROOM_HALF * 2) + WALL_THICKNESS + 0.1, 0.25, (ROOM_HALF * 2) + WALL_THICKNESS + 0.1, 0.08), toon(COLORS.white), {
		position: [-(WALL_THICKNESS / 2) - 0.05, -0.125, -(WALL_THICKNESS / 2) - 0.05],
		outline: 0.035,
	});
	group.add(slab);

	const floorMaterial = toon('#ffffff');
	const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2), floorMaterial);
	floor.rotation.x = -Math.PI / 2;
	floor.position.y = 0.002;
	group.add(floor);

	const wallMaterial = toon(COLORS.white);
	const wallLength = (ROOM_HALF * 2) + WALL_THICKNESS;
	group.add(mesh(roundedBox(WALL_THICKNESS, WALL_HEIGHT, wallLength, 0.05), wallMaterial, {
		position: [-ROOM_HALF - (WALL_THICKNESS / 2), WALL_HEIGHT / 2, -(WALL_THICKNESS / 2)],
		outline: 0.035,
	}));
	group.add(mesh(roundedBox(wallLength, WALL_HEIGHT, WALL_THICKNESS, 0.05), wallMaterial, {
		position: [-(WALL_THICKNESS / 2), WALL_HEIGHT / 2, -ROOM_HALF - (WALL_THICKNESS / 2)],
		outline: 0.035,
	}));

	// 壁紙は内側の面に貼る板。左右の壁で雲の位置を変える
	const wallpaperLeft = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_HALF * 2, WALL_HEIGHT - 0.06), toon('#ffffff'));
	wallpaperLeft.rotation.y = Math.PI / 2;
	wallpaperLeft.position.set(-ROOM_HALF + 0.003, (WALL_HEIGHT / 2) - 0.03, 0);
	const wallpaperRight = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_HALF * 2, WALL_HEIGHT - 0.06), toon('#ffffff'));
	wallpaperRight.position.set(0, (WALL_HEIGHT / 2) - 0.03, -ROOM_HALF + 0.003);
	group.add(wallpaperLeft, wallpaperRight);
	const leftClouds = [[0.82, 0.42, 0.9], [0.18, 0.3, 0.75]];
	const rightClouds = [[0.2, 0.18, 0.85], [0.86, 0.6, 0.8]];

	const baseObstacles = [];
	for (const item of BASE_FURNITURE) {
		const object = item.build();
		object.position.set(...item.position);
		group.add(object);
		if (item.blocks) {
			baseObstacles.push(item.blocks);
		}
	}

	const shopObjects = new Map();
	for (const [id, item] of Object.entries(SHOP_FURNITURE)) {
		const object = item.build();
		object.position.set(...item.position);
		if (item.rotation) {
			object.rotation.set(...item.rotation);
		}

		object.visible = false;
		group.add(object);
		shopObjects.set(id, object);
	}

	let currentTheme = {};
	let obstacles = baseObstacles;

	return {
		group,
		setTheme({wall, floor: floorId, furniture}) {
			if (currentTheme.wall !== wall) {
				wallpaperLeft.material.map?.dispose();
				wallpaperRight.material.map?.dispose();
				wallpaperLeft.material.map = wallTexture(wall, leftClouds);
				wallpaperRight.material.map = wallTexture(wall, rightClouds);
				wallpaperLeft.material.needsUpdate = true;
				wallpaperRight.material.needsUpdate = true;
			}

			if (currentTheme.floor !== floorId) {
				floorMaterial.map?.dispose();
				floorMaterial.map = floorTexture(floorId);
				floorMaterial.needsUpdate = true;
			}

			for (const [id, object] of shopObjects) {
				object.visible = furniture.includes(id);
			}

			obstacles = [...baseObstacles, ...furniture.map(id => SHOP_FURNITURE[id]?.blocks).filter(Boolean)];
			currentTheme = {wall, floor: floorId};
		},
		isWalkable(x, z, margin = 0.3) {
			const limit = ROOM_HALF - margin;
			if (Math.abs(x) > limit || Math.abs(z) > limit) {
				return false;
			}

			return obstacles.every(([x1, z1, x2, z2]) => x < x1 - margin || x > x2 + margin || z < z1 - margin || z > z2 + margin);
		},
	};
}
