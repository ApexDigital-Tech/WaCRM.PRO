// ============================================================
// Realtime Manager — Backoff Exponencial + ConnectionStatus (ADR-07)
// Gestiona el ciclo de vida del canal Supabase Realtime en el CS.
// NO contiene lógica de negocio; emite eventos hacia los consumidores.
// ============================================================

import { type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';
import type { ConnectionStatus, RealtimeEvent, PostgresChangeEvent, BroadcastEvent } from '@wa-crm/types';

// ────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE BACKOFF
// ────────────────────────────────────────────────────────────

/** Tiempo base de backoff en ms (1 segundo) */
const BASE_DELAY_MS = 1_000;
/** Factor multiplicador por cada intento fallido */
const BACKOFF_FACTOR = 2;
/** Máximo delay entre reintentos (30 segundos) */
const MAX_DELAY_MS = 30_000;
/** Intentos antes de pasar a estado FAILED */
const MAX_ATTEMPTS = 10;
/** Intentos silenciosos antes de mostrar banner (A/B híbrido) */
const SILENT_ATTEMPTS = 3;

// ────────────────────────────────────────────────────────────
// TIPOS INTERNOS
// ────────────────────────────────────────────────────────────

type EventListener = (event: RealtimeEvent) => void;

// ────────────────────────────────────────────────────────────
// CLASE RealtimeManager
// ────────────────────────────────────────────────────────────

declare const __SUPABASE_ANON_KEY__: string;

export class RealtimeManager {
  private supabase: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private workspaceId: string;
  private accessToken: string;

  private status: ConnectionStatus = 'IDLE';
  private attempt: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed: boolean = false;

  private listeners: Set<EventListener> = new Set();

  constructor(supabaseUrl: string, accessToken: string, workspaceId: string, supabaseAnonKey?: string) {
    this.workspaceId = workspaceId;
    this.accessToken = accessToken;
    this.supabase = getSupabaseClient();
  }

  // ────────────────────────────────────────────────────────────
  // API PÚBLICA
  // ────────────────────────────────────────────────────────────

  /** Inicia la suscripción al canal de workspace */
  start(): void {
    if (this.destroyed) {
      console.warn('[WA-CRM REALTIME] Intento de start() sobre instancia destruida. Ignorado.');
      return;
    }
    this.attempt = 0;
    this.connect();
  }

  /** Detiene el canal y cancela cualquier reintento pendiente */
  stop(): void {
    this.destroyed = true;
    this.clearTimer();
    this.unsubscribeChannel();
    this.setStatus('IDLE');
  }

  /** Suscribe un listener a los eventos del canal */
  on(listener: EventListener): () => void {
    this.listeners.add(listener);
    // Retorna función de unsuscribe
    return () => this.listeners.delete(listener);
  }

  /** Exposición del estado actual (para lectura inicial de componentes) */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /** Exposición del intento actual (para el banner) */
  getAttempt(): number {
    return this.attempt;
  }

  // ────────────────────────────────────────────────────────────
  // LÓGICA INTERNA DE CONEXIÓN
  // ────────────────────────────────────────────────────────────

  private async connect(): Promise<void> {
    if (this.destroyed) return;

    this.setStatus(this.attempt === 0 ? 'CONNECTING' : 'RECONNECTING');
    console.info('[WA-CRM REALTIME] Conectando... intento=%d', this.attempt + 1);

    try {
      await this.supabase.auth.setSession({ access_token: this.accessToken, refresh_token: '' });
    } catch (err) {
      console.warn('[WA-CRM REALTIME] Error al establecer sesión en Supabase:', err);
    }

    const channelName = `workspace:${this.workspaceId}`;

    this.channel = this.supabase.channel(channelName)
      // Postgres Changes — contacts, deals, notes
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'contacts', filter: `workspace_id=eq.${this.workspaceId}` },
        (payload) => {
          this.emit({ type: 'POSTGRES_CHANGE', payload: payload as unknown as PostgresChangeEvent });
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'deals', filter: `workspace_id=eq.${this.workspaceId}` },
        (payload) => {
          this.emit({ type: 'POSTGRES_CHANGE', payload: payload as unknown as PostgresChangeEvent });
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `workspace_id=eq.${this.workspaceId}` },
        (payload) => {
          this.emit({ type: 'POSTGRES_CHANGE', payload: payload as unknown as PostgresChangeEvent });
        }
      )
      // Broadcast — presencia y sincronización forzada
      .on('broadcast',
        { event: 'agent_presence' },
        (payload) => {
          this.emit({ type: 'BROADCAST', payload: payload as unknown as BroadcastEvent });
        }
      )
      .on('broadcast',
        { event: 'force_sync' },
        (payload) => {
          this.emit({ type: 'BROADCAST', payload: payload as unknown as BroadcastEvent });
        }
      )
      .subscribe((subscribeStatus, err) => {
        if (this.destroyed) return;

        if (subscribeStatus === 'SUBSCRIBED') {
          this.onConnected();
        } else if (subscribeStatus === 'CHANNEL_ERROR' || subscribeStatus === 'TIMED_OUT') {
          console.warn('[WA-CRM REALTIME] Error de canal: status=%s, err=%s', subscribeStatus, err?.message);
          this.onFailedAttempt();
        } else if (subscribeStatus === 'CLOSED') {
          // Cierre inesperado (ej. red offline)
          if (!this.destroyed) {
            console.warn('[WA-CRM REALTIME] Canal cerrado inesperadamente. Reconectando...');
            this.onFailedAttempt();
          }
        }
      });
  }

  private onConnected(): void {
    this.attempt = 0;
    this.setStatus('CONNECTED');
    console.info('[WA-CRM REALTIME] Canal SUBSCRIBED — workspace=%s', this.workspaceId);
  }

  private onFailedAttempt(): void {
    if (this.status === 'FAILED') return;
    this.unsubscribeChannel();
    this.attempt += 1;

    if (this.attempt >= MAX_ATTEMPTS) {
      this.attempt = MAX_ATTEMPTS;
      this.setStatus('FAILED');
      console.error('[WA-CRM REALTIME] FAILED — %d intentos agotados. Canal en pausa.', MAX_ATTEMPTS);
      return;
    }

    // Calcular delay con jitter para evitar thundering herd
    const baseDelay = Math.min(BASE_DELAY_MS * Math.pow(BACKOFF_FACTOR, this.attempt - 1), MAX_DELAY_MS);
    const jitter = Math.random() * 0.3 * baseDelay; // ±15% jitter
    const delay = Math.round(baseDelay + jitter);

    this.setStatus('RECONNECTING');

    // Determina si este intento debe mostrar banner (A/B híbrido)
    if (this.attempt > SILENT_ATTEMPTS) {
      console.warn('[WA-CRM REALTIME] Intento %d/%d — próximo reintento en %dms (BANNER VISIBLE)',
        this.attempt, MAX_ATTEMPTS, delay);
    } else {
      console.info('[WA-CRM REALTIME] Intento %d/%d — próximo reintento en %dms (silencioso)',
        this.attempt, MAX_ATTEMPTS, delay);
    }

    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) this.connect();
    }, delay);
  }

  // ────────────────────────────────────────────────────────────
  // UTILIDADES INTERNAS
  // ────────────────────────────────────────────────────────────

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.emit({ type: 'STATUS_CHANGE', status: newStatus, attempt: this.attempt });
  }

  private emit(event: RealtimeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        // Aislar errores de listeners individuales
        console.error('[WA-CRM REALTIME] Error en listener:', err);
      }
    }
  }

  private unsubscribeChannel(): void {
    if (this.channel) {
      this.supabase.removeChannel(this.channel).catch(() => {
        // Ignorar errores de cleanup — el canal puede ya estar cerrado
      });
      this.channel = null;
    }
  }

  private clearTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
