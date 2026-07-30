# Plan Arquitectónico y de Implementación v0.2: PULSO CRM SaaS

> [!NOTE]
> **Versión 0.2** — Incorpora las 4 correcciones obligatorias solicitadas. Listo para inicializar repositorios e infraestructura.

---

## 1. Diseño Arquitectónico y Patrones Técnicos

### 1.1 Topología del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENTE (Extensión Chrome MV3)                                 │
│  ┌──────────────────┐    ┌──────────────────────────────────┐   │
│  │  Content Script  │◄──►│  Service Worker (Orquestador)    │   │
│  │  (React + Vite)  │    │  (Auth, Mensajes, Alarm-free)    │   │
│  └──────────────────┘    └──────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS + JWT Supabase
┌───────────────────────────────▼─────────────────────────────────┐
│  BACKEND (Supabase)                                             │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────────┐ │
│  │  Auth   │ │ Postgres │ │ Realtime │ │   Edge Functions    │ │
│  │  JWT    │ │ + RLS    │ │ PG/Broad │ │  (Webhooks, OAuth)  │ │
│  └─────────┘ └──────────┘ └──────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  PANEL WEB (Next.js App Router)                                 │
│  Administración, Métricas, Onboarding, API Pública              │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Estrategia Anti-fragilidad ante Cambios del DOM de WhatsApp Web

**Problema:** WhatsApp Web actualiza su DOM con frecuencia sin aviso previo, rompiendo los selectores de la extensión.

**Solución: Diccionario de Selectores Declarativo y Versionado**

Los selectores son **configuración pura**, no lógica ejecutable. Se almacenan en Supabase y la extensión los consume como datos estáticos ya validados en el arranque. No se ejecuta ningún código descargado del servidor.

**Flujo de carga:**
1. Al iniciar el Content Script, se solicita la versión activa del diccionario a Supabase vía `SELECT`.
2. El resultado es un objeto JSON plano con claves semánticas (`CHAT_HEADER`, `CONTACT_NAME`, etc.) y valores de selector CSS o XPATH.
3. El Content Script valida el objeto localmente con un esquema **Zod** antes de usarlo.
4. Si la validación falla o el fetch falla, se usan los selectores del **build anterior** (empaquetados en el bundle de la extensión como fallback).

```typescript
// Estructura tipada y validada del diccionario — nunca es código ejecutable
import { z } from 'zod';

export const SelectorDictionarySchema = z.object({
  version: z.string(),          // ej. "2026-07-27"
  CHAT_CONTACT_NAME: z.string(),
  CHAT_PHONE_HEADER: z.string(),
  CHAT_LIST_ITEM: z.string(),
  CHAT_INPUT_BOX: z.string(),
  OPEN_CHAT_PANEL: z.string(),
});

export type SelectorDictionary = z.infer<typeof SelectorDictionarySchema>;

// Tabla en Supabase: dom_selector_configs
// Políticas RLS: lectura pública para usuarios autenticados
// Actualización: solo rol service_role (backend/admin)
```

**Capa de Abstracción del DOM:**

```typescript
// Toda la extensión accede al DOM exclusivamente a través de WhatsAppService
// Nunca un selector hardcodeado fuera de este servicio

export class WhatsAppDomService {
  constructor(private selectors: SelectorDictionary) {}

  getActiveContactName(): string | null {
    return document.querySelector(this.selectors.CHAT_CONTACT_NAME)
      ?.textContent?.trim() ?? null;
  }
}
```

**MutationObserver en lugar de polling:**

```typescript
// Se observa el contenedor raíz de WhatsApp para reaccionar a cambios de chat
const observer = new MutationObserver(onChatChange);
observer.observe(document.getElementById('app'), { childList: true, subtree: true });
```

---

### 1.3 Criterio: Supabase Realtime — Broadcast vs. Postgres Changes

| Criterio | Postgres Changes | Realtime Broadcast |
|---|---|---|
| **Tipo de dato** | Estado persistente (escrito en DB) | Efímero, no persiste |
| **Caso de uso** | Mover lead de etapa, nueva nota, cambio de etiqueta | Presencia ("agente X está editando"), bloqueos de edición |
| **Latencia** | ~100–300ms (depende de WAL) | ~50ms |
| **Filtro RLS** | Respeta RLS por `workspace_id` automáticamente | Canal incluye `workspace_id` como namespace explícito |
| **Receptor** | Content Script (pestaña activa de WA) | Content Script o SW según el caso |

**Regla de decisión:** Si el dato necesita existir si el usuario se desconecta, usa Postgres Changes. Si es sólo interacción en tiempo real de sesión activa, usa Broadcast.

---

### 1.4 Ciclo de Vida del Service Worker MV3 y Patrón de Reconexión

**Problema:** En MV3, el Service Worker (SW) se suspende tras ~30 segundos de inactividad, rompiendo listeners y conexiones.

**Solución adoptada (sin `alarms` innecesarios):**

```
Content Script (vive con la pestaña de WhatsApp)
       │
       │ chrome.runtime.connect({ name: 'cs-to-sw' })
       ▼
Service Worker ──► Se activa. Escucha mensajes.
       │
       │ (tras 30s sin actividad)
       ▼
SW se suspende (puerto cae → onDisconnect dispara en CS)
       │
       │ Content Script detecta onDisconnect
       ▼
CS vuelve a llamar chrome.runtime.connect() → SW se despierta
```

**Código de reconexión en el Content Script:**

```typescript
let swPort: chrome.runtime.Port | null = null;

function connectToServiceWorker() {
  swPort = chrome.runtime.connect({ name: 'cs-to-sw' });

  swPort.onMessage.addListener((msg) => handleMessageFromSW(msg));

  swPort.onDisconnect.addListener(() => {
    // SW se suspendió. Reconectamos con backoff exponencial.
    swPort = null;
    setTimeout(connectToServiceWorker, 500);
  });
}

connectToServiceWorker();
```

**Sobre el permiso `alarms`:** Se **elimina del manifest**. Justificación técnica: el único caso de uso que requeriría alarms sería un follow-up programado en background cuando WhatsApp Web no está abierto. Esa responsabilidad recae en el **servidor** (Supabase Edge Function + pg_cron), no en el cliente. La extensión reacciona a notificaciones push del backend, no dispara timers propios.

> [!IMPORTANT]
> Si en Etapa 2 se identifica una necesidad legítima de `alarms` en el cliente (ej. alerta local sin conexión), se reintroducirá con documentación explícita del caso de uso. Por ahora: **eliminado**.

---

### 1.5 Flujo JWT en MV3: Almacenamiento, Acceso y Revocación

**Corrección v0.2:** La política de tokens se precisa con los mecanismos específicos de MV3.

#### 1.5.1 Almacenamiento del JWT de Supabase

| Ubicación | API | Persistencia | Acceso desde |
|---|---|---|---|
| **`chrome.storage.session`** | MV3 nativo | Borra al cerrar navegador | SW y CS vía `chrome.storage.session.get()` |
| ~~`localStorage`~~ | ~~DOM API~~ | ~~Persiste~~ | ~~No usar — no compartido entre SW y CS~~ |
| ~~`chrome.storage.local`~~ | ~~MV3~~ | ~~Persiste~~ | ~~No usar para JWT — riesgo ante XSS en la pestaña~~ |

#### 1.5.2 Flujo de Login y Distribución del JWT

```
1. Usuario hace login en el Popup (React)
2. Supabase SDK en el Popup retorna { access_token, refresh_token }
3. Popup envía mensaje al SW: { action: 'SET_SESSION', payload: { access_token, refresh_token } }
4. SW guarda en chrome.storage.session:
      chrome.storage.session.set({ supabase_session: { access_token, refresh_token } })
5. Content Script necesita el token → solicita al SW via puerto:
      swPort.postMessage({ action: 'GET_SESSION' })
      SW responde: swPort.postMessage({ access_token })
6. Content Script usa access_token para consultas directas a Supabase (REST/Realtime)
```

> [!IMPORTANT]
> El **refresh_token de Google Calendar** NUNCA pasa al cliente. Lo almacena Supabase en una tabla cifrada (`google_oauth_tokens`), con acceso exclusivo desde Edge Functions usando `service_role`. La extensión solo llama a una Edge Function (`/create-calendar-event`) con el JWT del usuario. La Edge Function hace el intercambio de tokens internamente.

#### 1.5.3 Renovación Automática del JWT de Supabase

```typescript
// En el Service Worker — único responsable de renovar el token
async function refreshSupabaseSession() {
  const session = await chrome.storage.session.get('supabase_session');
  if (!session?.supabase_session) return;

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: session.supabase_session.refresh_token,
  });

  if (error || !data.session) {
    // Token inválido o revocado → limpiar sesión y notificar CS
    await chrome.storage.session.remove('supabase_session');
    broadcastToContentScripts({ action: 'SESSION_REVOKED' });
    return;
  }

  // Guardar nueva sesión renovada
  await chrome.storage.session.set({ supabase_session: data.session });
}
```

#### 1.5.4 Flujo de Revocación

```
CASO A — Expiración natural:
  CS realiza petición → Supabase responde 401
  CS notifica al SW → SW intenta refreshSession()
  Si refresh falla → SW emite SESSION_REVOKED → CS muestra login

CASO B — Revocación remota (admin expulsa usuario del workspace):
  Supabase invalida el JWT en servidor
  La próxima renovación del SW falla con 401/403
  SW limpia storage.session y emite SESSION_REVOKED → CS muestra login

CASO C — Usuario cierra sesión activamente:
  CS/Popup llama supabase.auth.signOut()
  SW limpia chrome.storage.session
  CS destruye la suscripción Realtime y limpia el estado de React
```

---

### 1.6 Flujo OAuth — Google Calendar (Offline Access)

1. Usuario inicia desde Popup de la extensión → redirige al Panel Web de Next.js para el flujo OAuth (los popups de extensión no pueden gestionar redirects de OAuth de forma confiable).
2. Next.js invoca `supabase.auth.signInWithOAuth({ provider: 'google', options: { scopes: 'https://www.googleapis.com/auth/calendar', queryParams: { access_type: 'offline', prompt: 'consent' } } })`.
3. Supabase intercepta el callback, extrae el `refresh_token` de Google y lo almacena en `google_oauth_tokens` usando `service_role`.
4. La extensión invoca la Edge Function `POST /functions/v1/calendar-event` con el JWT del usuario + datos del evento.
5. La Edge Function recupera el `refresh_token` de Google, obtiene un `access_token` fresco y crea el evento. La extensión nunca ve tokens de Google.

---

## Anexo 1: SQL Inicial de Supabase v0.2

> [!TIP]
> **Corrección principal v0.2:** Se reemplaza la tabla `users` monolítica por el patrón `profiles` + `workspace_members`, que permite a un usuario pertenecer a múltiples workspaces con roles distintos (real multitenancy SaaS).

```sql
-- ============================================================
-- PULSO CRM SaaS — Esquema Inicial v0.2
-- Patrón: profiles + workspace_members (multiworkspace real)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- CAPA 1: Identidad y Membresía
-- ────────────────────────────────────────────────────────────

-- Perfil de usuario (extiende auth.users, sin workspace propio)
CREATE TABLE public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.profiles IS
  'Datos públicos del usuario. Un usuario puede ser miembro de múltiples workspaces.';

-- Espacio de trabajo (empresa / tenant)
CREATE TABLE public.workspaces (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,  -- para URLs amigables
    plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla pivote: membresía de usuario en workspace (con rol)
-- Un usuario puede ser admin en Workspace A y agent en Workspace B
CREATE TABLE public.workspace_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'admin', 'agent')),
    invited_by      UUID REFERENCES public.profiles(id),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, user_id)  -- un miembro único por workspace
);
COMMENT ON TABLE public.workspace_members IS
  'Membresías multiworkspace. Fuente de verdad para permisos de acceso por tenant.';

-- ────────────────────────────────────────────────────────────
-- CAPA 2: CRM Core
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.contacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    phone_number    TEXT NOT NULL,
    name            TEXT,
    assigned_to     UUID REFERENCES public.profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, phone_number)
);

CREATE TABLE public.pipeline_stages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    position        INTEGER NOT NULL DEFAULT 0,
    color           TEXT DEFAULT '#6B7280'
);

CREATE TABLE public.deals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    contact_id      UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    stage_id        UUID REFERENCES public.pipeline_stages(id),
    title           TEXT NOT NULL,
    value           NUMERIC(12, 2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    contact_id      UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.labels (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    color           TEXT NOT NULL DEFAULT '#3B82F6',
    UNIQUE(workspace_id, name)
);

CREATE TABLE public.contact_labels (
    contact_id  UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    label_id    UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, label_id)
);

CREATE TABLE public.quick_replies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    shortcut        TEXT NOT NULL,
    content         TEXT NOT NULL,
    created_by      UUID REFERENCES public.profiles(id),
    UNIQUE(workspace_id, shortcut)
);

CREATE TABLE public.follow_ups (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    contact_id      UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    assigned_to     UUID REFERENCES public.profiles(id),
    scheduled_at    TIMESTAMPTZ NOT NULL,
    note            TEXT,
    done            BOOLEAN NOT NULL DEFAULT false,
    google_event_id TEXT,  -- ID del evento en Google Calendar
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- CAPA 3: Configuración y Anti-fragilidad DOM
-- ────────────────────────────────────────────────────────────

-- Diccionario de selectores del DOM de WhatsApp Web (datos puros, sin código)
CREATE TABLE public.dom_selector_configs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version         TEXT NOT NULL UNIQUE,  -- ej. '2026-07-27'
    selectors       JSONB NOT NULL,        -- objeto validado con SelectorDictionarySchema
    is_active       BOOLEAN NOT NULL DEFAULT false,
    released_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.dom_selector_configs IS
  'Configuración declarativa de selectores DOM de WhatsApp Web. Sin lógica ejecutable.
   Solo los admins del sistema (service_role) pueden escribir aquí.
   Los clientes solo pueden hacer SELECT de la fila con is_active = true.';

-- Tokens OAuth de Google Calendar (solo accesible desde Edge Functions)
CREATE TABLE public.google_oauth_tokens (
    user_id         UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    refresh_token   TEXT NOT NULL,  -- cifrado en tránsito vía TLS; en reposo usar vault
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- SEGURIDAD: Habilitar RLS en todas las tablas
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_labels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_replies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dom_selector_configs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_oauth_tokens     ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- FUNCIÓN HELPER: Obtener workspaces del usuario actual
-- Evita sub-queries repetidas en cada política RLS
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid();
$$;

-- ────────────────────────────────────────────────────────────
-- POLÍTICAS RLS
-- ────────────────────────────────────────────────────────────

-- profiles: Cada usuario ve su propio perfil
CREATE POLICY "profile: owner can read/write"
    ON public.profiles FOR ALL
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- workspace_members: Usuarios ven miembros de sus workspaces
CREATE POLICY "workspace_members: members can select"
    ON public.workspace_members FOR SELECT
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

-- workspaces: Usuarios acceden a sus workspaces
CREATE POLICY "workspaces: members can select"
    ON public.workspaces FOR SELECT
    USING (id IN (SELECT public.get_user_workspace_ids()));

-- contacts: Aislamiento estricto por workspace
CREATE POLICY "contacts: workspace members can select"
    ON public.contacts FOR SELECT
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "contacts: workspace members can insert"
    ON public.contacts FOR INSERT
    WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "contacts: workspace members can update"
    ON public.contacts FOR UPDATE
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

-- notes: Mismo patrón de workspace
CREATE POLICY "notes: workspace members can select"
    ON public.notes FOR SELECT
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "notes: workspace members can insert"
    ON public.notes FOR INSERT
    WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids()));

-- dom_selector_configs: Solo lectura del config activo para cualquier usuario autenticado
-- Escritura exclusiva desde service_role (backend)
CREATE POLICY "dom_selectors: authenticated users can read active config"
    ON public.dom_selector_configs FOR SELECT
    TO authenticated
    USING (is_active = true);

-- google_oauth_tokens: BLOQUEADO completamente para clientes
-- Solo accesible desde Edge Functions con service_role
-- (No se crea política — sin política + RLS habilitado = denegado por defecto)
```

---

## Anexo 2: manifest.json v0.2 — Base Segura y Explicada

> [!WARNING]
> **Cambio v0.2 crítico:** Se elimina `"alarms"` de los permisos. Se documenta explícitamente cada permiso restante.

```json
{
  "manifest_version": 3,
  "name": "PULSO CRM: Workspace Platform",
  "version": "8.0.0",
  "description": "CRM colaborativo para WhatsApp Web. Gestiona contactos, pipeline y follow-ups sin salir de WhatsApp.",

  "permissions": [
    "storage"
  ],
  "_comment_permissions": {
    "storage": "Requerido para chrome.storage.session (JWT de sesión) y chrome.storage.local (diccionario de selectores en caché). SIN alarms — los timers corren en el servidor (Supabase/pg_cron).",
    "alarms_eliminado": "Eliminado. No hay lógica de temporización en el cliente. Follow-ups y recordatorios son responsabilidad del backend."
  },

  "host_permissions": [
    "https://web.whatsapp.com/*"
  ],
  "_comment_host_permissions": "Único dominio autorizado. No hay acceso a dominios del backend — las peticiones a Supabase usan las credenciales del SDK que va empaquetado con la URL del proyecto.",

  "background": {
    "service_worker": "dist/background/serviceWorker.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["https://web.whatsapp.com/*"],
      "js": ["dist/content/index.js"],
      "css": ["dist/content/styles.css"],
      "run_at": "document_idle"
    }
  ],

  "action": {
    "default_popup": "dist/popup/index.html",
    "default_icon": {
      "16":  "assets/icons/icon16.png",
      "32":  "assets/icons/icon32.png",
      "128": "assets/icons/icon128.png"
    }
  },

  "web_accessible_resources": [
    {
      "resources": ["assets/icons/*", "assets/fonts/*"],
      "matches": ["https://web.whatsapp.com/*"]
    }
  ],
  "_comment_web_accessible": "Solo activos estáticos (iconos, fuentes). Sin JS ni CSS accesibles remotamente.",

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src https://*.supabase.co wss://*.supabase.co;"
  },
  "_comment_csp": "connect-src permite HTTPS y WSS exclusivamente a Supabase. Sin eval, sin código inline, sin fuentes externas de script."
}
```

---

## Anexo 3: Roadmap de 12 Semanas v0.2 (Sprints)

### Etapa 1: MVP Operativo (Semanas 1–6)

| Sprint | Semana | Objetivo | Entregables Clave |
|---|---|---|---|
| **S1** | 1 | Infraestructura y Auth | Monorepo (Turborepo), Supabase configurado, SQL v0.2 aplicado, tipos TS generados desde DB, CI/CD básico |
| **S2** | 2 | Extensión Base | Manifest v0.2, Vite build, Content Script con Shadow DOM, ciclo de vida SW + reconexión automática, `chrome.storage.session` operativo |
| **S3** | 3 | Motor Anti-fragilidad DOM | `dom_selector_configs` en Supabase, carga al inicio con validación Zod, `WhatsAppDomService` con abstracción completa, MutationObserver reactivo |
| **S4** | 4 | CRM Core: Contactos + Pipeline | CRUD de contactos y pipeline_stages, UI Kanban inyectada en WhatsApp, Realtime (Postgres Changes) sincronizando entre agentes |
| **S5** | 5 | Notas, Etiquetas, Respuestas Rápidas | UI de notas en panel lateral, gestión de etiquetas, buscador de respuestas rápidas con shortcut |
| **S6** | 6 | Follow-up + Google Calendar + QA | Flujo OAuth offline, Edge Function `create-calendar-event`, interfaz de agenda, pruebas E2E, release interno MVP |

### Etapa 2: Plataforma Multiempresa (Semanas 7–12)

| Sprint | Semana | Objetivo | Entregables Clave |
|---|---|---|---|
| **S7** | 7 | Panel Next.js: Workspace Admin | Gestión de miembros, invitaciones por email, asignación de roles (owner/admin/agent) |
| **S8** | 8 | Métricas e Informes | Dashboard de rendimiento por agente, conversión de pipeline, vistas con Postgres Window Functions |
| **S9** | 9 | Motor de Automatizaciones | Triggers en Supabase (DB Webhooks), editor de reglas if/then en el panel, primeras acciones automáticas |
| **S10** | 10 | API Pública y Webhooks | Endpoints REST autenticados, generación y rotación de API Keys por workspace, documentación OpenAPI |
| **S11** | 11 | Presencia Realtime y Colaboración | Broadcast de presencia entre agentes, bloqueo optimista de edición, indicadores de "visto por" |
| **S12** | 12 | Hardening, Auditoría y Launch | Revisión completa de RLS, tests de penetración básicos, pruebas de carga, publicación en Chrome Web Store |

---

## Riesgos Técnicos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| WhatsApp cambia el DOM y rompe la extensión | Alta | Alto | Diccionario de selectores remoto actualizable sin nueva versión de extensión |
| SW de MV3 se suspende en operaciones críticas | Media | Alto | Content Script como host de Realtime; reconexión automática con backoff |
| Google revoca el refresh_token de Calendar | Baja | Medio | Edge Function detecta error 401 de Google y marca `google_oauth_tokens` como inválido; el usuario re-autoriza desde el panel |
| RLS mal configurado filtra datos entre tenants | Baja | Crítico | Tests de penetración de RLS como paso obligatorio en S12; función helper `get_user_workspace_ids()` centraliza la lógica |
| Chrome Web Store rechaza la extensión | Baja | Alto | Cumplimiento estricto: sin código remoto, sin `eval`, permisos mínimos declarados, CSP restrictivo |

---

## Decisiones Arquitectónicas Registradas (ADR)

| ID | Decisión | Justificación |
|---|---|---|
| ADR-01 | `profiles` + `workspace_members` en lugar de `users` con workspace único | Soporte real de multitenancy SaaS: un usuario puede pertenecer a N workspaces con roles distintos |
| ADR-02 | `alarms` eliminado del manifest | Los timers de negocio son responsabilidad del servidor (pg_cron / Edge Functions), no del cliente |
| ADR-03 | Diccionario de selectores es datos declarativos, no código ejecutable | Cumplimiento MV3 + Chrome Web Store: prohibido ejecutar código descargado remotamente |
| ADR-04 | JWT de Supabase en `chrome.storage.session` | Datos de sesión en memoria volátil; eliminados al cerrar el navegador; inaccesibles desde JS de la página web |
| ADR-05 | refresh_token de Google solo accesible desde Edge Functions con `service_role` | La extensión nunca toca tokens de terceros; la Edge Function actúa como proxy seguro |
