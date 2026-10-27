import * as THREE from 'three';
import {mesh, toon} from './toon';

// ねこ・ペキニーズなど、ちびキャラのペットで共通に使う部品

export const OUTLINE = 0.016;

export type PetUniforms = {
	uDirt: {value: number};
	uWet: {value: number};
	uRootY: {value: number};
	uPetScale: {value: number};
};

// 丸いぶち {center, radius, color} か、しま模様などを描く {test(point), color}
export type Patch =
	| {center: THREE.Vector3; radius: number; color: THREE.Color}
	| {test: (point: THREE.Vector3, wobble: number) => boolean; color: THREE.Color};

export type HeadSurface = {
	surface(x: number, y: number, lift?: number): {position: THREE.Vector3; normal: THREE.Vector3};
	place<T extends THREE.Object3D>(object: T, x: number, y: number, lift?: number): T;
};

export type Eye = {open: THREE.Group; closed: THREE.Mesh};

// avatar が毎フレーム計算してペットに渡す姿勢
export type PetPose = {
	elapsed: number;
	walkPhase: number;
	walk: number;
	headYaw: number;
	headPitch: number;
	headRoll: number;
	lid: number;
	earDroop: number;
	earTwitch: readonly number[];
	tailSway: number;
	tailLift: number;
	tongue: number;
	groom: number;
	sad: number;
};

// 泡を乗せる、胴体・頭のおおまかな楕円体
export type FoamAnchor = {center: THREE.Vector3Tuple; radii: THREE.Vector3Tuple; weight: number};

// ねこ・いぬのビルダーが返す、avatar から操作するための部品
export type PetRig = {
	root: THREE.Group;
	body: THREE.Group;
	head: THREE.Group;
	headAnchor: THREE.Group;
	eyePositions: THREE.Vector3[];
	collar: THREE.Group;
	hitProxy: THREE.Mesh;
	uniforms: PetUniforms;
	foamAnchors: FoamAnchor[];
	update(pose: PetPose): void;
};

// 配列の要素を取り出す。範囲外はモデルの定義の誤りなので例外にする
export function itemAt<T>(list: readonly T[], index: number): T {
	const value = list[index];
	if (value === undefined) {
		throw new RangeError(`index ${index} is out of range`);
	}

	return value;
}

const noiseGlsl = /* glsl */ `
	float petHash(vec3 p) {
		p = fract(p * 0.3183099 + 0.1);
		p *= 17.0;
		return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
	}

	float petNoise(vec3 x) {
		vec3 i = floor(x);
		vec3 f = fract(x);
		f = f * f * (3.0 - 2.0 * f);
		return mix(
			mix(mix(petHash(i), petHash(i + vec3(1, 0, 0)), f.x), mix(petHash(i + vec3(0, 1, 0)), petHash(i + vec3(1, 1, 0)), f.x), f.y),
			mix(mix(petHash(i + vec3(0, 0, 1)), petHash(i + vec3(1, 0, 1)), f.x), mix(petHash(i + vec3(0, 1, 1)), petHash(i + vec3(1, 1, 1)), f.x), f.y),
			f.z
		);
	}
`;

export function createPetUniforms(): PetUniforms {
	return {
		uDirt: {value: 0},
		uWet: {value: 0},
		uRootY: {value: 0},
		uPetScale: {value: 1},
	};
}

// トゥーン調の毛のマテリアルに、汚れ（泥のまだら）と濡れ（暗く青みがかる）を足す
export function createFurMaterial(uniforms: PetUniforms): THREE.MeshToonMaterial {
	const material = toon('#ffffff', {vertexColors: true});
	material.onBeforeCompile = shader => {
		Object.assign(shader.uniforms, uniforms);
		shader.vertexShader = `varying vec3 vPetLocal;\nvarying float vPetHeight;\nuniform float uRootY;\n${shader.vertexShader}`
			.replace('#include <begin_vertex>', `
				#include <begin_vertex>
				vPetLocal = transformed;
				vPetHeight = (modelMatrix * vec4(transformed, 1.0)).y - uRootY;
			`);
		shader.fragmentShader = `varying vec3 vPetLocal;\nvarying float vPetHeight;\nuniform float uDirt;\nuniform float uWet;\nuniform float uPetScale;\n${noiseGlsl}\n${shader.fragmentShader}`
			.replace('#include <color_fragment>', `
				#include <color_fragment>
				float dirtNoise = petNoise(vPetLocal * 6.0) * 0.7 + petNoise(vPetLocal * 13.0) * 0.3;
				float dirtThreshold = 1.0 - uDirt * 0.62;
				float mud = smoothstep(dirtThreshold, dirtThreshold + 0.08, dirtNoise + (0.45 - vPetHeight / uPetScale) * 0.3) * step(0.05, uDirt);
				diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.29, 0.17), mud * 0.85);
				diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.86, 0.8, 0.7), uDirt * 0.6);
				diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.72, 0.8, 0.9), uWet);
			`);
	};

	return material;
}

// 頂点カラーで模様を塗る。境界は少し揺らして手描きっぽくする
// patch は {center, radius, color} の丸いぶちか、しま模様などを描く {test(point), color}
export function paint(geometry: THREE.BufferGeometry, base: THREE.Color, patches: readonly Patch[] = []): THREE.BufferGeometry {
	const positions = geometry.getAttribute('position');
	const colors = new Float32Array(positions.count * 3);
	const point = new THREE.Vector3();
	for (let index = 0; index < positions.count; index++) {
		point.fromBufferAttribute(positions, index);
		let color = base;
		for (const patch of patches) {
			const wobble = Math.sin((point.x * 23) + (point.y * 17)) * Math.cos(point.z * 19) * 0.025;
			const isInside = 'test' in patch ? patch.test(point, wobble) : point.distanceTo(patch.center) + wobble < patch.radius;
			if (isInside) {
				color = patch.color;
			}
		}

		color.toArray(colors, index * 3);
	}

	geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	return geometry;
}

export function ellipsoid(radii: THREE.Vector3, segments: [number, number] = [40, 30]): THREE.SphereGeometry {
	const geometry = new THREE.SphereGeometry(1, ...segments);
	geometry.scale(radii.x, radii.y, radii.z);
	return geometry;
}

// 表面をもこもこに波打たせて、巻き毛や長毛のふくらみを出す。位置だけで決めるので継ぎ目も割れない
export function fluffy<T extends THREE.BufferGeometry>(geometry: T, amount = 0.025, frequency = 38): T {
	const positions = geometry.getAttribute('position');
	const normals = geometry.getAttribute('normal');
	const point = new THREE.Vector3();
	const normal = new THREE.Vector3();
	for (let index = 0; index < positions.count; index++) {
		point.fromBufferAttribute(positions, index);
		normal.fromBufferAttribute(normals, index);
		const bump = (Math.sin(point.x * frequency) * Math.sin(point.y * frequency * 1.1) * Math.sin(point.z * frequency * 0.9)) + 0.4;
		point.addScaledVector(normal, Math.abs(bump) * amount);
		positions.setXYZ(index, point.x, point.y, point.z);
	}

	geometry.computeVertexNormals();
	return geometry;
}

export function line(points: THREE.Vector3[], radius: number, material: THREE.Material): THREE.Mesh {
	return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, radius, 6, false), material);
}

// 頭の楕円体の正面に顔のパーツを貼るための、表面上の点と向き
export function createHeadSurface(radii: THREE.Vector3): HeadSurface {
	function surface(x: number, y: number, lift = 0) {
		const z = radii.z * Math.sqrt(Math.max(0, 1 - ((x / radii.x) ** 2) - ((y / radii.y) ** 2)));
		const normal = new THREE.Vector3(x / (radii.x ** 2), y / (radii.y ** 2), z / (radii.z ** 2)).normalize();
		return {position: new THREE.Vector3(x, y, z).addScaledVector(normal, lift), normal};
	}

	function place<T extends THREE.Object3D>(object: T, x: number, y: number, lift = 0): T {
		const {position, normal} = surface(x, y, lift);
		object.position.copy(position);
		object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
		return object;
	}

	return {surface, place};
}

const eyeMaterial = new THREE.MeshBasicMaterial({color: '#2b1f1a'});
const highlightMaterial = new THREE.MeshBasicMaterial({color: '#ffffff'});
const blushMaterial = new THREE.MeshBasicMaterial({color: '#ffb0bf', transparent: true, opacity: 0.85, depthWrite: false});

// 黒目（ハイライト付き）と、閉じたときの「∩」の線、ほっぺ
type EyeOptions = {eyeX: number; eyeY?: number; eyeRadii: THREE.Vector3; blushX: number; blushY: number; eyeRing?: string | undefined};

export function addEyesAndBlush(head: THREE.Object3D, {place}: HeadSurface, {eyeX, eyeY = 0, eyeRadii, blushX, blushY, eyeRing}: EyeOptions): Eye[] {
	const eyeGeometry = ellipsoid(eyeRadii, [20, 14]);
	const highlightGeometry = new THREE.SphereGeometry(eyeRadii.x * 0.36, 10, 8);
	const closedEyeGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
		new THREE.Vector3(-eyeRadii.x * 1.05, -0.014, 0),
		new THREE.Vector3(0, 0.018, 0),
		new THREE.Vector3(eyeRadii.x * 1.05, -0.014, 0),
	]), 12, 0.009, 6, false);

	const eyes = [eyeX, -eyeX].map(x => {
		const open = new THREE.Group();
		open.add(new THREE.Mesh(eyeGeometry, eyeMaterial));
		const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
		highlight.position.set(eyeRadii.x * 0.3, eyeRadii.y * 0.36, eyeRadii.z * 0.7);
		open.add(highlight);
		// 黒っぽい毛では黒目が埋もれるので、まわりに色の付いた縁を入れる
		if (eyeRing) {
			const ring = new THREE.Mesh(eyeGeometry, new THREE.MeshBasicMaterial({color: eyeRing}));
			ring.scale.set(1.3, 1.25, 0.6);
			ring.position.z = -eyeRadii.z * 0.45;
			open.add(ring);
		}

		place(open, x, eyeY, 0.002);
		const closed = place(new THREE.Mesh(closedEyeGeometry, eyeMaterial), x, eyeY, 0.006);
		closed.visible = false;
		head.add(open, closed);
		return {open, closed};
	});

	for (const x of [blushX, -blushX]) {
		head.add(place(new THREE.Mesh(new THREE.CircleGeometry(0.052, 24), blushMaterial), x, blushY, 0.004));
	}

	return eyes;
}

export function updateEyes(eyes: readonly Eye[], lid: number, sad: number): void {
	const isClosed = lid > 0.6;
	for (const {open, closed} of eyes) {
		open.visible = !isClosed;
		closed.visible = isClosed;
		// しょんぼり時は目を細める
		open.scale.y = 1 - (Math.min(lid, 0.6) * 0.8) - (sad * 0.2);
	}
}

export function addTongue(head: THREE.Object3D, {surface}: HeadSurface, y: number): (amount: number) => void {
	const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({color: '#ff8fa3'}));
	const base = surface(0, y, 0.004).position;
	tongue.visible = false;
	head.add(tongue);
	return (amount: number) => {
		tongue.visible = amount > 0.02;
		tongue.scale.set(0.028, 0.008 + (0.03 * amount), 0.012);
		// 舌は口元から下へ伸びる
		tongue.position.copy(base).setY(base.y - tongue.scale.y);
	};
}

// アクセサリーの取り付け位置（アクセサリーは頭の半径 0.21 前後・首の高さ 0.6 の寸法で作ってある）
type AnchorOptions = {
	head: THREE.Object3D;
	body: THREE.Object3D;
	surface: HeadSurface['surface'];
	headOffsetY: number;
	headScale: number;
	eyeX: number;
	eyeY?: number;
	collarCenter: THREE.Vector3;
	collarScale: number;
};

export function createAccessoryAnchors({head, body, surface, headOffsetY, headScale, eyeX, eyeY = 0, collarCenter, collarScale}: AnchorOptions): Pick<PetRig, 'headAnchor' | 'eyePositions' | 'collar'> {
	const headAnchor = new THREE.Group();
	headAnchor.position.set(0, headOffsetY, 0);
	headAnchor.scale.setScalar(headScale);
	head.add(headAnchor);
	const eyePositions = [eyeX, -eyeX].map(x => surface(x, eyeY, -0.03).position.sub(headAnchor.position).divideScalar(headScale));

	const collar = new THREE.Group();
	collar.scale.setScalar(collarScale);
	collar.position.set(collarCenter.x, collarCenter.y - (0.6 * collarScale), collarCenter.z - (0.07 * collarScale));
	body.add(collar);
	return {headAnchor, eyePositions, collar};
}

// 足: 腰の位置を支点に前後へ振る
// patches の y は腰からの高さ（足先が -hipY）
type LegOptions = {
	positions: readonly (readonly [number, number])[];
	hipY: number;
	radius: number;
	length: number;
	colors: readonly THREE.Color[];
	patches?: readonly Patch[];
	fluff?: number;
};

export function buildLegs(body: THREE.Object3D, fur: THREE.Material, {positions, hipY, radius, length, colors, patches = [], fluff = 0}: LegOptions): THREE.Group[] {
	return positions.map(([x, z], index) => {
		const pivot = new THREE.Group();
		pivot.position.set(x, hipY, z);
		const geometry = new THREE.CapsuleGeometry(radius, length, 6, 16);
		geometry.translate(0, -(hipY - radius - (length / 2)), 0);
		if (fluff > 0) {
			fluffy(geometry, fluff);
		}

		pivot.add(mesh(paint(geometry, itemAt(colors, index), patches), fur, {outline: OUTLINE}));
		body.add(pivot);
		return pivot;
	});
}

export function swingLegs(legs: readonly THREE.Object3D[], walkPhase: number, walk: number, groom: number): void {
	// 対角の足を交互に振る。毛づくろいでは右前足を口元へ上げる
	const swing = Math.sin(walkPhase) * 0.55 * walk;
	itemAt(legs, 0).rotation.x = swing - (groom * 1.9);
	itemAt(legs, 1).rotation.x = -swing;
	itemAt(legs, 2).rotation.x = -swing;
	itemAt(legs, 3).rotation.x = swing;
}

type TailOptions = {
	origin: THREE.Vector3Tuple;
	segments: number;
	step: number;
	radius: number;
	taper: number;
	colors: readonly THREE.Color[];
	fluff?: number;
};

export function buildTail(body: THREE.Object3D, fur: THREE.Material, {origin, segments, step, radius, taper, colors, fluff = 0}: TailOptions): THREE.Group[] {
	const joints: THREE.Group[] = [];
	let parent: THREE.Object3D = body;
	for (let index = 0; index < segments; index++) {
		const joint = new THREE.Group();
		if (index === 0) {
			joint.position.set(...origin);
		} else {
			joint.position.y = step;
		}

		const segmentRadius = radius - (index * taper);
		const geometry = new THREE.CapsuleGeometry(segmentRadius, step * 0.7, 4, 12);
		geometry.translate(0, step * 0.55, 0);
		if (fluff > 0) {
			fluffy(geometry, fluff);
		}

		joint.add(mesh(paint(geometry, itemAt(colors, index % colors.length)), fur, {outline: OUTLINE}));
		parent.add(joint);
		joints.push(joint);
		parent = joint;
	}

	return joints;
}

export function createHitProxy(root: THREE.Object3D, radius: number, height: number): THREE.Mesh {
	const hitProxy = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), new THREE.MeshBasicMaterial({visible: false}));
	hitProxy.position.set(0, height, 0);
	root.add(hitProxy);
	return hitProxy;
}
