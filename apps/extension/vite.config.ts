import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // La URL de Supabase se inyecta en build-time — nunca en runtime desde el servidor
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseRef = env.VITE_SUPABASE_REF; // Usado para generar el manifest final

  if (!supabaseUrl || !supabaseRef) {
    console.warn(
      '⚠️ VITE_SUPABASE_URL y VITE_SUPABASE_REF no encontradas. Usando valores por defecto para permitir que CI/Vercel compile.'
    );
  }

  const finalSupabaseUrl = supabaseUrl || 'https://dummy.supabase.co';
  const finalSupabaseRef = supabaseRef || 'dummy';
  const finalAnonKey = env.VITE_SUPABASE_ANON_KEY || 'dummy';

  const copyManifestPlugin = () => ({
    name: 'copy-manifest-plugin',
    closeBundle() {
      const manifestPath = resolve(__dirname, 'manifest.json');
      const distManifestPath = resolve(__dirname, 'dist/manifest.json');
      let content = fs.readFileSync(manifestPath, 'utf-8');
      content = content.replace(/__SUPABASE_REF__/g, finalSupabaseRef);
      fs.writeFileSync(distManifestPath, content, 'utf-8');
    },
  });

  return {
    plugins: [react(), copyManifestPlugin()],

    define: {
      // Variables de entorno accesibles en el código de la extensión
      __SUPABASE_URL__: JSON.stringify(finalSupabaseUrl),
      __SUPABASE_ANON_KEY__: JSON.stringify(finalAnonKey),
      __SUPABASE_REF__: JSON.stringify(finalSupabaseRef),
      __APP_VERSION__: JSON.stringify('8.0.0'),
    },

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: mode === 'development',

      rollupOptions: {
        input: {
          // Service Worker (background)
          serviceWorker: resolve(__dirname, 'src/background/serviceWorker.ts'),
          // Popup de la extensión
          popup: resolve(__dirname, 'src/popup/index.html'),
        },
        output: {
          // Paths fijos requeridos por el manifest
          entryFileNames: (chunk) => {
            const names: Record<string, string> = {
              serviceWorker: 'background/serviceWorker.js',
            };
            return names[chunk.name] ?? 'assets/[name]-[hash].js';
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: (asset) => {
            if (asset.name?.endsWith('.css')) {
              return asset.name.includes('content')
                ? 'content/styles.css'
                : 'assets/[name]-[hash].css';
            }
            return 'assets/[name]-[hash][extname]';
          },
        },
      },
    },

    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
  };
});
