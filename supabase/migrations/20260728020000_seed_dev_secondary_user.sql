-- ============================================================
-- Seed / Vinculación de Usuarios Dev al Workspace Apex Digital
-- Workspace ID: 6f5b7bed-5ac1-43de-8711-203948bad048
-- ============================================================
-- UIDs extraídos de Supabase Studio Auth:
-- User 1 (Owner): ecotraffic.bo@gmail.com   -> fcafea25-e829-461c-b3c0-3a061e94a0f7
-- User 2 (Agent): rolangutiali.rg@gmail.com -> 904498d7-c7be-4066-9561-50fd56501b3b
-- Nota: Según ADR-01, la columna 'role' vive en workspace_members, no en profiles.
-- ============================================================

DO $$
DECLARE
  v_workspace_id UUID := '6f5b7bed-5ac1-43de-8711-203948bad048';
  v_user_1_id UUID := 'fcafea25-e829-461c-b3c0-3a061e94a0f7'; -- ecotraffic.bo@gmail.com
  v_user_2_id UUID := '904498d7-c7be-4066-9561-50fd56501b3b'; -- rolangutiali.rg@gmail.com
BEGIN
  -- 1. Perfil y membresía para Usuario 1 (Owner / Admin)
  INSERT INTO public.profiles (id, full_name)
  VALUES (v_user_1_id, 'Ecotraffic Admin')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_1_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- 2. Perfil y membresía para Usuario 2 (Agent)
  INSERT INTO public.profiles (id, full_name)
  VALUES (v_user_2_id, 'Rolando Agent Dev')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_2_id, 'agent')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RAISE NOTICE '✅ Ambos usuarios vinculados exitosamente al workspace %', v_workspace_id;
END $$;
