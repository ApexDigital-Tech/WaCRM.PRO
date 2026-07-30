// ============================================================
// Content Script — Entry Point (ADR-03, ADR-06, ADR-07)
// Inicializa la UI de React en Shadow DOM.
// ============================================================

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import { mountShadowUI } from './shadow-mount';
import { WhatsAppDomService } from './dom-service';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

// ────────────────────────────────────────────────────────────
// BOOTSTRAP
// ────────────────────────────────────────────────────────────

async function init() {
  console.info('[WA-CRM] Content Script iniciando (React + Shadow DOM + WhatsAppDomService)...');

  // 1. Montar UI base en Shadow DOM
  const { container } = mountShadowUI();

  // 2. Renderizar App React
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // 3. Inicializar el servicio de DOM
  const domService = WhatsAppDomService.getInstance();
  domService.init(__SUPABASE_URL__, __SUPABASE_ANON_KEY__).catch(err => {
    console.error('[WA-CRM] Error al inicializar DOM Service:', err);
  });
}

// Bootstrap inmediato para Content Script
init();
