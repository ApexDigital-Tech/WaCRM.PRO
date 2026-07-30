// ============================================================
// ConnectionBanner — Notificación de estado Realtime (ADR-07)
// Visible solo en intentos 4+ (A/B híbrido).
// ============================================================

import React from 'react';
import type { ConnectionStatus } from '@wa-crm/types';

interface ConnectionBannerProps {
  status: ConnectionStatus;
  attempt: number;
  onRetry: () => void;
}

/**
 * Lógica de visibilidad A/B híbrida:
 * - IDLE / CONNECTING / CONNECTED: oculto (o verde en CONNECTED brevemente)
 * - RECONNECTING intentos 1-3: silencioso (sin banner)
 * - RECONNECTING intento 4+: banner amarillo
 * - FAILED: banner rojo permanente
 */
export function ConnectionBanner({ status, attempt, onRetry }: ConnectionBannerProps) {
  // Intento 1-3 en RECONNECTING: silencioso
  if (status === 'RECONNECTING' && attempt <= 3) return null;
  // IDLE y CONNECTING: sin banner
  if (status === 'IDLE' || status === 'CONNECTING') return null;
  // CONNECTED: sin banner (conexión exitosa = estado normal)
  if (status === 'CONNECTED') return null;

  const isReconnecting = status === 'RECONNECTING';
  const isFailed = status === 'FAILED';

  const bannerClass = isReconnecting
    ? 'wacrm-banner wacrm-banner--reconnecting'
    : 'wacrm-banner wacrm-banner--failed';

  const message = isFailed
    ? 'Sin conexión — 10 intentos fallidos'
    : `Reconectando... (intento ${attempt}/10)`;

  return (
    <div className={bannerClass} role="alert" aria-live="polite">
      <div className="wacrm-banner__left">
        <div className="wacrm-banner__dot" />
        <span>{message}</span>
      </div>
      {isFailed && (
        <button
          id="wacrm-banner-retry-btn"
          className="wacrm-banner__retry-btn"
          onClick={onRetry}
          type="button"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
