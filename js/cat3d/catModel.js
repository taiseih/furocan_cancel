import * as THREE from 'three';
import {COAT, createFurMaterial, createFurMesh} from './fur.js';

export const TAIL_SEGMENT_COUNT = 16;
export const TAIL_SEGMENT_LENGTH = 0.055;
export const TAIL_CURL_PER_SEGMENT = 0.167;

// 頭ローカル座標での目と口元。毛を短くする穴と、目・アクセサリーの配置で共有する
export const EYE_POSITIONS = [new THREE.Vector3(0.062, 0.012, 0.112), new THREE.Vector3(-0.062, 0.012, 0.112)];
const MOUTH_POSITION = new THREE.Vector3(0, -0.045, 0.155);
const EYE_RADIUS = 0.032;

function ellipsoid(rx, ry, rz, widthSegments = 40, heightSegments = 28) {
	const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
	geometry.scale(rx, ry, rz);
	return geometry;
}

function capsuleAlongY(radius, length) {
	return new THREE.CapsuleGeometry(radius, length, 8, 20);
}

function createIrisTexture() {
	const size = 256;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext('2d');
	const center = size / 2;

	const gradient = context.createRadialGradient(center, center, 0, center, center, center);
	gradient.addColorStop(0, '#f2d36b');
	gradient.addColorStop(0.45, '#d9b443');
	gradient.addColorStop(0.8, '#9fae45');
	gradient.addColorStop(0.93, '#6f7d2e');
	gradient.addColorStop(1, '#2d2a12');
	context.fillStyle = gradient;
	context.fillRect(0, 0, size, size);

	// 虹彩の放射状の筋
	for (let index = 0; index < 220; index++) {
		const angle = Math.random() * Math.PI * 2;
		const inner = center * (0.15 + (Math.random() * 0.2));
		const outer = center * (0.6 + (Math.random() * 0.35));
		context.strokeStyle = Math.random() > 0.5 ? 'rgba(255, 240, 170, 0.25)' : 'rgba(90, 70, 20, 0.22)';
		context.lineWidth = 1 + Math.random();
		context.beginPath();
		context.moveTo(center + (Math.cos(angle) * inner), center + (Math.sin(angle) * inner));
		context.lineTo(center + (Math.cos(angle) * outer), center + (Math.sin(angle) * outer));
		context.stroke();
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

// 球の正面に虹彩テクスチャを平行投影で貼るためのUV
function planarFrontUv(geometry, radius) {
	const positions = geometry.attributes.position;
	const uvs = geometry.attributes.uv;
	for (let index = 0; index < positions.count; index++) {
		uvs.setXY(index, (positions.getX(index) / radius * 0.5) + 0.5, (positions.getY(index) / radius * 0.5) + 0.5);
	}

	uvs.needsUpdate = true;
}

function createEyeMaterial(irisTexture, pupilUniform) {
	const material = new THREE.MeshPhysicalMaterial({
		map: irisTexture,
		emissiveMap: irisTexture,
		emissive: new THREE.Color('#ffffff'),
		emissiveIntensity: 0.22,
		roughness: 0.08,
		clearcoat: 1,
		clearcoatRoughness: 0.02,
	});

	material.onBeforeCompile = shader => {
		shader.uniforms.uPupilWidth = pupilUniform;
		shader.fragmentShader = `uniform float uPupilWidth;\n${shader.fragmentShader}`
			.replace('#include <map_fragment>', `
				#include <map_fragment>
				vec2 pupilCoord = (vMapUv - 0.5) * 2.0;
				float pupilMask = 1.0 - smoothstep(0.88, 1.0, length(vec2(pupilCoord.x / uPupilWidth, pupilCoord.y / 0.66)));
				diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.004), pupilMask);
			`)
			.replace('#include <emissivemap_fragment>', `
				#include <emissivemap_fragment>
				totalEmissiveRadiance *= 1.0 - pupilMask;
			`);
	};

	return material;
}

function tube(points, radius, material) {
	const curve = new THREE.CatmullRomCurve3(points);
	return new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius, 5, false), material);
}

export function buildCat(sharedUniforms) {
	const furMeshes = [];
	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add(body);

	function addFur(parent, geometry, options = {}, position = [0, 0, 0], rotation = [0, 0, 0]) {
		const mesh = createFurMesh(geometry, createFurMaterial(sharedUniforms, options));
		mesh.position.set(...position);
		mesh.rotation.set(...rotation);
		parent.add(mesh);
		furMeshes.push(mesh);
		return mesh;
	}

	// 頭の穴は頭ローカル座標で定義し、パーツの位置分ずらして渡す
	function headHolesFor(partPosition) {
		const offset = new THREE.Vector3(...partPosition);
		return [
			[...EYE_POSITIONS[0].clone().sub(offset).toArray(), 0.036],
			[...EYE_POSITIONS[1].clone().sub(offset).toArray(), 0.036],
			[...MOUTH_POSITION.clone().sub(offset).toArray(), 0.03],
		];
	}

	// ---------- 胴体 ----------
	addFur(body, ellipsoid(0.15, 0.16, 0.2), {stripeDir: [0, 1, 0.4]}, [0.13, 0.16, -0.1], [0, 0.2, 0]);
	addFur(body, ellipsoid(0.15, 0.16, 0.2), {stripeDir: [0, 1, 0.4]}, [-0.13, 0.16, -0.1], [0, -0.2, 0]);
	addFur(body, ellipsoid(0.19, 0.17, 0.2), {stripeDir: [0, 1, 0]}, [0, 0.2, -0.14]);
	addFur(body, ellipsoid(0.17, 0.27, 0.17), {creamFront: 1, creamZ: 0.08, stripeDir: [0, 1, 0.3]}, [0, 0.36, -0.04], [0.3, 0, 0]);
	addFur(body, ellipsoid(0.14, 0.17, 0.13), {creamFront: 1, creamZ: 0.12}, [0, 0.46, 0.06], [0.3, 0, 0]);
	addFur(body, ellipsoid(0.11, 0.12, 0.11), {creamFront: 1, creamZ: 0.12}, [0, 0.6, 0.06]);

	// 後ろ足
	addFur(body, ellipsoid(0.048, 0.034, 0.1), {cream: 0.6, furLength: 0.016}, [0.16, 0.034, 0.03]);
	addFur(body, ellipsoid(0.048, 0.034, 0.1), {cream: 0.6, furLength: 0.016}, [-0.16, 0.034, 0.03]);

	// 前足: 肩 → 肘 → 手先 の2関節にして毛づくろいで曲げられるようにする
	const frontLegs = [0.075, -0.075].map(x => {
		const shoulder = new THREE.Group();
		shoulder.position.set(x, 0.4, 0.13);
		body.add(shoulder);
		addFur(shoulder, capsuleAlongY(0.045, 0.15), {furLength: 0.02, stripeAmount: 0.4}, [0, -0.085, 0]);
		const elbow = new THREE.Group();
		elbow.position.set(0, -0.17, 0);
		shoulder.add(elbow);
		addFur(elbow, capsuleAlongY(0.04, 0.17), {furLength: 0.018, cream: 0.2, stripeAmount: 0.35}, [0, -0.1, 0]);
		addFur(elbow, ellipsoid(0.05, 0.03, 0.062), {furLength: 0.014, cream: 0.75}, [0, -0.2, 0.035]);
		return {shoulder, elbow};
	});

	// ---------- しっぽ ----------
	const tailJoints = [];
	let tailParent = body;
	for (let index = 0; index < TAIL_SEGMENT_COUNT; index++) {
		const joint = new THREE.Group();
		if (index === 0) {
			joint.position.set(0, 0.045, -0.32);
			joint.rotation.y = -Math.PI / 2;
		} else {
			joint.position.set(0, 0, TAIL_SEGMENT_LENGTH);
			joint.rotation.y = TAIL_CURL_PER_SEGMENT;
		}

		tailParent.add(joint);
		const radius = 0.036 - (index * 0.0012);
		const geometry = capsuleAlongY(radius, TAIL_SEGMENT_LENGTH);
		geometry.rotateX(Math.PI / 2);
		geometry.translate(0, 0, TAIL_SEGMENT_LENGTH / 2);
		const mesh = addFur(joint, geometry, {stripeDir: [0, 0, 1], stripeFreq: 80, furLength: 0.03});
		// しっぽの縞は曲がり具合に関係なく輪になるよう、根元からの距離で模様を決める
		mesh.userData.restOverride = new THREE.Matrix4().makeTranslation(0, 0, index * TAIL_SEGMENT_LENGTH);
		tailJoints.push(joint);
		tailParent = joint;
	}

	// ---------- 頭 ----------
	const neck = new THREE.Group();
	neck.position.set(0, 0.68, 0.08);
	body.add(neck);
	const head = new THREE.Group();
	head.position.set(0, 0.075, 0.035);
	head.scale.setScalar(1.15);
	neck.add(head);

	addFur(head, ellipsoid(0.165, 0.145, 0.15), {
		holes: headHolesFor([0, 0, 0]),
		stripeDir: [1, 0, 0],
		stripeFreq: 120,
		stripeAmount: 0.7,
		stripeMinY: 0.8,
		creamFront: 0.5,
		creamZ: 0.83,
	});
	for (const x of [0.08, -0.08]) {
		const position = [x, -0.06, 0.06];
		addFur(head, ellipsoid(0.07, 0.05, 0.06), {holes: headHolesFor(position), cream: 0.35, stripeAmount: 0.3, furLength: 0.024}, position);
	}

	for (const x of [0.028, -0.028]) {
		const position = [x, -0.058, 0.128];
		addFur(head, ellipsoid(0.04, 0.032, 0.035), {holes: headHolesFor(position), cream: 1, furLength: 0.01}, position);
	}

	addFur(head, ellipsoid(0.03, 0.025, 0.03), {cream: 1, furLength: 0.01}, [0, -0.09, 0.11]);

	// 耳: 後ろ半分の円錐に毛、内側はピンクの皮膚を裏面で見せてくぼみを表現
	const earGeometry = () => {
		const geometry = new THREE.CylinderGeometry(0, 0.06, 0.12, 20, 4, true, Math.PI / 2, Math.PI);
		geometry.translate(0, 0.06, 0);
		geometry.scale(1, 1, 0.55);
		return geometry;
	};

	const innerEarMaterial = new THREE.MeshStandardMaterial({color: '#c98f86', roughness: 0.8, side: THREE.BackSide});
	const ears = [1, -1].map(side => {
		const ear = new THREE.Group();
		ear.position.set(0.088 * side, 0.105, -0.01);
		ear.rotation.set(-0.15, 0, -0.3 * side);
		head.add(ear);
		addFur(ear, earGeometry(), {furLength: 0.012, stripeAmount: 0.2});
		const inner = new THREE.Mesh(earGeometry(), innerEarMaterial);
		inner.scale.setScalar(0.9);
		inner.position.set(0, 0.004, 0.004);
		ear.add(inner);
		return ear;
	});

	// 目
	const pupilUniform = {value: 0.3};
	const irisTexture = createIrisTexture();
	const eyeMaterial = createEyeMaterial(irisTexture, pupilUniform);
	const lidMaterial = new THREE.MeshStandardMaterial({color: '#b86e30', roughness: 0.95});
	const rimMaterial = new THREE.MeshStandardMaterial({color: '#2b1d14', roughness: 0.6});
	const eyeballGeometry = new THREE.SphereGeometry(EYE_RADIUS, 32, 24);
	planarFrontUv(eyeballGeometry, EYE_RADIUS);
	const lidGeometry = new THREE.SphereGeometry(EYE_RADIUS * 1.09, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
	const rimGeometry = new THREE.TorusGeometry(EYE_RADIUS * 0.93, 0.0035, 8, 40);
	const lashGeometry = new THREE.TorusGeometry(EYE_RADIUS * 1.09, 0.003, 6, 40, Math.PI);

	const lids = EYE_POSITIONS.map((position, index) => {
		const side = index === 0 ? 1 : -1;
		const eye = new THREE.Group();
		eye.position.copy(position);
		eye.rotation.set(0, 0.18 * side, -0.12 * side);
		head.add(eye);
		eye.add(new THREE.Mesh(eyeballGeometry, eyeMaterial));
		const rim = new THREE.Mesh(rimGeometry, rimMaterial);
		rim.position.z = EYE_RADIUS * 0.37;
		eye.add(rim);
		const lid = new THREE.Mesh(lidGeometry, lidMaterial);
		// まぶたを少し平たくして、閉じたときに目玉が出っ張って見えないようにする
		lid.scale.z = 0.8;
		// まぶたの縁を濃い線にして、閉じた目が「閉じている」と分かるようにする
		const lashLine = new THREE.Mesh(lashGeometry, rimMaterial);
		lashLine.rotation.x = Math.PI / 2;
		lid.add(lashLine);
		eye.add(lid);
		return lid;
	});

	// 鼻と口
	const noseGeometry = ellipsoid(0.022, 0.014, 0.014, 24, 16);
	const nosePositions = noseGeometry.attributes.position;
	for (let index = 0; index < nosePositions.count; index++) {
		const y = nosePositions.getY(index);
		// 下側をすぼめて逆三角形の鼻にする
		nosePositions.setX(index, nosePositions.getX(index) * (y < 0 ? 1 + (y / 0.014 * 0.6) : 1));
	}

	noseGeometry.computeVertexNormals();
	const nose = new THREE.Mesh(noseGeometry, new THREE.MeshPhysicalMaterial({color: '#c97b78', roughness: 0.4, clearcoat: 0.4}));
	nose.position.set(0, -0.03, 0.152);
	head.add(nose);

	const mouthMaterial = new THREE.MeshStandardMaterial({color: '#3b2620', roughness: 0.7});
	head.add(tube([new THREE.Vector3(0, -0.042, 0.164), new THREE.Vector3(0, -0.062, 0.166)], 0.0022, mouthMaterial));
	for (const side of [1, -1]) {
		head.add(tube([
			new THREE.Vector3(0, -0.062, 0.166),
			new THREE.Vector3(0.012 * side, -0.072, 0.165),
			new THREE.Vector3(0.026 * side, -0.068, 0.158),
		], 0.0022, mouthMaterial));
	}

	// ひげ
	const whiskerMaterial = new THREE.MeshStandardMaterial({color: '#f6f1e7', roughness: 0.35});
	const whiskerGroups = [1, -1].map(side => {
		const group = new THREE.Group();
		group.position.set(0.045 * side, -0.058, 0.15);
		head.add(group);
		for (let index = 0; index < 5; index++) {
			const spread = (index - 2) * 0.022;
			group.add(tube([
				new THREE.Vector3(0, index * 0.004, 0),
				new THREE.Vector3(0.09 * side, 0.01 + (spread * 0.6), -0.005),
				new THREE.Vector3(0.18 * side, spread - 0.015, -0.03),
			], 0.0011, whiskerMaterial));
		}

		for (let index = 0; index < 2; index++) {
			head.add(tube([
				new THREE.Vector3(0.05 * side, 0.06, 0.13),
				new THREE.Vector3(0.09 * side, 0.1 + (index * 0.012), 0.12),
				new THREE.Vector3(0.13 * side, 0.12 + (index * 0.02), 0.09),
			], 0.0009, whiskerMaterial));
		}

		return group;
	});

	// なでる判定用の見えない当たり判定
	const hitProxy = new THREE.Mesh(ellipsoid(0.3, 0.5, 0.3, 12, 8), new THREE.MeshBasicMaterial({visible: false}));
	hitProxy.position.set(0, 0.45, 0);
	root.add(hitProxy);

	// 静止ポーズでのパーツ位置を模様の座標系として固定し、動いても模様が滑らないようにする
	root.updateMatrixWorld(true);
	const rootInverse = root.matrixWorld.clone().invert();
	for (const mesh of furMeshes) {
		const restMatrix = mesh.userData.restOverride ?? new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld);
		mesh.material.uniforms.uRestMatrix.value.copy(restMatrix);
	}

	return {
		root,
		body,
		neck,
		head,
		ears,
		lids,
		lidMaterial,
		pupilUniform,
		frontLegs,
		tailJoints,
		whiskerGroups,
		hitProxy,
	};
}
