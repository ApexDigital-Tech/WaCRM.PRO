// ============================================================
// LoginView — Formulario de autenticación en el panel PULSO CRM
// Montado dentro del Shadow DOM — sin acceso a clases globales.
// ============================================================

import React, { useState } from 'react';
import { getSupabaseClient } from '../supabaseClient';
import type { SwMessage } from '@wa-crm/types';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

interface LoginViewProps {
  onLoginSuccess: () => void;
  onSimulateTestRealtime?: () => void;
}

export function LoginView({ onLoginSuccess, onSimulateTestRealtime }: LoginViewProps) {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [error, setError]               = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleResetPassword() {
    setError(null);
    setResetMessage(null);

    const targetEmail = email.trim();
    if (!targetEmail) {
      setError('Ingresa tu correo electrónico arriba para enviarte el enlace de recuperación.');
      return;
    }

    setResetLoading(true);
    try {
      const supabase = getSupabaseClient();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: 'http://localhost:3000/reset-password',
      });

      if (resetError) {
        setError(resetError.message ?? 'Error al enviar correo de recuperación');
        return;
      }

      setResetMessage('Te hemos enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResetMessage(null);
    setLoading(true);

    try {
      // 1. Autenticar con Supabase Auth desde el CS
      const supabase = getSupabaseClient();

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !data.session) {
        setError(authError?.message ?? 'Credenciales inválidas');
        return;
      }

      // 2. Entregar los tokens al Service Worker — ADR-06
      //    El SW es el único custodio de chrome.storage.session
      const swMsg: SwMessage = {
        action: 'SET_SESSION',
        payload: {
          access_token:  data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
      };

      const swResponse = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        chrome.runtime.sendMessage(swMsg, resolve);
      });

      if (!swResponse.success) {
        setError(`Error al guardar sesión: ${swResponse.error ?? 'desconocido'}`);
        return;
      }

      onLoginSuccess();

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      console.error('[WA-CRM][LoginView] Error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wacrm-login">
      <div className="wacrm-login__logo">W</div>

      <div>
        <p className="wacrm-login__title">WA-CRM</p>
        <p className="wacrm-login__subtitle">
          Inicia sesión para gestionar tus contactos directamente en WhatsApp Web.
        </p>
      </div>

      <form className="wacrm-form" onSubmit={handleSubmit} noValidate>
        <div className="wacrm-form__group">
          <label htmlFor="wacrm-email" className="wacrm-form__label">
            Correo electrónico
          </label>
          <input
            id="wacrm-email"
            type="email"
            className="wacrm-form__input"
            placeholder="tu@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={loading || resetLoading}
          />
        </div>

        <div className="wacrm-form__group">
          <label htmlFor="wacrm-password" className="wacrm-form__label">
            Contraseña
          </label>
          <input
            id="wacrm-password"
            type="password"
            className="wacrm-form__input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={loading || resetLoading}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              id="wacrm-login-forgot"
              type="button"
              className="wacrm-form__forgot-link"
              onClick={handleResetPassword}
              disabled={loading || resetLoading}
            >
              {resetLoading ? 'Enviando enlace...' : '¿Olvidaste tu contraseña?'}
            </button>
          </div>
        </div>

        {resetMessage && (
          <p id="wacrm-login-success" className="wacrm-form__success" role="status">
            {resetMessage}
          </p>
        )}

        {error && (
          <p id="wacrm-login-error" className="wacrm-form__error" role="alert">
            {error}
          </p>
        )}

        <button
          id="wacrm-login-submit"
          type="submit"
          className="wacrm-btn wacrm-btn--primary"
          disabled={loading || !email || !password}
        >
          {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </button>

        {onSimulateTestRealtime && (
          <button
            type="button"
            onClick={onSimulateTestRealtime}
            style={{
              marginTop: '16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              color: '#a1a1aa',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              cursor: 'pointer',
              width: '100%',
              transition: 'all 0.2s ease',
            }}
          >
            🛠️ Probar Realtime Offline (Modo Dev)
          </button>
        )}
      </form>
    </div>
  );
}
