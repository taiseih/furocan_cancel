import {ITEM_CATALOG, SHOP_CATEGORIES, type ItemCategory} from '../../game/data';
import {useGame} from '../../game/GameContext';
import {isOwned} from '../../game/rules';
import {ItemCard} from './ItemCard';

export function ShopTab({category, onChangeCategory, onBuy}: {
	category: ItemCategory;
	onChangeCategory: (category: ItemCategory) => void;
	onBuy: (itemId: string) => void;
}) {
	const {state} = useGame();
	return (
		<>
			<div className="chips">
				{SHOP_CATEGORIES.map(candidate => (
					<button key={candidate.id} type="button" className={`chip ${candidate.id === category ? 'is-active' : ''}`} onClick={() => onChangeCategory(candidate.id)}>
						{candidate.label}
					</button>
				))}
			</div>
			{ITEM_CATALOG.filter(item => item.category === category && item.price > 0).map(item => {
				const isOwnedItem = item.category !== 'food' && isOwned(state, item.id);
				const canAfford = state.points >= item.price;
				const ownedCount = item.category === 'food' ? (state.inventory[item.id] ?? 0) : 0;
				return (
					<ItemCard
						key={item.id}
						item={item}
						className={isOwnedItem ? 'is-owned' : ''}
						action={(
							<div className="buy-area">
								{ownedCount > 0 && <small className="owned-count">所持 {ownedCount}</small>}
								<button type="button" className="btn btn-buy" disabled={isOwnedItem || !canAfford} onClick={() => onBuy(item.id)}>
									{isOwnedItem ? '持ってる' : `${item.price}pt`}
								</button>
							</div>
						)}
					/>
				);
			})}
		</>
	);
}
