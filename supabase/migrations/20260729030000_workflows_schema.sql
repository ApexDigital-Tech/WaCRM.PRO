-- ============================================================
-- SPRINT 6: Motor de Automatizaciones & Flujos (v8.3.0)
-- Creación de las tablas workflows y workflow_steps con políticas RLS.
-- ============================================================

-- 1. Crear tabla workflows
CREATE TABLE IF NOT EXISTS public.workflows (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    is_active      BOOLEAN NOT NULL DEFAULT false,
    trigger_type    TEXT NOT NULL CHECK (trigger_type IN ('keyword', 'welcome')),
    keywords        TEXT[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workflows IS
  'Cabecera de flujos de trabajo de automatización de respuestas rápidas.';

-- 2. Crear tabla workflow_steps
CREATE TABLE IF NOT EXISTS public.workflow_steps (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id    UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    step_order      INTEGER NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('message', 'delay', 'tag_add')),
    delay_seconds   INTEGER NOT NULL DEFAULT 0,
    message_content TEXT,
    tag_id          UUID REFERENCES public.tags(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workflow_steps IS
  'Pasos secuenciales que componen un flujo de trabajo de automatización.';

-- 3. Habilitar RLS en ambas tablas
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para workflows
CREATE POLICY "workflows: workspace members can select" ON public.workflows
    FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "workflows: workspace members can insert" ON public.workflows
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
        AND public.user_role_in_workspace(workspace_id) IN ('owner', 'admin', 'agent')
    );

CREATE POLICY "workflows: workspace members can update" ON public.workflows
    FOR UPDATE USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
        AND public.user_role_in_workspace(workspace_id) IN ('owner', 'admin', 'agent')
    );

CREATE POLICY "workflows: workspace members can delete" ON public.workflows
    FOR DELETE USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
        AND public.user_role_in_workspace(workspace_id) IN ('owner', 'admin', 'agent')
    );

-- 5. Políticas RLS para workflow_steps
CREATE POLICY "workflow_steps: workspace members can select" ON public.workflow_steps
    FOR SELECT USING (
        workflow_id IN (SELECT id FROM public.workflows WHERE workspace_id IN (SELECT public.get_user_workspace_ids()))
    );

CREATE POLICY "workflow_steps: workspace members can insert" ON public.workflow_steps
    FOR INSERT WITH CHECK (
        workflow_id IN (SELECT id FROM public.workflows WHERE public.user_role_in_workspace(workspace_id) IN ('owner', 'admin', 'agent'))
    );

CREATE POLICY "workflow_steps: workspace members can update" ON public.workflow_steps
    FOR UPDATE USING (
        workflow_id IN (SELECT id FROM public.workflows WHERE public.user_role_in_workspace(workspace_id) IN ('owner', 'admin', 'agent'))
    );

CREATE POLICY "workflow_steps: workspace members can delete" ON public.workflow_steps
    FOR DELETE USING (
        workflow_id IN (SELECT id FROM public.workflows WHERE public.user_role_in_workspace(workspace_id) IN ('owner', 'admin', 'agent'))
    );

-- 6. Políticas de Bypass para Entorno de Desarrollo (Dev Workspace)
CREATE POLICY "workflows: dev bypass select" ON public.workflows
    FOR SELECT USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "workflows: dev bypass insert" ON public.workflows
    FOR INSERT WITH CHECK (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "workflows: dev bypass update" ON public.workflows
    FOR UPDATE USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "workflows: dev bypass delete" ON public.workflows
    FOR DELETE USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- workflow_steps dev bypass
CREATE POLICY "workflow_steps: dev bypass select" ON public.workflow_steps
    FOR SELECT USING (workflow_id IN (SELECT id FROM public.workflows WHERE workspace_id = '00000000-0000-0000-0000-000000000001'::uuid));

CREATE POLICY "workflow_steps: dev bypass insert" ON public.workflow_steps
    FOR INSERT WITH CHECK (workflow_id IN (SELECT id FROM public.workflows WHERE workspace_id = '00000000-0000-0000-0000-000000000001'::uuid));

CREATE POLICY "workflow_steps: dev bypass update" ON public.workflow_steps
    FOR UPDATE USING (workflow_id IN (SELECT id FROM public.workflows WHERE workspace_id = '00000000-0000-0000-0000-000000000001'::uuid));

CREATE POLICY "workflow_steps: dev bypass delete" ON public.workflow_steps
    FOR DELETE USING (workflow_id IN (SELECT id FROM public.workflows WHERE workspace_id = '00000000-0000-0000-0000-000000000001'::uuid));
