type ToggleItem = {id: string; icon: string; name: string};

export function ToggleGrid<Item extends ToggleItem>({items, isActive, onSelect}: {
	items: readonly Item[];
	isActive: (item: Item) => boolean;
	onSelect: (item: Item) => void;
}) {
	return (
		<div className="toggle-grid">
			{items.map(item => (
				<button key={item.id} type="button" className={`toggle ${isActive(item) ? 'is-active' : ''}`} aria-pressed={isActive(item)} onClick={() => onSelect(item)}>
					<span className="toggle-icon">{item.icon}</span>
					<span>{item.name}</span>
				</button>
			))}
		</div>
	);
}
