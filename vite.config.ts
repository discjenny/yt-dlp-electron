import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

// Vite only for the renderer. Main and preload continue to be built by Bun.
export default defineConfig({
	root: path.resolve(__dirname, 'renderer'),
	publicDir: path.resolve(__dirname, 'renderer', 'public'),
	plugins: [react()],
	// Ensure file:// production works with relative asset URLs
	base: './',
	server: {
		port: 5175,
		strictPort: true,
		hmr: true,
	},
	preview: {
		port: 5175,
		strictPort: true,
	},
	build: {
		// Emit to dist next to main/preload outputs
		outDir: path.resolve(__dirname, 'dist'),
		emptyOutDir: false,
		assetsDir: '.',
		rollupOptions: {
			input: path.resolve(__dirname, 'renderer', 'index.html'),
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'renderer'),
		},
	},
});


