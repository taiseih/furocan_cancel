import {defineConfig, type Plugin} from 'vite';
import react from '@vitejs/plugin-react';

// 読み込めるのは自サイトと Google Fonts だけにして、XSS で外部のスクリプトを差し込まれないようにする。
// 開発サーバーは React のホットリロード用にインラインスクリプトを使うので、CSP はビルド時だけ入れる
const CONTENT_SECURITY_POLICY = [
	"default-src 'none'",
	"script-src 'self'",
	"style-src 'self' https://fonts.googleapis.com",
	'font-src https://fonts.gstatic.com',
	"img-src 'self' data:",
	"connect-src 'self'",
	"base-uri 'none'",
	"form-action 'none'",
	"object-src 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
	return {
		name: 'content-security-policy',
		apply: 'build',
		transformIndexHtml: () => [{tag: 'meta', attrs: {'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY}, injectTo: 'head-prepend'}],
	};
}

export default defineConfig({
	// GitHub Pages などサブパスに置いても動くように相対パスで出力する
	base: './',
	plugins: [react(), contentSecurityPolicy()],
	build: {
		// three.js（約700KB）を同梱しているので、警告の上限を少し上げる
		chunkSizeWarningLimit: 1000,
	},
});
