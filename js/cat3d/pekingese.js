import * as THREE from 'three';
import {mesh, OUTLINE_COLOR} from './toon.js';
import {
	OUTLINE, addEyesAndBlush, addTongue, buildLegs, buildTail, createAccessoryAnchors, createFurMaterial,
	createHeadSurface, createHitProxy, createPetUniforms, ellipsoid, line, paint, swingLegs, updateEyes,
} from './petKit.js';

// ちびキャラのペキニーズ。鼻ぺちゃの黒いマズル、たてがみのような首まわりの長毛、垂れた長毛の耳、背中に巻いたふさふさのしっぽ
const FUR = {
	fawn: new THREE.Color('#ecc082'),
	cream: new THREE.Color('#fcebcf'),
	darkFawn: new THREE.Color('#cf9459'),
	mask: new THREE.Color('#4d3b33'),
};
const HEAD_RADII = new THREE.Vector3(0.34, 0.3, 0.29);
const EYE_X = 0.135;
const EYE_Y = 0.02;
const EAR_REST = 0.3;

export function buildPekingese() {
	const uniforms = createPetUniforms();
	const fur = createFurMaterial(uniforms);
	const ink = new THREE.MeshBasicMaterial({color: OUTLINE_COLOR});

	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add(body);

	body.add(mesh(paint(ellipsoid(new THREE.Vector3(0.27, 0.2, 0.32)), FUR.fawn, [
		{center: new THREE.Vector3(0, -0.04, 0.26), radius: 0.2, color: FUR.cream},
	]), fur, {outline: OUTLINE, position: [0, 0.28, -0.04]}));
	// 床すれすれまで垂れる長毛。短い足は先だけがのぞく
	body.add(mesh(paint(ellipsoid(new THREE.Vector3(0.3, 0.11, 0.34)), FUR.cream, [
		{center: new THREE.Vector3(0, 0.08, -0.2), radius: 0.22, color: FUR.fawn},
	]), fur, {outline: OUTLINE, position: [0, 0.16, -0.04]}));
	// 首まわりのたてがみ
	body.add(mesh(paint(ellipsoid(new THREE.Vector3(0.35, 0.28, 0.26)), FUR.cream, [
		{center: new THREE.Vector3(0, 0.2, -0.18), radius: 0.22, color: FUR.fawn},
	]), fur, {outline: OUTLINE, position: [0, 0.45, 0.1]}));

	const legs = buildLegs(body, fur, {
		positions: [[0.13, 0.17], [-0.13, 0.17], [0.13, -0.2], [-0.13, -0.2]],
		hipY: 0.16,
		radius: 0.07,
		length: 0.03,
		colors: [FUR.cream, FUR.cream, FUR.cream, FUR.cream],
	});

	// しっぽ: 背中の上へ大きく巻き上げる
	const tailJoints = buildTail(body, fur, {origin: [0, 0.38, -0.3], segments: 5, step: 0.085, radius: 0.09, taper: 0.008, colors: [FUR.cream, FUR.cream, FUR.fawn]});

	// ---------- 頭 ----------
	const head = new THREE.Group();
	head.position.set(0, 0.68, 0.2);
	body.add(head);
	head.add(mesh(paint(ellipsoid(HEAD_RADII, [48, 36]), FUR.fawn, [
		{center: new THREE.Vector3(0, -0.03, 0.27), radius: 0.075, color: FUR.mask},
		{center: new THREE.Vector3(0, 0.23, 0.14), radius: 0.1, color: FUR.cream},
		{center: new THREE.Vector3(0, -0.22, 0.18), radius: 0.12, color: FUR.cream},
	]), fur, {outline: OUTLINE}));
	const headSurface = createHeadSurface(HEAD_RADII);

	// 鼻ぺちゃのマズル
	const muzzle = mesh(paint(ellipsoid(new THREE.Vector3(0.09, 0.055, 0.045), [24, 16]), FUR.mask), fur, {outline: 0.01});
	headSurface.place(muzzle, 0, -0.06, -0.01);
	head.add(muzzle);
	const nose = new THREE.Mesh(ellipsoid(new THREE.Vector3(0.032, 0.022, 0.016), [12, 8]), new THREE.MeshBasicMaterial({color: '#1e1512'}));
	nose.position.set(0, 0.012, 0.043);
	muzzle.add(nose);

	// 垂れた長毛の耳
	const ears = [1, -1].map(side => {
		const pivot = new THREE.Group();
		pivot.position.set(0.29 * side, 0.12, 0.02);
		pivot.rotation.z = EAR_REST * side;
		const geometry = ellipsoid(new THREE.Vector3(0.11, 0.21, 0.08), [24, 18]);
		geometry.translate(0.03, -0.15, 0);
		pivot.add(mesh(paint(geometry, FUR.darkFawn, [
			{center: new THREE.Vector3(0, -0.33, 0), radius: 0.1, color: FUR.fawn},
		]), fur, {outline: OUTLINE}));
		head.add(pivot);
		return pivot;
	});

	const eyes = addEyesAndBlush(head, headSurface, {eyeX: EYE_X, eyeY: EYE_Y, eyeRadii: new THREE.Vector3(0.05, 0.056, 0.024), blushX: 0.21, blushY: -0.07});
	const mouthPoints = [[-0.04, -0.115], [-0.02, -0.132], [0, -0.115], [0.02, -0.132], [0.04, -0.115]]
		.map(([x, y]) => headSurface.surface(x, y, 0.005).position);
	head.add(line(mouthPoints, 0.0065, ink));

	const setTongue = addTongue(head, headSurface, -0.13);
	const anchors = createAccessoryAnchors({
		head, body, surface: headSurface.surface, headOffsetY: 0.08, headScale: 1.5, eyeX: EYE_X, eyeY: EYE_Y,
		collarCenter: new THREE.Vector3(0, 0.44, 0.14), collarScale: 2.2,
	});

	return {
		root,
		body,
		head,
		...anchors,
		hitProxy: createHitProxy(root, 0.55, 0.45),
		uniforms,
		update({elapsed, walkPhase, walk, headYaw, headPitch, headRoll, lid, earDroop, earTwitch, tailSway, tailLift, tongue, groom, sad}) {
			swingLegs(legs, walkPhase, walk, groom);
			// 短足なので小刻みに弾むように歩く
			body.position.y = Math.abs(Math.sin(walkPhase)) * 0.03 * walk;

			head.rotation.set(headPitch, headYaw, headRoll);
			for (const [index, ear] of ears.entries()) {
				const side = index === 0 ? 1 : -1;
				// 歩くと耳がゆれ、しょんぼりすると頭に沿ってぺたんと寝る
				const bounce = Math.sin(walkPhase * 2) * 0.12 * walk;
				ear.rotation.z = (EAR_REST + (earTwitch[index] * 0.35) + bounce - (earDroop * 0.12)) * side;
				ear.rotation.x = earDroop * 0.25;
			}

			updateEyes(eyes, lid, sad);

			for (const [index, joint] of tailJoints.entries()) {
				const wave = Math.sin((elapsed * 3) - (index * 0.6)) * tailSway;
				if (index === 0) {
					joint.rotation.set(-0.25 - (tailLift * 0.15) + (sad * 1.3), wave * 0.5, 0);
				} else {
					joint.rotation.set(0.55 * (1 - (sad * 0.7)), 0, wave * 0.8);
				}
			}

			setTongue(tongue);
		},
	};
}
