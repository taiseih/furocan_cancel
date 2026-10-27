import type {Species} from './data';
import {HOUR_MS} from './rules';

// セリフの語尾 {nya} をペットに合わせて「にゃ」「わん」にする
export function talk(species: Species, text: string): string {
	return text.replaceAll('{nya}', species.suffix);
}

export function getPetLine(species: Species, dirt: number, hunger: number): string {
	if (dirt >= 85) {
		return talk(species, 'くさい{nya}…かゆい{nya}…お風呂入ってほしい{nya}…');
	}

	if (dirt >= 60) {
		return talk(species, 'からだがベタベタする{nya}…');
	}

	if (hunger <= 20) {
		return talk(species, 'おなかすいた{nya}〜');
	}

	if (dirt < 15) {
		return talk(species, 'ぴかぴかで気分いい{nya}！');
	}

	const lines = [species.voice, talk(species, 'なでてくれるの{nya}？'), species.happySound];
	return lines[Math.floor(Math.random() * lines.length)] ?? species.voice;
}

export function getCleanLabel(dirt: number): string {
	if (dirt < 15) {
		return 'ぴかぴか';
	}

	if (dirt < 40) {
		return 'きれい';
	}

	if (dirt < 65) {
		return 'ちょい汚れ';
	}

	if (dirt < 85) {
		return 'よごれ';
	}

	return 'どろどろ';
}

export function formatElapsed(ms: number): string {
	const hours = Math.floor(ms / HOUR_MS);
	if (hours < 1) {
		return 'さっき';
	}

	if (hours < 24) {
		return `${hours}時間前`;
	}

	return `${Math.floor(hours / 24)}日${hours % 24}時間前`;
}
