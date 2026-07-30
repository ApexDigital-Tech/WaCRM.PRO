import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseRef = env.VITE_SUPABASE_REF;

  if (!supabaseUrl || !supabaseRef) {
    console.warn(
      '⚠️ VITE_SUPABASE_URL y VITE_SUPABASE_REF no encontradas. Usando valores por defecto para permitir que CI/Vercel compile.'
    );
  }

  const finalSupabaseUrl = supabaseUrl || 'https://dummy.supabase.co';
  const finalSupabaseRef = supabaseRef || 'dummy';
  const finalAnonKey = env.VITE_SUPABASE_ANON_KEY || 'dummy';

  return {
    plugins: [react()],

    define: {
      __SUPABASE_URL__: JSON.stringify(finalSupabaseUrl),
      __SUPABASE_ANON_KEY__: JSON.stringify(finalAnonKey),
      __SUPABASE_REF__: JSON.stringify(finalSupabaseRef),
      __APP_VERSION__: JSON.stringify('8.0.0'),
    },

    build: {
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: mode === 'development',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/content/index.tsx'),
          mainWorldBridge: resolve(__dirname, 'src/content/mainWorldBridge.ts'),
        },
        treeshake: false, // Desactivar tree-shaking para preservar side-effects
        output: {
          format: 'es',
          entryFileNames: 'content/[name].js',
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
