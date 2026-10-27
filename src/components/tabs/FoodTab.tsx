import {ITEM_CATALOG} from '../../game/data';
import {useGame} from '../../game/GameContext';
import {ItemCard} from './ItemCard';

export function FoodTab({onFeed, onGoToShop}: {onFeed: (itemId: string) => void; onGoToShop: () => void}) {
	const {state} = useGame();
	const foods = ITEM_CATALOG.filter(item => item.category === 'food' && (state.inventory[item.id] ?? 0) > 0);
	if (foods.length === 0) {
		return <p className="empty">ごはんがないよ。<button type="button" className="link" onClick={onGoToShop}>ショップで買おう</button></p>;
	}

	return foods.map(item => (
		<ItemCard
			key={item.id}
			item={item}
			action={<button type="button" className="btn btn-primary" onClick={() => onFeed(item.id)}>あげる <small>×{state.inventory[item.id]}</small></button>}
		/>
	));
}
