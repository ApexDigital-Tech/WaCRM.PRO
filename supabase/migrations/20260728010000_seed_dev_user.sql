-- ============================================================
-- SPRINT 4: Crear Usuario Dev (apexdigital70@gmail.com), Workspace y Pipeline
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
  v_workspace_id UUID;
BEGIN
  -- 1. Crear usuario en auth.users si no existe
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'apexdigital70@gmail.com') THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'apexdigital70@gmail.com',
      crypt('Apex#2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Apex Digital Admin"}',
      now(),
      now(),
      '', '', '', ''
    );
  ELSE
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'apexdigital70@gmail.com';

    -- Actualizar contraseña
    UPDATE auth.users
    SET encrypted_password = crypt('Apex#2026', gen_salt('bf')),
        email_confirmed_at = now(),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- 2. Asegurar registro en public.profiles
  INSERT INTO public.profiles (id, full_name)
  VALUES (v_user_id, 'Apex Digital Admin')
  ON CONFLICT (id) DO UPDATE SET full_name = 'Apex Digital Admin';

  -- 3. Crear workspace de dev para Apex Digital
  SELECT id INTO v_workspace_id FROM public.workspaces WHERE slug = 'apex-digital-dev';

  IF v_workspace_id IS NULL THEN
    v_workspace_id := gen_random_uuid();
    INSERT INTO public.workspaces (id, name, slug, plan)
    VALUES (v_workspace_id, 'Apex Digital Dev Workspace', 'apex-digital-dev', 'pro');
  END IF;

  -- 4. Asociar usuario al workspace como owner
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';

  -- 5. Crear las 5 etapas del pipeline Kanban para este workspace
  DELETE FROM public.pipeline_stages WHERE workspace_id = v_workspace_id;

  INSERT INTO public.pipeline_stages (workspace_id, name, position, color) VALUES
    (v_workspace_id, 'Lead', 0, '#3b82f6'),
    (v_workspace_id, 'Contactado', 1, '#8b5cf6'),
    (v_workspace_id, 'Propuesta', 2, '#f59e0b'),
    (v_workspace_id, 'Ganado', 3, '#10b981'),
    (v_workspace_id, 'Perdido', 4, '#ef4444');

  RAISE NOTICE 'Usuario registrado exitosamente: % con workspace: %', v_user_id, v_workspace_id;
END $$;
