// ============================================================
// Content Script — Módulo de Sesión (ADR-06)
// El CS NUNCA accede a chrome.storage.session directamente.
// Toda sesión se solicita al SW vía mensaje.
// ============================================================

import type { SwMessage, SwResponse, WorkspaceRole } from '@wa-crm/types';

// Cache en memoria local del CS — no persiste entre navegaciones
let _cachedToken: string | null = null;
let _tokenExpiry: number = 0;
let _workspaceId: string | null = null;
let _role: WorkspaceRole | null = null;

// ────────────────────────────────────────────────────────────
// API PÚBLICA
// ────────────────────────────────────────────────────────────

/**
 * Obtiene el access_token del usuario.
 * Usa caché local en memoria (30s de anticipación para evitar expiración).
 * Si el caché es inválido, solicita al Service Worker.
 */
export async function getAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiry - 30_000) {
    return _cachedToken;
  }

  const response = await sendToSW({ action: 'GET_ACCESS_TOKEN' });

  if (!response.success) {
    throw new Error(`Session error: ${response.error}`);
  }

  // response.success === true, accedemos a los campos tipados
  const successResponse = response as Extract<SwResponse, { success: true; access_token: string }>;
  _cachedToken = successResponse.access_token;
  _tokenExpiry = successResponse.expires_at;
  return _cachedToken;
}

/** Retorna el workspace_id del usuario autenticado */
export async function getWorkspaceId(): Promise<string> {
  if (_workspaceId) return _workspaceId;
  await hydrateWorkspaceContext();
  if (!_workspaceId) throw new Error('No workspace context available');
  return _workspaceId;
}

/** Retorna el rol del usuario en el workspace activo */
export async function getUserRole(): Promise<WorkspaceRole> {
  if (_role) return _role;
  await hydrateWorkspaceContext();
  if (!_role) throw new Error('No role available');
  return _role;
}

/** Limpia el caché local de sesión (llamado al recibir SESSION_REVOKED del SW) */
export function clearSessionCache(): void {
  _cachedToken = null;
  _tokenExpiry = 0;
  _workspaceId = null;
  _role = null;
}

// ────────────────────────────────────────────────────────────
// ESCUCHA DE REVOCACIÓN DESDE EL SW
// ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'SESSION_REVOKED') {
    clearSessionCache();
    // El componente React escuchará este evento para redirigir al login
    window.dispatchEvent(new CustomEvent('wa-crm:session-revoked'));
  }
});

// ────────────────────────────────────────────────────────────
// UTILIDADES INTERNAS
// ────────────────────────────────────────────────────────────

function sendToSW(message: SwMessage): Promise<SwResponse> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response: SwResponse) => {
        if (chrome.runtime.lastError) {
          const errText = chrome.runtime.lastError.message || '';
          if (errText.includes('context invalidated') || errText.includes('Could not establish connection')) {
            console.warn('[WA-CRM] Contexto de extensión invalidado tras actualización. Recargando WhatsApp Web...');
            window.location.reload();
            return;
          }
          return reject(new Error(errText));
        }
        resolve(response);
      });
    } catch (err: any) {
      if (err?.message?.includes('context invalidated')) {
        console.warn('[WA-CRM] Contexto de extensión invalidado tras actualización. Recargando WhatsApp Web...');
        window.location.reload();
        return;
      }
      reject(err);
    }
  });
}

async function hydrateWorkspaceContext(): Promise<void> {
  const response = await sendToSW({ action: 'GET_WORKSPACE_CONTEXT' });
  if (!response.success) return;

  const ctx = response as Extract<SwResponse, { success: true; workspace_id: string }>;
  _workspaceId = ctx.workspace_id;
  _role = ctx.role;
}
