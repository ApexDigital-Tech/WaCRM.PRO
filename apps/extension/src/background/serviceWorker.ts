// ============================================================
// Service Worker — Broker de Sesión (ADR-04, ADR-06)
// Único custodio de chrome.storage.session
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { SwMessage, SwResponse } from '@wa-crm/types';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

const supabase = createClient(__SUPABASE_URL__, __SUPABASE_ANON_KEY__);

// ────────────────────────────────────────────────────────────
// MANEJADOR DE MENSAJES — Interface pública del broker
// ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (msg: SwMessage, _sender, sendResponse: (r: SwResponse) => void) => {
    switch (msg.action) {
      case 'GET_ACCESS_TOKEN':
        handleGetAccessToken(sendResponse);
        return true; // Respuesta asíncrona

      case 'SET_SESSION':
        handleSetSession(msg.payload as { access_token: string; refresh_token: string }, sendResponse);
        return true;

      case 'SIGN_OUT':
        handleSignOut(sendResponse);
        return true;

      case 'GET_WORKSPACE_CONTEXT':
        handleGetWorkspaceContext(sendResponse);
        return true;

      default:
        sendResponse({ success: false, error: 'UNKNOWN_ACTION' });
        return false;
    }
  }
);

// ────────────────────────────────────────────────────────────
// LÓGICA INTERNA DEL BROKER
// ────────────────────────────────────────────────────────────

async function handleGetAccessToken(sendResponse: (r: SwResponse) => void) {
  const stored = await chrome.storage.session.get('wacrm_session');
  const session = stored['wacrm_session'];

  if (!session) {
    sendResponse({ success: false, error: 'NO_SESSION' });
    return;
  }

  // Renovar el token si expira en menos de 60 segundos
  const expiresAtMs = (session.expires_at as number) * 1000;
  const needsRefresh = Date.now() > expiresAtMs - 60_000;

  if (needsRefresh) {
    const renewed = await refreshSession(session.refresh_token as string);
    if (!renewed) {
      await chrome.storage.session.remove('wacrm_session');
      broadcastRevocation();
      sendResponse({ success: false, error: 'SESSION_EXPIRED' });
      return;
    }
    sendResponse({
      success: true,
      access_token: renewed.access_token,
      expires_at: renewed.expires_at * 1000,
    });
    return;
  }

  sendResponse({
    success: true,
    access_token: session.access_token as string,
    expires_at: expiresAtMs,
  });
}

async function handleSetSession(
  payload: { access_token: string; refresh_token: string },
  sendResponse: (r: SwResponse) => void
) {
  const { data, error } = await supabase.auth.setSession(payload);
  if (error || !data.session) {
    sendResponse({ success: false, error: 'UNAUTHORIZED' });
    return;
  }
  await chrome.storage.session.set({ wacrm_session: data.session });

  // Consultar workspace_members para guardar workspace_context
  try {
    const { data: memberData } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', data.session.user.id)
      .limit(1)
      .single();

    if (memberData) {
      await chrome.storage.session.set({
        wacrm_workspace_context: {
          workspace_id: memberData.workspace_id,
          role: memberData.role,
        },
      });
    } else {
      await chrome.storage.session.set({
        wacrm_workspace_context: {
          workspace_id: '00000000-0000-0000-0000-000000000001',
          role: 'owner',
        },
      });
    }
  } catch (e) {
    console.warn('[WA-CRM][SW] Error al resolver wacrm_workspace_context:', e);
  }

  sendResponse({ success: true });
}

async function handleSignOut(sendResponse: (r: SwResponse) => void) {
  await supabase.auth.signOut();
  await chrome.storage.session.remove(['wacrm_session', 'wacrm_workspace_context']);
  broadcastRevocation();
  sendResponse({ success: true });
}

async function handleGetWorkspaceContext(sendResponse: (r: SwResponse) => void) {
  const stored = await chrome.storage.session.get('wacrm_workspace_context');
  const ctx = stored['wacrm_workspace_context'];
  if (!ctx) {
    sendResponse({ success: false, error: 'NO_SESSION' });
    return;
  }
  sendResponse({ success: true, workspace_id: ctx.workspace_id, role: ctx.role });
}

// ────────────────────────────────────────────────────────────
// UTILIDADES
// ────────────────────────────────────────────────────────────

async function refreshSession(refreshToken: string) {
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return null;
  await chrome.storage.session.set({ wacrm_session: data.session });
  return data.session;
}

/** Notifica a todos los content scripts que la sesión fue revocada */
function broadcastRevocation() {
  chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'SESSION_REVOKED' });
      }
    }
  });
}

// ────────────────────────────────────────────────────────────
// chrome.action.onClicked — Navegar a WhatsApp Web (ADR-09)
// Mutuamente excluyente con default_popup en MV3.
// Instrucción: buscar pestaña existente → focar; si no → crear.
// ────────────────────────────────────────────────────────────

chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
  const existing = tabs[0];

  if (existing?.id !== undefined && existing.windowId !== undefined) {
    // Pestaña encontrada: activarla y enfocar su ventana
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    console.info('[WA-CRM] Pestaña WhatsApp Web enfocada (id=%d)', existing.id);
  } else {
    // No existe pestaña — abrir nueva
    await chrome.tabs.create({ url: 'https://web.whatsapp.com' });
    console.info('[WA-CRM] Nueva pestaña WhatsApp Web creada');
  }
});

// ────────────────────────────────────────────────────────────
// SESSION WATCHDOG — chrome.alarms (ADR-09)
// Renovación proactiva de token cada 20 min.
// Evita que el SW se quede con un token expirado sin saberlo.
// ────────────────────────────────────────────────────────────

const WATCHDOG_ALARM = 'SESSION_WATCHDOG';
const WATCHDOG_PERIOD_MINUTES = 20;

/** Crea (o reemplaza) la alarma de watchdog y recarga pestañas WhatsApp al instalar/actualizar la extensión */
chrome.runtime.onInstalled.addListener((details) => {
  chrome.alarms.create(WATCHDOG_ALARM, {
    delayInMinutes: WATCHDOG_PERIOD_MINUTES,
    periodInMinutes: WATCHDOG_PERIOD_MINUTES,
  });
  console.info('[WA-CRM] SESSION_WATCHDOG alarm registrada (%d min)', WATCHDOG_PERIOD_MINUTES);

  // Auto-recargar automáticamente las pestañas de WhatsApp Web abiertas al actualizar/recargar la extensión
  chrome.tabs.query({ url: '*://web.whatsapp.com/*' }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        console.info('[WA-CRM] Actualización de extensión detectada (%s). Auto-recargando WhatsApp Web id=%d...', details.reason, tab.id);
        chrome.tabs.reload(tab.id);
      }
    }
  });
});

/** También registra la alarma al arrancar el SW (puede reiniciarse sin onInstalled) */
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.get(WATCHDOG_ALARM, (existing) => {
    if (!existing) {
      chrome.alarms.create(WATCHDOG_ALARM, {
        delayInMinutes: WATCHDOG_PERIOD_MINUTES,
        periodInMinutes: WATCHDOG_PERIOD_MINUTES,
      });
      console.info('[WA-CRM] SESSION_WATCHDOG re-registrada tras restart');
    }
  });
});

/**
 * Manejador de alarmas.
 * SESSION_WATCHDOG → renueva proactivamente el access_token si hay sesión activa.
 * Si el refresh_token es inválido, revoca la sesión y notifica al CS.
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== WATCHDOG_ALARM) return;

  const stored = await chrome.storage.session.get('wacrm_session');
  const session = stored['wacrm_session'];

  if (!session) {
    // Sin sesión activa — nada que renovar
    console.info('[WA-CRM][WATCHDOG] Sin sesión activa, skip.');
    return;
  }

  const expiresAtMs = (session.expires_at as number) * 1000;
  const minutesLeft = (expiresAtMs - Date.now()) / 60_000;

  console.info('[WA-CRM][WATCHDOG] Token expira en %.1f min.', minutesLeft);

  // Renovar si expira en menos de 25 min (margen > periodo de 20 min)
  if (minutesLeft < 25) {
    const renewed = await refreshSession(session.refresh_token as string);
    if (renewed) {
      console.info('[WA-CRM][WATCHDOG] Token renovado exitosamente. Nuevo expires_at=%s',
        new Date(renewed.expires_at * 1000).toISOString());
    } else {
      console.warn('[WA-CRM][WATCHDOG] Refresh fallido — revocando sesión.');
      await chrome.storage.session.remove('wacrm_session');
      broadcastRevocation();
    }
  }
});
