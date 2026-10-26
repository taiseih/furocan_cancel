import * as THREE from 'three';
import {createRoom, ROOM_HALF} from './room.js';
import {buildChibiCat} from './chibiCat.js';
import {buildPekingese} from './pekingese.js';
import {attachAccessories} from './accessories.js';
import {mesh, toon, toonify} from './toon.js';

const FOAM_COUNT = 90;
const DROPLET_COUNT = 60;
const BATH_TIMELINE = {rinseAt: 1.4, shakeAt: 1.7, dryAt: 2.6, end: 3.4};
const WALK_SPEED = 0.9;
// 部屋に対するねこの大きさ（成長段階の大きさに掛ける）
const CAT_SIZE = 1.7;
// カメラは斜め上から見下ろす等角投影。ねこが正面を向くときはこの向きを向く
const VIEW_DIRECTION = new THREE.Vector3(1, 0.78, 1).normalize();
const FACE_CAMERA_YAW = Math.atan2(VIEW_DIRECTION.x, VIEW_DIRECTION.z);

const PET_BUILDERS = {cat: buildChibiCat, pekingese: buildPekingese};

const MOOD_POSE = {
	happy: {lid: 0, earDroop: 0, headPitch: -0.05, tailLift: 1, tailSway: 0.35, breath: 1.6, sad: 0, walkSpeed: 1, restTime: [2, 4]},
	normal: {lid: 0, earDroop: 0, headPitch: 0, tailLift: 0.4, tailSway: 0.22, breath: 1.8, sad: 0, walkSpeed: 0.85, restTime: [2.5, 5]},
	sad: {lid: 0.35, earDroop: 1, headPitch: 0.3, tailLift: 0, tailSway: 0.05, breath: 1.1, sad: 1, walkSpeed: 0.45, restTime: [5, 9]},
};

// 泡を乗せる位置。胴体・頭のおおまかな楕円体の表面から選ぶ
const FOAM_ANCHORS = [
	{center: [0, 0.33, -0.04], radii: [0.27, 0.25, 0.35], weight: 3},
	{center: [0, 0.68, 0.15], radii: [0.4, 0.35, 0.36], weight: 3},
];

const random = (min, max) => min + (Math.random() * (max - min));
const damp = (current, target, rate, delta) => current + ((target - current) * (1 - Math.exp(-rate * delta)));
const angleDifference = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const dampAngle = (current, target, rate, delta) => current + (angleDifference(current, target) * (1 - Math.exp(-rate * delta)));

function sampleEllipsoid(center, radii) {
	const direction = new THREE.Vector3(random(-1, 1), random(-0.4, 1), random(-1, 1)).normalize();
	return new THREE.Vector3(...center).add(direction.multiply(new THREE.Vector3(...radii)));
}

function createBlobShadow() {
	const canvas = document.createElement('canvas');
	canvas.width = 64;
	canvas.height = 64;
	const context = canvas.getContext('2d');
	const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
	gradient.addColorStop(0, 'rgba(90, 70, 60, 0.32)');
	gradient.addColorStop(0.7, 'rgba(90, 70, 60, 0.18)');
	gradient.addColorStop(1, 'rgba(90, 70, 60, 0)');
	context.fillStyle = gradient;
	context.fillRect(0, 0, 64, 64);
	const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false}));
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.y = 0.01;
	return shadow;
}

function createFoodBowl() {
	const group = new THREE.Group();
	const profile = [[0, 0], [0.16, 0.005], [0.2, 0.09], [0.185, 0.095], [0.15, 0.03], [0, 0.03]].map(([x, y]) => new THREE.Vector2(x, y));
	group.add(mesh(new THREE.LatheGeometry(profile, 32), toon('#9fd3f0', {side: THREE.DoubleSide}), {outline: 0.012}));
	const kibble = toon('#b9733c');
	for (let index = 0; index < 12; index++) {
		const angle = random(0, Math.PI * 2);
		const distance = random(0, 0.1);
		group.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), kibble, {position: [Math.cos(angle) * distance, 0.06 + random(0, 0.02), Math.sin(angle) * distance], outline: 0}));
	}

	group.visible = false;
	return group;
}

function createFly() {
	const group = new THREE.Group();
	group.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), toon('#2b2b2b'), {outline: 0}));
	const wingMaterial = new THREE.MeshBasicMaterial({color: '#e8f2fa', transparent: true, opacity: 0.8, side: THREE.DoubleSide});
	const wings = [1, -1].map(side => {
		const wing = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), wingMaterial);
		wing.scale.set(0.6, 1, 1);
		wing.position.set(0.02 * side, 0.02, 0);
		wing.rotation.x = -Math.PI / 2;
		group.add(wing);
		return wing;
	});
	group.userData.wings = wings;
	return group;
}

export function createCatAvatar(container, {onPet, stage} = {}) {
	const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	renderer.domElement.className = 'cat-canvas';
	container.append(renderer.domElement);

	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
	const lookTarget = new THREE.Vector3(-0.1, 1.0, -0.1);
	camera.position.copy(lookTarget).addScaledVector(VIEW_DIRECTION, 30);
	camera.lookAt(lookTarget);
	camera.updateMatrixWorld();

	// イラスト調にするため、全体を明るい環境光で照らし、陰影は控えめな平行光だけにする
	scene.add(new THREE.HemisphereLight('#ffffff', '#f3e6da', 2.1));
	const keyLight = new THREE.DirectionalLight('#fff8ee', 1.1);
	keyLight.position.set(2, 6, 4);
	scene.add(keyLight);

	const room = createRoom();
	scene.add(room.group);

	let pet = null;
	let petType = null;
	let accessories = new Map();
	let equippedIds = new Set();
	const shadow = createBlobShadow();
	scene.add(shadow);
	const bowl = createFoodBowl();
	scene.add(bowl);

	// 泡
	const foamMesh = new THREE.InstancedMesh(
		new THREE.SphereGeometry(1, 14, 10),
		toon('#ffffff', {transparent: true, opacity: 0.95}),
		FOAM_COUNT,
	);
	const totalWeight = FOAM_ANCHORS.reduce((sum, anchor) => sum + anchor.weight, 0);
	const foamBubbles = Array.from({length: FOAM_COUNT}, () => {
		let pick = random(0, totalWeight);
		const anchor = FOAM_ANCHORS.find(candidate => (pick -= candidate.weight) <= 0) ?? FOAM_ANCHORS[0];
		return {position: sampleEllipsoid(anchor.center, anchor.radii), size: random(0.06, 0.12), delay: random(0, 0.9)};
	});
	foamMesh.frustumCulled = false;
	foamMesh.visible = false;

	// ペットの種類を切り替えるときは、モデルとアクセサリーを作り直す
	function setPetType(type) {
		const nextType = PET_BUILDERS[type] ? type : 'cat';
		if (nextType === petType) {
			return;
		}

		if (pet) {
			scene.remove(pet.root);
		}

		petType = nextType;
		pet = PET_BUILDERS[petType]();
		scene.add(pet.root);
		pet.body.add(foamMesh);
		accessories = attachAccessories({head: pet.headAnchor, body: pet.body, collar: pet.collar, eyePositions: pet.eyePositions});
		for (const [id, object] of accessories) {
			toonify(object);
			object.visible = equippedIds.has(id);
		}
	}

	setPetType('cat');

	// 水しぶき
	const dropletMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.025, 8, 6), toon('#8fd3ff', {transparent: true, opacity: 0.8}), DROPLET_COUNT);
	dropletMesh.frustumCulled = false;
	dropletMesh.visible = false;
	scene.add(dropletMesh);
	const droplets = Array.from({length: DROPLET_COUNT}, () => ({position: new THREE.Vector3(), velocity: new THREE.Vector3()}));

	const flies = [createFly(), createFly()];
	scene.add(...flies);

	const target = {dirt: 0, mood: 'normal', scale: 0.78};
	const pose = {
		dirt: 0, wet: 0, lid: 0, earDroop: 0, headYaw: 0, headPitch: 0, headRoll: 0, tailLift: 0.4, tailSway: 0.22,
		breath: 1.8, scale: 0.78, tongue: 0, groom: 0, sad: 0, walk: 0, walkPhase: 0,
	};
	const brain = {mode: 'rest', until: 1.5, destination: new THREE.Vector3(), nextGroomAt: random(10, 18), nextBlinkAt: 2, blinkStart: -1, nextTwitchAt: 3, twitchStart: -1, twitchEar: 0};
	const position = new THREE.Vector3(0.6, 0, 1.9);
	let facing = FACE_CAMERA_YAW;
	let action = null;
	let hasReceivedState = false;
	let elapsed = 0;
	let wetTarget = 0;
	let foamProgress = 0;
	let isFoamVisible = false;
	const timers = [];

	const tempMatrix = new THREE.Matrix4();
	const tempQuaternion = new THREE.Quaternion();
	const tempScale = new THREE.Vector3();
	const tempVector = new THREE.Vector3();

	function startAction(type, duration) {
		action = {type, start: elapsed, duration};
	}

	function actionProgress(type) {
		if (!action || action.type !== type) {
			return -1;
		}

		return (elapsed - action.start) / action.duration;
	}

	// 部屋全体が収まるように正投影の範囲を合わせる
	const roomCorners = [];
	for (const x of [-ROOM_HALF - 0.3, ROOM_HALF + 0.05]) {
		for (const y of [-0.25, 3.25]) {
			for (const z of [-ROOM_HALF - 0.3, ROOM_HALF + 0.05]) {
				roomCorners.push(new THREE.Vector3(x, y, z));
			}
		}
	}

	function resize() {
		const {clientWidth: width, clientHeight: height} = container;
		if (width === 0 || height === 0) {
			return;
		}

		renderer.setSize(width, height, false);
		const bounds = new THREE.Box2();
		for (const corner of roomCorners) {
			const viewPoint = corner.clone().applyMatrix4(camera.matrixWorldInverse);
			bounds.expandByPoint(new THREE.Vector2(viewPoint.x, viewPoint.y));
		}

		const center = bounds.getCenter(new THREE.Vector2());
		const size = bounds.getSize(new THREE.Vector2()).multiplyScalar(1.04);
		const aspect = width / height;
		const halfHeight = Math.max(size.y, size.x / aspect) / 2;
		const halfWidth = halfHeight * aspect;
		camera.left = center.x - halfWidth;
		camera.right = center.x + halfWidth;
		camera.top = center.y + halfHeight;
		camera.bottom = center.y - halfHeight;
		camera.updateProjectionMatrix();
	}

	new ResizeObserver(resize).observe(container);
	resize();

	const raycaster = new THREE.Raycaster();
	const pointerNdc = new THREE.Vector2();
	function isPointerOnCat(event) {
		const rect = renderer.domElement.getBoundingClientRect();
		pointerNdc.set((((event.clientX - rect.left) / rect.width) * 2) - 1, -((((event.clientY - rect.top) / rect.height) * 2) - 1));
		raycaster.setFromCamera(pointerNdc, camera);
		return raycaster.intersectObject(pet.hitProxy).length > 0;
	}

	renderer.domElement.addEventListener('click', event => {
		if (isPointerOnCat(event)) {
			onPet?.();
		}
	});
	renderer.domElement.addEventListener('pointermove', event => {
		renderer.domElement.style.cursor = isPointerOnCat(event) ? 'pointer' : 'default';
	});

	// ---------- ねこの行動 ----------
	function pickDestination() {
		for (let attempt = 0; attempt < 30; attempt++) {
			const candidate = new THREE.Vector3(random(-ROOM_HALF, ROOM_HALF), 0, random(-ROOM_HALF, ROOM_HALF));
			if (candidate.distanceTo(position) < 1.2 || !room.isWalkable(candidate.x, candidate.z, 0.45)) {
				continue;
			}

			// 途中で家具にぶつからない直線の道だけを選ぶ
			let isClear = true;
			for (let step = 1; step <= 10; step++) {
				tempVector.lerpVectors(position, candidate, step / 10);
				if (!room.isWalkable(tempVector.x, tempVector.z, 0.4)) {
					isClear = false;
					break;
				}
			}

			if (isClear) {
				return candidate;
			}
		}

		return null;
	}

	function updateBrain(delta) {
		const mood = MOOD_POSE[target.mood] ?? MOOD_POSE.normal;
		if (elapsed > brain.nextBlinkAt) {
			brain.blinkStart = elapsed;
			brain.nextBlinkAt = elapsed + random(2.5, 6);
		}

		if (elapsed > brain.nextTwitchAt) {
			brain.twitchStart = elapsed;
			brain.twitchEar = Math.random() > 0.5 ? 0 : 1;
			brain.nextTwitchAt = elapsed + random(3, 8);
		}

		if (action && elapsed - action.start > action.duration) {
			if (action.type === 'groom') {
				brain.nextGroomAt = elapsed + random(15, 25);
			}

			action = null;
		}

		const isBusy = action !== null;
		if (isBusy) {
			brain.mode = 'rest';
			brain.until = elapsed + random(...mood.restTime);
		} else if (brain.mode === 'rest' && elapsed > brain.until) {
			if (target.mood !== 'sad' && elapsed > brain.nextGroomAt) {
				startAction('groom', 3.2);
			} else {
				const destination = pickDestination();
				if (destination) {
					brain.destination.copy(destination);
					brain.mode = 'walk';
				} else {
					brain.until = elapsed + 1;
				}
			}
		}

		let walkTarget = 0;
		let desiredFacing = facing;
		if (brain.mode === 'walk') {
			const toDestination = tempVector.subVectors(brain.destination, position);
			toDestination.y = 0;
			const distance = toDestination.length();
			desiredFacing = Math.atan2(toDestination.x, toDestination.z);
			// 向きがそろってから歩き出す
			const alignment = Math.max(0, Math.cos(angleDifference(facing, desiredFacing)));
			if (distance < 0.05) {
				brain.mode = 'rest';
				brain.until = elapsed + random(...mood.restTime);
			} else {
				walkTarget = alignment * mood.walkSpeed;
				const step = Math.min(distance, WALK_SPEED * walkTarget * delta);
				position.addScaledVector(toDestination.normalize(), step);
			}
		} else if (isBusy && action.type !== 'groom') {
			desiredFacing = FACE_CAMERA_YAW;
		}

		facing = dampAngle(facing, desiredFacing, brain.mode === 'walk' ? 6 : 3, delta);
		pose.walk = damp(pose.walk, walkTarget, 8, delta);
		pose.walkPhase += delta * 11 * pose.walk;
	}

	function updatePose(delta) {
		const mood = MOOD_POSE[target.mood] ?? MOOD_POSE.normal;
		// 休んでいるときはカメラの方を見る
		const towardCamera = THREE.MathUtils.clamp(angleDifference(facing, FACE_CAMERA_YAW), -0.8, 0.8);
		let headYaw = brain.mode === 'walk' ? 0 : towardCamera;
		let headPitch = mood.headPitch;
		let headRoll = 0;
		let lid = mood.lid;
		let earDroop = mood.earDroop;
		let tailLift = mood.tailLift;
		let tailSway = mood.tailSway;
		let tongue = 0;
		let groom = 0;

		// 毛づくろい: 前足を上げて、首をかしげながらなめる
		const groomProgress = actionProgress('groom');
		if (groomProgress >= 0) {
			groom = Math.min(1, Math.sin(Math.min(groomProgress, 1) * Math.PI) * 1.8);
			headYaw = 0.35 * groom;
			headPitch = 0.3 * groom;
			headRoll = -0.2 * groom;
			lid = Math.max(lid, 0.7 * groom);
			tongue = Math.max(0, Math.sin(elapsed * 10)) * groom;
		}

		const eat = actionProgress('eat');
		if (eat >= 0) {
			const weight = Math.min(1, Math.sin(Math.min(eat, 1) * Math.PI) * 2);
			headYaw = 0;
			headPitch = (0.55 * weight) + (Math.sin(elapsed * 14) * 0.08 * weight);
			lid = Math.max(lid, 0.7 * weight);
			tongue = Math.max(0, Math.sin(elapsed * 14)) * weight;
		}

		bowl.visible = eat >= 0;

		const pet = actionProgress('pet');
		if (pet >= 0) {
			const weight = Math.min(1, Math.sin(Math.min(pet, 1) * Math.PI) * 2);
			lid = Math.max(lid, weight);
			headRoll = 0.3 * weight;
			headPitch = -0.15 * weight;
			earDroop = Math.min(earDroop, 0.2);
			tailLift = 1;
			tailSway = 0.4;
		}

		if (actionProgress('bath') >= 0) {
			lid = 1;
			earDroop = 0.7;
			headYaw = 0;
			headPitch = 0.1;
		}

		const blinkTime = elapsed - brain.blinkStart;
		if (blinkTime < 0.14) {
			lid = 1;
		}

		pose.headYaw = damp(pose.headYaw, headYaw, 5, delta);
		pose.headPitch = damp(pose.headPitch, headPitch, 5, delta);
		pose.headRoll = damp(pose.headRoll, headRoll, 5, delta);
		pose.lid = blinkTime < 0.14 ? lid : damp(pose.lid, lid, 12, delta);
		pose.earDroop = damp(pose.earDroop, earDroop, 5, delta);
		pose.tailLift = damp(pose.tailLift, tailLift, 2, delta);
		pose.tailSway = damp(pose.tailSway, tailSway, 2, delta);
		pose.breath = damp(pose.breath, mood.breath, 1, delta);
		pose.tongue = damp(pose.tongue, tongue, 20, delta);
		pose.groom = damp(pose.groom, groom, 8, delta);
		pose.sad = damp(pose.sad, mood.sad, 2, delta);
		pose.dirt = damp(pose.dirt, target.dirt, 2.5, delta);
		pose.wet = damp(pose.wet, wetTarget, 3, delta);
		pose.scale = damp(pose.scale, target.scale, 3, delta);
	}

	function applyPose() {
		pet.root.position.copy(position);
		pet.root.rotation.y = facing;
		const size = pose.scale * CAT_SIZE;
		pet.root.scale.setScalar(size);

		const breathing = Math.sin(elapsed * pose.breath * Math.PI * 0.5);
		pet.body.scale.set(1 + (breathing * 0.015), 1 + (breathing * 0.01), 1);
		pet.body.rotation.set(0, 0, 0);
		pet.body.position.x = 0;

		const jump = actionProgress('jump');
		if (jump >= 0 && jump <= 1) {
			const height = Math.max(0, Math.sin(((jump - 0.15) / 0.85) * Math.PI)) * 0.45;
			const squash = jump < 0.15 ? Math.sin((jump / 0.15) * Math.PI) * 0.12 : 0;
			pet.root.position.y = height * size;
			pet.root.scale.set(size * (1 + squash), size * (1 - squash), size * (1 + squash));
		}

		let headYaw = pose.headYaw;
		const shake = actionProgress('shake');
		if (shake >= 0 && shake <= 1) {
			const decay = 1 - shake;
			pet.body.rotation.z = Math.sin(elapsed * 42) * 0.14 * decay;
			headYaw += Math.sin((elapsed * 42) + 1) * 0.5 * decay;
		}

		if (actionProgress('pet') >= 0) {
			// ゴロゴロ喉を鳴らす細かい振動
			pet.body.position.x = Math.sin(elapsed * 160) * 0.004;
		}

		const twitchTime = elapsed - brain.twitchStart;
		const earTwitch = [0, 1].map(index => (brain.twitchEar === index && twitchTime < 0.25 ? Math.sin((twitchTime / 0.25) * Math.PI) : 0));

		pet.update({
			elapsed,
			walkPhase: pose.walkPhase,
			walk: pose.walk,
			headYaw,
			headPitch: pose.headPitch,
			headRoll: pose.headRoll,
			lid: pose.lid,
			earDroop: pose.earDroop,
			earTwitch,
			tailSway: pose.tailSway,
			tailLift: pose.tailLift,
			tongue: pose.tongue,
			groom: pose.groom,
			sad: pose.sad,
		});

		pet.uniforms.uDirt.value = pose.dirt;
		pet.uniforms.uWet.value = pose.wet;
		pet.uniforms.uRootY.value = pet.root.position.y;
		pet.uniforms.uPetScale.value = size;

		shadow.position.set(position.x, 0.01, position.z);
		shadow.scale.setScalar(size * (1 - (pet.root.position.y * 0.5)));
	}

	function updateFoam(delta) {
		foamProgress = damp(foamProgress, isFoamVisible ? 1 : 0, isFoamVisible ? 3 : 8, delta);
		foamMesh.visible = foamProgress > 0.01;
		if (!foamMesh.visible) {
			return;
		}

		const bathTime = action?.type === 'bath' ? elapsed - action.start : 99;
		for (const [index, bubble] of foamBubbles.entries()) {
			const grow = isFoamVisible ? THREE.MathUtils.clamp((bathTime - bubble.delay) / 0.35, 0, 1) : foamProgress;
			const size = bubble.size * grow * (1 + (Math.sin((elapsed * 3) + index) * 0.08));
			tempMatrix.compose(bubble.position, tempQuaternion, tempScale.setScalar(size));
			foamMesh.setMatrixAt(index, tempMatrix);
		}

		foamMesh.instanceMatrix.needsUpdate = true;
	}

	function burstDroplets() {
		const center = position.clone().setY(0.45 * pose.scale * CAT_SIZE);
		for (const droplet of droplets) {
			const angle = random(0, Math.PI * 2);
			droplet.position.copy(center).add(new THREE.Vector3(Math.cos(angle) * 0.25, random(-0.2, 0.35), Math.sin(angle) * 0.25));
			droplet.velocity.set(Math.cos(angle) * random(1, 2.2), random(1, 2.2), Math.sin(angle) * random(1, 2.2));
		}

		dropletMesh.visible = true;
	}

	function updateDroplets(delta) {
		if (!dropletMesh.visible) {
			return;
		}

		let isAnyAlive = false;
		for (const [index, droplet] of droplets.entries()) {
			droplet.velocity.y -= 6 * delta;
			droplet.position.addScaledVector(droplet.velocity, delta);
			const isAlive = droplet.position.y > 0;
			isAnyAlive ||= isAlive;
			tempMatrix.compose(droplet.position, tempQuaternion, tempScale.setScalar(isAlive ? 1 : 0));
			dropletMesh.setMatrixAt(index, tempMatrix);
		}

		dropletMesh.instanceMatrix.needsUpdate = true;
		dropletMesh.visible = isAnyAlive;
	}

	function updateFlies() {
		const isVisible = pose.dirt >= 0.75;
		for (const [index, fly] of flies.entries()) {
			fly.visible = isVisible;
			if (!isVisible) {
				continue;
			}

			const time = (elapsed * (1.6 + (index * 0.5))) + (index * 2);
			fly.position.set(
				position.x + (Math.sin(time) * 0.7),
				(0.9 * pose.scale * CAT_SIZE) + (Math.sin(time * 1.7) * 0.15),
				position.z + (Math.cos(time * 0.9) * 0.7),
			);
			fly.rotation.y = -time;
			for (const wing of fly.userData.wings) {
				wing.rotation.z = Math.sin(elapsed * 90) * 0.6;
			}
		}
	}

	// 吹き出しやキラキラなどの DOM エフェクトを、歩き回るねこの足元に追従させる
	function updateStage() {
		if (!stage) {
			return;
		}

		tempVector.copy(position).project(camera);
		stage.style.left = `${((tempVector.x + 1) / 2) * container.clientWidth}px`;
		stage.style.top = `${((1 - tempVector.y) / 2) * container.clientHeight}px`;
		stage.style.setProperty('--cat-scale', String(pose.scale * CAT_SIZE));
	}

	function tick(delta) {
		elapsed += delta;
		for (const timer of timers.filter(candidate => candidate.at <= elapsed)) {
			timers.splice(timers.indexOf(timer), 1);
			timer.run();
		}

		updateBrain(delta);
		updatePose(delta);
		applyPose();
		updateFoam(delta);
		updateDroplets(delta);
		updateFlies();
		updateStage();
	}

	let lastFrameTime = null;
	renderer.setAnimationLoop(time => {
		const delta = lastFrameTime === null ? 0 : Math.min((time - lastFrameTime) / 1000, 0.05);
		lastFrameTime = time;
		tick(delta);
		renderer.render(scene, camera);
	});

	function schedule(secondsFromNow, run) {
		timers.push({at: elapsed + secondsFromNow, run});
	}

	return {
		setState({dirt, mood, scale, equippedIds: nextEquippedIds}) {
			target.dirt = dirt;
			target.mood = mood;
			target.scale = scale;
			// 開いた瞬間に汚れや大きさが変化して見えないよう、初回は即座に反映する
			if (!hasReceivedState) {
				pose.dirt = dirt;
				pose.scale = scale;
				hasReceivedState = true;
			}

			equippedIds = nextEquippedIds;
			for (const [id, object] of accessories) {
				object.visible = equippedIds.has(id);
			}
		},
		setPetType,
		setRoom(roomState) {
			room.setTheme(roomState);
			// 家具が増えてねこと重なったら、空いている場所へ移す
			if (!room.isWalkable(position.x, position.z, 0.35)) {
				const destination = pickDestination();
				if (destination) {
					position.copy(destination);
				}
			}
		},
		pet() {
			startAction('pet', 2.2);
		},
		eat() {
			startAction('eat', 2.6);
			const toCamera = new THREE.Vector3(VIEW_DIRECTION.x, 0, VIEW_DIRECTION.z).normalize();
			bowl.position.copy(position).addScaledVector(toCamera, 0.6 * pose.scale * CAT_SIZE);
			bowl.scale.setScalar(pose.scale * CAT_SIZE);
		},
		jump() {
			startAction('jump', 0.7);
		},
		// ヘッドレスブラウザなどフレームがほぼ進まない環境で動きを検証するためのデバッグ用
		debugStep(seconds) {
			for (let remaining = seconds; remaining > 0; remaining -= 1 / 60) {
				tick(Math.min(remaining, 1 / 60));
			}

			renderer.render(scene, camera);
		},
		// 泡で洗う → すすぐ → ぶるぶる水を飛ばす → ふわっと乾いてジャンプ
		playBath({onRinse, onDry, onDone}) {
			startAction('bath', BATH_TIMELINE.shakeAt);
			isFoamVisible = true;
			wetTarget = 1;
			schedule(BATH_TIMELINE.rinseAt, () => {
				isFoamVisible = false;
				onRinse?.();
			});
			schedule(BATH_TIMELINE.shakeAt, () => {
				startAction('shake', 0.9);
				burstDroplets();
			});
			schedule(BATH_TIMELINE.dryAt, () => {
				wetTarget = 0;
				startAction('jump', 0.7);
				onDry?.();
			});
			schedule(BATH_TIMELINE.end, () => onDone?.());
		},
	};
}
