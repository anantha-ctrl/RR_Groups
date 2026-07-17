import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: true, // listen on 0.0.0.0 so LAN devices (phones on the same Wi-Fi) can reach it
    port: 5173,
  },
});
