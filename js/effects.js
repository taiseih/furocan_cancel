'use strict';

const Effects = (() => {
	const SPARKLE_COLORS = ['#ffd23f', '#ff8fab', '#7bdff2', '#b8f2a6', '#ffffff', '#c3a6ff'];
	const SPARKLE_CHARS = ['✦', '✧', '★', '✶'];
	const BUBBLE_DURATION_MS = 2400;
	const SPARKLE_DURATION_MS = 1800;

	const random = (min, max) => min + (Math.random() * (max - min));
	const pick = list => list[Math.floor(Math.random() * list.length)];

	function createLayer(stage) {
		const layer = document.createElement('div');
		layer.className = 'fx-layer';
		stage.append(layer);
		return layer;
	}

	function spawnBubbles(layer, count) {
		for (let index = 0; index < count; index++) {
			const bubble = document.createElement('span');
			const size = random(14, 42);
			bubble.className = 'fx-bubble';
			bubble.style.width = `${size}px`;
			bubble.style.height = `${size}px`;
			bubble.style.left = `${random(8, 88)}%`;
			bubble.style.top = `${random(20, 92)}%`;
			bubble.style.animationDelay = `${random(0, 800)}ms`;
			layer.append(bubble);
		}
	}

	function spawnSparkles(layer, count) {
		for (let index = 0; index < count; index++) {
			const sparkle = document.createElement('span');
			const angle = random(0, Math.PI * 2);
			const distance = random(60, 160);
			sparkle.className = 'fx-sparkle';
			sparkle.textContent = pick(SPARKLE_CHARS);
			sparkle.style.color = pick(SPARKLE_COLORS);
			sparkle.style.fontSize = `${random(14, 32)}px`;
			sparkle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
			sparkle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
			sparkle.style.setProperty('--spin', `${random(-270, 270)}deg`);
			sparkle.style.animationDelay = `${random(0, 350)}ms`;
			layer.append(sparkle);
		}
	}

	function appendElement(layer, className) {
		const element = document.createElement('div');
		element.className = className;
		layer.append(element);
	}

	function bubbles(stage) {
		const layer = createLayer(stage);
		spawnBubbles(layer, 30);
		setTimeout(() => layer.remove(), BUBBLE_DURATION_MS);
	}

	function sparkleBurst(stage) {
		const layer = createLayer(stage);
		appendElement(layer, 'fx-flash');
		appendElement(layer, 'fx-ring');
		spawnSparkles(layer, 40);
		setTimeout(() => layer.remove(), SPARKLE_DURATION_MS);
	}

	function floatText(stage, text) {
		const label = document.createElement('div');
		label.className = 'fx-float-text';
		label.textContent = text;
		stage.append(label);
		label.addEventListener('animationend', () => label.remove());
	}

	function hearts(stage, count = 5) {
		const layer = createLayer(stage);
		for (let index = 0; index < count; index++) {
			const heart = document.createElement('span');
			heart.className = 'fx-heart';
			heart.textContent = pick(['💗', '💕', '💖']);
			heart.style.left = `${random(25, 75)}%`;
			heart.style.animationDelay = `${random(0, 300)}ms`;
			layer.append(heart);
		}

		setTimeout(() => layer.remove(), 1600);
	}

	return {bubbles, sparkleBurst, floatText, hearts};
})();
