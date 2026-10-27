import {useEffect, useRef, type ReactNode} from 'react';

// 画面の上に重ねるカード。中身が長いときはカードの中だけスクロールし、下のボタンは常に見える
// placement が bottom のときは画面の下に寄せて、上のお部屋（ペット）が見えるようにする
export function Modal({children, footer, labelledBy, placement = 'center'}: {children: ReactNode; footer: ReactNode; labelledBy?: string; placement?: 'center' | 'bottom'}) {
	const cardRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		cardRef.current?.querySelector<HTMLElement>('.modal-footer .btn-primary')?.focus();
	}, []);

	return (
		<div className={`modal ${placement === 'bottom' ? 'is-bottom' : ''}`}>
			<div ref={cardRef} className="modal-card" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
				<div className="modal-body">{children}</div>
				<div className="modal-footer">{footer}</div>
			</div>
		</div>
	);
}

export function MessageModal({emoji, title, children, onClose}: {emoji: string; title: ReactNode; children?: ReactNode; onClose: () => void}) {
	return (
		<Modal labelledBy="message-modal-title" footer={<button className="btn btn-primary" type="button" onClick={onClose}>OK</button>}>
			<div className="modal-emoji">{emoji}</div>
			<h2 id="message-modal-title">{title}</h2>
			{children}
		</Modal>
	);
}
