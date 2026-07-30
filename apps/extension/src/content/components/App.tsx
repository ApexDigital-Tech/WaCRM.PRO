// ============================================================
// App.tsx — Raíz React del Content Script (ADR-06)
// ============================================================

import React, { useState, useEffect } from 'react';
import { LoginView } from './LoginView';
import { CrmPanelView } from './CrmPanelView';
import { ConnectionBanner } from './ConnectionBanner';
import { getAccessToken, getWorkspaceId, clearSessionCache } from '../session';
import type { ConnectionStatus, SwMessage, SwResponse } from '@wa-crm/types';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [connStatus, setConnStatus] = useState<ConnectionStatus>('IDLE');
  const [connAttempt, setConnAttempt] = useState<number>(0);

  useEffect(() => {
    // 1. Escuchar evento local de revocación de sesión
    const handleRevoked = () => {
      console.warn('[WA-CRM][App] Sesión revocada. Redirigiendo a Login.');
      setIsAuthenticated(false);
      setAccessToken(null);
      setWorkspaceId(null);
    };
    window.addEventListener('wa-crm:session-revoked', handleRevoked);

    // 2. Comprobar estado de sesión inicial
    checkSession();

    // 3. Exponer helper de prueba seguro para el Hallazgo #2 (Reconexión Realtime)
    (window as any).__WACRM_TEST_REALTIME__ = () => {
      console.info('[WA-CRM][TEST] Modo de prueba de Realtime activado (sesión simulada).');
      setAccessToken('test_access_token_wacrm_sprint_2');
      setWorkspaceId('00000000-0000-0000-0000-000000000001');
      setIsAuthenticated(true);
    };

    return () => {
      window.removeEventListener('wa-crm:session-revoked', handleRevoked);
      delete (window as any).__WACRM_TEST_REALTIME__;
    };
  }, []);

  async function checkSession() {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const wsId = await getWorkspaceId();
      setAccessToken(token);
      setWorkspaceId(wsId);
      setIsAuthenticated(true);
    } catch (err) {
      console.info('[WA-CRM][App] Sin sesión activa. Mostrando Login.');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      const swMsg: SwMessage = { action: 'SIGN_OUT' };
      const response = await new Promise<SwResponse>((resolve) => {
        chrome.runtime.sendMessage(swMsg, resolve);
      });
      if (!response.success) {
        console.error('[WA-CRM][App] Error al cerrar sesión:', response.error);
      }
    } catch (err) {
      console.error('[WA-CRM][App] Error IPC en signout:', err);
    } finally {
      clearSessionCache();
      setIsAuthenticated(false);
      setAccessToken(null);
      setWorkspaceId(null);
    }
  }

  function handleConnectionChange(status: ConnectionStatus, attempt: number) {
    setConnStatus(status);
    setConnAttempt(attempt);
  }

  // TODO: Implementar lógica de reconexión manual a través del banner
  // Se requiere inyectar una prop 'onRetry' o usar un contexto. Por ahora, CrmPanelView tiene un handleRetry interno.
  // Vamos a exponer la función handleRetry desde el CrmPanelView si es necesario, pero
  // es más sencillo pasar el status y dejar que el banner despache un evento o lo maneje el CrmPanelView.
  // En nuestro diseño, ConnectionBanner está al mismo nivel que CrmPanelView.

  return (
    <div id="wacrm-app">
      {/* ── HEADER ── */}
      <header className="wacrm-header">
        <div className="wacrm-header__logo">
          <div className="wacrm-header__logo-icon">W</div>
          <div>
            <h1 className="wacrm-header__title">WA-CRM</h1>
            <p className="wacrm-header__subtitle">Workspace Platform</p>
          </div>
        </div>
      </header>

      {/* ── CONNECTION BANNER ── */}
      {isAuthenticated && (
        <ConnectionBanner 
          status={connStatus} 
          attempt={connAttempt} 
          onRetry={() => {
            // Se despacha un evento para que CrmPanelView inicie la reconexión
            window.dispatchEvent(new CustomEvent('wa-crm:manual-reconnect'));
          }} 
        />
      )}

      {/* ── CONTENIDO ── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="wacrm-spinner"></div>
        </div>
      ) : isAuthenticated && accessToken && workspaceId ? (
        <CrmPanelView
          accessToken={accessToken}
          workspaceId={workspaceId}
          onConnectionChange={handleConnectionChange}
          onSignOut={handleSignOut}
        />
      ) : (
        <LoginView 
          onLoginSuccess={checkSession} 
          onSimulateTestRealtime={() => {
            console.info('[WA-CRM][TEST] Modo de prueba de Realtime activado desde botón Dev.');
            setAccessToken('test_access_token_wacrm_sprint_2');
            setWorkspaceId('00000000-0000-0000-0000-000000000001');
            setIsAuthenticated(true);
          }}
        />
      )}
    </div>
  );
}
