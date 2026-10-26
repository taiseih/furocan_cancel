import * as THREE from 'three';
import {mesh, toon, OUTLINE_COLOR} from './toon.js';
import {
	OUTLINE, addEyesAndBlush, addTongue, buildLegs, buildTail, createAccessoryAnchors, createFurMaterial,
	createHeadSurface, createHitProxy, createPetUniforms, ellipsoid, fluffy, line, paint, swingLegs, updateEyes,
} from './petKit.js';

// 完成イメージのちびねこ。頭が大きく、品種で耳の形や毛の長さ、毛色で模様が変わる
const BREED_SHAPES = {
	mix: {headRadii: [0.37, 0.32, 0.33], ears: 'normal'},
	scottish: {headRadii: [0.39, 0.33, 0.34], ears: 'fold'},
	persian: {headRadii: [0.37, 0.31, 0.33], ears: 'small', fluff: 0.03},
	siamese: {headRadii: [0.35, 0.31, 0.32], ears: 'big'},
};

// 耳の大きさ・付け根・傾き。折れ耳は前へぺたんと倒す
const EAR_SHAPES = {
	normal: {radius: 0.13, height: 0.22, pivot: [0.2, 0.2, -0.02], tilt: -0.32, fold: 0},
	big: {radius: 0.15, height: 0.27, pivot: [0.2, 0.19, -0.02], tilt: -0.42, fold: 0},
	small: {radius: 0.1, height: 0.15, pivot: [0.23, 0.18, -0.02], tilt: -0.55, fold: 0},
	fold: {radius: 0.13, height: 0.16, pivot: [0.19, 0.28, 0.02], tilt: -0.4, fold: 0.75},
};

const EYE_X = 0.13;
const LEG_HIP_Y = 0.22;

// 毛色の模様を、胴体・頭・足・しっぽ・耳の塗り分けに変換する
function createCoat({pattern, base, accent, sub}) {
	const muzzle = {center: new THREE.Vector3(0, -0.12, 0.28), radius: 0.12, color: sub};
	const chest = {center: new THREE.Vector3(0, -0.08, 0.24), radius: 0.18, color: sub};
	switch (pattern) {
		case 'calico': {
			return {
				body: [
					{center: new THREE.Vector3(-0.1, 0.18, -0.05), radius: 0.2, color: accent},
					{center: new THREE.Vector3(0.14, 0.12, -0.24), radius: 0.15, color: sub},
				],
				head: [
					{center: new THREE.Vector3(-0.27, 0.16, 0.08), radius: 0.2, color: accent},
					{center: new THREE.Vector3(0.22, 0.24, -0.02), radius: 0.17, color: sub},
					{center: new THREE.Vector3(0.02, 0.27, -0.2), radius: 0.15, color: accent},
				],
				legColors: [base, base, base, sub],
				legPatches: [],
				tailColors: [accent, sub],
				earColors: [sub, accent],
			};
		}

		case 'tabby': {
			return {
				body: [
					{test: (point, wobble) => point.y > -0.06 && Math.sin((point.z * 30) + (point.y * 6)) + (wobble * 8) > 0.35, color: accent},
					chest,
				],
				head: [
					// おでこの M 字としま、ほほのしま
					{test: (point, wobble) => point.y > 0.12 && point.z > 0 && Math.sin(point.x * 48) + (wobble * 6) > 0.35, color: accent},
					{test: (point, wobble) => Math.abs(point.x) > 0.27 && Math.sin(point.y * 42) + (wobble * 6) > 0.45, color: accent},
					muzzle,
				],
				legColors: [base, base, base, base],
				legPatches: [{test: (point, wobble) => point.y > -0.15 && Math.sin(point.y * 50) + (wobble * 6) > 0.4, color: accent}],
				tailColors: [base, accent],
				earColors: [base, base],
			};
		}

		case 'bicolor': {
			return {
				body: [{test: (point, wobble) => point.y + wobble > 0.04 || point.z + wobble < -0.2, color: accent}],
				head: [{
					// 鼻すじから額へ逆 V 字に白を残す
					test: (point, wobble) => point.y + wobble > -0.03 && !(point.z > 0.1 && Math.abs(point.x) < 0.05 + (Math.max(0, 0.2 - point.y) * 0.45)),
					color: accent,
				}],
				legColors: [base, base, base, base],
				legPatches: [],
				tailColors: [accent],
				earColors: [accent, accent],
			};
		}

		case 'point': {
			return {
				body: [{test: point => point.z < -0.26, color: accent}],
				head: [{center: new THREE.Vector3(0, -0.07, 0.3), radius: 0.17, color: accent}],
				legColors: [base, base, base, base],
				legPatches: [{test: (point, wobble) => point.y + wobble < -0.12, color: accent}],
				tailColors: [accent],
				earColors: [accent, accent],
			};
		}

		default: {
			return {
				body: [chest],
				head: [muzzle],
				legColors: [base, base, base, base],
				legPatches: [],
				tailColors: [base],
				earColors: [base, base],
			};
		}
	}
}

export function buildChibiCat({breed = 'mix', palette}) {
	const shape = BREED_SHAPES[breed] ?? BREED_SHAPES.mix;
	const earShape = EAR_SHAPES[shape.ears];
	const fluff = shape.fluff ?? 0;
	const colors = {
		pattern: palette.pattern,
		base: new THREE.Color(palette.base),
		accent: new THREE.Color(palette.accent),
		sub: new THREE.Color(palette.sub),
	};
	const coat = createCoat(colors);
	const headRadii = new THREE.Vector3(...shape.headRadii);

	const uniforms = createPetUniforms();
	const fur = createFurMaterial(uniforms);
	const ink = new THREE.MeshBasicMaterial({color: OUTLINE_COLOR});

	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add(body);

	const bodyGeometry = ellipsoid(new THREE.Vector3(0.24, 0.22, 0.32));
	if (fluff > 0) {
		fluffy(bodyGeometry, fluff);
	}

	body.add(mesh(paint(bodyGeometry, colors.base, coat.body), fur, {outline: OUTLINE, position: [0, 0.33, -0.04]}));

	const legs = buildLegs(body, fur, {
		positions: [[0.12, 0.16], [-0.12, 0.16], [0.12, -0.22], [-0.12, -0.22]],
		hipY: LEG_HIP_Y,
		radius: 0.075,
		length: 0.1,
		colors: coat.legColors,
		patches: coat.legPatches,
		fluff: fluff * 0.6,
	});

	// しっぽ: 根元から上へ立てて先を前へ丸める。長毛種は太くふさふさにする
	const tailJoints = buildTail(body, fur, {
		origin: [0, 0.36, -0.32],
		segments: 6,
		step: 0.075,
		radius: fluff > 0 ? 0.075 : 0.052,
		taper: 0.003,
		colors: coat.tailColors,
		fluff,
	});

	// ---------- 頭 ----------
	const head = new THREE.Group();
	head.position.set(0, 0.68, 0.15);
	body.add(head);
	head.add(mesh(paint(ellipsoid(headRadii, [48, 36]), colors.base, coat.head), fur, {outline: OUTLINE}));
	const headSurface = createHeadSurface(headRadii);

	// 長毛種は顔のまわりをふかふかの襟毛で囲む
	if (fluff > 0) {
		const ruff = fluffy(ellipsoid(new THREE.Vector3(0.43, 0.27, 0.3)), fluff * 1.2);
		head.add(mesh(paint(ruff, colors.sub), fur, {outline: OUTLINE, position: [0, -0.14, -0.06]}));
	}

	const innerEar = toon('#ffc2cc');
	const ears = [1, -1].map((side, index) => {
		const pivot = new THREE.Group();
		pivot.position.set(earShape.pivot[0] * side, earShape.pivot[1], earShape.pivot[2]);
		pivot.rotation.z = earShape.tilt * side;
		const outer = new THREE.ConeGeometry(earShape.radius, earShape.height, 24);
		outer.scale(1, 1, 0.6);
		outer.translate(0, earShape.height * 0.45, 0);
		pivot.add(mesh(paint(outer, coat.earColors[index]), fur, {outline: OUTLINE}));
		const inner = new THREE.ConeGeometry(earShape.radius * 0.58, earShape.height * 0.64, 20);
		inner.scale(1, 1, 0.4);
		inner.translate(0, earShape.height * 0.36, earShape.radius * 0.35);
		pivot.add(mesh(inner, innerEar, {outline: 0}));
		head.add(pivot);
		return pivot;
	});

	// 顔: 黒目・ほっぺ・鼻・ω口・ひげ
	const eyes = addEyesAndBlush(head, headSurface, {
		eyeX: EYE_X,
		eyeRadii: new THREE.Vector3(0.043, 0.056, 0.022),
		blushX: 0.22,
		blushY: -0.08,
		eyeRing: palette.eyeRing,
	});
	const noseGeometry = ellipsoid(new THREE.Vector3(0.022, 0.014, 0.012), [12, 8]);
	head.add(headSurface.place(new THREE.Mesh(noseGeometry, new THREE.MeshBasicMaterial({color: '#f08a9b'})), 0, -0.045, 0.004));
	const mouthPoints = [[-0.045, -0.085], [-0.022, -0.105], [0, -0.085], [0.022, -0.105], [0.045, -0.085]]
		.map(([x, y]) => headSurface.surface(x, y, 0.005).position);
	head.add(line(mouthPoints, 0.0065, ink));
	// 黒い毛ではひげが見えないので白くする
	const whiskerMaterial = colors.base.getHSL({}).l < 0.35 ? new THREE.MeshBasicMaterial({color: '#f4ece4'}) : ink;
	for (const side of [1, -1]) {
		for (const [y1, y2] of [[-0.04, -0.02], [-0.09, -0.11]]) {
			head.add(line([
				new THREE.Vector3((headRadii.x - 0.07) * side, y1, 0.13),
				new THREE.Vector3((headRadii.x + 0.07) * side, y2, 0.1),
			], 0.0055, whiskerMaterial));
		}
	}

	const setTongue = addTongue(head, headSurface, -0.1);
	const anchors = createAccessoryAnchors({
		head, body, surface: headSurface.surface, headOffsetY: 0.08, headScale: 1.55, eyeX: EYE_X,
		collarCenter: new THREE.Vector3(0, 0.5, 0.08), collarScale: fluff > 0 ? 1.75 : 1.6,
	});

	return {
		root,
		body,
		head,
		...anchors,
		hitProxy: createHitProxy(root, 0.55, 0.5),
		uniforms,
		foamAnchors: [
			{center: [0, 0.33, -0.04], radii: [0.27, 0.25, 0.35], weight: 3},
			{center: [0, 0.68, 0.15], radii: [headRadii.x + 0.03, headRadii.y + 0.03, headRadii.z + 0.03], weight: 3},
		],
		update({elapsed, walkPhase, walk, headYaw, headPitch, headRoll, lid, earDroop, earTwitch, tailSway, tailLift, tongue, groom, sad}) {
			swingLegs(legs, walkPhase, walk, groom);
			body.position.y = Math.abs(Math.sin(walkPhase)) * 0.025 * walk;

			head.rotation.set(headPitch, headYaw, headRoll);
			for (const [index, ear] of ears.entries()) {
				const side = index === 0 ? 1 : -1;
				ear.rotation.z = (earShape.tilt - (earDroop * 0.6)) * side;
				ear.rotation.x = earShape.fold - (earTwitch[index] * 0.5) - (earDroop * 0.3);
			}

			updateEyes(eyes, lid, sad);

			for (const [index, joint] of tailJoints.entries()) {
				const wave = Math.sin((elapsed * 2.4) - (index * 0.6)) * tailSway;
				if (index === 0) {
					joint.rotation.set(-0.55 - (tailLift * 0.25) + (sad * 1.1), wave * 0.6, 0);
				} else {
					joint.rotation.set(0.2 * (1 - sad) * (1 + tailLift), 0, wave);
				}
			}

			setTongue(tongue);
		},
	};
}
