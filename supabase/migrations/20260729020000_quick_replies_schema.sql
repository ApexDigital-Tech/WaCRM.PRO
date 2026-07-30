-- ============================================================
-- SPRINT 5: Módulo de Respuestas Rápidas & Seguridad (v8.2.0)
-- Creación de la tabla quick_replies y políticas RLS asociadas.
-- ============================================================

-- 1. Crear tabla quick_replies
CREATE TABLE IF NOT EXISTS public.quick_replies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    shortcut        TEXT NOT NULL,
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT quick_replies_shortcut_workspace_unique UNIQUE (workspace_id, shortcut)
);

COMMENT ON TABLE public.quick_replies IS
  'Plantillas de respuestas rápidas creadas por los agentes de un workspace.';

-- 2. Habilitar RLS
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS
CREATE POLICY "quick_replies: workspace members can select" ON public.quick_replies
    FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "quick_replies: workspace members can insert" ON public.quick_replies
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
        AND public.user_role_in_workspace(workspace_id) IN ('owner', 'admin', 'agent')
    );

CREATE POLICY "quick_replies: workspace members can update" ON public.quick_replies
    FOR UPDATE USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
        AND public.user_role_in_workspace(workspace_id) IN ('owner', 'admin', 'agent')
    );

CREATE POLICY "quick_replies: workspace members can delete" ON public.quick_replies
    FOR DELETE USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
        AND public.user_role_in_workspace(workspace_id) IN ('owner', 'admin', 'agent')
    );

-- 4. Políticas de Bypass para Entorno de Desarrollo (Dev Workspace)
CREATE POLICY "quick_replies: dev bypass select" ON public.quick_replies
    FOR SELECT USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "quick_replies: dev bypass insert" ON public.quick_replies
    FOR INSERT WITH CHECK (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "quick_replies: dev bypass update" ON public.quick_replies
    FOR UPDATE USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "quick_replies: dev bypass delete" ON public.quick_replies
    FOR DELETE USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);
