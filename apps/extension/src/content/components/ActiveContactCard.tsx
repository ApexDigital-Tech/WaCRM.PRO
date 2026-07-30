// ============================================================
// ActiveContactCard — Ficha del contacto activo en PULSO CRM
// Soporta los estados: ACTIVE, NO_ACTIVE_CHAT, SELECTOR_DEGRADED.
// ============================================================

import React from 'react';
import type { ActiveChatInfo } from '@wa-crm/types';

interface ActiveContactCardProps {
  chatInfo: ActiveChatInfo;
  onRetryDetection?: () => void;
}

export function ActiveContactCard({ chatInfo, onRetryDetection }: ActiveContactCardProps) {
  const { status, name, phoneNumber, jid, avatarUrl, degradedReason, source } = chatInfo;

  // 1. Estado: SIN CHAT ABIERTO o GRUPO
  if (status === 'NO_ACTIVE_CHAT') {
    const isGroupMessage = degradedReason === 'Los grupos no son contactos individuales de CRM.';
    return (
      <div className="wacrm-card wacrm-card--empty" style={isGroupMessage ? { borderColor: 'rgba(255, 255, 255, 0.05)' } : undefined}>
        <div className="wacrm-card__empty-icon">{isGroupMessage ? '👥' : '👤'}</div>
        <h3 className="wacrm-card__title">{isGroupMessage ? 'Chat de Grupo' : 'Sin chat seleccionado'}</h3>
        <p className="wacrm-card__text">
          {isGroupMessage 
            ? 'Los chats grupales no se sincronizan como contactos individuales en el CRM.' 
            : 'Abre una conversación en WhatsApp Web para cargar los datos del contacto en WA-CRM.'}
        </p>
      </div>
    );
  }

  // 2. Estado: DEGRADADO (Fallaron selectores remoto y local)
  if (status === 'SELECTOR_DEGRADED') {
    return (
      <div className="wacrm-card wacrm-card--degraded" style={{ borderColor: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '18px' }}>⚠️</span>
          <h3 className="wacrm-card__title" style={{ color: '#fbbf24', margin: 0 }}>
            Formato de WhatsApp Web actualizado
          </h3>
        </div>
        <p className="wacrm-card__text" style={{ color: '#d4d4d8', fontSize: '12px', marginBottom: '12px' }}>
          {degradedReason || 'No se pudo leer automáticamente el nombre del contacto activo.'}
        </p>
        {onRetryDetection && (
          <button
            type="button"
            className="wacrm-btn wacrm-btn--secondary"
            onClick={onRetryDetection}
            style={{ fontSize: '11px', padding: '6px 10px', width: '100%' }}
          >
            🔄 Reintentar detección
          </button>
        )}
      </div>
    );
  }

  // 3. Estado: ACTIVO (Contacto Detectado)
  const initialLetter = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className="wacrm-card wacrm-card--active-contact">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Avatar / Inicial */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name || 'Contacto'}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid #8b5cf6',
            }}
          />
        ) : (
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '18px',
              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4)',
            }}
          >
            {initialLetter}
          </div>
        )}

        {/* Datos del contacto */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 600,
              color: '#f4f4f5',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name || 'Contacto WhatsApp'}
          </h2>

          <p
            style={{
              margin: '2px 0 0 0',
              fontSize: '12px',
              color: '#a1a1aa',
              fontFamily: 'monospace',
            }}
          >
            {phoneNumber ? `+${phoneNumber.replace('+', '')}` : jid ?? 'Sin número'}
          </p>

          <span
            style={{
              display: 'inline-block',
              marginTop: '4px',
              fontSize: '9px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: source === 'REMOTE_SELECTOR' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(168, 85, 247, 0.15)',
              color: source === 'REMOTE_SELECTOR' ? '#4ade80' : '#c084fc',
              fontWeight: 500,
            }}
          >
            {source === 'REMOTE_SELECTOR' ? '🟢 Selector Remoto DB' : '🟣 Selector Resiliencia Local'}
          </span>
        </div>
      </div>
    </div>
  );
}
