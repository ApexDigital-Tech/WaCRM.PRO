-- ============================================================
-- PULSO CRM SaaS — Esquema SQL v0.3
-- Correcciones: cifrado obligatorio + RLS completo
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgsodium";   -- Cifrado simétrico nativo de Supabase (Vault opera sobre el esquema vault nativo)

-- ────────────────────────────────────────────────────────────
-- CAPA 1: Identidad y Membresía
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workspaces (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workspace_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'admin', 'agent')),
    invited_by      UUID REFERENCES public.profiles(id),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

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
    google_event_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- CAPA 3: Configuración y Anti-fragilidad
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.dom_selector_configs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version         TEXT NOT NULL UNIQUE,
    selectors       JSONB NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT false,
    released_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- CORRECCIÓN 4 OBLIGATORIA: Cifrado de refresh_token con Vault
-- El refresh_token de Google NUNCA se almacena en texto plano.
-- Se guarda el UUID de la entrada en vault.secrets, no el secreto mismo.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.google_oauth_tokens (
    user_id             UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    workspace_id        UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    vault_secret_id     UUID NOT NULL,  -- referencia a vault.secrets, NO el token en texto plano
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.google_oauth_tokens.vault_secret_id IS
  'UUID del secreto almacenado en vault.secrets vía pgsodium.
   El refresh_token real NUNCA aparece en esta tabla ni en logs de Postgres.
   Acceso exclusivo desde Edge Functions con service_role usando vault.decrypted_secrets.';

-- ────────────────────────────────────────────────────────────
-- HABILITAR RLS — TODAS LAS TABLAS
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
-- FUNCIÓN HELPER — Evita sub-queries repetidas en cada política
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_role_in_workspace(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.workspace_members
  WHERE user_id = auth.uid() AND workspace_id = p_workspace_id
  LIMIT 1;
$$;

-- ────────────────────────────────────────────────────────────
-- CORRECCIÓN 5: POLÍTICAS RLS COMPLETAS — TODAS LAS TABLAS
-- ────────────────────────────────────────────────────────────

-- ── profiles ─────────────────────────────────────────────────
CREATE POLICY "profiles: owner full access"
    ON public.profiles FOR ALL
    USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ── workspaces ───────────────────────────────────────────────
CREATE POLICY "workspaces: members can select"
    ON public.workspaces FOR SELECT
    USING (id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "workspaces: owner can update"
    ON public.workspaces FOR UPDATE
    USING (public.user_role_in_workspace(id) = 'owner')
    WITH CHECK (public.user_role_in_workspace(id) = 'owner');

-- ── workspace_members ────────────────────────────────────────
CREATE POLICY "workspace_members: members can select"
    ON public.workspace_members FOR SELECT
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "workspace_members: admin/owner can insert"
    ON public.workspace_members FOR INSERT
    WITH CHECK (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "workspace_members: admin/owner can update role"
    ON public.workspace_members FOR UPDATE
    USING (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "workspace_members: admin/owner can delete"
    ON public.workspace_members FOR DELETE
    USING (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

-- ── contacts ─────────────────────────────────────────────────
CREATE POLICY "contacts: workspace members can select"
    ON public.contacts FOR SELECT
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "contacts: workspace members can insert"
    ON public.contacts FOR INSERT
    WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "contacts: workspace members can update"
    ON public.contacts FOR UPDATE
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "contacts: admin/owner can delete"
    ON public.contacts FOR DELETE
    USING (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

-- ── pipeline_stages ──────────────────────────────────────────
CREATE POLICY "pipeline_stages: members can select"
    ON public.pipeline_stages FOR SELECT
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "pipeline_stages: admin/owner can insert"
    ON public.pipeline_stages FOR INSERT
    WITH CHECK (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "pipeline_stages: admin/owner can update"
    ON public.pipeline_stages FOR UPDATE
    USING (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "pipeline_stages: admin/owner can delete"
    ON public.pipeline_stages FOR DELETE
    USING (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

-- ── deals ────────────────────────────────────────────────────
CREATE POLICY "deals: workspace members can select"
    ON public.deals FOR SELECT
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "deals: workspace members can insert"
    ON public.deals FOR INSERT
    WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "deals: workspace members can update"
    ON public.deals FOR UPDATE
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "deals: admin/owner can delete"
    ON public.deals FOR DELETE
    USING (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

-- ── notes ────────────────────────────────────────────────────
CREATE POLICY "notes: workspace members can select"
    ON public.notes FOR SELECT
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "notes: workspace members can insert"
    ON public.notes FOR INSERT
    WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "notes: author or admin can update"
    ON public.notes FOR UPDATE
    USING (
        author_id = auth.uid()
        OR public.user_role_in_workspace(workspace_id) IN ('owner', 'admin')
    );

CREATE POLICY "notes: author or admin can delete"
    ON public.notes FOR DELETE
    USING (
        author_id = auth.uid()
        OR public.user_role_in_workspace(workspace_id) IN ('owner', 'admin')
    );

-- ── labels ───────────────────────────────────────────────────
CREATE POLICY "labels: members can select"
    ON public.labels FOR SELECT
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "labels: admin/owner can insert"
    ON public.labels FOR INSERT
    WITH CHECK (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "labels: admin/owner can update"
    ON public.labels FOR UPDATE
    USING (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "labels: admin/owner can delete"
    ON public.labels FOR DELETE
    USING (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

-- ── contact_labels ───────────────────────────────────────────
CREATE POLICY "contact_labels: members can select"
    ON public.contact_labels FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.contacts c
            WHERE c.id = contact_id
            AND c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "contact_labels: members can insert"
    ON public.contact_labels FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.contacts c
            WHERE c.id = contact_id
            AND c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "contact_labels: members can delete"
    ON public.contact_labels FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.contacts c
            WHERE c.id = contact_id
            AND c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

-- ── quick_replies ────────────────────────────────────────────
CREATE POLICY "quick_replies: members can select"
    ON public.quick_replies FOR SELECT
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "quick_replies: members can insert"
    ON public.quick_replies FOR INSERT
    WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "quick_replies: author or admin can update"
    ON public.quick_replies FOR UPDATE
    USING (
        created_by = auth.uid()
        OR public.user_role_in_workspace(workspace_id) IN ('owner', 'admin')
    );

CREATE POLICY "quick_replies: author or admin can delete"
    ON public.quick_replies FOR DELETE
    USING (
        created_by = auth.uid()
        OR public.user_role_in_workspace(workspace_id) IN ('owner', 'admin')
    );

-- ── follow_ups ───────────────────────────────────────────────
CREATE POLICY "follow_ups: members can select"
    ON public.follow_ups FOR SELECT
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "follow_ups: members can insert"
    ON public.follow_ups FOR INSERT
    WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "follow_ups: assigned agent or admin can update"
    ON public.follow_ups FOR UPDATE
    USING (
        assigned_to = auth.uid()
        OR public.user_role_in_workspace(workspace_id) IN ('owner', 'admin')
    );

CREATE POLICY "follow_ups: admin/owner can delete"
    ON public.follow_ups FOR DELETE
    USING (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

-- ── dom_selector_configs ─────────────────────────────────────
CREATE POLICY "dom_selectors: authenticated read active only"
    ON public.dom_selector_configs FOR SELECT
    TO authenticated
    USING (is_active = true);

-- ────────────────────────────────────────────────────────────
-- ÍNDICES DE RENDIMIENTO
-- ────────────────────────────────────────────────────────────

CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX idx_contacts_workspace ON public.contacts(workspace_id);
CREATE INDEX idx_contacts_phone ON public.contacts(workspace_id, phone_number);
CREATE INDEX idx_deals_workspace ON public.deals(workspace_id);
CREATE INDEX idx_deals_contact ON public.deals(contact_id);
CREATE INDEX idx_deals_stage ON public.deals(stage_id);
CREATE INDEX idx_notes_contact ON public.notes(contact_id);
CREATE INDEX idx_follow_ups_scheduled ON public.follow_ups(workspace_id, scheduled_at) WHERE done = false;
