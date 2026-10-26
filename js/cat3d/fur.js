import * as THREE from 'three';

const isLowPowerDevice = matchMedia('(pointer: coarse)').matches;
export const SHELL_COUNT = isLowPowerDevice ? 16 : 24;

const STRAND_TEXTURE_SIZE = 256;
const MAX_HOLES = 3;

const vertexShader = /* glsl */ `
	attribute float aShell;
	uniform float uShellCount;
	uniform float uFurLength;
	uniform float uWet;
	uniform mat4 uRestMatrix;
	uniform vec4 uHoles[${MAX_HOLES}];
	varying vec3 vWorldPos;
	varying vec3 vWorldNormal;
	varying vec3 vPattern;
	varying vec3 vLocal;
	varying vec3 vLocalNormal;
	varying float vShell;
	varying float vHole;

	void main() {
		float shell = aShell / (uShellCount - 1.0);
		float hole = 1.0;
		for (int i = 0; i < ${MAX_HOLES}; i++) {
			if (uHoles[i].w > 0.0) {
				hole *= smoothstep(uHoles[i].w * 0.75, uHoles[i].w * 1.6, distance(position, uHoles[i].xyz));
			}
		}

		// 濡れると毛が寝て重力で垂れる
		float furLength = uFurLength * mix(1.0, 0.3, uWet) * hole;
		vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
		vec4 worldPos = modelMatrix * vec4(position, 1.0);
		vec3 gravity = vec3(0.0, -1.0, 0.0) * mix(0.25, 0.9, uWet);
		worldPos.xyz += worldNormal * furLength * shell + gravity * furLength * shell * shell;

		vWorldPos = worldPos.xyz;
		vWorldNormal = worldNormal;
		vPattern = (uRestMatrix * vec4(position, 1.0)).xyz;
		vLocal = position;
		vLocalNormal = normal;
		vShell = shell;
		vHole = hole;
		gl_Position = projectionMatrix * viewMatrix * worldPos;
	}
`;

const fragmentShader = /* glsl */ `
	uniform sampler2D uStrandTex;
	uniform float uStrandScale;
	uniform float uDirt;
	uniform float uWet;
	uniform vec3 uLightDir;
	uniform vec3 uLightColor;
	uniform vec3 uSky;
	uniform vec3 uGround;
	uniform vec3 uRimColor;
	uniform vec3 uBaseColor;
	uniform vec3 uCreamColor;
	uniform vec3 uStripeColor;
	uniform vec3 uStripeDir;
	uniform float uStripeFreq;
	uniform float uStripeAmount;
	uniform float uStripeMinY;
	uniform float uCream;
	uniform float uCreamFront;
	uniform float uCreamZ;
	varying vec3 vWorldPos;
	varying vec3 vWorldNormal;
	varying vec3 vPattern;
	varying vec3 vLocal;
	varying vec3 vLocalNormal;
	varying float vShell;
	varying float vHole;

	float hash(vec3 p) {
		p = fract(p * 0.3183099 + 0.1);
		p *= 17.0;
		return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
	}

	float noise(vec3 x) {
		vec3 i = floor(x);
		vec3 f = fract(x);
		f = f * f * (3.0 - 2.0 * f);
		return mix(
			mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
			mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
			f.z
		);
	}

	float fbm(vec3 p) {
		float value = 0.0;
		float amplitude = 0.5;
		for (int i = 0; i < 4; i++) {
			value += amplitude * noise(p);
			p *= 2.03;
			amplitude *= 0.5;
		}
		return value;
	}

	void main() {
		// パーツごとのUVの歪みを避けるため、法線の主軸方向に投影して毛の位置を決める
		vec3 axisWeight = abs(vLocalNormal);
		vec2 strandUv = axisWeight.x > axisWeight.y && axisWeight.x > axisWeight.z
			? vLocal.yz
			: (axisWeight.y > axisWeight.z ? vLocal.xz : vLocal.xy);
		strandUv *= uStrandScale;
		vec4 strand = texture2D(uStrandTex, (floor(strandUv) + 0.5) / ${STRAND_TEXTURE_SIZE}.0);

		// 汚れは体の下側から広がり、汚れた毛は固まって短くなる
		float dirtNoise = fbm(vPattern * 9.0);
		float dirtThreshold = 1.0 - uDirt * 0.5;
		float dirtMask = smoothstep(dirtThreshold, dirtThreshold + 0.1, dirtNoise + (0.45 - vPattern.y) * 0.35) * step(0.08, uDirt);

		if (vShell > 0.0) {
			if (vHole < 0.04) discard;
			float strandHeight = strand.r * mix(1.0, 0.7, dirtMask);
			if (vShell > strandHeight) discard;
			vec2 center = 0.5 + (strand.gb - 0.5) * 0.5;
			float radius = (1.0 - (vShell / strandHeight) * 0.8) * mix(0.55, 0.42, dirtMask);
			if (distance(fract(strandUv), center) > radius) discard;
		}

		float creamWeight = max(uCream, uCreamFront * smoothstep(uCreamZ, uCreamZ + 0.06, vPattern.z));
		float stripeWave = sin(dot(vPattern, uStripeDir) * uStripeFreq + fbm(vPattern * 5.0) * 4.0);
		float stripe = smoothstep(0.2, 0.75, stripeWave) * uStripeAmount * (1.0 - creamWeight) * step(uStripeMinY, vPattern.y);
		vec3 color = mix(uBaseColor, uCreamColor, creamWeight);
		color = mix(color, uStripeColor, stripe);
		color *= mix(0.82, 1.12, strand.a);
		color = mix(color, color * 1.25, vShell * vShell * 0.6);
		color = mix(color, vec3(0.13, 0.085, 0.045) * mix(0.8, 1.2, dirtNoise), dirtMask * 0.9);
		// 全体はうっすらくすむ程度にとどめ、元の毛色が分かるようにする
		float luminance = dot(color, vec3(0.299, 0.587, 0.114));
		color = mix(color, vec3(luminance) * vec3(0.95, 0.88, 0.75), uDirt * 0.25);
		color *= mix(1.0, 0.55, uWet);

		vec3 normal = normalize(vWorldNormal);
		vec3 viewDir = normalize(cameraPosition - vWorldPos);
		vec3 lightDir = normalize(uLightDir);
		float diffuse = clamp((dot(normal, lightDir) + 0.45) / 1.45, 0.0, 1.0);
		vec3 ambient = mix(uGround, uSky, normal.y * 0.5 + 0.5);
		// 根元ほど他の毛に遮られて暗くなる
		float occlusion = mix(0.3, 1.0, vShell);
		vec3 halfDir = normalize(lightDir + viewDir);
		float specular = pow(max(dot(normal, halfDir), 0.0), mix(14.0, 80.0, uWet)) * mix(0.12, 0.9, uWet) * (1.0 - dirtMask);
		float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0) * (1.0 - uDirt * 0.6);

		vec3 lit = color * (ambient + uLightColor * diffuse) * occlusion
			+ uLightColor * specular * max(vShell, uWet)
			+ uRimColor * rim * vShell;
		gl_FragColor = vec4(lit, 1.0);
		#include <tonemapping_fragment>
		#include <colorspace_fragment>
	}
`;

function createStrandTexture() {
	const size = STRAND_TEXTURE_SIZE;
	const data = new Uint8Array(size * size * 4);
	for (let index = 0; index < size * size; index++) {
		data[index * 4] = 140 + (Math.random() * 115);
		data[(index * 4) + 1] = Math.random() * 255;
		data[(index * 4) + 2] = Math.random() * 255;
		data[(index * 4) + 3] = Math.random() * 255;
	}

	const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.needsUpdate = true;
	return texture;
}

export function createFurSharedUniforms() {
	return {
		uDirt: {value: 0},
		uWet: {value: 0},
		uShellCount: {value: SHELL_COUNT},
		uStrandTex: {value: createStrandTexture()},
		uStrandScale: {value: 240},
		uLightDir: {value: new THREE.Vector3(0.45, 0.9, 0.7).normalize()},
		uLightColor: {value: new THREE.Color(1, 0.95, 0.88).multiplyScalar(1.5)},
		uSky: {value: new THREE.Color('#cfe3ff').multiplyScalar(0.6)},
		uGround: {value: new THREE.Color('#8a6a50').multiplyScalar(0.4)},
		uRimColor: {value: new THREE.Color('#fff2dd').multiplyScalar(0.45)},
	};
}

export const COAT = {
	base: '#d4843a',
	cream: '#f3dfc1',
	stripe: '#9a5220',
};

export function createFurMaterial(sharedUniforms, options = {}) {
	const {
		furLength = 0.024,
		cream = 0,
		creamFront = 0,
		creamZ = 0,
		stripeDir = [0, 1, 0],
		stripeFreq = 95,
		stripeAmount = 0.75,
		stripeMinY = -10,
		holes = [],
	} = options;

	const holeValues = Array.from({length: MAX_HOLES}, (_, index) => {
		const hole = holes[index];
		return hole ? new THREE.Vector4(...hole) : new THREE.Vector4(0, 0, 0, 0);
	});

	return new THREE.ShaderMaterial({
		uniforms: {
			...sharedUniforms,
			uFurLength: {value: furLength},
			uRestMatrix: {value: new THREE.Matrix4()},
			uHoles: {value: holeValues},
			uBaseColor: {value: new THREE.Color(COAT.base)},
			uCreamColor: {value: new THREE.Color(COAT.cream)},
			uStripeColor: {value: new THREE.Color(COAT.stripe)},
			uStripeDir: {value: new THREE.Vector3(...stripeDir).normalize()},
			uStripeFreq: {value: stripeFreq},
			uStripeAmount: {value: stripeAmount},
			uStripeMinY: {value: stripeMinY},
			uCream: {value: cream},
			uCreamFront: {value: creamFront},
			uCreamZ: {value: creamZ},
		},
		vertexShader,
		fragmentShader,
	});
}

// 1パーツ = 1ドローコールに抑えるため、毛の層をインスタンスとして描く
export function createFurMesh(geometry, material) {
	const shellIndices = Float32Array.from({length: SHELL_COUNT}, (_, index) => index);
	geometry.setAttribute('aShell', new THREE.InstancedBufferAttribute(shellIndices, 1));
	const mesh = new THREE.InstancedMesh(geometry, material, SHELL_COUNT);
	const identity = new THREE.Matrix4();
	for (let index = 0; index < SHELL_COUNT; index++) {
		mesh.setMatrixAt(index, identity);
	}

	mesh.frustumCulled = false;
	return mesh;
}
