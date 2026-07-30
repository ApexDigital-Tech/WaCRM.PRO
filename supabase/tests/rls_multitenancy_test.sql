-- ============================================================
-- PULSO CRM SaaS — Prueba RLS Multi-tenant v3 (4.3)
-- Ejecutar en: Supabase Studio → SQL Editor
--
-- CAMBIOS VS v2 (fixes acumulados):
--   ✓ Sin BEGIN/ROLLBACK explícito → el editor maneja su propio autocommit
--   ✓ SET ROLE (sin LOCAL) → persiste entre statements del editor
--   ✓ Temp table sin ON COMMIT DROP → sobrevive entre autocommits
--   ✓ T7 con DO block + EXCEPTION → captura error RLS de INSERT
--   ✓ Limpieza explícita con DELETE al final
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- FASE 0: Limpiar restos de ejecuciones anteriores
-- ────────────────────────────────────────────────────────────

DELETE FROM public.contacts
WHERE workspace_id IN (
    'aaaaaaaa-0001-0001-0001-000000000001',
    'bbbbbbbb-0002-0002-0002-000000000002'
);
DELETE FROM public.workspace_members
WHERE workspace_id IN (
    'aaaaaaaa-0001-0001-0001-000000000001',
    'bbbbbbbb-0002-0002-0002-000000000002'
);
DELETE FROM public.workspaces
WHERE id IN (
    'aaaaaaaa-0001-0001-0001-000000000001',
    'bbbbbbbb-0002-0002-0002-000000000002'
);
DELETE FROM public.profiles
WHERE id IN (
    '11111111-aaaa-aaaa-aaaa-000000000001',
    '22222222-bbbb-bbbb-bbbb-000000000002'
);
DELETE FROM auth.users
WHERE id IN (
    '11111111-aaaa-aaaa-aaaa-000000000001',
    '22222222-bbbb-bbbb-bbbb-000000000002'
);

-- ────────────────────────────────────────────────────────────
-- FASE 1: Insertar datos de prueba (como postgres / sin RLS)
-- ────────────────────────────────────────────────────────────

INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
    (
        '11111111-aaaa-aaaa-aaaa-000000000001',
        'test-a@pulsocrm.test',
        crypt('TestPass123!', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{}', 'authenticated', 'authenticated'
    ),
    (
        '22222222-bbbb-bbbb-bbbb-000000000002',
        'test-b@pulsocrm.test',
        crypt('TestPass123!', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{}', 'authenticated', 'authenticated'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name) VALUES
    ('11111111-aaaa-aaaa-aaaa-000000000001', 'Test User A'),
    ('22222222-bbbb-bbbb-bbbb-000000000002', 'Test User B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspaces (id, name, slug, plan) VALUES
    ('aaaaaaaa-0001-0001-0001-000000000001', 'Workspace Alpha', 'ws-alpha-rls-test', 'pro'),
    ('bbbbbbbb-0002-0002-0002-000000000002', 'Workspace Beta',  'ws-beta-rls-test',  'free')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
    ('aaaaaaaa-0001-0001-0001-000000000001', '11111111-aaaa-aaaa-aaaa-000000000001', 'owner'),
    ('bbbbbbbb-0002-0002-0002-000000000002', '22222222-bbbb-bbbb-bbbb-000000000002', 'owner')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO public.contacts (id, workspace_id, phone_number, name) VALUES
    ('c0000001-0000-0000-0000-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', '+1-555-A001', 'Alpha Contacto 1'),
    ('c0000002-0000-0000-0000-000000000002', 'aaaaaaaa-0001-0001-0001-000000000001', '+1-555-A002', 'Alpha Contacto 2'),
    ('c0000003-0000-0000-0000-000000000003', 'bbbbbbbb-0002-0002-0002-000000000002', '+1-555-B001', 'Beta Contacto 1'),
    ('c0000004-0000-0000-0000-000000000004', 'bbbbbbbb-0002-0002-0002-000000000002', '+1-555-B002', 'Beta Contacto 2')
ON CONFLICT (workspace_id, phone_number) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- FASE 2: Tabla de resultados
-- Sin ON COMMIT DROP → sobrevive entre los autocommits del editor
-- ────────────────────────────────────────────────────────────

CREATE TEMP TABLE IF NOT EXISTS rls_test_results (
    test     TEXT,
    expected INTEGER,
    actual   INTEGER
);

TRUNCATE rls_test_results;

-- El rol authenticated necesita permisos sobre esta tabla de sesión
GRANT INSERT, SELECT ON rls_test_results TO authenticated;

-- ────────────────────────────────────────────────────────────
-- FASE 3: Tests como USUARIO A
-- SET ROLE (sin LOCAL) persiste entre statements del editor
-- ────────────────────────────────────────────────────────────

SET ROLE authenticated;
SET "request.jwt.claims" = '{"sub":"11111111-aaaa-aaaa-aaaa-000000000001","role":"authenticated","aud":"authenticated"}';

-- T1: User A ve sus propios contactos en Workspace Alpha → esperado: 2
INSERT INTO rls_test_results
SELECT 'T1 — User A lee Workspace Alpha (propio)', 2,
    COUNT(*)::INTEGER FROM public.contacts
    WHERE workspace_id = 'aaaaaaaa-0001-0001-0001-000000000001';

-- T2: User A NO ve contactos en Workspace Beta → esperado: 0
INSERT INTO rls_test_results
SELECT 'T2 — User A lee Workspace Beta (ajeno)', 0,
    COUNT(*)::INTEGER FROM public.contacts
    WHERE workspace_id = 'bbbbbbbb-0002-0002-0002-000000000002';

-- T3: User A NO ve workspace_members de Workspace Beta → esperado: 0
INSERT INTO rls_test_results
SELECT 'T3 — User A lee members de Workspace Beta', 0,
    COUNT(*)::INTEGER FROM public.workspace_members
    WHERE workspace_id = 'bbbbbbbb-0002-0002-0002-000000000002';

-- ────────────────────────────────────────────────────────────
-- FASE 4: Tests como USUARIO B
-- (solo cambiamos jwt.claims, el ROLE sigue siendo authenticated)
-- ────────────────────────────────────────────────────────────

SET "request.jwt.claims" = '{"sub":"22222222-bbbb-bbbb-bbbb-000000000002","role":"authenticated","aud":"authenticated"}';

-- T4: User B ve sus propios contactos en Workspace Beta → esperado: 2
INSERT INTO rls_test_results
SELECT 'T4 — User B lee Workspace Beta (propio)', 2,
    COUNT(*)::INTEGER FROM public.contacts
    WHERE workspace_id = 'bbbbbbbb-0002-0002-0002-000000000002';

-- T5: User B NO ve contactos en Workspace Alpha → esperado: 0
INSERT INTO rls_test_results
SELECT 'T5 — User B lee Workspace Alpha (ajeno)', 0,
    COUNT(*)::INTEGER FROM public.contacts
    WHERE workspace_id = 'aaaaaaaa-0001-0001-0001-000000000001';

-- T6: User B NO ve workspace_members de Workspace Alpha → esperado: 0
INSERT INTO rls_test_results
SELECT 'T6 — User B lee members de Workspace Alpha', 0,
    COUNT(*)::INTEGER FROM public.workspace_members
    WHERE workspace_id = 'aaaaaaaa-0001-0001-0001-000000000001';

-- ────────────────────────────────────────────────────────────
-- FASE 5: Test de bloqueo INSERT cruzado (como Usuario A)
-- RLS WITH CHECK lanza ERROR en INSERT → necesita EXCEPTION handler
-- ────────────────────────────────────────────────────────────

SET "request.jwt.claims" = '{"sub":"11111111-aaaa-aaaa-aaaa-000000000001","role":"authenticated","aud":"authenticated"}';

-- El DO block hereda el ROLE=authenticated de la sesión
-- BEGIN/EXCEPTION crea un savepoint implícito → la sesión sobrevive al error
DO $$
BEGIN
    -- Intento de insertar un contacto en Workspace Beta siendo Usuario A
    INSERT INTO public.contacts (workspace_id, phone_number, name)
    VALUES (
        'bbbbbbbb-0002-0002-0002-000000000002',
        '+1-555-INTRUSO',
        'Intruso de A'
    );
EXCEPTION
    -- RLS lanza: "new row violates row-level security policy for table contacts"
    WHEN OTHERS THEN NULL;  -- capturamos → sesión continúa
END;
$$;

-- Volver a postgres para verificar si el INSERT intruso persistió
RESET ROLE;
RESET "request.jwt.claims";

-- T7: verificar que el contacto intruso NO existe (esperado=1, actual=1 si fue bloqueado)
INSERT INTO rls_test_results
SELECT
    'T7 — INSERT cruzado User A→Workspace Beta bloqueado',
    1,
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM public.contacts
            WHERE workspace_id = 'bbbbbbbb-0002-0002-0002-000000000002'
              AND phone_number  = '+1-555-INTRUSO'
        ) THEN 1   -- no existe → fue bloqueado correctamente ✅
        ELSE 0     -- existe → RLS falló ❌
    END;

-- ────────────────────────────────────────────────────────────
-- FASE 6: RESULTADOS — panel Results del SQL Editor
-- ────────────────────────────────────────────────────────────

SELECT
    test                                            AS "Test",
    expected                                        AS "Esperado",
    actual                                          AS "Obtenido",
    CASE
        WHEN actual = expected THEN '✅ PASADO'
        ELSE '❌ FALLIDO'
    END                                             AS "Estado"
FROM rls_test_results
ORDER BY test;

-- ────────────────────────────────────────────────────────────
-- FASE 7: LIMPIEZA — eliminar todos los datos de prueba
-- Ejecutar DESPUÉS de revisar los resultados
-- (El SQL Editor mostrará el resultado del SELECT de arriba,
--  no de estos DELETE — ya que DELETE no retorna filas)
-- ────────────────────────────────────────────────────────────

DELETE FROM public.contacts
WHERE workspace_id IN (
    'aaaaaaaa-0001-0001-0001-000000000001',
    'bbbbbbbb-0002-0002-0002-000000000002'
);
DELETE FROM public.workspace_members
WHERE workspace_id IN (
    'aaaaaaaa-0001-0001-0001-000000000001',
    'bbbbbbbb-0002-0002-0002-000000000002'
);
DELETE FROM public.workspaces
WHERE id IN (
    'aaaaaaaa-0001-0001-0001-000000000001',
    'bbbbbbbb-0002-0002-0002-000000000002'
);
DELETE FROM public.profiles
WHERE id IN (
    '11111111-aaaa-aaaa-aaaa-000000000001',
    '22222222-bbbb-bbbb-bbbb-000000000002'
);
DELETE FROM auth.users
WHERE id IN (
    '11111111-aaaa-aaaa-aaaa-000000000001',
    '22222222-bbbb-bbbb-bbbb-000000000002'
);
