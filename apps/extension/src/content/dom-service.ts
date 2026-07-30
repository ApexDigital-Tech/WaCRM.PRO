// ============================================================
// WhatsAppDomService — Motor Anti-fragilidad DOM (Sprint 3)
// Extrae el contacto activo desde WhatsApp Web de forma resiliente.
// ============================================================

import { type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';
import type { ActiveChatInfo, DomSelectorConfigRow, DomServiceStatus } from '@wa-crm/types';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

// ────────────────────────────────────────────────────────────
// SELECTORES LOCALES DE RESILIENCIA (FALLBACK HARDCODEADO)
// ────────────────────────────────────────────────────────────

const DEFAULT_WHATSAPP_SELECTORS: Record<string, { selector: string; fallback?: string }> = {
  chat_header: {
    selector: '#main header, div[role="region"] header',
    fallback: 'header',
  },
  chat_title: {
    selector: '#main header div[role="button"] span[title], #main header span[dir="auto"]',
    fallback: '#main header [title]',
  },
  chat_avatar: {
    selector: '#main header img[src*="whatsapp"], #main header img',
    fallback: 'header img',
  },
  chat_phone_or_jid: {
    selector: '#main header div[data-jid]',
    fallback: '#main header [title]',
  },
};

type ChatChangeListener = (chatInfo: ActiveChatInfo) => void;

export class WhatsAppDomService {
  private static instance: WhatsAppDomService | null = null;

  private selectors: Record<string, { selector: string; fallback?: string }> = { ...DEFAULT_WHATSAPP_SELECTORS };
  private activeChatInfo: ActiveChatInfo = {
    jid: null,
    phoneNumber: null,
    name: null,
    avatarUrl: null,
    status: 'INITIALIZING',
    source: 'LOCAL_FALLBACK',
  };

  private observer: MutationObserver | null = null;
  private messageObserver: MutationObserver | null = null;
  private observedMainEl: HTMLElement | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<ChatChangeListener> = new Set();
  private processedMessageIds: Set<string> = new Set();
  private isObserving: boolean = false;
  private selectorSource: 'REMOTE_SELECTOR' | 'LOCAL_FALLBACK' = 'LOCAL_FALLBACK';

  private constructor() {}

  public static getInstance(): WhatsAppDomService {
    if (!WhatsAppDomService.instance) {
      WhatsAppDomService.instance = new WhatsAppDomService();
    }
    return WhatsAppDomService.instance;
  }

  // ────────────────────────────────────────────────────────────
  // INICIALIZACIÓN
  // ────────────────────────────────────────────────────────────

  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount: number = 0;
  private lastBridgeData: { phone: string | null; jid: string | null; isGroup: boolean } | null = null;

  public async init(supabaseUrl?: string, anonKey?: string): Promise<void> {
    // Resetear siempre a constantes por defecto antes de intentar carga remota
    this.selectors = { ...DEFAULT_WHATSAPP_SELECTORS };
    this.selectorSource = 'LOCAL_FALLBACK';

    // Inyectar Bridge en el Main World de WhatsApp Web para leer Fiber/Store nativamente
    this.injectMainWorldBridge();

    const url = supabaseUrl || (typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '');
    const key = anonKey || (typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '');

    if (url && key) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('dom_selector_configs')
          .select('*')
          .eq('platform', 'whatsapp_web')
          .eq('is_active', true);

        if (!error && data && data.length > 0) {
          const remoteMap: Record<string, { selector: string; fallback?: string }> = {};
          (data as DomSelectorConfigRow[]).forEach((row) => {
            remoteMap[row.selector_key] = {
              selector: row.selector_value,
              fallback: row.fallback_value || undefined,
            };
          });

          this.selectors = { ...DEFAULT_WHATSAPP_SELECTORS, ...remoteMap };
          this.selectorSource = 'REMOTE_SELECTOR';
          console.info('[WA-CRM DOM_SERVICE] Selectores cargados exitosamente desde Supabase (%d reglas).', data.length);
        } else {
          console.info('[WA-CRM DOM_SERVICE] Usando constantes locales de resiliencia (%s).', error?.message ?? 'sin datos');
        }
      } catch (err) {
        console.warn('[WA-CRM DOM_SERVICE] Error al conectar Supabase. Usando selectores de resiliencia local.');
      }
    }

    this.startObserving();
  }

  // ────────────────────────────────────────────────────────────
  // OBSERVADOR DOM & SUSCRIPCIÓN
  // ────────────────────────────────────────────────────────────

  public startObserving(): void {
    if (this.isObserving) return;

    this.isObserving = true;
    this.evaluateDom(); // Evaluación inicial inmediata

    this.observer = new MutationObserver(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.evaluateDom();
      }, 150);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['title', 'src', 'data-jid'],
    });

    console.info('[WA-CRM DOM_SERVICE] MutationObserver activo sobre WhatsApp Web.');
  }

  /**
   * Busca el contenedor principal del chat activo de WhatsApp Web.
   * Estrategia: navegar hacia arriba desde el header del chat (que sabemos encontrar)
   * hasta hallar un ancestro que contenga los mensajes. Esto es inmune a cambios de
   * IDs o roles ARIA por parte de Meta.
   */
  private findChatContainer(): HTMLElement | null {
    // 1. Intento clásico rápido
    const byId = document.getElementById('main');
    if (byId) return byId;

    // 2. Buscar desde la cabecera conocida (misma que produce 🟢 Sincronizado)
    const headerEl =
      this.queryElement('chat_header') ||
      document.querySelector<HTMLElement>('#main header') ||
      document.querySelector<HTMLElement>('div[role="region"] header') ||
      document.querySelector<HTMLElement>('[role="main"] header');

    if (headerEl) {
      // Subir por el árbol hasta encontrar un ancestro que contenga mensajes
      let parent = headerEl.parentElement;
      while (parent && parent !== document.body) {
        if (
          parent.querySelector('[data-id]') ||
          parent.querySelector('.message-in') ||
          parent.querySelector('[role="row"]')
        ) {
          return parent;
        }
        parent = parent.parentElement;
      }
      // Fallback: el padre directo del header al menos está dentro de la zona de chat
      if (headerEl.parentElement && headerEl.parentElement !== document.body) {
        return headerEl.parentElement;
      }
    }

    // 3. Último recurso: roles ARIA genéricos
    return (
      document.querySelector<HTMLElement>('div[role="region"]') ||
      document.querySelector<HTMLElement>('[role="main"]') ||
      null
    );
  }

  /**
   * Inicia el MutationObserver secundario específico para monitorear mensajes entrantes
   * dentro de la zona activa del chat de forma ultra-reactiva.
   * Aplica: escaneo inicial, inspección directa de addedNodes, selectores amplios.
   */
  private startObservingMessages(mainEl: HTMLElement): void {
    this.stopObservingMessages();
    this.observedMainEl = mainEl;

    // Pre-cargar TODOS los mensajes existentes para no responder al historial
    const allExisting = mainEl.querySelectorAll('[data-id]');
    allExisting.forEach((msgEl) => {
      const msgId = msgEl.getAttribute('data-id');
      if (msgId) {
        this.processedMessageIds.add(msgId);
      }
    });

    console.info('[WA-CRM DOM_SERVICE] messageObserver iniciado. Mensajes precargados:', this.processedMessageIds.size);

    // ESCANEO INICIAL: procesar el ÚLTIMO mensaje entrante en caso de que
    // haya llegado justo antes de iniciar el observer (punto 1 del asesor)
    setTimeout(() => {
      this.scanLastIncomingMessage(mainEl);
    }, 300);

    // MutationObserver con inspección directa de addedNodes (punto 2 del asesor)
    this.messageObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Inspeccionar nodos agregados directamente
        if (mutation.addedNodes.length > 0) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            const el = node as HTMLElement;

            // Verificar si el nodo es o contiene un mensaje entrante
            if (this.isIncomingMessageNode(el)) {
              this.processMessageNode(el);
            }

            // Buscar mensajes entrantes dentro del nodo agregado
            const innerMsgs = el.querySelectorAll?.('.message-in, [data-id^="true_"], [data-id^="false_"]');
            if (innerMsgs) {
              innerMsgs.forEach((innerEl) => {
                if (this.isIncomingMessageNode(innerEl as HTMLElement)) {
                  this.processMessageNode(innerEl as HTMLElement);
                }
              });
            }
          }
        }

        // También capturar cambios de atributos (data-id inyectado tardíamente por React)
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
          const target = mutation.target;
          if (this.isIncomingMessageNode(target)) {
            this.processMessageNode(target);
          }
        }
      }

      // Fallback: re-escaneo completo por si los addedNodes no coincidieron
      this.scanMessagesForWorkflows(mainEl);
    });

    this.messageObserver.observe(mainEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-id', 'class'],
    });
  }

  /**
   * Determina si un nodo HTML es o contiene un mensaje entrante.
   * Usa selectores amplios para cubrir variantes de WhatsApp Web (punto 2 del asesor).
   */
  private isIncomingMessageNode(node: HTMLElement): boolean {
    if (!node) return false;
    return !!(
      node.classList?.contains('message-in') ||
      node.querySelector?.('.message-in') ||
      node.getAttribute?.('data-id')?.startsWith('true_') ||
      node.getAttribute?.('data-id')?.startsWith('false_') ||
      node.querySelector?.('[data-id^="true_"]') ||
      node.querySelector?.('[data-id^="false_"]')
    );
  }

  /**
   * Procesa un nodo de mensaje individual: extrae data-id, texto, y dispara el WorkflowEngine.
   */
  private processMessageNode(node: HTMLElement, source: string = 'DOM'): void {
    const activeJid = this.activeChatInfo.jid;
    if (!activeJid) return;

    // Obtener data-id directamente o del primer descendiente que lo tenga
    let msgId = node.getAttribute('data-id');
    if (!msgId) {
      const inner = node.querySelector('[data-id]');
      if (inner) msgId = inner.getAttribute('data-id');
    }
    
    if (!msgId) {
      // Demasiado ruidoso hacer log de esto
      return;
    }

    // Deduplicación (punto 3 del asesor)
    if (this.processedMessageIds.has(msgId)) {
      // Silencioso, es normal procesar el mismo nodo varias veces
      return;
    }

    // Determinar si es un mensaje entrante (no enviado por nosotros)
    const isFromContact = msgId.startsWith('true_') ||
      node.classList?.contains('message-in') ||
      !!node.closest?.('.message-in') ||
      !!node.querySelector?.('.message-in');

    if (!isFromContact) {
      this.processedMessageIds.add(msgId); // Lo guardamos para no volver a revisarlo
      return; 
    }

    console.info(`[WA-CRM DOM_SERVICE] [DEBUG] Intentando extraer texto de mensaje entrante (${source}). ID: ${msgId}`);

    const messageText = this.extractMessageText(node);
    if (!messageText) {
      console.warn(`[WA-CRM DOM_SERVICE] [DEBUG] Falla de extracción de texto para ID: ${msgId}. HTML del nodo:`, node.outerHTML.substring(0, 300));
      return;
    }

    this.processedMessageIds.add(msgId);
    if (this.processedMessageIds.size > 5000) this.processedMessageIds.clear();

    console.info('[WA-CRM DOM_SERVICE] 📩 Mensaje entrante detectado (DOM):', msgId, messageText);
    import('./services/workflow-engine').then(({ WorkflowEngine }) => {
      WorkflowEngine.getInstance().processIncomingMessage(activeJid, messageText);
    }).catch(err => console.error('[WA-CRM] Error cargando WorkflowEngine:', err));
  }

  /**
   * Escaneo inicial del ÚLTIMO mensaje entrante al abrir un chat.
   * Captura mensajes que llegaron justo antes de iniciar el observer (punto 1 del asesor).
   */
  private scanLastIncomingMessage(mainEl: HTMLElement): void {
    const activeJid = this.activeChatInfo.jid;
    if (!activeJid) return;

    // Buscar todos los mensajes entrantes visibles
    const incomingMsgs = mainEl.querySelectorAll('.message-in, [data-id^="true_"]');
    if (incomingMsgs.length === 0) return;

    // Tomar el ÚLTIMO mensaje
    const lastMsg = incomingMsgs[incomingMsgs.length - 1] as HTMLElement;
    this.processMessageNode(lastMsg);
  }

  /**
   * Desconecta el observador secundario de mensajería.
   */
  private stopObservingMessages(): void {
    if (this.messageObserver) {
      this.messageObserver.disconnect();
      this.messageObserver = null;
    }
    this.observedMainEl = null;
  }

  /**
   * Re-escaneo completo de mensajes dentro del contenedor (fallback).
   */
  private scanMessagesForWorkflows(mainEl: HTMLElement): void {
    const activeJid = this.activeChatInfo.jid;
    const isGroup = this.activeChatInfo.degradedReason === 'Los grupos no son contactos individuales de CRM.';
    
    if (activeJid && !isGroup) {
      // Selectores amplios: tanto clase .message-in como data-id con ambos prefijos
      const messages = mainEl.querySelectorAll('.message-in, [data-id^="true_"], [data-id^="false_"], div[role="row"]');
      for (let i = 0; i < messages.length; i++) {
        const htmlEl = messages[i] as HTMLElement;
        this.processMessageNode(htmlEl);
      }
    }
  }

  /**
   * Extrae el texto del mensaje de forma multi-estrategia defensiva.
   */
  private extractMessageText(messageEl: HTMLElement): string | null {
    // Estrategia 1: Selectores clásicos
    const selectable = messageEl.querySelector('.selectable-text span');
    if (selectable && selectable.textContent?.trim()) {
      return selectable.textContent.trim();
    }

    // Estrategia 2: Selector alternativo copyable-text
    const copyable = messageEl.querySelector('.copyable-text span');
    if (copyable && copyable.textContent?.trim()) {
      return copyable.textContent.trim();
    }

    // Estrategia 3: Contenedor directo seleccionable
    const textDiv = messageEl.querySelector('.selectable-text');
    if (textDiv && textDiv.textContent?.trim()) {
      return textDiv.textContent.trim();
    }

    // Estrategia 4: Cualquier span con texto directo dentro del mensaje
    const spans = messageEl.querySelectorAll('span[dir="ltr"], span[dir="auto"]');
    for (const span of Array.from(spans)) {
      const text = span.textContent?.trim();
      if (text && text.length > 0 && text.length < 500) {
        return text;
      }
    }

    return null;
  }

  public stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isObserving = false;
  }

  public subscribe(listener: ChatChangeListener): () => void {
    this.listeners.add(listener);
    // Invocación inmediata con el estado actual
    listener(this.activeChatInfo);
    return () => this.listeners.delete(listener);
  }

  public getActiveChatInfo(): ActiveChatInfo {
    return this.activeChatInfo;
  }

  // Helpers para testing y simulación (DoD Checkpoint 4/6)
  public simulateBrokenSelector(brokenKey: string): void {
    if (this.selectors[brokenKey]) {
      this.selectors[brokenKey] = {
        selector: '#invalid-broken-selector-nonexistent',
        fallback: '#another-invalid-broken-fallback',
      };
      console.warn('[WA-CRM DOM_SERVICE][TEST] Selector %s forzado a roto.', brokenKey);
      this.evaluateDom();
    }
  }

  public resetSelectors(): void {
    this.selectors = { ...DEFAULT_WHATSAPP_SELECTORS };
    console.info('[WA-CRM DOM_SERVICE][TEST] Selectores reseteados a constantes locales.');
    this.evaluateDom();
  }

  public simulateNoActiveChat(): void {
    console.info('[WA-CRM DOM_SERVICE][TEST] Simulando estado sin chat activo.');
    this.updateState({
      jid: null,
      phoneNumber: null,
      name: null,
      avatarUrl: null,
      status: 'NO_ACTIVE_CHAT',
      source: this.selectorSource,
    });
  }

  private injectMainWorldBridge(): void {
    if (typeof window === 'undefined') return;

    try {
      window.addEventListener('message', (event) => {
        if (!event.data) return;

        // Datos del chat activo (JID/teléfono)
        if (event.data.type === 'WACRM_MAIN_BRIDGE_DATA') {
          this.handleMainBridgeData(event.data.payload);
        }

        // Mensaje entrante detectado vía Store.Msg nativo (método v7 Pro)
        if (event.data.type === 'WACRM_INCOMING_MESSAGE') {
          this.handleNativeIncomingMessage(event.data.payload);
        }
      });
    } catch (e) {
      console.warn('[WA-CRM DOM_SERVICE] Error registrando listener de Main Bridge:', e);
    }
  }

  /**
   * Procesa un mensaje entrante detectado nativamente por el Main World Bridge
   * vía Store.Msg (sin depender del DOM ni de MutationObserver).
   */
  private handleNativeIncomingMessage(payload: {
    msgId: string;
    text: string;
    senderJid: string;
    phoneNumber: string | null;
    timestamp: number;
  }): void {
    if (!payload || !payload.text || !payload.senderJid) return;

    // Deduplicar mensajes ya procesados
    if (this.processedMessageIds.has(payload.msgId)) return;
    this.processedMessageIds.add(payload.msgId);
    if (this.processedMessageIds.size > 5000) this.processedMessageIds.clear();

    // Ignorar grupos
    if (payload.senderJid.endsWith('@g.us')) return;

    console.info('[WA-CRM DOM_SERVICE] 📩 Mensaje entrante (vía Store nativo):', payload.msgId, payload.text);

    // Disparar WorkflowEngine con el texto del mensaje
    import('./services/workflow-engine').then(({ WorkflowEngine }) => {
      WorkflowEngine.getInstance().processIncomingMessage(payload.senderJid, payload.text);
    }).catch(err => console.error('[WA-CRM] Error cargando WorkflowEngine:', err));
  }

  private handleMainBridgeData(data: { phone?: string; jid?: string; isGroup?: boolean }): void {
    if (!data) return;
    const phone = data.phone || null;
    const jid = data.jid || null;
    const isGroup = !!data.isGroup;

    if (
      !this.lastBridgeData ||
      this.lastBridgeData.phone !== phone ||
      this.lastBridgeData.jid !== jid ||
      this.lastBridgeData.isGroup !== isGroup
    ) {
      this.lastBridgeData = { phone, jid, isGroup };
      this.evaluateDom();
    }
  }

  private evaluateDom(): void {
    try {
      // 1. Buscar header del chat activo
      const chatContainer = this.findChatContainer();
      const headerEl = this.queryElement('chat_header') || chatContainer?.querySelector<HTMLElement>('header') || document.querySelector<HTMLElement>('#main header');

      if (!headerEl) {
        this.retryCount = 0;
        this.lastBridgeData = null;
        this.updateState({
          jid: null,
          phoneNumber: null,
          name: null,
          avatarUrl: null,
          status: 'NO_ACTIVE_CHAT',
          source: this.selectorSource,
        });
        return;
      }

      // 2. Extraer Nombre del Contacto
      const titleEl = this.queryElement('chat_title') || headerEl.querySelector<HTMLElement>('div[role="button"] span[title], span[dir="auto"]');
      let contactName: string | null = null;

      if (titleEl) {
        contactName = titleEl.getAttribute('title') || titleEl.textContent?.trim() || null;
      }

      if (!contactName) {
        const fallbackTitle = headerEl.querySelector('[title]');
        if (fallbackTitle) {
          contactName = fallbackTitle.getAttribute('title') || fallbackTitle.textContent?.trim() || null;
        }
      }

      // 3. Extraer Avatar
      const avatarEl = (this.queryElement('chat_avatar') || headerEl.querySelector('img')) as HTMLImageElement | null;
      let avatarUrl: string | null = null;
      if (avatarEl && avatarEl.src) {
        avatarUrl = avatarEl.src;
      }

      // 4. Extraer JID y Número de Teléfono mediante Multi-Estrategia Defensiva
      const { phone: parsedPhone, jid: parsedJid, isGroup } = this.extractPhoneAndJid(headerEl, contactName);

      console.info('[WA-CRM DEBUG]', {
        contactName,
        lastBridgeData: this.lastBridgeData,
        parsedPhone,
        parsedJid,
        isGroup
      });

      // Si es un chat de GRUPO, no intentamos sincronizar un contacto individual en el CRM
      if (isGroup) {
        this.retryCount = 0;
        this.updateState({
          jid: null,
          phoneNumber: null,
          name: contactName || 'Grupo de WhatsApp',
          avatarUrl,
          status: 'NO_ACTIVE_CHAT',
          degradedReason: 'Los grupos no son contactos individuales de CRM.',
          source: this.selectorSource,
        });
        return;
      }

      // 5. Si hay chat pero no se detectó el teléfono/JID: controlar retries y DEGRADAR obligatoriamente
      if (!parsedPhone && !parsedJid) {
        if (this.retryCount < 2 && contactName) {
          this.retryCount++;
          if (this.retryTimer) clearTimeout(this.retryTimer);
          this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.evaluateDom();
          }, 250);
          return; // Retornar de inmediato para NO emitir status: ACTIVE con teléfono nulo
        }

        // Se agotaron los retries: DEGRADACIÓN GARANTIZADA OBLIGATORIA
        console.warn(
          '[WA-CRM DOM_SERVICE][DEGRADED] Reintentos agotados. Degradando estado para:',
          contactName
        );
        this.retryCount = 0;
        this.updateState({
          jid: null,
          phoneNumber: null,
          name: contactName || 'Contacto WhatsApp',
          avatarUrl,
          status: 'SELECTOR_DEGRADED',
          degradedReason: `No se pudo detectar el número de teléfono del contacto ${contactName ? `"${contactName}"` : ''}.`,
          source: 'DEGRADED',
        });
        return;
      }

      // Resetear contador de retries si hubo éxito
      this.retryCount = 0;

      // 6. Emitir estado activo completo SOLO con teléfono o JID válido
      this.updateState({
        jid: parsedJid,
        phoneNumber: parsedPhone,
        name: contactName || parsedPhone || 'Contacto WhatsApp',
        avatarUrl,
        status: 'ACTIVE',
        source: this.selectorSource,
      });

    } catch (err) {
      console.error('[WA-CRM DOM_SERVICE] Error defensivo no capturado en evaluateDom:', err);
      this.retryCount = 0;
      this.updateState({
        jid: null,
        phoneNumber: null,
        name: null,
        avatarUrl: null,
        status: 'SELECTOR_DEGRADED',
        degradedReason: err instanceof Error ? err.message : 'Error desconocido de evaluación DOM',
        source: 'DEGRADED',
      });
    }
  }

  /** Escanea el árbol de Fiber/Props de React atado a nodos DOM clave (#main, header, item activo) */
  private extractJidFromReactFiber(nodes: (Element | null)[]): { phone: string | null; jid: string | null; isGroup: boolean } {
    for (const node of nodes) {
      if (!node) continue;
      const reactKey = Object.keys(node).find(
        (key) => key.startsWith('__reactProps$') || key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
      );
      if (!reactKey) continue;

      const rootObj = (node as any)[reactKey];
      const visited = new WeakSet<object>();

      const found = this.searchReactTree(rootObj, 0, visited);
      if (found && (found.isGroup || found.phone)) return found;
    }
    return { phone: null, jid: null, isGroup: false };
  }

  private searchReactTree(obj: any, depth: number, visited: WeakSet<object>): { phone: string | null; jid: string | null; isGroup: boolean } | null {
    if (!obj || depth > 5 || typeof obj !== 'object' || visited.has(obj)) return null;
    visited.add(obj);

    const GROUP_JID_REGEX = /^(\d{10,18}|\d{7,15}-\d{10})@g\.us$/;
    const USER_JID_REGEX = /^(\d{7,15})@(c\.us|s\.whatsapp\.net)$/;
    const EXCLUDED_KEYS = ['chats', 'contacts', 'messages', 'collection', 'models', '_models', 'store', 'allChats', 'allContacts'];

    // 1. Intentar extracción dirigida prioritaria
    let jidStr: string | null = null;
    if (obj.chat && obj.chat.id) {
      jidStr = typeof obj.chat.id === 'string' ? obj.chat.id : (obj.chat.id._serialized || null);
    } else if (obj.contact && obj.contact.id) {
      jidStr = typeof obj.contact.id === 'string' ? obj.contact.id : (obj.contact.id._serialized || null);
    }

    if (jidStr) {
      if (GROUP_JID_REGEX.test(jidStr)) return { phone: null, jid: null, isGroup: true };
      const m = jidStr.match(USER_JID_REGEX);
      if (m && m[1]) return { phone: `+${m[1]}`, jid: `${m[1]}@c.us`, isGroup: false };
    }

    // Fallback a propiedades directas del objeto actual
    if (typeof obj.id === 'string') {
      if (GROUP_JID_REGEX.test(obj.id)) return { phone: null, jid: null, isGroup: true };
      const m = obj.id.match(USER_JID_REGEX);
      if (m && m[1]) return { phone: `+${m[1]}`, jid: `${m[1]}@c.us`, isGroup: false };
    }

    if (obj.id && typeof obj.id._serialized === 'string') {
      const ser = obj.id._serialized;
      if (GROUP_JID_REGEX.test(ser)) return { phone: null, jid: null, isGroup: true };
      const m = ser.match(USER_JID_REGEX);
      if (m && m[1]) return { phone: `+${m[1]}`, jid: `${m[1]}@c.us`, isGroup: false };
    }

    if (typeof obj.jid === 'string') {
      if (GROUP_JID_REGEX.test(obj.jid)) return { phone: null, jid: null, isGroup: true };
      const m = obj.jid.match(USER_JID_REGEX);
      if (m && m[1]) return { phone: `+${m[1]}`, jid: `${m[1]}@c.us`, isGroup: false };
    }

    if (typeof obj.user === 'string' && /^\d{7,15}$/.test(obj.user)) {
      return { phone: `+${obj.user}`, jid: `${obj.user}@c.us`, isGroup: false };
    }

    // 2. Iterar propiedades
    for (const key of Object.keys(obj)) {
      if (key === 'stateNode' && obj[key] instanceof Element) continue;
      if (EXCLUDED_KEYS.includes(key)) continue;
      const val = obj[key];
      if (typeof val === 'string') {
        if (GROUP_JID_REGEX.test(val)) return { phone: null, jid: null, isGroup: true };
        const m = val.match(USER_JID_REGEX);
        if (m && m[1]) return { phone: `+${m[1]}`, jid: `${m[1]}@c.us`, isGroup: false };
      } else if (typeof val === 'object' && val !== null) {
        const res = this.searchReactTree(val, depth + 1, visited);
        if (res) return res;
      }
    }

    return null;
  }

  private extractPhoneAndJid(
    headerEl: HTMLElement,
    contactName: string | null
  ): { phone: string | null; jid: string | null; isGroup: boolean } {
    const GROUP_JID_REGEX = /^(\d{10,18}|\d{7,15}-\d{10})@g\.us$/;
    const USER_JID_REGEX = /^(\d{7,15})@(c\.us|s\.whatsapp\.net)$/;

    // -------------------------------------------------------------
    // ESTRATEGIA -1: Usar datos capturados en el Main World Bridge
    // -------------------------------------------------------------
    if (this.lastBridgeData) {
      if (this.lastBridgeData.isGroup) return { phone: null, jid: null, isGroup: true };
      if (this.lastBridgeData.phone || this.lastBridgeData.jid) {
        return {
          phone: this.lastBridgeData.phone,
          jid: this.lastBridgeData.jid,
          isGroup: false,
        };
      }
    }

    // -------------------------------------------------------------
    // ESTRATEGIA 0: Inspeccionar Árbol de Props/Fiber de React en Nodos Clave
    // -------------------------------------------------------------
    const activeSidebarEl = document.querySelector('#pane-side [aria-selected="true"], [data-testid="cell-frame-container"][aria-selected="true"]');
    const mainEl = this.findChatContainer();

    const fiberResult = this.extractJidFromReactFiber([
      headerEl,
      activeSidebarEl,
      headerEl.querySelector('div[role="button"]'),
    ]);

    if (fiberResult.isGroup || fiberResult.phone) {
      return fiberResult;
    }

    // -------------------------------------------------------------
    // ESTRATEGIA 1: Parsear data-id de los elementos de mensaje en #main
    // -------------------------------------------------------------
    const chatContainer = this.findChatContainer();
    const messageEls = chatContainer ? chatContainer.querySelectorAll('[data-id]') : document.querySelectorAll('#main [data-id]');
    for (const msgEl of Array.from(messageEls)) {
      const dataId = msgEl.getAttribute('data-id');
      if (dataId) {
        const parts = dataId.split('_');
        if (parts.length >= 2) {
          const rawTarget = parts[1];
          if (rawTarget) {
            if (GROUP_JID_REGEX.test(rawTarget)) {
              return { phone: null, jid: null, isGroup: true };
            }
            const cleanNum = rawTarget.split('@')[0];
            if (/^\d{7,15}$/.test(cleanNum)) {
              return { phone: `+${cleanNum}`, jid: `${cleanNum}@c.us`, isGroup: false };
            }
          }
        }
      }
    }

    // -------------------------------------------------------------
    // ESTRATEGIA 2: Buscar en el ítem del Sidebar activo (#pane-side)
    // -------------------------------------------------------------
    if (contactName) {
      const sideItems = document.querySelectorAll('#pane-side [role="listitem"], #pane-side [data-testid="cell-frame-container"], [aria-selected="true"]');
      for (const item of Array.from(sideItems)) {
        const textContent = item.textContent || '';
        const isSelectedOrMatch = item.getAttribute('aria-selected') === 'true' || textContent.includes(contactName);
        if (isSelectedOrMatch) {
          const html = item.outerHTML;
          const groupMatch = html.match(/data-id="[^"]*?(\d{10,18}@g\.us)/) || html.match(/(\d{10,18}@g\.us)/);
          if (groupMatch) {
            return { phone: null, jid: null, isGroup: true };
          }
          // Buscar JID explícito
          const jidMatch = html.match(/(\d{7,15})@(c\.us|s\.whatsapp\.net)/) || html.match(/data-id="[^"]*?(\d{7,15})/);
          if (jidMatch && jidMatch[1] && /^\d{7,15}$/.test(jidMatch[1])) {
            const rawNum = jidMatch[1];
            return { phone: `+${rawNum}`, jid: `${rawNum}@c.us`, isGroup: false };
          }
          // Buscar teléfono formateado en el texto del ítem
          const phoneInItem = textContent.match(/\+?\d{1,4}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
          if (phoneInItem) {
            const cleaned = phoneInItem[0].replace(/[^\d+]/g, '');
            if (cleaned.length >= 7) {
              const rawNum = cleaned.replace('+', '');
              return { phone: `+${rawNum}`, jid: `${rawNum}@c.us`, isGroup: false };
            }
          }
        }
      }
    }

    // -------------------------------------------------------------
    // ESTRATEGIA 3: Escanear outerHTML de #main header
    // -------------------------------------------------------------
    const headerHtml = headerEl.outerHTML;
    const headerJidMatch = headerHtml.match(/(\d{7,15})@(c\.us|s\.whatsapp\.net)/) || headerHtml.match(/data-id="[^"]*?(\d{7,15})/);
    if (headerJidMatch && headerJidMatch[1]) {
      const rawNum = headerJidMatch[1];
      return { phone: `+${rawNum}`, jid: `${rawNum}@c.us`, isGroup: false };
    }

    // -------------------------------------------------------------
    // ESTRATEGIA 4: Si 'contactName' en la cabecera es un número de teléfono (ej. "+591 78756107")
    // -------------------------------------------------------------
    if (contactName) {
      const cleanedName = contactName.replace(/[^\d+]/g, '');
      if (cleanedName.length >= 7 && (contactName.startsWith('+') || /^\d{7,15}$/.test(cleanedName))) {
        const rawNum = cleanedName.replace('+', '');
        return { phone: `+${rawNum}`, jid: `${rawNum}@c.us`, isGroup: false };
      }
    }

    // -------------------------------------------------------------
    // ESTRATEGIA 5: Escanear texto del drawer de info o subtítulo del header
    // -------------------------------------------------------------
    const drawerEl = document.querySelector('div[data-testid="contact-info-drawer"], div[role="region"] header + div');
    const scannedText = (drawerEl?.textContent || '') + ' ' + (headerEl.textContent || '');
    const phoneMatch = scannedText.match(/\+\d{1,4}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
    if (phoneMatch) {
      const cleaned = phoneMatch[0].replace(/[^\d+]/g, '');
      if (cleaned.length >= 7) {
        const rawNum = cleaned.replace('+', '');
        return { phone: `+${rawNum}`, jid: `${rawNum}@c.us`, isGroup: false };
      }
    }

    return { phone: null, jid: null, isGroup: false };
  }

  /** Consulta defensiva con fallback */
  private queryElement(selectorKey: string): HTMLElement | null {
    const config = this.selectors[selectorKey];
    if (!config) return null;

    // Intentar selector primario
    try {
      if (config.selector) {
        const el = document.querySelector<HTMLElement>(config.selector);
        if (el) return el;
      }
    } catch (e) {
      console.warn('[WA-CRM DOM_SERVICE] Selector primario inválido para %s:', selectorKey, config.selector);
    }

    // Intentar selector secundario (fallback)
    try {
      if (config.fallback) {
        const fallbackEl = document.querySelector<HTMLElement>(config.fallback);
        if (fallbackEl) return fallbackEl;
      }
    } catch (e) {
      console.warn('[WA-CRM DOM_SERVICE] Selector fallback inválido para %s:', selectorKey, config.fallback);
    }

    return null;
  }

  private updateState(newState: ActiveChatInfo): void {
    const previousJid = this.activeChatInfo.jid;

    // Al conmutar o activarse el chat, controlar el observador secundario de mensajería (Sprint v8.3.0)
    // Se ejecuta antes del early-return para reaccionar si #main se inyecta tardíamente en el DOM
    if (newState.status === 'ACTIVE' && newState.jid) {
      const mainEl = this.findChatContainer();
      console.info('[WA-CRM DOM_SERVICE] findChatContainer() →', mainEl ? `<${mainEl.tagName} id="${mainEl.id}" class="${mainEl.className?.substring?.(0,50) ?? ''}">` : 'NULL');
      if (mainEl) {
        if (newState.jid !== previousJid || !this.messageObserver || mainEl !== this.observedMainEl) {
          this.processedMessageIds.clear();
          this.startObservingMessages(mainEl);
        }
      } else {
        console.warn('[WA-CRM DOM_SERVICE] ⚠️ No se encontró contenedor de chat. El messageObserver NO se iniciará.');
        this.stopObservingMessages();
      }
    } else {
      this.stopObservingMessages();
    }

    // Evitar emisiones idénticas repetidas para los escuchas
    if (
      this.activeChatInfo.jid === newState.jid &&
      this.activeChatInfo.phoneNumber === newState.phoneNumber &&
      this.activeChatInfo.name === newState.name &&
      this.activeChatInfo.avatarUrl === newState.avatarUrl &&
      this.activeChatInfo.status === newState.status
    ) {
      return;
    }

    this.activeChatInfo = newState;

    console.info(
      '[WA-CRM DOM_SERVICE] Chat Activo actualizador: status=%s, nombre="%s", jid=%s (fuente=%s)',
      newState.status,
      newState.name ?? 'N/A',
      newState.jid ?? 'N/A',
      newState.source
    );

    // Emisión de evento global en window
    window.dispatchEvent(
      new CustomEvent('wa-crm:active-chat-changed', {
        detail: newState,
      })
    );

    // Notificar suscriptores
    for (const listener of this.listeners) {
      try {
        listener(newState);
      } catch (err) {
        console.error('[WA-CRM DOM_SERVICE] Error en subscriber listener:', err);
      }
    }
  }

  /**
   * Envía un comando a través de postMessage al contexto principal (Main World Bridge)
   * para inyectar texto en la caja de entrada activa de WhatsApp Web.
   */
  public insertTextIntoChatInput(text: string): void {
    window.postMessage({ type: 'WACRM_INSERT_TEXT', payload: { text } }, '*');
  }

  /**
   * Envía un comando a través de postMessage al contexto principal (Main World Bridge)
   * para inyectar texto y presionar automáticamente el botón de envío en WhatsApp Web.
   */
  public sendMessageAutomatically(text: string): void {
    window.postMessage({ type: 'WACRM_SEND_MESSAGE', payload: { text } }, '*');
  }
}
