-- ============================================================
-- SPRINT 4: Políticas de Bypass RLS para Desarrollo (WA-CRM)
-- Permite SELECT, INSERT, UPDATE para el workspace_id
-- ficticio de simulación local ('00000000-0000-0000-0000-000000000001').
-- ============================================================

-- 1. contacts
CREATE POLICY "contacts: dev bypass select" ON public.contacts
    FOR SELECT USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "contacts: dev bypass insert" ON public.contacts
    FOR INSERT WITH CHECK (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "contacts: dev bypass update" ON public.contacts
    FOR UPDATE USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- 2. deals
CREATE POLICY "deals: dev bypass select" ON public.deals
    FOR SELECT USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "deals: dev bypass insert" ON public.deals
    FOR INSERT WITH CHECK (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "deals: dev bypass update" ON public.deals
    FOR UPDATE USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- 3. pipeline_stages
CREATE POLICY "pipeline_stages: dev bypass select" ON public.pipeline_stages
    FOR SELECT USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "pipeline_stages: dev bypass insert" ON public.pipeline_stages
    FOR INSERT WITH CHECK (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "pipeline_stages: dev bypass update" ON public.pipeline_stages
    FOR UPDATE USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- 4. notes
CREATE POLICY "notes: dev bypass select" ON public.notes
    FOR SELECT USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "notes: dev bypass insert" ON public.notes
    FOR INSERT WITH CHECK (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "notes: dev bypass update" ON public.notes
    FOR UPDATE USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);
