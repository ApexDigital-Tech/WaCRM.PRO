-- ============================================================
-- PULSO CRM SaaS — Esquema SQL Sprint 3: Motor Anti-fragilidad DOM
-- Tabla dom_selector_configs + RLS + Datos Semilla
-- ============================================================

DROP TABLE IF EXISTS public.dom_selector_configs CASCADE;

CREATE TABLE public.dom_selector_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform        TEXT NOT NULL DEFAULT 'whatsapp_web',
    selector_key    TEXT NOT NULL,
    selector_value  TEXT NOT NULL,
    fallback_value  TEXT,
    version         TEXT NOT NULL DEFAULT '1.0',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(platform, selector_key, version)
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.dom_selector_configs ENABLE ROW LEVEL SECURITY;

-- 1. Lectura pública global para usuarios autenticados
CREATE POLICY "Permitir lectura global a usuarios autenticados"
    ON public.dom_selector_configs
    FOR SELECT
    TO authenticated
    USING (true);

-- 2. Escritura (INSERT/UPDATE/DELETE) restringida a service_role
CREATE POLICY "Escritura restringida a service_role"
    ON public.dom_selector_configs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_dom_selector_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dom_selector_configs_updated_at
    BEFORE UPDATE ON public.dom_selector_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_dom_selector_configs_updated_at();

-- ────────────────────────────────────────────────────────────
-- DATOS SEMILLA — Selectores de WhatsApp Web v1.0
-- ────────────────────────────────────────────────────────────

INSERT INTO public.dom_selector_configs (platform, selector_key, selector_value, fallback_value, version, is_active)
VALUES
    ('whatsapp_web', 'chat_header', '#main header, div[role="region"] header', 'header', '1.0', true),
    ('whatsapp_web', 'chat_title', '#main header div[role="button"] span[title], #main header span[dir="auto"]', '#main header [title]', '1.0', true),
    ('whatsapp_web', 'chat_avatar', '#main header img[src*="whatsapp"]', '#main header img', '1.0', true),
    ('whatsapp_web', 'chat_phone_or_jid', '#main header div[data-jid]', '#main header [title]', '1.0', true)
ON CONFLICT (platform, selector_key, version) 
DO UPDATE SET 
    selector_value = EXCLUDED.selector_value,
    fallback_value = EXCLUDED.fallback_value,
    is_active = EXCLUDED.is_active,
    updated_at = now();
