import * as THREE from 'three';

const gold = () => new THREE.MeshStandardMaterial({color: '#f5c542', metalness: 1, roughness: 0.25});

function ribbon() {
	const group = new THREE.Group();
	const satin = new THREE.MeshPhysicalMaterial({color: '#e8344e', roughness: 0.35, sheen: 1, sheenColor: new THREE.Color('#ff9fb0')});
	for (const side of [1, -1]) {
		const loop = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), satin);
		loop.scale.set(0.042, 0.026, 0.012);
		loop.position.x = 0.036 * side;
		loop.rotation.z = 0.35 * side;
		group.add(loop);
	}

	const knot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), satin);
	group.add(knot);
	group.position.set(0.075, 0.13, 0.04);
	group.rotation.set(-0.3, 0.2, -0.4);
	return group;
}

function strawHat() {
	const group = new THREE.Group();
	const straw = new THREE.MeshStandardMaterial({color: '#e2c071', roughness: 0.95});
	const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.008, 48), straw);
	const crown = new THREE.Mesh(new THREE.SphereGeometry(0.105, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), straw);
	crown.scale.y = 0.85;
	const band = new THREE.Mesh(new THREE.CylinderGeometry(0.107, 0.107, 0.024, 48, 1, true), new THREE.MeshStandardMaterial({color: '#d94a64', roughness: 0.6}));
	band.position.y = 0.014;
	group.add(brim, crown, band);
	group.position.set(0, 0.15, -0.01);
	group.rotation.set(-0.15, 0, 0.12);
	return group;
}

function crown() {
	const group = new THREE.Group();
	const material = gold();
	const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.068, 0.035, 40, 1, true), material);
	ring.material.side = THREE.DoubleSide;
	group.add(ring);
	for (let index = 0; index < 5; index++) {
		const angle = (index / 5) * Math.PI * 2;
		const spike = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.045, 12), material);
		spike.position.set(Math.sin(angle) * 0.062, 0.038, Math.cos(angle) * 0.062);
		group.add(spike);
		const gem = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), new THREE.MeshPhysicalMaterial({color: index % 2 ? '#3d7bff' : '#ff2d55', roughness: 0.05, clearcoat: 1}));
		gem.position.set(Math.sin(angle) * 0.07, 0, Math.cos(angle) * 0.07);
		group.add(gem);
	}

	group.position.set(0, 0.155, 0.01);
	group.rotation.set(-0.12, 0, 0.1);
	return group;
}

function eyewear(isSunglasses, eyePositions) {
	const group = new THREE.Group();
	const frame = isSunglasses ? new THREE.MeshStandardMaterial({color: '#111', roughness: 0.3}) : gold();
	const lens = isSunglasses
		? new THREE.MeshPhysicalMaterial({color: '#0b0b0b', roughness: 0.05, clearcoat: 1, metalness: 0.3})
		: new THREE.MeshPhysicalMaterial({color: '#ffffff', roughness: 0.02, transparent: true, opacity: 0.15});
	for (const position of eyePositions) {
		const center = position.clone().add(new THREE.Vector3(0, 0, 0.045));
		const rim = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 10, 40), frame);
		rim.position.copy(center);
		const glass = new THREE.Mesh(new THREE.CircleGeometry(0.049, 40), lens);
		glass.position.copy(center);
		group.add(rim, glass);
	}

	const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0035, 8, 20, Math.PI), frame);
	const [right, left] = eyePositions[0].x > eyePositions[1].x ? eyePositions : [eyePositions[1], eyePositions[0]];
	bridge.position.copy(right).add(left).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.008, 0.045));
	group.add(bridge);
	for (const [eye, side] of [[right, 1], [left, -1]]) {
		const temple = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.15, 8), frame);
		temple.rotation.x = Math.PI / 2;
		temple.position.set(eye.x + (0.049 * side), eye.y, eye.z - 0.016);
		group.add(temple);
	}

	return group;
}

function bellCollar() {
	const group = new THREE.Group();
	const strap = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.012, 12, 56), new THREE.MeshStandardMaterial({color: '#c4213a', roughness: 0.55}));
	strap.rotation.x = Math.PI / 2;
	const bell = new THREE.Mesh(new THREE.SphereGeometry(0.022, 24, 16), gold());
	bell.position.set(0, -0.025, 0.13);
	group.add(strap, bell);
	group.position.set(0, 0.6, 0.07);
	group.rotation.x = 0.25;
	return group;
}

function scarf() {
	const group = new THREE.Group();
	const cloth = new THREE.MeshPhysicalMaterial({color: '#3f86e8', roughness: 0.8, sheen: 0.6, sheenColor: new THREE.Color('#9cc6ff')});
	const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.022, 14, 56), cloth);
	wrap.rotation.x = Math.PI / 2;
	const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.11, 3), cloth);
	tail.rotation.set(Math.PI, 0, 0);
	tail.scale.z = 0.3;
	tail.position.set(0.02, -0.07, 0.14);
	group.add(wrap, tail);
	group.position.set(0, 0.6, 0.07);
	group.rotation.x = 0.25;
	return group;
}

const BUILDERS = {
	'acc-ribbon': {parent: 'head', build: ribbon},
	'acc-strawhat': {parent: 'head', build: strawHat},
	'acc-crown': {parent: 'head', build: crown},
	'acc-glasses': {parent: 'head', build: rig => eyewear(false, rig.eyePositions)},
	'acc-sunglasses': {parent: 'head', build: rig => eyewear(true, rig.eyePositions)},
	'acc-bell': {parent: 'body', build: bellCollar},
	'acc-scarf': {parent: 'body', build: scarf},
};

export function attachAccessories(rig) {
	const meshes = new Map();
	for (const [id, {parent, build}] of Object.entries(BUILDERS)) {
		const object = build(rig);
		object.visible = false;
		// 胴体のアクセサリーは、モデルが首まわりの基準を持っていればそこに付ける
		(parent === 'body' ? rig.collar ?? rig.body : rig[parent]).add(object);
		meshes.set(id, object);
	}

	return meshes;
}
