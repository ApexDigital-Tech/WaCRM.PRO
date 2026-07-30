// ============================================================
// Shadow Mount — Aislamiento de UI (ADR-08, Sprint 2)
// Evita conflictos de CSS con el DOM de WhatsApp Web.
// ============================================================

// El CSS procesado por Vite se inyecta como un string
import panelStyles from './styles/panel.css?inline';

export interface ShadowMount {
  host: HTMLElement;
  root: ShadowRoot;
  container: HTMLElement;
}

/**
 * Crea y monta el contenedor raíz de la extensión usando Shadow DOM (closed).
 * Inyecta el CSS usando adoptedStyleSheets (preferido) o <style> como fallback.
 */
export function mountShadowUI(): ShadowMount {
  // 1. Crear el host principal
  const host = document.createElement('div');
  host.id = 'wacrm-host';
  // z-index maximo para sobreponerse a WhatsApp
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.right = '0';
  host.style.zIndex = '2147483647';
  
  // 2. Adjuntar Shadow DOM en modo closed (nadie desde fuera puede acceder a .shadowRoot)
  const shadow = host.attachShadow({ mode: 'closed' });

  // 3. Crear el contenedor interno de React
  const container = document.createElement('div');
  container.id = 'wacrm-root';
  shadow.appendChild(container);

  // 4. Inyectar estilos (Aislamiento de CSS)
  try {
    // API moderna (rendimiento óptimo, sin nodos extra en el DOM)
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(panelStyles);
    shadow.adoptedStyleSheets = [sheet];
  } catch (err) {
    // Fallback para navegadores antiguos que no soporten constructable stylesheets
    console.warn('[WA-CRM] adoptedStyleSheets no soportado. Usando <style> fallback.');
    const styleTag = document.createElement('style');
    styleTag.textContent = panelStyles;
    shadow.appendChild(styleTag);
  }

  // 5. Agregar el host al documento de WhatsApp
  document.body.appendChild(host);

  return { host, root: shadow, container };
}
