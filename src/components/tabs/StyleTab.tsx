import {Fragment} from 'react';
import {ACCESSORY_SLOTS, ITEM_CATALOG, type AccessoryItem, type RoomItem} from '../../game/data';
import {useGame} from '../../game/GameContext';
import {isOwned} from '../../game/rules';
import {BreedPicker, ColorPicker} from '../PetPicker';
import {ToggleGrid} from '../ToggleGrid';

const ROOM_KINDS = [['wall', '🧱 壁紙'], ['floor', '🟫 床']] as const;

export function StyleTab({onSelectBreed, onSelectColor}: {onSelectBreed: (breedId: string) => void; onSelectColor: (colorId: string) => void}) {
	const {state, actions} = useGame();
	const ownedItems = ITEM_CATALOG.filter(item => isOwned(state, item.id));
	const accessories = ownedItems.filter((item): item is AccessoryItem => item.category === 'accessory');
	const roomItems = ownedItems.filter((item): item is RoomItem => item.category === 'room');
	const furniture = roomItems.filter(item => item.kind === 'furniture');

	return (
		<>
			<BreedPicker onSelect={onSelectBreed} />
			<h3>🎨 毛色</h3>
			<ColorPicker onSelect={onSelectColor} />

			{ACCESSORY_SLOTS.map(slot => {
				const slotItems = accessories.filter(item => item.slot === slot.id);
				return slotItems.length > 0 && (
					<Fragment key={slot.id}>
						<h3>🎀 {slot.label}</h3>
						<ToggleGrid items={slotItems} isActive={item => state.equipped[slot.id] === item.id} onSelect={item => actions.toggleEquip(item.id)} />
					</Fragment>
				);
			})}
			{accessories.length === 0 && <p className="empty">アクセサリーはショップで買えるよ</p>}

			{ROOM_KINDS.map(([kind, label]) => (
				<Fragment key={kind}>
					<h3>{label}</h3>
					<ToggleGrid items={roomItems.filter(item => item.kind === kind)} isActive={item => state.room[kind] === item.id} onSelect={item => actions.applyRoom(item.id)} />
				</Fragment>
			))}

			<h3>🪑 家具</h3>
			{furniture.length > 0
				? <ToggleGrid items={furniture} isActive={item => state.room.furniture.includes(item.id)} onSelect={item => actions.toggleFurniture(item.id)} />
				: <p className="empty">家具はショップの「模様替え」で買えるよ</p>}
		</>
	);
}
