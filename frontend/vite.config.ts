import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE for GitHub Pages deployment:
//  - Build with: VITE_API_URL=https://<your-public-backend-url> npm run build
//  - `base: './'` keeps asset paths relative so the app works when served
//    from a project sub-path like https://<user>.github.io/<repo>/.
//  - The app uses HashRouter, so no server-side SPA fallback is needed.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
  },
});
