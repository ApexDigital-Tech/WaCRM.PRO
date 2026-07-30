// ============================================================
// WA-CRM — Main World Bridge Script (MV3 Native Main World)
// Corre en el contexto nativo JS (world: MAIN) de WhatsApp Web.
// Extrae el JID/Teléfono desde React Fiber y window.Store sin violar CSP.
// Detecta mensajes entrantes vía Store.Msg (método nativo, mismo que v7 Pro).
// ============================================================

(function () {
  if ((window as any).__WACRM_BRIDGE_ACTIVE__) return;
  (window as any).__WACRM_BRIDGE_ACTIVE__ = true;

  const EXCLUDED_KEYS = ['chats', 'contacts', 'messages', 'collection', 'models', '_models', 'store', 'allChats', 'allContacts'];

  // ────────────────────────────────────────────────────────────
  // DETECCIÓN NATIVA DE MENSAJES VÍA STORE (MÉTODO v7 Pro)
  // ────────────────────────────────────────────────────────────
  let msgHookInstalled = false;
  const processedBridgeMsgs = new Set<string>();

  function tryHookMessageStore(): void {
    if (msgHookInstalled) return;

    const store = (window as any).Store;
    if (!store) {
      if (!(window as any).__WACRM_STORE_LOGGED) {
        console.warn('[WA-CRM BRIDGE] window.Store no está disponible. Intentando módulos Webpack...');
        (window as any).__WACRM_STORE_LOGGED = true;
      }
    } else {
      // Estrategia 1: Store.Msg.on('add') — colección de mensajes
      if (store.Msg && typeof store.Msg.on === 'function') {
        store.Msg.on('add', handleNewMessage);
        msgHookInstalled = true;
        console.info('[WA-CRM BRIDGE] ✅ Hook instalado: Store.Msg.on("add")');
        return;
      }

      // Estrategia 2: Store.Chat — escuchar cambios en el último mensaje recibido
      if (store.Chat && typeof store.Chat.on === 'function') {
        store.Chat.on('change:lastReceivedKey', handleChatChange);
        msgHookInstalled = true;
        console.info('[WA-CRM BRIDGE] ✅ Hook instalado: Store.Chat.on("change:lastReceivedKey")');
        return;
      }
      
      console.warn('[WA-CRM BRIDGE] window.Store existe, pero no tiene Msg.on ni Chat.on');
    }

    // Estrategia 3: Buscar módulos internos de WhatsApp Web (webpack)
    const webpackModules = (window as any).require || (window as any).__d;
    if (webpackModules) {
      try {
        // Intentar encontrar el dispatcher de mensajes
        const msgModule = findWebpackModule((m: any) =>
          m && m.default && typeof m.default.on === 'function' && m.default.models && m.default.models[0]?.id
        );
        if (msgModule && msgModule.default) {
          msgModule.default.on('add', handleNewMessage);
          msgHookInstalled = true;
          console.info('[WA-CRM BRIDGE] ✅ Hook instalado: webpack module on("add")');
          return;
        }
      } catch (e) {}
    }
  }

  function findWebpackModule(predicate: (m: any) => boolean): any {
    try {
      const modules = (window as any).__webpack_require__?.c || (window as any).webpackChunkwhatsapp_web_client;
      if (!modules) return null;
      
      if (Array.isArray(modules)) {
        // webpack chunk format
        for (const chunk of modules) {
          if (chunk && chunk[1]) {
            for (const key of Object.keys(chunk[1])) {
              try {
                const mod = { exports: {} };
                chunk[1][key](mod, mod.exports, (window as any).__webpack_require__ || (() => {}));
                if (predicate(mod.exports)) return mod.exports;
              } catch (e) {}
            }
          }
        }
      } else {
        // module cache format
        for (const key of Object.keys(modules)) {
          try {
            if (predicate(modules[key]?.exports)) return modules[key].exports;
          } catch (e) {}
        }
      }
    } catch (e) {}
    return null;
  }

  function handleNewMessage(msg: any): void {
    try {
      if (!msg) return;

      // Solo mensajes entrantes (no enviados por nosotros)
      const isFromMe = msg.id?.fromMe ?? msg.fromMe ?? false;
      if (isFromMe) return;

      // Extraer ID del mensaje para deduplicación
      const msgId = msg.id?._serialized || msg.id?.id || String(msg.t || Date.now());
      if (processedBridgeMsgs.has(msgId)) return;
      processedBridgeMsgs.add(msgId);

      // Limpiar set periódicamente
      if (processedBridgeMsgs.size > 5000) processedBridgeMsgs.clear();

      // Extraer texto del mensaje
      const text = msg.body || msg.text || msg.caption || '';
      if (!text || typeof text !== 'string') return;

      // Extraer JID del remitente
      const from = msg.from || msg.chatId || (msg.id?.remote ? (typeof msg.id.remote === 'string' ? msg.id.remote : msg.id.remote._serialized) : null);
      if (!from) return;

      // Ignorar grupos
      if (typeof from === 'string' && from.endsWith('@g.us')) return;

      // Extraer número limpio
      let senderJid = typeof from === 'string' ? from : null;
      if (!senderJid) return;

      // Normalizar JID
      const numMatch = senderJid.match(/^(\d{7,15})@/);
      const phoneNumber = numMatch ? '+' + numMatch[1] : null;

      console.info('[WA-CRM BRIDGE] 📩 Mensaje entrante detectado vía Store:', {
        msgId,
        text: text.substring(0, 50),
        from: senderJid,
        phone: phoneNumber,
      });

      // Enviar al content script
      window.postMessage({
        type: 'WACRM_INCOMING_MESSAGE',
        payload: {
          msgId,
          text: text.trim(),
          senderJid,
          phoneNumber,
          timestamp: msg.t || Math.floor(Date.now() / 1000),
        },
      }, '*');
    } catch (err) {
      // Silenciar errores para no romper WhatsApp Web
    }
  }

  function handleChatChange(chat: any): void {
    try {
      if (!chat || !chat.lastReceivedKey) return;
      const msgId = chat.lastReceivedKey._serialized || chat.lastReceivedKey.id;
      if (!msgId || processedBridgeMsgs.has(msgId)) return;

      // Buscar el mensaje real en la colección
      const store = (window as any).Store;
      if (store && store.Msg) {
        const msg = store.Msg.get(chat.lastReceivedKey) || store.Msg.get(msgId);
        if (msg) {
          handleNewMessage(msg);
          return;
        }
      }

      // Si no podemos obtener el mensaje completo, al menos notificar
      const chatId = chat.id ? (typeof chat.id === 'string' ? chat.id : chat.id._serialized) : null;
      if (chatId && !chatId.endsWith('@g.us')) {
        processedBridgeMsgs.add(msgId);
        window.postMessage({
          type: 'WACRM_INCOMING_MESSAGE',
          payload: {
            msgId,
            text: chat.lastReceivedMsg?.body || '',
            senderJid: chatId,
            phoneNumber: null,
            timestamp: Math.floor(Date.now() / 1000),
          },
        }, '*');
      }
    } catch (err) {}
  }

  // ────────────────────────────────────────────────────────────
  // ESCANEO DE JID ACTIVO (código existente)
  // ────────────────────────────────────────────────────────────

  function searchProps(obj: any, depth: number, visited: WeakSet<object>): any {
    if (!obj || depth > 5 || typeof obj !== 'object' || visited.has(obj)) return null;
    visited.add(obj);

    if (typeof Element !== 'undefined' && (obj instanceof Element || obj instanceof Node)) return null;

    // 1. Intentar extracción dirigida prioritaria
    let jidStr: string | null = null;
    if (obj.chat && obj.chat.id) {
      jidStr = typeof obj.chat.id === 'string' ? obj.chat.id : (obj.chat.id._serialized || null);
    } else if (obj.contact && obj.contact.id) {
      jidStr = typeof obj.contact.id === 'string' ? obj.contact.id : (obj.contact.id._serialized || null);
    }

    // Fallback a propiedades directas del objeto actual
    if (!jidStr) {
      if (typeof obj.id === 'string') jidStr = obj.id;
      else if (obj.id && typeof obj.id._serialized === 'string') jidStr = obj.id._serialized;
      else if (typeof obj.jid === 'string') jidStr = obj.jid;
      else if (typeof obj.user === 'string' && /^\d{7,15}$/.test(obj.user)) jidStr = obj.user + '@c.us';
    }

    if (jidStr) {
      if (jidStr.endsWith('@g.us')) return { isGroup: true };
      const m = jidStr.match(/^(\d{7,15})@(c\.us|s\.whatsapp\.net)$/);
      if (m && m[1]) return { phone: '+' + m[1], jid: m[1] + '@c.us', isGroup: false };
    }

    // 2. Iterar recursivamente ignorando colecciones ruidosas
    for (const key in obj) {
      if (key === 'return' || key === 'alternate' || key === 'stateNode' || key === 'elementType') continue;
      if (EXCLUDED_KEYS.includes(key)) continue;
      try {
        const val = obj[key];
        if (val && typeof val === 'object') {
          const res = searchProps(val, depth + 1, visited);
          if (res) return res;
        }
      } catch (e) {}
    }
    return null;
  }

  function scan() {
    // Intentar instalar hook de mensajes en cada escaneo hasta lograrlo
    tryHookMessageStore();

    try {
      // 1. WhatsApp Web Store (si está disponible)
      const store = (window as any).Store;
      if (store && store.Chat && store.Chat.active) {
        const active = store.Chat.active;
        const idStr = active.id ? (typeof active.id === 'string' ? active.id : active.id._serialized) : null;
        if (idStr) {
          if (idStr.endsWith('@g.us')) {
            window.postMessage({ type: 'WACRM_MAIN_BRIDGE_DATA', payload: { isGroup: true } }, '*');
            return;
          }
          const m = idStr.match(/^(\d{7,15})@(c\.us|s\.whatsapp\.net)$/);
          if (m && m[1]) {
            window.postMessage({ type: 'WACRM_MAIN_BRIDGE_DATA', payload: { phone: '+' + m[1], jid: m[1] + '@c.us', isGroup: false } }, '*');
            return;
          }
        }
      }

      // 2. React Fiber Inspection en header y sidebar activo
      const headerEl = document.querySelector('#main header') || document.querySelector('div[role="region"] header') || document.querySelector('[role="main"] header');
      const sideEl = document.querySelector('#pane-side [aria-selected="true"], [data-testid="cell-frame-container"][aria-selected="true"]');
      const nodes = [sideEl, headerEl];

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node) continue;
        const keys = Object.keys(node);
        for (let j = 0; j < keys.length; j++) {
          const key = keys[j];
          if (key.startsWith('__reactProps$') || key.startsWith('__reactFiber$')) {
            const res = searchProps((node as any)[key], 0, new WeakSet());
            if (res) {
              window.postMessage({ type: 'WACRM_MAIN_BRIDGE_DATA', payload: res }, '*');
              return;
            }
          }
        }
      }

      // 3. Escaneo de data-id del chat
      const mainEl = document.querySelector('#main') || document.querySelector('div[role="region"]') || document.querySelector('[role="main"]');
      if (mainEl) {
        const msgEls = mainEl.querySelectorAll('[data-id]');
        for (let i = 0; i < msgEls.length; i++) {
          const dataId = msgEls[i].getAttribute('data-id');
          if (dataId) {
            const parts = dataId.split('_');
            if (parts.length >= 2) {
              const rawTarget = parts[1];
              if (rawTarget.endsWith('@g.us')) {
                window.postMessage({ type: 'WACRM_MAIN_BRIDGE_DATA', payload: { isGroup: true } }, '*');
                return;
              }
              const cleanNum = rawTarget.split('@')[0];
              if (/^\d{7,15}$/.test(cleanNum)) {
                window.postMessage({ type: 'WACRM_MAIN_BRIDGE_DATA', payload: { phone: '+' + cleanNum, jid: cleanNum + '@c.us', isGroup: false } }, '*');
                return;
              }
            }
          }
        }
      }
    } catch (e) {}
  }

  // ────────────────────────────────────────────────────────────
  // INSERCIÓN Y ENVÍO DE TEXTO (código existente mejorado)
  // ────────────────────────────────────────────────────────────

  window.addEventListener('message', (event) => {
    if (!event.data) return;
    const type = event.data.type;
    const text = event.data.payload?.text;
    if (typeof text !== 'string') return;

    if (type === 'WACRM_INSERT_TEXT' || type === 'WACRM_SEND_MESSAGE') {
      try {
        const inputEl = document.querySelector('#main footer [contenteditable="true"]') || document.querySelector('footer [contenteditable="true"]') || document.querySelector('[contenteditable="true"][data-tab]');
        if (inputEl) {
          (inputEl as HTMLElement).focus();
          document.execCommand('insertText', false, text);
          const ev = new Event('input', { bubbles: true });
          inputEl.dispatchEvent(ev);

          // Si es de tipo envío automático, presionar botón de enviar nativo de WhatsApp Web
          if (type === 'WACRM_SEND_MESSAGE') {
            setTimeout(() => {
              const sendBtn = 
                document.querySelector('button[data-testid="send"]') ||
                document.querySelector('[data-testid="send"]') ||
                document.querySelector('footer button span[data-icon="send"]')?.closest('button') ||
                document.querySelector('span[data-icon="send"]')?.closest('button');
              if (sendBtn) {
                (sendBtn as HTMLElement).click();
                console.info('[WA-CRM BRIDGE] ✅ Mensaje enviado automáticamente.');
              } else {
                console.warn('[WA-CRM BRIDGE] ⚠️ Botón de enviar no encontrado.');
              }
            }, 100);
          }
        } else {
          console.warn('[WA-CRM BRIDGE] ⚠️ Campo de entrada no encontrado.');
        }
      } catch (err) {
        console.error('[WA-CRM BRIDGE] Error inserting/sending text:', err);
      }
    }
  });

  setInterval(scan, 250);
  scan();
})();
