import * as THREE from 'three';
import {mesh, toon, OUTLINE_COLOR} from './toon.js';
import {
	OUTLINE, addEyesAndBlush, addTongue, buildLegs, buildTail, createAccessoryAnchors, createFurMaterial,
	createHeadSurface, createHitProxy, createPetUniforms, ellipsoid, line, paint, swingLegs, updateEyes,
} from './petKit.js';

// 完成イメージの三毛のちびねこ。頭が大きく、白地にオレンジとベージュのぶち
const FUR = {
	white: new THREE.Color('#fffaf2'),
	orange: new THREE.Color('#f5b066'),
	beige: new THREE.Color('#f8d9aa'),
};
const HEAD_RADII = new THREE.Vector3(0.37, 0.32, 0.33);
const EYE_X = 0.13;

export function buildChibiCat() {
	const uniforms = createPetUniforms();
	const fur = createFurMaterial(uniforms);
	const ink = new THREE.MeshBasicMaterial({color: OUTLINE_COLOR});

	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add(body);

	body.add(mesh(paint(ellipsoid(new THREE.Vector3(0.24, 0.22, 0.32)), FUR.white, [
		{center: new THREE.Vector3(-0.1, 0.18, -0.05), radius: 0.2, color: FUR.orange},
		{center: new THREE.Vector3(0.14, 0.12, -0.24), radius: 0.15, color: FUR.beige},
	]), fur, {outline: OUTLINE, position: [0, 0.33, -0.04]}));

	const legs = buildLegs(body, fur, {
		positions: [[0.12, 0.16], [-0.12, 0.16], [0.12, -0.22], [-0.12, -0.22]],
		hipY: 0.22,
		radius: 0.075,
		length: 0.1,
		colors: [FUR.white, FUR.white, FUR.white, FUR.beige],
	});

	// しっぽ: 根元から上へ立てて先を前へ丸める
	const tailJoints = buildTail(body, fur, {origin: [0, 0.36, -0.32], segments: 6, step: 0.075, radius: 0.052, taper: 0.003, colors: [FUR.orange, FUR.beige]});

	// ---------- 頭 ----------
	const head = new THREE.Group();
	head.position.set(0, 0.68, 0.15);
	body.add(head);
	head.add(mesh(paint(ellipsoid(HEAD_RADII, [48, 36]), FUR.white, [
		{center: new THREE.Vector3(-0.27, 0.16, 0.08), radius: 0.2, color: FUR.orange},
		{center: new THREE.Vector3(0.22, 0.24, -0.02), radius: 0.17, color: FUR.beige},
		{center: new THREE.Vector3(0.02, 0.27, -0.2), radius: 0.15, color: FUR.orange},
	]), fur, {outline: OUTLINE}));
	const headSurface = createHeadSurface(HEAD_RADII);

	const innerEar = toon('#ffc2cc');
	const ears = [1, -1].map(side => {
		const pivot = new THREE.Group();
		pivot.position.set(0.2 * side, 0.2, -0.02);
		pivot.rotation.z = -0.32 * side;
		const outer = new THREE.ConeGeometry(0.13, 0.22, 24);
		outer.scale(1, 1, 0.6);
		outer.translate(0, 0.1, 0);
		pivot.add(mesh(paint(outer, side < 0 ? FUR.orange : FUR.beige), fur, {outline: OUTLINE}));
		const inner = new THREE.ConeGeometry(0.075, 0.14, 20);
		inner.scale(1, 1, 0.4);
		inner.translate(0, 0.08, 0.045);
		pivot.add(mesh(inner, innerEar, {outline: 0}));
		head.add(pivot);
		return pivot;
	});

	// 顔: 黒目・ほっぺ・鼻・ω口・ひげ
	const eyes = addEyesAndBlush(head, headSurface, {eyeX: EYE_X, eyeRadii: new THREE.Vector3(0.043, 0.056, 0.022), blushX: 0.22, blushY: -0.08});
	const noseGeometry = ellipsoid(new THREE.Vector3(0.022, 0.014, 0.012), [12, 8]);
	head.add(headSurface.place(new THREE.Mesh(noseGeometry, new THREE.MeshBasicMaterial({color: '#f08a9b'})), 0, -0.045, 0.004));
	const mouthPoints = [[-0.045, -0.085], [-0.022, -0.105], [0, -0.085], [0.022, -0.105], [0.045, -0.085]]
		.map(([x, y]) => headSurface.surface(x, y, 0.005).position);
	head.add(line(mouthPoints, 0.0065, ink));
	for (const side of [1, -1]) {
		for (const [y1, y2] of [[-0.04, -0.02], [-0.09, -0.11]]) {
			head.add(line([
				new THREE.Vector3(0.3 * side, y1, 0.13),
				new THREE.Vector3(0.44 * side, y2, 0.1),
			], 0.0055, ink));
		}
	}

	const setTongue = addTongue(head, headSurface, -0.1);
	const anchors = createAccessoryAnchors({
		head, body, surface: headSurface.surface, headOffsetY: 0.08, headScale: 1.55, eyeX: EYE_X,
		collarCenter: new THREE.Vector3(0, 0.5, 0.08), collarScale: 1.6,
	});

	return {
		root,
		body,
		head,
		...anchors,
		hitProxy: createHitProxy(root, 0.55, 0.5),
		uniforms,
		update({elapsed, walkPhase, walk, headYaw, headPitch, headRoll, lid, earDroop, earTwitch, tailSway, tailLift, tongue, groom, sad}) {
			swingLegs(legs, walkPhase, walk, groom);
			body.position.y = Math.abs(Math.sin(walkPhase)) * 0.025 * walk;

			head.rotation.set(headPitch, headYaw, headRoll);
			for (const [index, ear] of ears.entries()) {
				const side = index === 0 ? 1 : -1;
				ear.rotation.z = (-0.32 - (earDroop * 0.6)) * side;
				ear.rotation.x = -(earTwitch[index] * 0.5) - (earDroop * 0.3);
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
