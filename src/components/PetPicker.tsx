import {Fragment} from 'react';
import {PET_BREEDS, PET_SPECIES, petColorSwatch, type SpeciesId} from '../game/data';
import {getPet} from '../game/rules';
import {useGame} from '../game/GameContext';
import {ToggleGrid} from './ToggleGrid';

// ねこ・いぬの品種をえらぶボタン。コーデタブと最初の説明の両方で使う
export function BreedPicker({onSelect}: {onSelect: (breedId: string) => void}) {
	const {state} = useGame();
	const {breed: currentBreed} = getPet(state);
	return (
		<>
			{(Object.entries(PET_SPECIES) as [SpeciesId, (typeof PET_SPECIES)[SpeciesId]][]).map(([speciesId, species]) => (
				<Fragment key={speciesId}>
					<h3>{species.icon} {species.name}</h3>
					<ToggleGrid
						items={PET_BREEDS.filter(breed => breed.species === speciesId)}
						isActive={breed => breed.id === currentBreed.id}
						onSelect={breed => onSelect(breed.id)}
					/>
				</Fragment>
			))}
		</>
	);
}

// 選んでいる品種の毛色をえらぶボタン
export function ColorPicker({onSelect}: {onSelect: (colorId: string) => void}) {
	const {state} = useGame();
	const {breed, color: currentColor} = getPet(state);
	return (
		<div className="swatch-grid">
			{breed.colors.map(color => {
				const [first, second, third] = petColorSwatch(color);
				const isActive = color.id === currentColor.id;
				return (
					<button key={color.id} type="button" className={`swatch ${isActive ? 'is-active' : ''}`} aria-pressed={isActive} onClick={() => onSelect(color.id)}>
						<span className="swatch-color" style={{background: `conic-gradient(${first} 0 50%, ${second} 50% 75%, ${third} 75%)`}} />
						<span>{color.name}</span>
					</button>
				);
			})}
		</div>
	);
}
