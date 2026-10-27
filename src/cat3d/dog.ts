import * as THREE from 'three';
import {mesh, toon, OUTLINE_COLOR} from './toon';
import type {DogPalette} from '../game/data';
import {
	OUTLINE, addEyesAndBlush, addTongue, buildLegs, buildTail, createAccessoryAnchors, createFurMaterial,
	createHeadSurface, createHitProxy, createPetUniforms, ellipsoid, fluffy, itemAt, line, paint, swingLegs, updateEyes,
	type Patch, type PetRig,
} from './petKit';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

type ColorKey = 'base' | 'light' | 'dark' | 'mask';
type DogColors = Record<ColorKey, THREE.Color>;
type ErectEars = {type: 'erect'; pivot: THREE.Vector3Tuple; radius: number; height: number; tilt: number; lean: number; color: ColorKey; inner: ColorKey};
type DroopEars = {
	type: 'droop';
	pivot: THREE.Vector3Tuple;
	radii: THREE.Vector3Tuple;
	offset: THREE.Vector3Tuple;
	rest: number;
	color: ColorKey;
	tip: ColorKey;
	fluff?: number;
};
type DogShape = {
	buildBody(body: THREE.Group, fur: THREE.Material, colors: DogColors): void;
	bodyBounds: {center: THREE.Vector3Tuple; radii: THREE.Vector3Tuple};
	legs: {positions: [number, number][]; hipY: number; radius: number; length: number; color: ColorKey; socks?: ColorKey; fluff?: number};
	tail: {
		origin: THREE.Vector3Tuple;
		segments: number;
		step: number;
		radius: number;
		taper: number;
		colors: ColorKey[];
		rootPitch: number;
		curl: number;
		lift: number;
		sadDrop: number;
		wave: number;
		speed: number;
		pompom?: number;
	};
	head: {
		radii: THREE.Vector3Tuple;
		position: THREE.Vector3Tuple;
		patches(colors: DogColors): Patch[];
		topknot?: {radii: THREE.Vector3Tuple; position: THREE.Vector3Tuple};
	};
	muzzle: {radii: THREE.Vector3Tuple; y: number; lift: number; color: ColorKey; mouthOnHead?: number};
	ears: ErectEars | DroopEars;
	eyes: {x: number; y: number; radii: THREE.Vector3Tuple; blushX: number; blushY: number};
	anchors: {headOffsetY: number; headScale: number; collarCenter: THREE.Vector3Tuple; collarScale: number};
	bounce: number;
};

// ちびキャラのいぬ。品種ごとに胴の長さ・足の長さ・耳・しっぽ・マズルを変える
// colors は palette を THREE.Color にしたもの（base 地の色 / light 明るい色 / dark 濃い色 / mask 顔の黒）
const BREEDS: Record<'pekingese', DogShape> & Record<string, DogShape> = {
	// 鼻ぺちゃの黒いマズル、たてがみのような首まわりの長毛、垂れた長毛の耳、背中に巻いたふさふさのしっぽ
	pekingese: {
		buildBody(body, fur, {base, light}) {
			body.add(mesh(paint(ellipsoid(v3(0.27, 0.2, 0.32)), base, [
				{center: v3(0, -0.04, 0.26), radius: 0.2, color: light},
			]), fur, {outline: OUTLINE, position: [0, 0.28, -0.04]}));
			// 床すれすれまで垂れる長毛。短い足は先だけがのぞく
			body.add(mesh(paint(ellipsoid(v3(0.3, 0.11, 0.34)), light, [
				{center: v3(0, 0.08, -0.2), radius: 0.22, color: base},
			]), fur, {outline: OUTLINE, position: [0, 0.16, -0.04]}));
			// 首まわりのたてがみ
			body.add(mesh(paint(ellipsoid(v3(0.35, 0.28, 0.26)), light, [
				{center: v3(0, 0.2, -0.18), radius: 0.22, color: base},
			]), fur, {outline: OUTLINE, position: [0, 0.45, 0.1]}));
		},
		bodyBounds: {center: [0, 0.3, -0.04], radii: [0.33, 0.28, 0.37]},
		legs: {positions: [[0.13, 0.17], [-0.13, 0.17], [0.13, -0.2], [-0.13, -0.2]], hipY: 0.16, radius: 0.07, length: 0.03, color: 'light'},
		tail: {origin: [0, 0.38, -0.3], segments: 5, step: 0.085, radius: 0.09, taper: 0.008, colors: ['light', 'light', 'base'], rootPitch: -0.25, curl: 0.55, lift: 0.15, sadDrop: 1.3, wave: 0.8, speed: 3},
		head: {
			radii: [0.34, 0.3, 0.29],
			position: [0, 0.68, 0.2],
			patches: ({light, mask}) => [
				{center: v3(0, -0.03, 0.27), radius: 0.075, color: mask},
				{center: v3(0, 0.23, 0.14), radius: 0.1, color: light},
				{center: v3(0, -0.22, 0.18), radius: 0.12, color: light},
			],
		},
		// 鼻ぺちゃなので口はマズルの下の顔に描く
		muzzle: {radii: [0.09, 0.055, 0.045], y: -0.06, lift: -0.01, color: 'mask', mouthOnHead: -0.115},
		ears: {type: 'droop', pivot: [0.29, 0.12, 0.02], radii: [0.11, 0.21, 0.08], offset: [0.03, -0.15, 0], rest: 0.3, color: 'dark', tip: 'base'},
		eyes: {x: 0.135, y: 0.02, radii: [0.05, 0.056, 0.024], blushX: 0.21, blushY: -0.07},
		anchors: {headOffsetY: 0.08, headScale: 1.5, collarCenter: [0, 0.44, 0.14], collarScale: 2.2},
		bounce: 0.03,
	},

	// ピンと立った耳、くるんと巻いたしっぽ、ほほと胸の白い「裏白」、眉の点
	shiba: {
		buildBody(body, fur, {base, light}) {
			body.add(mesh(paint(ellipsoid(v3(0.24, 0.22, 0.33)), base, [
				{center: v3(0, -0.06, 0.26), radius: 0.17, color: light},
				{test: (point, wobble) => point.y + wobble < -0.13, color: light},
			]), fur, {outline: OUTLINE, position: [0, 0.34, -0.04]}));
		},
		bodyBounds: {center: [0, 0.34, -0.04], radii: [0.27, 0.25, 0.36]},
		legs: {positions: [[0.12, 0.16], [-0.12, 0.16], [0.12, -0.22], [-0.12, -0.22]], hipY: 0.22, radius: 0.075, length: 0.1, color: 'base', socks: 'light'},
		tail: {origin: [0, 0.42, -0.32], segments: 6, step: 0.07, radius: 0.06, taper: 0.004, colors: ['base', 'base', 'light'], rootPitch: -0.45, curl: 0.8, lift: 0.15, sadDrop: 1.4, wave: 0.6, speed: 4},
		head: {
			radii: [0.35, 0.31, 0.31],
			position: [0, 0.7, 0.16],
			patches: ({light}) => [
				{test: (point, wobble) => point.y + wobble < -0.05 && point.z > 0.05, color: light},
				...[1, -1].map(side => ({center: v3(0.1 * side, 0.12, 0.27), radius: 0.035, color: light})),
			],
		},
		muzzle: {radii: [0.12, 0.085, 0.11], y: -0.11, lift: -0.025, color: 'light'},
		ears: {type: 'erect', pivot: [0.2, 0.19, 0], radius: 0.12, height: 0.21, tilt: -0.28, lean: 0.2, color: 'base', inner: 'light'},
		eyes: {x: 0.13, y: 0.04, radii: [0.042, 0.05, 0.022], blushX: 0.22, blushY: -0.06},
		anchors: {headOffsetY: 0.08, headScale: 1.5, collarCenter: [0, 0.5, 0.1], collarScale: 1.6},
		bounce: 0.025,
	},

	// 全身くるくるの巻き毛。頭のてっぺんと耳、しっぽの先がぽんぽん
	poodle: {
		buildBody(body, fur, {base}) {
			body.add(mesh(paint(fluffy(ellipsoid(v3(0.24, 0.22, 0.3)), 0.035), base), fur, {outline: OUTLINE, position: [0, 0.37, -0.04]}));
		},
		bodyBounds: {center: [0, 0.37, -0.04], radii: [0.29, 0.27, 0.35]},
		legs: {positions: [[0.12, 0.15], [-0.12, 0.15], [0.12, -0.2], [-0.12, -0.2]], hipY: 0.24, radius: 0.07, length: 0.12, color: 'base', fluff: 0.025},
		tail: {origin: [0, 0.5, -0.3], segments: 2, step: 0.07, radius: 0.04, taper: 0, colors: ['base'], rootPitch: -0.35, curl: 0.1, lift: 0.2, sadDrop: 1.2, wave: 0.5, speed: 5, pompom: 0.09},
		head: {
			radii: [0.3, 0.28, 0.28],
			position: [0, 0.72, 0.17],
			patches: () => [],
			topknot: {radii: [0.27, 0.17, 0.25], position: [0, 0.2, -0.04]},
		},
		muzzle: {radii: [0.1, 0.075, 0.09], y: -0.1, lift: -0.025, color: 'light'},
		ears: {type: 'droop', pivot: [0.26, 0.1, -0.02], radii: [0.12, 0.2, 0.09], offset: [0.03, -0.14, 0], rest: 0.15, color: 'dark', tip: 'dark', fluff: 0.03},
		eyes: {x: 0.12, y: 0.03, radii: [0.042, 0.05, 0.022], blushX: 0.19, blushY: -0.07},
		anchors: {headOffsetY: 0.2, headScale: 1.4, collarCenter: [0, 0.52, 0.1], collarScale: 1.75},
		bounce: 0.035,
	},

	// 胴長短足。長いマズルと垂れ耳、細長いしっぽ
	dachshund: {
		buildBody(body, fur, {base, light}) {
			body.add(mesh(paint(ellipsoid(v3(0.2, 0.18, 0.42)), base, [
				{center: v3(0, -0.04, 0.38), radius: 0.13, color: light},
			]), fur, {outline: OUTLINE, position: [0, 0.28, -0.1]}));
		},
		bodyBounds: {center: [0, 0.28, -0.1], radii: [0.23, 0.21, 0.45]},
		legs: {positions: [[0.11, 0.18], [-0.11, 0.18], [0.11, -0.38], [-0.11, -0.38]], hipY: 0.16, radius: 0.065, length: 0.03, color: 'base', socks: 'light'},
		tail: {origin: [0, 0.32, -0.5], segments: 6, step: 0.07, radius: 0.04, taper: 0.004, colors: ['base'], rootPitch: -1.1, curl: 0.08, lift: 0.4, sadDrop: 0.9, wave: 0.9, speed: 4},
		head: {
			radii: [0.3, 0.28, 0.29],
			position: [0, 0.6, 0.3],
			patches: ({light}) => [1, -1].map(side => ({center: v3(0.1 * side, 0.12, 0.26), radius: 0.035, color: light})),
		},
		muzzle: {radii: [0.1, 0.08, 0.15], y: -0.09, lift: -0.04, color: 'light'},
		ears: {type: 'droop', pivot: [0.25, 0.12, -0.02], radii: [0.1, 0.22, 0.06], offset: [0.02, -0.17, 0], rest: 0.12, color: 'dark', tip: 'dark'},
		eyes: {x: 0.12, y: 0.04, radii: [0.04, 0.048, 0.022], blushX: 0.19, blushY: -0.05},
		anchors: {headOffsetY: 0.06, headScale: 1.4, collarCenter: [0, 0.43, 0.22], collarScale: 1.5},
		bounce: 0.02,
	},
};

export function buildDog({breed = 'pekingese', palette}: {breed?: string; palette: DogPalette}): PetRig {
	const shape = BREEDS[breed] ?? BREEDS.pekingese;
	const colors: DogColors = {
		base: new THREE.Color(palette.base),
		light: new THREE.Color(palette.light),
		dark: new THREE.Color(palette.dark),
		mask: new THREE.Color(palette.mask ?? '#2b211d'),
	};

	const uniforms = createPetUniforms();
	const fur = createFurMaterial(uniforms);
	const ink = new THREE.MeshBasicMaterial({color: OUTLINE_COLOR});
	const noseMaterial = new THREE.MeshBasicMaterial({color: '#1e1512'});

	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add(body);
	shape.buildBody(body, fur, colors);

	const legShape = shape.legs;
	const legs = buildLegs(body, fur, {
		...legShape,
		colors: Array.from({length: 4}, () => colors[legShape.color]),
		patches: legShape.socks ? [{test: (point, wobble) => point.y + wobble < -legShape.hipY + 0.09, color: colors[legShape.socks]}] : [],
	});

	const tailShape = shape.tail;
	const tailJoints = buildTail(body, fur, {...tailShape, colors: tailShape.colors.map(key => colors[key])});
	if (tailShape.pompom) {
		const pompom = fluffy(ellipsoid(v3(tailShape.pompom, tailShape.pompom, tailShape.pompom), [24, 18]), 0.025);
		itemAt(tailJoints, tailJoints.length - 1).add(mesh(paint(pompom, colors.base), fur, {outline: OUTLINE, position: [0, tailShape.step, 0]}));
	}

	// ---------- 頭 ----------
	const headShape = shape.head;
	const headRadii = v3(...headShape.radii);
	const head = new THREE.Group();
	head.position.set(...headShape.position);
	body.add(head);
	head.add(mesh(paint(ellipsoid(headRadii, [48, 36]), colors.base, headShape.patches(colors)), fur, {outline: OUTLINE}));
	const headSurface = createHeadSurface(headRadii);
	if (headShape.topknot) {
		const topknot = fluffy(ellipsoid(v3(...headShape.topknot.radii)), 0.035);
		head.add(mesh(paint(topknot, colors.light), fur, {outline: OUTLINE, position: headShape.topknot.position}));
	}

	const muzzleShape = shape.muzzle;
	const muzzleRadii = v3(...muzzleShape.radii);
	const muzzleSurface = createHeadSurface(muzzleRadii);
	const muzzle = mesh(paint(ellipsoid(muzzleRadii, [24, 16]), colors[muzzleShape.color]), fur, {outline: 0.01});
	headSurface.place(muzzle, 0, muzzleShape.y, muzzleShape.lift);
	head.add(muzzle);
	const nose = new THREE.Mesh(ellipsoid(v3(0.032, 0.022, 0.016), [12, 8]), noseMaterial);
	muzzleSurface.place(nose, 0, muzzleRadii.y * 0.3, 0.004);
	muzzle.add(nose);

	let setTongue: (amount: number) => void;
	if (muzzleShape.mouthOnHead === undefined) {
		const mouthPoints = ([[-0.45, -0.35], [-0.22, -0.6], [0, -0.3], [0.22, -0.6], [0.45, -0.35]] as const)
			.map(([x, y]) => muzzleSurface.surface(x * muzzleRadii.x, y * muzzleRadii.y, 0.004).position);
		muzzle.add(line(mouthPoints, 0.006, ink));
		setTongue = addTongue(muzzle, muzzleSurface, -muzzleRadii.y * 0.62);
	} else {
		const y = muzzleShape.mouthOnHead;
		const mouthPoints = ([[-0.04, y], [-0.02, y - 0.017], [0, y], [0.02, y - 0.017], [0.04, y]] as const)
			.map(([x, pointY]) => headSurface.surface(x, pointY, 0.005).position);
		head.add(line(mouthPoints, 0.0065, ink));
		setTongue = addTongue(head, headSurface, y - 0.015);
	}

	const earShape = shape.ears;
	const ears = [1, -1].map(side => {
		const pivot = new THREE.Group();
		pivot.position.set(earShape.pivot[0] * side, earShape.pivot[1], earShape.pivot[2]);
		if (earShape.type === 'erect') {
			const outer = new THREE.ConeGeometry(earShape.radius, earShape.height, 24);
			outer.scale(1, 1, 0.6);
			outer.translate(0, earShape.height * 0.45, 0);
			pivot.add(mesh(paint(outer, colors[earShape.color]), fur, {outline: OUTLINE}));
			const inner = new THREE.ConeGeometry(earShape.radius * 0.58, earShape.height * 0.64, 20);
			inner.scale(1, 1, 0.4);
			inner.translate(0, earShape.height * 0.36, earShape.radius * 0.35);
			pivot.add(mesh(inner, toon(colors[earShape.inner]), {outline: 0}));
		} else {
			const geometry = ellipsoid(v3(...earShape.radii), [24, 18]);
			geometry.translate(earShape.offset[0] * side, earShape.offset[1], earShape.offset[2]);
			if (earShape.fluff) {
				fluffy(geometry, earShape.fluff);
			}

			pivot.add(mesh(paint(geometry, colors[earShape.color], [
				{center: v3(0, earShape.offset[1] - (earShape.radii[1] * 0.85), 0), radius: earShape.radii[0], color: colors[earShape.tip]},
			]), fur, {outline: OUTLINE}));
		}

		head.add(pivot);
		return pivot;
	});

	const eyeShape = shape.eyes;
	const eyes = addEyesAndBlush(head, headSurface, {
		eyeX: eyeShape.x,
		eyeY: eyeShape.y,
		eyeRadii: v3(...eyeShape.radii),
		blushX: eyeShape.blushX,
		blushY: eyeShape.blushY,
		eyeRing: palette.eyeRing,
	});

	const anchorShape = shape.anchors;
	const anchors = createAccessoryAnchors({
		head, body, surface: headSurface.surface, headOffsetY: anchorShape.headOffsetY, headScale: anchorShape.headScale, eyeX: eyeShape.x, eyeY: eyeShape.y,
		collarCenter: v3(...anchorShape.collarCenter), collarScale: anchorShape.collarScale,
	});

	return {
		root,
		body,
		head,
		...anchors,
		hitProxy: createHitProxy(root, 0.55, 0.45),
		uniforms,
		foamAnchors: [
			{...shape.bodyBounds, weight: 3},
			{center: headShape.position, radii: [headShape.radii[0] + 0.03, headShape.radii[1] + 0.03, headShape.radii[2] + 0.03], weight: 3},
		],
		update({elapsed, walkPhase, walk, headYaw, headPitch, headRoll, lid, earDroop, earTwitch, tailSway, tailLift, tongue, groom, sad}) {
			swingLegs(legs, walkPhase, walk, groom);
			// 小刻みに弾むように歩く
			body.position.y = Math.abs(Math.sin(walkPhase)) * shape.bounce * walk;

			head.rotation.set(headPitch, headYaw, headRoll);
			for (const [index, ear] of ears.entries()) {
				const side = index === 0 ? 1 : -1;
				if (earShape.type === 'erect') {
					// しょんぼりすると立ち耳が後ろへ寝る
					ear.rotation.z = (earShape.tilt - (earDroop * 0.4)) * side;
					ear.rotation.x = earShape.lean - (itemAt(earTwitch, index) * 0.5) - (earDroop * 0.7);
				} else {
					// 歩くと垂れ耳がゆれ、しょんぼりすると頭に沿ってぺたんと寝る
					const bounce = Math.sin(walkPhase * 2) * 0.12 * walk;
					ear.rotation.z = (earShape.rest + (itemAt(earTwitch, index) * 0.35) + bounce - (earDroop * 0.12)) * side;
					ear.rotation.x = earDroop * 0.25;
				}
			}

			updateEyes(eyes, lid, sad);

			for (const [index, joint] of tailJoints.entries()) {
				const wave = Math.sin((elapsed * tailShape.speed) - (index * 0.6)) * tailSway;
				if (index === 0) {
					joint.rotation.set(tailShape.rootPitch - (tailLift * tailShape.lift) + (sad * tailShape.sadDrop), wave * 0.5, 0);
				} else {
					joint.rotation.set(tailShape.curl * (1 - (sad * 0.7)), 0, wave * tailShape.wave);
				}
			}

			setTongue(tongue);
		},
	};
}
