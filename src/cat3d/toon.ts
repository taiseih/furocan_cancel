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

export function toon(color: THREE.ColorRepresentation, options: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial {
	return new THREE.MeshToonMaterial({color, gradientMap, ...options});
}

const outlineMaterials = new Map<number, THREE.ShaderMaterial>();

// 法線方向に膨らませた裏面だけを描く「背面法」で、線画のような輪郭線を付ける
function outlineMaterial(thickness: number): THREE.ShaderMaterial {
	let material = outlineMaterials.get(thickness);
	if (!material) {
		material = new THREE.ShaderMaterial({
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
		});
		outlineMaterials.set(thickness, material);
	}

	return material;
}

export function outlined<T extends THREE.Mesh>(mesh: T, thickness = 0.02): T {
	const hull = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness));
	hull.raycast = () => {};
	mesh.add(hull);
	return mesh;
}

export type MeshOptions = {outline?: number; position?: THREE.Vector3Tuple; rotation?: THREE.Vector3Tuple};

export function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, {outline = 0.02, position, rotation}: MeshOptions = {}): THREE.Mesh {
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
export function toonify<T extends THREE.Object3D>(object: T, outline = 0.012): T {
	const meshes: THREE.Mesh[] = [];
	object.traverse(child => {
		if (child instanceof THREE.Mesh) {
			meshes.push(child);
		}
	});

	for (const child of meshes) {
		const source = child.material;
		if (Array.isArray(source)) {
			continue;
		}

		const color = 'color' in source && source.color instanceof THREE.Color ? source.color : '#ffffff';
		child.material = toon(color, {
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
