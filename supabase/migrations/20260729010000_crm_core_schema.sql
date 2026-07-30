-- ============================================================
-- SPRINT 4: Módulo CRM Core & Pipeline Kanban (v8.1.0)
-- Reestructuración para soportar múltiples pipelines.
-- Renombrado de labels a tags.
-- ============================================================

-- 1. Crear tabla pipelines
CREATE TABLE IF NOT EXISTS public.pipelines (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Crear pipelines por defecto para workspaces existentes
INSERT INTO public.pipelines (workspace_id, name, is_default)
SELECT DISTINCT workspace_id, 'Pipeline Principal', true
FROM public.pipeline_stages
ON CONFLICT DO NOTHING;

-- 3. Modificar pipeline_stages
-- Eliminar políticas que dependen de la columna workspace_id antes de eliminarla
DROP POLICY IF EXISTS "pipeline_stages: members can select" ON public.pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages: admin/owner can insert" ON public.pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages: admin/owner can update" ON public.pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages: admin/owner can delete" ON public.pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages: dev bypass select" ON public.pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages: dev bypass insert" ON public.pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages: dev bypass update" ON public.pipeline_stages;

ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE;

-- Asociar stages con su respectivo pipeline creado
UPDATE public.pipeline_stages ps
SET pipeline_id = p.id
FROM public.pipelines p
WHERE ps.workspace_id = p.workspace_id;

-- Hacer pipeline_id obligatorio
ALTER TABLE public.pipeline_stages ALTER COLUMN pipeline_id SET NOT NULL;

-- Eliminar workspace_id de pipeline_stages (relacionado vía pipeline)
ALTER TABLE public.pipeline_stages DROP COLUMN IF EXISTS workspace_id;

-- Renombrar position a order_index
ALTER TABLE public.pipeline_stages RENAME COLUMN position TO order_index;

-- 4. Modificar deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost'));

-- 5. Modificar notes
ALTER TABLE public.notes RENAME COLUMN author_id TO created_by;

-- 6. Renombrar labels y contact_labels a tags y contact_tags
ALTER TABLE public.labels RENAME TO tags;
ALTER TABLE public.contact_labels RENAME TO contact_tags;
ALTER TABLE public.contact_tags RENAME COLUMN label_id TO tag_id;

-- 7. RLS y políticas para pipelines
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipelines: workspace members can select" ON public.pipelines
    FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "pipelines: admin/owner can insert" ON public.pipelines
    FOR INSERT WITH CHECK (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "pipelines: admin/owner can update" ON public.pipelines
    FOR UPDATE USING (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "pipelines: admin/owner can delete" ON public.pipelines
    FOR DELETE USING (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

-- Recrear políticas de pipeline_stages
DROP POLICY IF EXISTS "pipeline_stages: members can select" ON public.pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages: admin/owner can insert" ON public.pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages: admin/owner can update" ON public.pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages: admin/owner can delete" ON public.pipeline_stages;

CREATE POLICY "pipeline_stages: members can select" ON public.pipeline_stages
    FOR SELECT USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE workspace_id IN (SELECT public.get_user_workspace_ids())));

CREATE POLICY "pipeline_stages: admin/owner can insert" ON public.pipeline_stages
    FOR INSERT WITH CHECK (pipeline_id IN (SELECT id FROM public.pipelines WHERE public.user_role_in_workspace(workspace_id) IN ('owner', 'admin')));

CREATE POLICY "pipeline_stages: admin/owner can update" ON public.pipeline_stages
    FOR UPDATE USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE public.user_role_in_workspace(workspace_id) IN ('owner', 'admin')));

CREATE POLICY "pipeline_stages: admin/owner can delete" ON public.pipeline_stages
    FOR DELETE USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE public.user_role_in_workspace(workspace_id) IN ('owner', 'admin')));

-- Recrear políticas para tags y contact_tags
DROP POLICY IF EXISTS "labels: members can select" ON public.tags;
DROP POLICY IF EXISTS "labels: admin/owner can insert" ON public.tags;
DROP POLICY IF EXISTS "labels: admin/owner can update" ON public.tags;
DROP POLICY IF EXISTS "labels: admin/owner can delete" ON public.tags;

DROP POLICY IF EXISTS "contact_labels: members can select" ON public.contact_tags;
DROP POLICY IF EXISTS "contact_labels: members can insert" ON public.contact_tags;
DROP POLICY IF EXISTS "contact_labels: members can delete" ON public.contact_tags;

CREATE POLICY "tags: members can select" ON public.tags
    FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "tags: admin/owner can insert" ON public.tags
    FOR INSERT WITH CHECK (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "tags: admin/owner can update" ON public.tags
    FOR UPDATE USING (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "tags: admin/owner can delete" ON public.tags
    FOR DELETE USING (public.user_role_in_workspace(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "contact_tags: members can select" ON public.contact_tags
    FOR SELECT USING (contact_id IN (SELECT id FROM public.contacts WHERE workspace_id IN (SELECT public.get_user_workspace_ids())));

CREATE POLICY "contact_tags: members can insert" ON public.contact_tags
    FOR INSERT WITH CHECK (contact_id IN (SELECT id FROM public.contacts WHERE workspace_id IN (SELECT public.get_user_workspace_ids())));

CREATE POLICY "contact_tags: members can delete" ON public.contact_tags
    FOR DELETE USING (contact_id IN (SELECT id FROM public.contacts WHERE workspace_id IN (SELECT public.get_user_workspace_ids())));

-- 8. Políticas de Bypass de Desarrollo para la simulación
CREATE POLICY "pipelines: dev bypass select" ON public.pipelines FOR SELECT USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY "pipelines: dev bypass insert" ON public.pipelines FOR INSERT WITH CHECK (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY "pipelines: dev bypass update" ON public.pipelines FOR UPDATE USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "pipeline_stages: dev bypass select" ON public.pipeline_stages FOR SELECT USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE workspace_id = '00000000-0000-0000-0000-000000000001'::uuid));
CREATE POLICY "pipeline_stages: dev bypass insert" ON public.pipeline_stages FOR INSERT WITH CHECK (pipeline_id IN (SELECT id FROM public.pipelines WHERE workspace_id = '00000000-0000-0000-0000-000000000001'::uuid));
CREATE POLICY "pipeline_stages: dev bypass update" ON public.pipeline_stages FOR UPDATE USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE workspace_id = '00000000-0000-0000-0000-000000000001'::uuid));

CREATE POLICY "tags: dev bypass select" ON public.tags FOR SELECT USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY "tags: dev bypass insert" ON public.tags FOR INSERT WITH CHECK (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY "tags: dev bypass update" ON public.tags FOR UPDATE USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "contact_tags: dev bypass select" ON public.contact_tags FOR SELECT USING (contact_id IN (SELECT id FROM public.contacts WHERE workspace_id = '00000000-0000-0000-0000-000000000001'::uuid));
CREATE POLICY "contact_tags: dev bypass insert" ON public.contact_tags FOR INSERT WITH CHECK (contact_id IN (SELECT id FROM public.contacts WHERE workspace_id = '00000000-0000-0000-0000-000000000001'::uuid));
CREATE POLICY "contact_tags: dev bypass delete" ON public.contact_tags FOR DELETE USING (contact_id IN (SELECT id FROM public.contacts WHERE workspace_id = '00000000-0000-0000-0000-000000000001'::uuid));

-- 9. Datos Semilla para Desarrollo (Bypass)
-- Asegurar que el workspace de prueba exista antes de asociarle el pipeline de prueba (FKEY constraint)
INSERT INTO public.workspaces (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Workspace de Prueba Dev', 'workspace-prueba-dev', 'free')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pipelines (id, workspace_id, name, is_default)
VALUES ('00000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Pipeline de Prueba', true)
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.pipeline_stages WHERE pipeline_id = '00000000-0000-0000-0000-000000000002'::uuid;

INSERT INTO public.pipeline_stages (pipeline_id, name, order_index, color)
VALUES
    ('00000000-0000-0000-0000-000000000002'::uuid, 'Lead', 0, '#3b82f6'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'Contactado', 1, '#8b5cf6'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'Propuesta', 2, '#f59e0b'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'Ganado', 3, '#10b981'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'Perdido', 4, '#ef4444');
