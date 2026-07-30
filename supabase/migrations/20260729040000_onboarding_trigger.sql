-- ============================================================
-- Migración: Trigger de Onboarding para Nuevos Usuarios
-- Descripción: Crea Profile y Workspace automáticamente
-- ============================================================

-- 1. Crear la función del trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_workspace_name TEXT;
  v_workspace_slug TEXT;
  v_full_name TEXT;
BEGIN
  -- Extraer nombre del metadata o usar la parte local del email
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1));
  
  -- 1. Crear Profile
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    v_full_name,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- 2. Definir datos del Workspace
  -- El nombre por defecto será "Empresa de [Nombre]"
  v_workspace_name := 'Empresa de ' || v_full_name;
  
  -- El slug debe ser único, usamos la parte local del email + sufijo aleatorio corto
  v_workspace_slug := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-zA-Z0-9]', '', 'g')) || '-' || SUBSTRING(NEW.id::text FROM 1 FOR 4);

  -- 3. Crear Workspace (Por defecto plan 'free')
  INSERT INTO public.workspaces (name, slug, plan)
  VALUES (v_workspace_name, v_workspace_slug, 'free')
  RETURNING id INTO v_workspace_id;

  -- 4. Asignar al usuario como 'owner' del nuevo Workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'owner');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- En caso de error, loggear pero no interrumpir la creación en auth.users si no es estrictamente necesario
  RAISE LOG 'Error en handle_new_user trigger: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. Asociar el trigger a auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
