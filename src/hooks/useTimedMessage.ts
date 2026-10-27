import {useCallback, useEffect, useRef, useState} from 'react';

export type TimedMessage = {text: string; isVisible: boolean};

// 吹き出しやトーストのように、出してからしばらくすると消えるメッセージ。
// 消えるときに文字が先に消えるとフェードアウトが崩れるので、text は残したまま isVisible だけ落とす
export function useTimedMessage(durationMs: number): [TimedMessage, (text: string) => void] {
	const [message, setMessage] = useState<TimedMessage>({text: '', isVisible: false});
	const timerIdRef = useRef<number | undefined>(undefined);

	const show = useCallback((text: string) => {
		setMessage({text, isVisible: true});
		window.clearTimeout(timerIdRef.current);
		timerIdRef.current = window.setTimeout(() => setMessage(current => ({...current, isVisible: false})), durationMs);
	}, [durationMs]);

	useEffect(() => () => window.clearTimeout(timerIdRef.current), []);
	return [message, show];
}
