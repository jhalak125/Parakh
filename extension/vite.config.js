import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

function safeCopy(src, dest) {
  try {
    if (existsSync(src)) copyFileSync(src, dest);
  } catch (e) {
    // ignore
  }
}

export default defineConfig({
  // Relative base so all references in sidepanel/index.html are relative
  base: './',
  plugins: [
    react(),
    {
      name: 'copy-extension-files',
      closeBundle() {
        copyFileSync('manifest.json', 'dist/manifest.json');
        mkdirSync('dist/public/icons', { recursive: true });
        safeCopy('public/icons/icon-16.png',  'dist/public/icons/icon-16.png');
        safeCopy('public/icons/icon-48.png',  'dist/public/icons/icon-48.png');
        safeCopy('public/icons/icon-128.png', 'dist/public/icons/icon-128.png');
        console.log('✅ Extension assets copied to dist/');
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel/index.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.js'),
        scraper: resolve(__dirname, 'src/content/scraper.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') return 'src/background/service-worker.js';
          if (chunkInfo.name === 'scraper')         return 'src/content/scraper.js';
          // Put the sidepanel JS next to its HTML
          return 'sidepanel/[name]-[hash].js';
        },
        // Shared chunks alongside the sidepanel
        chunkFileNames: 'sidepanel/chunks/[name]-[hash].js',
        // CSS and other assets alongside the sidepanel
        assetFileNames: 'sidepanel/assets/[name]-[hash][extname]',
        format: 'es',
      }
    }
  }
});
