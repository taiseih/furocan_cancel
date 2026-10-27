import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import {GameProvider} from './game/GameContext';
import './style.css';

const root = document.getElementById('root');
if (!root) {
	throw new Error('#root が見つかりません');
}

createRoot(root).render(
	<StrictMode>
		<GameProvider>
			<App />
		</GameProvider>
	</StrictMode>,
);
