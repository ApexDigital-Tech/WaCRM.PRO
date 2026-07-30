// ============================================================
// WhatsAppDomService — Abstracción del DOM (ADR-03)
// Toda la extensión accede al DOM de WhatsApp EXCLUSIVAMENTE
// a través de este servicio. Cero selectores hardcodeados fuera.
// ============================================================

import { z } from 'zod';
import type { SelectorDictionary } from '@wa-crm/types';

// ────────────────────────────────────────────────────────────
// SCHEMA ZOD — Validación del diccionario de selectores
// El servidor solo entrega datos; este schema garantiza su forma correcta.
// ────────────────────────────────────────────────────────────

export const SelectorDictionarySchema = z.object({
  version: z.string().min(1),
  CHAT_CONTACT_NAME: z.string().min(1),
  CHAT_PHONE_HEADER: z.string().min(1),
  CHAT_LIST_ITEM: z.string().min(1),
  CHAT_INPUT_BOX: z.string().min(1),
  OPEN_CHAT_PANEL: z.string().min(1),
  MESSAGE_LIST_CONTAINER: z.string().min(1),
});

// ────────────────────────────────────────────────────────────
// FALLBACK — Selectores de último recurso empaquetados en el build
// Usado si Supabase no responde o el schema falla la validación.
// ────────────────────────────────────────────────────────────

const FALLBACK_SELECTORS: SelectorDictionary = {
  version: '2026-07-27-fallback',
  CHAT_CONTACT_NAME: 'span[data-testid="conversation-info-header-chat-title"]',
  CHAT_PHONE_HEADER: 'span[data-testid="conversation-info-header-chat-title"] span',
  CHAT_LIST_ITEM: '[data-testid="cell-frame-container"]',
  CHAT_INPUT_BOX: 'div[data-testid="conversation-compose-box-input"]',
  OPEN_CHAT_PANEL: 'div[data-testid="conversation-panel-body"]',
  MESSAGE_LIST_CONTAINER: 'div[data-testid="msg-container"]',
};

// ────────────────────────────────────────────────────────────
// SERVICIO
// ────────────────────────────────────────────────────────────

export class WhatsAppDomService {
  private selectors: SelectorDictionary;
  private observer: MutationObserver | null = null;

  constructor(selectors: SelectorDictionary) {
    this.selectors = selectors;
  }

  // ── Lectura del DOM ──────────────────────────────────────

  /** Nombre del contacto en el chat activo */
  getActiveContactName(): string | null {
    return (
      document.querySelector(this.selectors.CHAT_CONTACT_NAME)
        ?.textContent?.trim() ?? null
    );
  }

  /** Input de texto del chat activo */
  getChatInputBox(): HTMLElement | null {
    return document.querySelector<HTMLElement>(this.selectors.CHAT_INPUT_BOX);
  }

  /** Lista de ítems de chat en el sidebar */
  getChatListItems(): NodeListOf<Element> {
    return document.querySelectorAll(this.selectors.CHAT_LIST_ITEM);
  }

  // ── Reactividad ──────────────────────────────────────────

  /**
   * Observa cambios en el panel principal de WhatsApp.
   * Se activa cuando el usuario abre un chat diferente.
   */
  onChatChange(callback: (contactName: string | null) => void): void {
    this.observer?.disconnect();

    const target = document.querySelector(this.selectors.OPEN_CHAT_PANEL);
    if (!target) {
      console.warn('[WA-CRM DOM] Panel de chat no encontrado. Selector:', this.selectors.OPEN_CHAT_PANEL);
      return;
    }

    this.observer = new MutationObserver(() => {
      const name = this.getActiveContactName();
      callback(name);
    });

    this.observer.observe(target, { childList: true, subtree: false });
  }

  /** Detiene todos los observadores activos */
  destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  // ── Metadatos ────────────────────────────────────────────

  get selectorVersion(): string {
    return this.selectors.version;
  }
}

// ────────────────────────────────────────────────────────────
// FACTORY — Construye el servicio con selectores validados
// ────────────────────────────────────────────────────────────

export function createWhatsAppDomService(rawSelectors: unknown): WhatsAppDomService {
  const parsed = SelectorDictionarySchema.safeParse(rawSelectors);

  if (!parsed.success) {
    console.error(
      '[WA-CRM DOM] Diccionario de selectores inválido. Usando fallback.',
      parsed.error.flatten()
    );
    return new WhatsAppDomService(FALLBACK_SELECTORS);
  }

  console.info(`[WA-CRM DOM] Selectores v${parsed.data.version} cargados y validados.`);
  return new WhatsAppDomService(parsed.data);
}
