// ============================================================
// @wa-crm/types — Tipos compartidos v0.3
// Fuente de verdad para extensión, panel web y edge functions.
// ============================================================

// ────────────────────────────────────────────────────────────
// ESQUEMA BASE DE DATOS SUPABASE
// ────────────────────────────────────────────────────────────

export * from './database.types';

// ────────────────────────────────────────────────────────────
// ENTIDADES DE BASE DE DATOS
// ────────────────────────────────────────────────────────────

export type WorkspacePlan = 'free' | 'pro' | 'enterprise';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: WorkspacePlan;
  created_at: string;
}

export type WorkspaceRole = 'owner' | 'admin' | 'agent';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_by: string | null;
  joined_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  workspace_id: string;
  phone_number: string;
  name: string | null;
  assigned_to: string | null;
  created_at: string;
}

export interface Pipeline {
  id: string;
  workspace_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  order_index: number;
  color: string;
}

export interface Deal {
  id: string;
  workspace_id: string;
  contact_id: string;
  stage_id: string | null;
  title: string;
  value: number | null;
  currency: string;
  status: 'open' | 'won' | 'lost';
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  workspace_id: string;
  contact_id: string;
  content: string;
  created_by: string;
  created_at: string;
}

export interface Tag {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
}

export interface QuickReply {
  id: string;
  workspace_id: string;
  shortcut: string;
  title: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

export interface FollowUp {
  id: string;
  workspace_id: string;
  contact_id: string;
  assigned_to: string | null;
  scheduled_at: string;
  note: string | null;
  done: boolean;
  google_event_id: string | null;
  created_at: string;
}

export interface Workflow {
  id: string;
  workspace_id: string;
  name: string;
  is_active: boolean;
  trigger_type: 'keyword' | 'welcome';
  keywords: string[];
  created_at: string;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  type: 'message' | 'delay' | 'tag_add';
  delay_seconds: number;
  message_content?: string;
  tag_id?: string | null;
  created_at: string;
}

// ────────────────────────────────────────────────────────────
// DICCIONARIO DE SELECTORES DOM (ADR-03)
// Configuración declarativa — nunca contiene código ejecutable
// ────────────────────────────────────────────────────────────

export interface SelectorDictionary {
  /** Versión del diccionario en formato YYYY-MM-DD */
  version: string;
  /** Selector del nombre del contacto activo en el chat */
  CHAT_CONTACT_NAME: string;
  /** Selector del encabezado con número de teléfono */
  CHAT_PHONE_HEADER: string;
  /** Selector de cada ítem en la lista de chats */
  CHAT_LIST_ITEM: string;
  /** Selector del input de texto del chat */
  CHAT_INPUT_BOX: string;
  /** Selector del panel principal de un chat abierto */
  OPEN_CHAT_PANEL: string;
  /** Selector del contenedor de la lista de mensajes */
  MESSAGE_LIST_CONTAINER: string;
}

export interface DomSelectorConfigRow {
  id: string;
  platform: string;
  selector_key: string;
  selector_value: string;
  fallback_value?: string | null;
  version: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type DomServiceStatus =
  | 'INITIALIZING'
  | 'ACTIVE'
  | 'NO_ACTIVE_CHAT'
  | 'SELECTOR_DEGRADED';

export interface ActiveChatInfo {
  jid: string | null;
  phoneNumber: string | null;
  name: string | null;
  avatarUrl: string | null;
  status: DomServiceStatus;
  degradedReason?: string;
  source: 'REMOTE_SELECTOR' | 'LOCAL_FALLBACK' | 'DEGRADED';
}

export interface DomSelectorConfig {
  id: string;
  version: string;
  selectors: SelectorDictionary;
  is_active: boolean;
  released_at: string;
}

// ────────────────────────────────────────────────────────────
// MENSAJES SERVICE WORKER ↔ CONTENT SCRIPT (ADR-06)
// ────────────────────────────────────────────────────────────

export type SwMessageAction =
  | 'GET_ACCESS_TOKEN'
  | 'SET_SESSION'
  | 'SIGN_OUT'
  | 'GET_WORKSPACE_CONTEXT';

export interface SwMessage {
  action: SwMessageAction;
  payload?: Record<string, unknown>;
}

export type SwResponseSuccess =
  | { success: true; access_token: string; expires_at: number }
  | { success: true; workspace_id: string; role: WorkspaceRole }
  | { success: true };

export type SwResponseError = {
  success: false;
  error: 'NO_SESSION' | 'SESSION_EXPIRED' | 'UNAUTHORIZED' | 'UNKNOWN_ACTION';
};

export type SwResponse = SwResponseSuccess | SwResponseError;

// ────────────────────────────────────────────────────────────
// EVENTOS REALTIME (ADR-07)
// ────────────────────────────────────────────────────────────

/** Eventos que viajan por Postgres Changes */
export type PostgresChangeEvent =
  | { table: 'contacts'; type: 'INSERT' | 'UPDATE' | 'DELETE'; record: Contact }
  | { table: 'deals'; type: 'INSERT' | 'UPDATE' | 'DELETE'; record: Deal }
  | { table: 'notes'; type: 'INSERT' | 'UPDATE' | 'DELETE'; record: Note }
  | { table: 'pipelines'; type: 'INSERT' | 'UPDATE' | 'DELETE'; record: Pipeline }
  | { table: 'quick_replies'; type: 'INSERT' | 'UPDATE' | 'DELETE'; record: QuickReply }
  | { table: 'workflows'; type: 'INSERT' | 'UPDATE' | 'DELETE'; record: Workflow }
  | { table: 'workflow_steps'; type: 'INSERT' | 'UPDATE' | 'DELETE'; record: WorkflowStep }
  | { table: 'tags'; type: 'INSERT' | 'UPDATE' | 'DELETE'; record: Tag };

/** Eventos efímeros que viajan por Broadcast */
export type BroadcastEvent =
  | { event: 'agent_presence'; payload: { user_id: string; contact_id: string } }
  | { event: 'force_sync'; payload: Record<string, never> };

// ────────────────────────────────────────────────────────────
// REALTIME CONNECTION STATUS (ADR-07 — Sprint 2)
// Maquina de estados del canal Supabase Realtime en el CS.
// ────────────────────────────────────────────────────────────

/**
 * Estados posibles del canal Realtime.
 * - IDLE: sin sesión activa, canal no iniciado.
 * - CONNECTING: intento inicial o de reconexión en curso.
 * - CONNECTED: canal SUBSCRIBED y recibiendo eventos.
 * - RECONNECTING: backoff activo tras fallo (intento N >= 1).
 * - FAILED: 10 intentos fallidos; canal en pausa. Requiere acción del usuario.
 */
export type ConnectionStatus =
  | 'IDLE'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'FAILED';

/** Evento emitido por RealtimeManager hacia los suscriptores del CS */
export type RealtimeEvent =
  | { type: 'STATUS_CHANGE'; status: ConnectionStatus; attempt: number }
  | { type: 'POSTGRES_CHANGE'; payload: PostgresChangeEvent }
  | { type: 'BROADCAST'; payload: BroadcastEvent };

// ────────────────────────────────────────────────────────────
// EDGE FUNCTIONS — CONTRATOS DE API (ADR-05)
// ────────────────────────────────────────────────────────────

export interface CreateCalendarEventRequest {
  contact_id: string;
  title: string;
  description?: string;
  start_time: string;  // ISO 8601
  end_time: string;    // ISO 8601
}

export interface CreateCalendarEventResponse {
  success: boolean;
  google_event_id?: string;
  error?: string;
}
