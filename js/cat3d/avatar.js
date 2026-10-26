import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createFurSharedUniforms} from './fur.js';
import {buildCat, TAIL_CURL_PER_SEGMENT} from './catModel.js';
import {attachAccessories} from './accessories.js';

const LID_OPEN = -0.9;
const LID_CLOSED = 1.5;
const FOAM_COUNT = 110;
const DROPLET_COUNT = 70;
const BATH_TIMELINE = {rinseAt: 1.4, shakeAt: 1.7, dryAt: 2.6, end: 3.4};

const MOOD_POSE = {
	happy: {lid: 0.12, pupil: 0.5, earFlat: 0, headPitch: -0.05, tailLift: 1, tailSway: 0.18, breath: 1.6},
	normal: {lid: 0, pupil: 0.3, earFlat: 0, headPitch: 0, tailLift: 0, tailSway: 0.12, breath: 1.8},
	sad: {lid: 0.45, pupil: 0.2, earFlat: 1, headPitch: 0.32, tailLift: 0, tailSway: 0.03, breath: 1.1},
};

const random = (min, max) => min + (Math.random() * (max - min));
const damp = (current, target, rate, delta) => current + ((target - current) * (1 - Math.exp(-rate * delta)));

function sampleEllipsoid(center, radii) {
	const direction = new THREE.Vector3(random(-1, 1), random(-1, 1), random(-1, 1)).normalize();
	return new THREE.Vector3(...center).add(direction.multiply(new THREE.Vector3(...radii)));
}

// 泡を乗せる位置。体・頭の大まかな楕円体の表面から選ぶ
const FOAM_ANCHORS = [
	{center: [0, 0.36, -0.04], radii: [0.21, 0.3, 0.21], weight: 3},
	{center: [0, 0.2, -0.12], radii: [0.3, 0.2, 0.24], weight: 2},
	{center: [0, 0.82, 0.11], radii: [0.2, 0.17, 0.18], weight: 2},
];

function createFloorShadow() {
	const canvas = document.createElement('canvas');
	canvas.width = 128;
	canvas.height = 128;
	const context = canvas.getContext('2d');
	const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
	gradient.addColorStop(0, 'rgba(40, 25, 15, 0.45)');
	gradient.addColorStop(0.6, 'rgba(40, 25, 15, 0.18)');
	gradient.addColorStop(1, 'rgba(40, 25, 15, 0)');
	context.fillStyle = gradient;
	context.fillRect(0, 0, 128, 128);
	const shadow = new THREE.Mesh(
		new THREE.PlaneGeometry(1, 1),
		new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false}),
	);
	shadow.rotation.x = -Math.PI / 2;
	shadow.scale.set(0.95, 0.8, 1);
	shadow.position.set(-0.05, 0.002, 0);
	return shadow;
}

function createFoodBowl() {
	const group = new THREE.Group();
	const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 32), new THREE.MeshStandardMaterial({color: '#b7834e', roughness: 0.7}));
	stand.position.y = 0.1;
	const bowlProfile = [[0, 0], [0.085, 0.004], [0.11, 0.05], [0.105, 0.052], [0.08, 0.012], [0, 0.012]].map(([x, y]) => new THREE.Vector2(x, y));
	const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 40), new THREE.MeshPhysicalMaterial({color: '#f7f2ea', roughness: 0.15, clearcoat: 1, side: THREE.DoubleSide}));
	bowl.position.y = 0.2;
	group.add(stand, bowl);
	const kibbleMaterial = new THREE.MeshStandardMaterial({color: '#8b5a2b', roughness: 0.8});
	for (let index = 0; index < 18; index++) {
		const kibble = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), kibbleMaterial);
		const angle = random(0, Math.PI * 2);
		const distance = random(0, 0.07);
		kibble.position.set(Math.cos(angle) * distance, 0.225 + random(0, 0.015), Math.sin(angle) * distance);
		group.add(kibble);
	}

	group.position.set(0, 0, 0.45);
	group.visible = false;
	return group;
}

function createFly() {
	const group = new THREE.Group();
	const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({color: '#151515', roughness: 0.4}));
	bodyMesh.scale.set(0.012, 0.01, 0.018);
	group.add(bodyMesh);
	const wingMaterial = new THREE.MeshBasicMaterial({color: '#dfe8f0', transparent: true, opacity: 0.55, side: THREE.DoubleSide});
	const wings = [1, -1].map(side => {
		const wing = new THREE.Mesh(new THREE.CircleGeometry(0.016, 12), wingMaterial);
		wing.scale.set(0.6, 1, 1);
		wing.position.set(0.01 * side, 0.008, -0.004);
		wing.rotation.x = -Math.PI / 2;
		group.add(wing);
		return wing;
	});
	group.userData.wings = wings;
	return group;
}

export function createCatAvatar(container, {onPet} = {}) {
	const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.05;
	renderer.domElement.className = 'cat-canvas';
	container.append(renderer.domElement);

	const scene = new THREE.Scene();
	scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
	scene.environmentIntensity = 0.6;
	const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
	camera.position.set(0, 0.8, 2.35);
	camera.lookAt(0, 0.46, 0);

	const keyLight = new THREE.DirectionalLight('#fff3e0', 2.2);
	keyLight.position.set(1.2, 2.4, 1.8);
	scene.add(keyLight, new THREE.HemisphereLight('#dfeaff', '#8a6a50', 0.9));

	const sharedUniforms = createFurSharedUniforms();
	sharedUniforms.uLightDir.value.copy(keyLight.position).normalize();
	const rig = buildCat(sharedUniforms);
	const accessories = attachAccessories(rig);
	scene.add(rig.root);
	scene.add(createFloorShadow());
	const bowl = createFoodBowl();
	scene.add(bowl);

	const earBaseRotations = rig.ears.map(ear => ear.rotation.clone());

	// 泡
	const foamMesh = new THREE.InstancedMesh(
		new THREE.SphereGeometry(1, 16, 12),
		new THREE.MeshPhysicalMaterial({color: '#ffffff', roughness: 0.3, clearcoat: 1, iridescence: 0.8, iridescenceIOR: 1.3, transparent: true, opacity: 0.93}),
		FOAM_COUNT,
	);
	const totalWeight = FOAM_ANCHORS.reduce((sum, anchor) => sum + anchor.weight, 0);
	const foamBubbles = Array.from({length: FOAM_COUNT}, () => {
		let pick = random(0, totalWeight);
		const anchor = FOAM_ANCHORS.find(candidate => (pick -= candidate.weight) <= 0) ?? FOAM_ANCHORS[0];
		return {position: sampleEllipsoid(anchor.center, anchor.radii), size: random(0.02, 0.055), delay: random(0, 0.9)};
	});
	foamMesh.frustumCulled = false;
	foamMesh.visible = false;
	rig.body.add(foamMesh);

	// 水しぶき
	const dropletMesh = new THREE.InstancedMesh(
		new THREE.SphereGeometry(0.011, 10, 8),
		new THREE.MeshPhysicalMaterial({color: '#9fd8ff', roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.55}),
		DROPLET_COUNT,
	);
	dropletMesh.frustumCulled = false;
	dropletMesh.visible = false;
	scene.add(dropletMesh);
	const droplets = Array.from({length: DROPLET_COUNT}, () => ({position: new THREE.Vector3(), velocity: new THREE.Vector3()}));

	const flies = [createFly(), createFly()];
	scene.add(...flies);

	const target = {dirt: 0, mood: 'normal', scale: 0.78};
	const pose = {
		dirt: 0, wet: 0, lid: 0, pupil: 0.3, earFlat: 0, headYaw: 0, headPitch: 0, headRoll: 0,
		tailLift: 0, tailSway: 0.12, breath: 1.8, bodyLean: 0, bodyDrop: 0, scale: 0.78,
	};
	const pointer = {x: 0, y: 0, lastMovedAt: -100};
	const idle = {nextBlinkAt: 2, blinkStart: -1, nextTwitchAt: 3, twitchStart: -1, twitchEar: 0, nextGroomAt: random(12, 20), wanderYaw: 0, wanderPitch: 0, nextWanderAt: 0};
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

	function startAction(type, duration) {
		action = {type, start: elapsed, duration};
	}

	function actionProgress(type) {
		if (!action || action.type !== type) {
			return -1;
		}

		return (elapsed - action.start) / action.duration;
	}

	function resize() {
		const {clientWidth: width, clientHeight: height} = container;
		if (width === 0 || height === 0) {
			return;
		}

		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	}

	new ResizeObserver(resize).observe(container);
	resize();

	window.addEventListener('pointermove', event => {
		const rect = renderer.domElement.getBoundingClientRect();
		pointer.x = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width * 2) - 1, -1.5, 1.5);
		pointer.y = THREE.MathUtils.clamp(((event.clientY - rect.top) / rect.height * 2) - 1, -1.5, 1.5);
		pointer.lastMovedAt = elapsed;
	});

	const raycaster = new THREE.Raycaster();
	renderer.domElement.addEventListener('click', event => {
		const rect = renderer.domElement.getBoundingClientRect();
		const ndc = new THREE.Vector2((((event.clientX - rect.left) / rect.width) * 2) - 1, -((((event.clientY - rect.top) / rect.height) * 2) - 1));
		raycaster.setFromCamera(ndc, camera);
		if (raycaster.intersectObject(rig.hitProxy).length > 0) {
			onPet?.();
		}
	});

	function updateIdle(delta) {
		if (elapsed > idle.nextBlinkAt) {
			idle.blinkStart = elapsed;
			idle.nextBlinkAt = elapsed + random(2.5, 6);
		}

		if (elapsed > idle.nextTwitchAt) {
			idle.twitchStart = elapsed;
			idle.twitchEar = Math.random() > 0.5 ? 0 : 1;
			idle.nextTwitchAt = elapsed + random(3, 8);
		}

		if (elapsed > idle.nextWanderAt) {
			idle.wanderYaw = random(-0.5, 0.5);
			idle.wanderPitch = random(-0.15, 0.15);
			idle.nextWanderAt = elapsed + random(2, 5);
		}

		if (!action && target.mood !== 'sad' && elapsed > idle.nextGroomAt) {
			startAction('groom', 3.2);
		}

		if (action && elapsed - action.start > action.duration) {
			if (action.type === 'groom') {
				idle.nextGroomAt = elapsed + random(18, 30);
			}

			action = null;
		}

		pose.dirt = damp(pose.dirt, target.dirt, 2.5, delta);
		pose.wet = damp(pose.wet, wetTarget, 3, delta);
		pose.scale = damp(pose.scale, target.scale, 3, delta);
	}

	function updatePose(delta) {
		const mood = MOOD_POSE[target.mood] ?? MOOD_POSE.normal;
		const isPointerActive = elapsed - pointer.lastMovedAt < 3;
		let lookYaw = isPointerActive ? pointer.x * 0.6 : idle.wanderYaw;
		let lookPitch = (isPointerActive ? pointer.y * 0.35 : idle.wanderPitch) + mood.headPitch;
		let lid = mood.lid;
		let pupil = mood.pupil;
		let earFlat = mood.earFlat;
		let headRoll = 0;
		let bodyLean = 0;
		let bodyDrop = 0;
		let tailLift = mood.tailLift;
		let tailSway = mood.tailSway;
		let shoulderAngle = 0;
		let elbowAngle = 0;

		const groom = actionProgress('groom');
		if (groom >= 0) {
			const weight = Math.sin(Math.min(groom, 1) * Math.PI);
			shoulderAngle = -1.2 * Math.min(1, weight * 1.6);
			elbowAngle = -1.94 * Math.min(1, weight * 1.6);
			lookYaw = -0.25 * weight;
			lookPitch = (0.7 * weight) + (Math.sin(elapsed * 22) * 0.06 * weight);
			lid = Math.max(lid, 0.7 * weight);
		}

		const eat = actionProgress('eat');
		if (eat >= 0) {
			const weight = Math.min(1, Math.sin(Math.min(eat, 1) * Math.PI) * 2);
			bodyLean = 0.35 * weight;
			bodyDrop = 0.04 * weight;
			lookYaw = 0;
			lookPitch = (0.95 * weight) + (Math.sin(elapsed * 14) * 0.07 * weight);
			lid = Math.max(lid, 0.4 * weight);
		}

		bowl.visible = eat >= 0;

		const pet = actionProgress('pet');
		if (pet >= 0) {
			const weight = Math.min(1, Math.sin(Math.min(pet, 1) * Math.PI) * 2);
			lid = Math.max(lid, weight);
			headRoll = 0.25 * weight;
			lookPitch = THREE.MathUtils.lerp(lookPitch, -0.2, weight);
			earFlat = Math.max(earFlat, 0.35 * weight);
			pupil = 0.5;
			tailLift = 1;
		}

		const bath = actionProgress('bath');
		if (bath >= 0) {
			lid = 0.85;
			earFlat = 0.6;
			lookYaw = 0;
			lookPitch = 0.1;
		}

		// まばたき
		const blinkTime = elapsed - idle.blinkStart;
		if (blinkTime < 0.16) {
			lid = Math.max(lid, Math.sin((blinkTime / 0.16) * Math.PI));
		}

		pose.headYaw = damp(pose.headYaw, lookYaw, 5, delta);
		pose.headPitch = damp(pose.headPitch, lookPitch, 5, delta);
		pose.headRoll = damp(pose.headRoll, headRoll, 5, delta);
		pose.lid = blinkTime < 0.16 ? lid : damp(pose.lid, lid, 10, delta);
		pose.pupil = damp(pose.pupil, pupil, 3, delta);
		pose.earFlat = damp(pose.earFlat, earFlat, 6, delta);
		pose.tailLift = damp(pose.tailLift, tailLift, 2, delta);
		pose.tailSway = damp(pose.tailSway, tailSway, 2, delta);
		pose.breath = damp(pose.breath, mood.breath, 1, delta);
		pose.bodyLean = damp(pose.bodyLean, bodyLean, 6, delta);
		pose.bodyDrop = damp(pose.bodyDrop, bodyDrop, 6, delta);

		for (const [index, {shoulder, elbow}] of rig.frontLegs.entries()) {
			const isGroomingLeg = index === 1;
			shoulder.rotation.x = damp(shoulder.rotation.x, isGroomingLeg ? shoulderAngle : 0, 8, delta);
			elbow.rotation.x = damp(elbow.rotation.x, isGroomingLeg ? elbowAngle : 0, 8, delta);
		}
	}

	function applyPose() {
		const breathing = Math.sin(elapsed * pose.breath * Math.PI * 0.5);
		rig.body.scale.set(1 + (breathing * 0.012), 1 + (breathing * 0.006), 1 + (breathing * 0.012));
		rig.body.rotation.x = pose.bodyLean;
		rig.body.position.y = -pose.bodyDrop;
		rig.body.rotation.z = 0;

		rig.neck.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll);

		// 耳: 寝かせると外側後ろへ倒れる。たまにぴくっと動く
		for (const [index, ear] of rig.ears.entries()) {
			const side = index === 0 ? 1 : -1;
			const twitchTime = elapsed - idle.twitchStart;
			const twitch = idle.twitchEar === index && twitchTime < 0.25 ? Math.sin((twitchTime / 0.25) * Math.PI) * 0.35 : 0;
			ear.rotation.x = earBaseRotations[index].x - (pose.earFlat * 0.7) - twitch;
			ear.rotation.z = earBaseRotations[index].z - (pose.earFlat * 0.7 * side);
		}

		for (const lid of rig.lids) {
			lid.rotation.x = THREE.MathUtils.lerp(LID_OPEN, LID_CLOSED, pose.lid);
		}

		rig.pupilUniform.value = pose.pupil;

		for (const [index, group] of rig.whiskerGroups.entries()) {
			group.rotation.y = Math.sin((elapsed * 1.3) + index) * 0.04;
		}

		// しっぽ: 先端ほど大きく揺れ、機嫌が良いと先が持ち上がる
		const count = rig.tailJoints.length;
		for (const [index, joint] of rig.tailJoints.entries()) {
			if (index === 0) {
				continue;
			}

			const ratio = index / count;
			const wave = Math.sin((elapsed * 1.7) - (index * 0.45)) * pose.tailSway * ratio;
			joint.rotation.y = TAIL_CURL_PER_SEGMENT + wave;
			joint.rotation.x = index > count - 6 ? -0.28 * pose.tailLift : 0;
		}

		rig.root.scale.setScalar(pose.scale);
		rig.root.position.y = 0;
		rig.root.rotation.set(0, 0, 0);
	}

	function applyJumpAndShake() {
		const jump = actionProgress('jump');
		if (jump >= 0 && jump <= 1) {
			const height = Math.max(0, Math.sin(((jump - 0.15) / 0.85) * Math.PI)) * 0.22;
			const squash = jump < 0.15 ? Math.sin((jump / 0.15) * Math.PI) * 0.08 : 0;
			rig.root.position.y = height * pose.scale;
			rig.root.scale.set(pose.scale * (1 + squash), pose.scale * (1 - squash), pose.scale * (1 + squash));
		}

		const shake = actionProgress('shake');
		if (shake >= 0 && shake <= 1) {
			const decay = 1 - shake;
			rig.body.rotation.z = Math.sin(elapsed * 42) * 0.1 * decay;
			rig.neck.rotation.y += Math.sin((elapsed * 42) + 1) * 0.5 * decay;
			for (const ear of rig.ears) {
				ear.rotation.z += Math.sin(elapsed * 50) * 0.3 * decay;
			}
		}

		const pet = actionProgress('pet');
		if (pet >= 0 && pet <= 1) {
			// ゴロゴロ喉を鳴らす細かい振動
			rig.body.position.x = Math.sin(elapsed * 160) * 0.0015;
		} else {
			rig.body.position.x = 0;
		}
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
		const center = new THREE.Vector3(0, 0.45 * pose.scale, 0);
		for (const droplet of droplets) {
			const angle = random(0, Math.PI * 2);
			droplet.position.copy(center).add(new THREE.Vector3(Math.cos(angle) * 0.2, random(-0.2, 0.35), Math.sin(angle) * 0.2));
			droplet.velocity.set(Math.cos(angle) * random(0.8, 1.8), random(0.6, 1.6), Math.sin(angle) * random(0.8, 1.8));
		}

		dropletMesh.visible = true;
	}

	function updateDroplets(delta) {
		if (!dropletMesh.visible) {
			return;
		}

		let isAnyAlive = false;
		for (const [index, droplet] of droplets.entries()) {
			droplet.velocity.y -= 4.5 * delta;
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
				Math.sin(time) * 0.32,
				(0.75 * pose.scale) + (Math.sin(time * 1.7) * 0.12),
				Math.cos(time * 0.9) * 0.3,
			);
			fly.rotation.y = -time;
			for (const wing of fly.userData.wings) {
				wing.rotation.z = Math.sin(elapsed * 90) * 0.6;
			}
		}
	}

	const lidBaseColor = rig.lidMaterial.color.clone();
	const mudColor = new THREE.Color('#3a2a18');

	function tick(delta) {
		elapsed += delta;
		for (const timer of timers.filter(candidate => candidate.at <= elapsed)) {
			timers.splice(timers.indexOf(timer), 1);
			timer.run();
		}

		updateIdle(delta);
		updatePose(delta);
		applyPose();
		applyJumpAndShake();
		updateFoam(delta);
		updateDroplets(delta);
		updateFlies();
		sharedUniforms.uDirt.value = pose.dirt;
		sharedUniforms.uWet.value = pose.wet;
		rig.lidMaterial.color.copy(lidBaseColor).lerp(mudColor, pose.dirt * 0.5).multiplyScalar(1 - (pose.wet * 0.4));
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
		setState({dirt, mood, scale, equippedIds}) {
			target.dirt = dirt;
			target.mood = mood;
			target.scale = scale;
			// 開いた瞬間に汚れや大きさが変化して見えないよう、初回は即座に反映する
			if (!hasReceivedState) {
				pose.dirt = dirt;
				pose.scale = scale;
				hasReceivedState = true;
			}

			for (const [id, object] of accessories) {
				object.visible = equippedIds.has(id);
			}
		},
		pet() {
			startAction('pet', 2.2);
		},
		eat() {
			startAction('eat', 2.6);
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
		// 泡で洗う → すすぐ → ぶるぶる水を飛ばす → 毛がふわっと乾く
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
