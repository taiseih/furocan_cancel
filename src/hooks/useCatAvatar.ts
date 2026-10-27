import {useEffect, useRef, useState} from 'react';
import {createCatAvatar, type CatAvatar} from '../cat3d/avatar';
import type {PetModel} from '../game/data';

declare global {
	interface Window {
		catAvatar?: CatAvatar;
	}
}

// three.js のお部屋は React の描画とは別に動かし、作り直さずに命令で状態を渡す
export function useCatAvatar(initialPet: PetModel, {onPet, isDebugMode}: {onPet: () => void; isDebugMode: boolean}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const stageRef = useRef<HTMLDivElement>(null);
	const avatarRef = useRef<CatAvatar | null>(null);
	const [error, setError] = useState<string | null>(null);
	const initialPetRef = useRef(initialPet);
	const onPetRef = useRef(onPet);

	useEffect(() => {
		onPetRef.current = onPet;
	});

	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return undefined;
		}

		let avatar: CatAvatar;
		try {
			avatar = createCatAvatar(container, {onPet: () => onPetRef.current(), stage: stageRef.current, pet: initialPetRef.current});
		} catch (caught) {
			// WebGL が使えない環境でもゲーム自体は遊べるようにする
			console.error(caught);
			setError('この端末では3Dのお部屋を表示できませんでした');
			return undefined;
		}

		avatarRef.current = avatar;
		if (isDebugMode) {
			window.catAvatar = avatar;
		}

		return () => {
			avatar.dispose();
			avatarRef.current = null;
		};
	}, [isDebugMode]);

	return {containerRef, stageRef, avatarRef, error};
}
