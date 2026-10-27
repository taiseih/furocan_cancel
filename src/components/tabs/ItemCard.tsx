import type {ReactNode} from 'react';
import type {Item} from '../../game/data';

export function ItemCard({item, action, className = ''}: {item: Item; action: ReactNode; className?: string}) {
	return (
		<div className={`item-card ${className}`}>
			<div className="item-icon">{item.icon}</div>
			<div className="item-info">
				<div className="item-name">{item.name}</div>
				<div className="item-desc">{item.description}</div>
			</div>
			{action}
		</div>
	);
}
