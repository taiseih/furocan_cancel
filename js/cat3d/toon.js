import * as THREE from 'three';

export const OUTLINE_COLOR = '#3b2b25';

// 3段階の階調にして、イラストのようなベタ塗りに近い陰影にする
const gradientMap = (() => {
	const texture = new THREE.DataTexture(new Uint8Array([170, 225, 255]), 3, 1, THREE.RedFormat);
	texture.minFilter = THREE.NearestFilter;
	texture.magFilter = THREE.NearestFilter;
	texture.needsUpdate = true;
	return texture;
})();

export function toon(color, options = {}) {
	return new THREE.MeshToonMaterial({color, gradientMap, ...options});
}

const outlineMaterials = new Map();

// 法線方向に膨らませた裏面だけを描く「背面法」で、線画のような輪郭線を付ける
function outlineMaterial(thickness) {
	if (!outlineMaterials.has(thickness)) {
		outlineMaterials.set(thickness, new THREE.ShaderMaterial({
			uniforms: {uThickness: {value: thickness}, uColor: {value: new THREE.Color(OUTLINE_COLOR)}},
			vertexShader: /* glsl */ `
				uniform float uThickness;
				void main() {
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normalize(normal) * uThickness, 1.0);
				}
			`,
			fragmentShader: /* glsl */ `
				uniform vec3 uColor;
				void main() {
					gl_FragColor = vec4(uColor, 1.0);
					#include <colorspace_fragment>
				}
			`,
			side: THREE.BackSide,
		}));
	}

	return outlineMaterials.get(thickness);
}

export function outlined(mesh, thickness = 0.02) {
	const hull = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness));
	hull.raycast = () => {};
	mesh.add(hull);
	return mesh;
}

export function mesh(geometry, material, {outline = 0.02, position, rotation} = {}) {
	const result = new THREE.Mesh(geometry, material);
	if (outline > 0) {
		outlined(result, outline);
	}

	if (position) {
		result.position.set(...position);
	}

	if (rotation) {
		result.rotation.set(...rotation);
	}

	return result;
}

// 既存のマテリアル（アクセサリーなど）をトゥーン調にそろえて輪郭線を付ける
export function toonify(object, outline = 0.012) {
	const meshes = [];
	object.traverse(child => {
		if (child.isMesh) {
			meshes.push(child);
		}
	});

	for (const child of meshes) {
		const source = child.material;
		child.material = toon(source.color ?? '#ffffff', {
			transparent: source.transparent,
			opacity: source.opacity,
			side: source.side,
		});
		if (!source.transparent) {
			outlined(child, outline);
		}
	}

	return object;
}
