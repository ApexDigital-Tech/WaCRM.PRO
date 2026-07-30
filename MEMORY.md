# MEMORY.md — WA-CRM SaaS
**Última actualización:** 2026-07-29 | **Sesión:** af273183-6ea0-44f0-b833-539f45ecc86e

> [!IMPORTANT]
> Leer este archivo COMPLETO al inicio de cada sesión antes de escribir cualquier línea de código.

---

## 1. Contexto del Proyecto

### ¿Qué es esto?
**WA-CRM SaaS v8.0.0** — Reconstrucción completa de una extensión Chrome (v7.4.3.47) hacia una plataforma SaaS moderna.

| Item | Valor |
|---|---|
| **Stack** | Next.js (App Router) + Supabase (Auth/Postgres/Realtime/Edge Functions) + Chrome MV3 |
| **Build tool (extensión)** | Vite + React + TypeScript |
| **Monorepo** | Turborepo |
| **Tipado compartido** | `@pulso/types` |
| **Versión del plan** | **v0.3** (validada y aprobada) |
| **Sprint activo** | **Sprint 1** — Infraestructura y Auth |

### Repositorios
| Proyecto | Ruta |
|---|---|
| Extensión antigua (referencia) | `c:\Files ECOTRAFFIC\PROYECTOS 2026\PULSO CRM 7.4.3.47\` |
| **Proyecto nuevo (activo)** | `c:\Files ECOTRAFFIC\PROYECTOS 2026\PULSO CRM 8.0.0\` |
| Plan arquitectónico | `C:\Users\Rolando\.gemini\antigravity-ide\brain\246d9add-4214-4916-8d9e-ff89d6e8a188\implementation_plan.md` |

---

## 2. Estado del Monorepo

### Estructura creada (Sprint 1 — en curso)

```
PULSO CRM 8.0.0/
├── apps/
│   ├── extension/                          ✅ Scaffolding completo
│   │   ├── src/
│   │   │   ├── background/
│   │   │   │   └── serviceWorker.ts        ✅ Broker de sesión implementado
│   │   │   └── content/
│   │   │       ├── index.tsx               ✅ Entry point (bootstrap)
│   │   │       ├── session.ts              ✅ Módulo de sesión CS (sin storage directo)
│   │   │       └── whatsapp-dom.service.ts ✅ Abstracción DOM + Zod + fallback
│   │   ├── manifest.json                   ✅ MV3 definitivo (con __SUPABASE_REF__)
│   │   ├── vite.config.ts                  ✅ Multi-entry (SW, CS, Popup)
│   │   ├── package.json                    ✅
│   │   └── .env.example                    ✅ Template de variables
│   └── web/
│       └── package.json                    ✅ Scaffold base Next.js
├── packages/
│   └── types/
│       ├── src/index.ts                    ✅ Tipos compartidos completos
│       ├── package.json                    ✅
│       └── tsconfig.json                   ✅
├── supabase/
│   └── migrations/
│       └── 20260727000000_initial_schema.sql  ⚠️  Placeholder — pegar SQL del plan v0.3
├── .gitignore                              ✅
├── README.md                               ✅
├── package.json                            ✅ (workspaces configurados)
├── tsconfig.base.json                      ✅
└── turbo.json                              ✅
```

### Estado del Sprint 1
- [x] **Crear proyecto en Supabase**: Proyecto activo `wqtqifqigtbajohgndlg`
- [x] **Aplicar migración SQL v0.3**: `20260727000000_initial_schema.sql` ejecutada en Supabase SQL Editor (13/13 tablas confirmadas live)
- [x] **Variables de entorno**: `apps/extension/.env.local` y `apps/web/.env.local` (solo `anon key`, sin `service_role`)
- [x] **Tipos TypeScript**: `packages/types/src/database.types.ts` generado e integrado en `@pulso/types`
- [x] **Monorepo Build**: `npm run build` compilando 3/3 paquetes (`@pulso/types`, `@pulso/extension`, `@pulso/web`)
- [x] **Prueba RLS Multi-tenant con Auth real (4.3)**: ✅ VERIFICADO 2026-07-27 — 7/7 tests pasados. Script: `supabase/tests/rls_multitenancy_test.sql`. Aislamiento SELECT confirmado (A↔B bloqueado). INSERT cruzado bloqueado por WITH CHECK.
- [x] **Auditoría de Vault/Secretos (4.4)**: 0 secretos expuestos en cliente; `google_oauth_tokens` protegido con Vault

> [!IMPORTANT]
> **Sprint 1 — ✅ COMPLETADO** (2026-07-27). Todos los criterios de aceptación verificados.
> Próximo: **Sprint 2** — Extensión base: Shadow DOM, ciclo de vida SW, reconexión.


---

## 3. Decisiones Arquitectónicas Registradas (ADRs) — v0.3 FINAL

> [!CAUTION]
> Estos ADRs son NORMATIVOS. No se pueden revertir sin discusión explícita y actualización de este archivo.

| ADR | Decisión | Consecuencia práctica |
|---|---|---|
| **ADR-01** | `profiles` + `workspace_members` (no `users` monolítico) | Un usuario puede pertenecer a N workspaces con roles distintos |
| **ADR-02** | Permiso `alarms` ELIMINADO del manifest | Timers de negocio viven en Supabase (pg_cron / Edge Functions) |
| **ADR-03** | Selectores DOM = datos declarativos validados con Zod | `SelectorDictionarySchema` en `whatsapp-dom.service.ts`. Sin código remoto ejecutable. Fallback empaquetado en el build |
| **ADR-04** | JWT de Supabase en `chrome.storage.session`, gestionado SOLO por el SW | SW es el único que llama `chrome.storage.session.get/set/remove` |
| **ADR-05** | `refresh_token` de Google cifrado con `pgsodium/vault` — OBLIGATORIO | Columna `vault_secret_id UUID`, no `refresh_token TEXT`. Acceso solo desde Edge Functions con `service_role` |
| **ADR-06** | Content Script NUNCA accede a `chrome.storage.session` directamente | CS usa `session.ts` → `chrome.runtime.sendMessage({action:'GET_ACCESS_TOKEN'})` → SW responde |
| **ADR-07** | Fetch REST a Supabase: enrutado por SW. WebSocket Realtime: directo desde CS | CS independiente del CSP de WhatsApp para REST. Excepción documentada para Realtime |
| **ADR-08** | `host_permissions` apunta al PROJECT_REF específico, no wildcard `*.supabase.co` | Se configura con `VITE_SUPABASE_REF` en CI/CD. Mínima superficie de ataque |
| **ADR-09** | Renombrado oficial de PULSO CRM a WA-CRM | Reemplazo total de la marca PULSO por WA-CRM en código, manifiestos, estilos, variables y eventos. |
| **ADR-10** | Reestructuración de Pipelines y Renombrado a Tags (v8.1.0) | Relación de `pipeline_stages` a través de `pipeline_id` (en vez de `workspace_id`). Soporte multi-moneda/estados en `deals`. Renombrado de labels/contact_labels a tags/contact_tags. |

---

## 4. Reglas de Diseño SaaS y Seguridad — Nunca Violar

```
1. TODA tabla en Postgres debe tener RLS habilitado.
2. TODA query de cliente debe filtrar por workspace_id.
3. El refresh_token de Google NUNCA aparece en texto plano en ninguna tabla.
4. La extensión NUNCA ejecuta código descargado remotamente (solo datos/configuración).
5. El Content Script NUNCA lee chrome.storage.session directamente.
6. Las API Keys, tokens de acceso (SUPABASE_ACCESS_TOKEN) y secretos del sistema NUNCA se incluyen en el bundle de la extensión ni se comparten por el chat.
7. Cualquier necesidad de autenticación CLI se resuelve mediante login interactivo local (`npx supabase login`) por parte del propietario.
8. El permiso `scripting` NO está en el manifest — prohibido.
9. `externally_connectable` NO existe en el manifest — prohibido.
10. NINGUNA contraseña, token, ni credencial de ningún tipo se comparte en el chat de desarrollo, bajo ninguna circunstancia (ni para cuentas dev/test). Toda gestión de contraseñas se realiza exclusivamente mediante (a) flujos nativos de Supabase Auth (resetPasswordForEmail / inviteUserByEmail), o (b) acción manual directa del propietario del proyecto en el Dashboard de Supabase.
```

---

## 5. Plan de Implementación v0.3 — Resumen Ejecutivo

### Etapa 1: MVP Operativo (Sprints 1–6)

| Sprint | Semana | Estado | Objetivo |
|---|---|---|---|
| **S1** | 1 | ✅ COMPLETADO | Infraestructura, Auth, SQL v0.3, RLS multi-tenant verificado (7/7 tests) |
| **S2** | 2 | ✅ COMPLETADO | Extensión base: Shadow DOM closed (✅), Watchdog SW (✅), Reconexión Realtime (✅) y build IIFE autosuficiente |
| **S3** | 3 | ✅ COMPLETADO | Motor anti-fragilidad DOM: `dom_selector_configs` (✅), `WhatsAppDomService` (✅), degradado seguro (✅) y estado vacío (✅) |
| **S4** | 4 | ✅ COMPLETADO | CRM Core: Auto-sincro contactos (✅), Pipeline Kanban (✅), CRUD de Notas con Optimistic UI (v8.1.0) |
| **S5** | 5 | ⏳ Pendiente | Respuestas Rápidas, Tags en UI |
| **S6** | 6 | ⏳ Pendiente | Follow-up + Google Calendar OAuth + QA + Release MVP |

### Etapa 2: Plataforma Multiempresa (Sprints 7–12)

| Sprint | Objetivo |
|---|---|
| **S7** | Panel Next.js: gestión de workspaces, miembros, roles |
| **S8** | Métricas e informes (Dashboard) |
| **S9** | Motor de automatizaciones (triggers + acciones) |
| **S10** | Webhooks y API Pública con API Keys por workspace |
| **S11** | Presencia Realtime (Broadcast) y colaboración entre agentes |
| **S12** | Hardening, auditoría RLS, pruebas de carga, publicación Chrome Web Store |

---

## 6. Arquitectura Técnica Clave

### Flujo de Sesión (ADR-04, ADR-06)

```
Login (Popup)
  └─→ Supabase SDK retorna { access_token, refresh_token }
  └─→ Popup envía SET_SESSION al SW
  └─→ SW guarda en chrome.storage.session

Content Script necesita token:
  └─→ CS llama getAccessToken() de session.ts
  └─→ session.ts → sendMessage({ action: 'GET_ACCESS_TOKEN' })
  └─→ SW verifica expiración → renueva si es necesario
  └─→ SW responde con access_token fresco

Revocación (3 casos):
  A. Expiración natural: CS recibe 401 → notifica SW → SW limpia → SESSION_REVOKED
  B. Revocación remota: SW falla en refresh → limpia storage → SESSION_REVOKED broadcast
  C. Sign out activo: CS/Popup → supabase.signOut() → SW limpia → SESSION_REVOKED broadcast
```

### Clasificación de Operaciones CS vs. Edge Functions

**CS puede hacer DIRECTAMENTE a Supabase REST:**
- CRUD de contactos, notas, deals, etiquetas, contact_labels, quick_replies
- Lectura de pipeline_stages, dom_selector_configs (activo)
- Suscripciones Realtime (Postgres Changes + Broadcast) en canal `workspace:{id}`

**DEBE pasar por Edge Function (nunca el CS):**
- Crear evento en Google Calendar (`POST /calendar-event`)
- Invitar miembro al workspace (`POST /invite-member`)
- Generar/rotar API Key (`POST /rotate-api-key`)
- Ejecutar automatizaciones (`POST /run-automation`)
- Validar licencia/suscripción (`GET /validate-license`)
- Crear/gestionar webhooks (`POST /webhook`)
- Cualquier operación que requiera `service_role`

### Realtime: Broadcast vs Postgres Changes

| | Postgres Changes | Broadcast |
|---|---|---|
| **Uso** | Estado persistente (leads, notas, deals) | Efímero (presencia, bloqueos) |
| **RLS** | Respeta RLS por workspace_id | Canal namespaced por workspace_id |
| **Receptor** | Content Script | Content Script |

---

## 7. Schema de Base de Datos — Tablas y Relaciones

```
auth.users (Supabase managed)
    └── profiles (1:1)
            └── workspace_members (N:M con workspaces)
                    └── workspaces
                            ├── contacts ──── contact_labels ──── labels
                            │       └── deals ──── pipeline_stages
                            │       └── notes
                            │       └── follow_ups
                            ├── quick_replies
                            ├── dom_selector_configs  (solo lectura desde cliente)
                            └── google_oauth_tokens   (BLOQUEADO para cliente, solo EF)
```

### RLS: Función Helper Central

```sql
-- Usada en TODAS las políticas de aislamiento por workspace
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid();
$$;
```

---

## 8. Archivos Clave a Conocer

| Archivo | Propósito |
|---|---|
| [`packages/types/src/index.ts`](file:///c:/Files%20ECOTRAFFIC/PROYECTOS%202026/PULSO%20CRM%208.0.0/packages/types/src/index.ts) | Tipos compartidos: entidades DB, mensajes SW↔CS, eventos Realtime, contratos Edge Functions |
| [`apps/extension/src/background/serviceWorker.ts`](file:///c:/Files%20ECOTRAFFIC/PROYECTOS%202026/PULSO%20CRM%208.0.0/apps/extension/src/background/serviceWorker.ts) | Broker de sesión — ÚNICO que toca chrome.storage.session |
| [`apps/extension/src/content/session.ts`](file:///c:/Files%20ECOTRAFFIC/PROYECTOS%202026/PULSO%20CRM%208.0.0/apps/extension/src/content/session.ts) | API de sesión del CS — caché en memoria, solicita al SW |
| [`apps/extension/src/content/whatsapp-dom.service.ts`](file:///c:/Files%20ECOTRAFFIC/PROYECTOS%202026/PULSO%20CRM%208.0.0/apps/extension/src/content/whatsapp-dom.service.ts) | Abstracción DOM: Zod schema, fallback, MutationObserver |
| [`apps/extension/src/content/index.tsx`](file:///c:/Files%20ECOTRAFFIC/PROYECTOS%202026/PULSO%20CRM%208.0.0/apps/extension/src/content/index.tsx) | Entry point del CS: bootstrap, carga selectores, monta Shadow DOM |
| [`apps/extension/manifest.json`](file:///c:/Files%20ECOTRAFFIC/PROYECTOS%202026/PULSO%20CRM%208.0.0/apps/extension/manifest.json) | Manifest MV3 con `__SUPABASE_REF__` (reemplazar en build) |
| [`apps/extension/vite.config.ts`](file:///c:/Files%20ECOTRAFFIC/PROYECTOS%202026/PULSO%20CRM%208.0.0/apps/extension/vite.config.ts) | Config multi-entry con validación de ENV obligatoria |

---

## 9. Primera Acción en la Próxima Sesión

> [!IMPORTANT]
> El Sprint 1 tiene una tarea pendiente de confirmación humana:
> Ejecutar `supabase/tests/rls_multitenancy_test.sql` en Supabase Studio y reportar resultados.
> Si todos los tests muestran ✅, marcar Sprint 1 como ✅ COMPLETADO y avanzar al Sprint 2.

---

## 10. Cómo Ejecutar la Prueba RLS (4.3) — Instrucciones

### Paso a paso

1. Ir a [Supabase Studio](https://supabase.com/dashboard/project/wqtqifqigtbajohgndlg) → **SQL Editor**
2. Abrir el archivo [`supabase/tests/rls_multitenancy_test.sql`](file:///c:/Files%20ECOTRAFFIC/PROYECTOS%202026/PULSO%20CRM%208.0.0/supabase/tests/rls_multitenancy_test.sql)
3. Copiar TODO el contenido y pegarlo en el SQL Editor
4. Hacer clic en **Run** (o `Ctrl+Enter`)
5. Revisar los mensajes en el panel **Messages** / **Notices**

### Resultado esperado (6 tests ✅)

```
✅ TEST 4.1 PASADO: Usuario A ve 2 contacto(s) en su Workspace A (esperado: 2)
✅ TEST 4.2 PASADO: Usuario A ve 0 contacto(s) del Workspace B (esperado: 0 — aislamiento OK)
✅ TEST 4.3 PASADO: Usuario B ve 2 contacto(s) en su Workspace B (esperado: 2)
✅ TEST 4.4 PASADO: Usuario B ve 0 contacto(s) del Workspace A (esperado: 0 — aislamiento OK)
✅ TEST 4.5 PASADO: Usuario A ve 0 miembro(s) de Workspace B (esperado: 0 — aislamiento OK)
✅ TEST 4.6 PASADO: INSERT cruzado de Usuario A en Workspace B bloqueado por RLS
══════ PULSO CRM — Prueba RLS Multi-tenant completada ══════
```

### ¿Qué hacer después?

| Resultado | Acción |
|---|---|
| Todos ✅ | Actualizar MEMORY.md: marcar RLS como `[x]` y Sprint 1 como `✅ COMPLETADO`. Avanzar a Sprint 2. |
| Algún ❌ | Reportar el mensaje de error exacto. Analizaré la política RLS afectada y generaré un patch SQL. |

---

## 11. Riesgos Conocidos

| Riesgo | Probabilidad | Mitigación implementada |
|---|---|---|
| WhatsApp cambia el DOM | Alta | `dom_selector_configs` en Supabase actualizable sin nueva versión de extensión |
| SW se suspende en MV3 | Media | CS como host de Realtime; reconexión automática con `onDisconnect` + backoff |
| CSP de WhatsApp bloquea WebSocket | Baja | Si ocurre: mover Realtime a Offscreen Document (path alternativo documentado en ADR-07) |
| RLS mal configurado | Baja | Tests de penetración de RLS obligatorios en Sprint 12; función helper centralizada |
| Chrome Web Store rechaza por código remoto | Baja | Selectores son datos declarativos, no código. Sin `eval`, sin Blob de JS externo |

---

## 12. Cierre de Sesión — Estado del Sprint 4 y Ruta Pendiente (2026-07-28)

### A. Resumen de Avances Logrados en la Sesión

1. **Sprint 3 — Cierre Formal Auditado:**
   - Cierre del Sprint 3 con la matriz de evidencia al 100% (6/6 checkpoints con capturas reales verificadas en WhatsApp Web y DevTools).
   - Componentes `dom_selector_configs` (SQL), `WhatsAppDomService`, `<ActiveContactCard />` y estado de resiliencia probados y consolidados.

2. **Sprint 4 — Implementación Técnica:**
   - **`ContactService` (`apps/extension/src/content/services/contact-service.ts`):** Normalización de teléfonos en formato E.164 canónico (`+591...`) y aplicación de la regla de prevalencia (el nombre guardado en el CRM prevalece sobre WhatsApp Web).
   - **`DealService` (`apps/extension/src/content/services/deal-service.ts`):** Carga dinámica de etapas del pipeline (`public.pipeline_stages`) y auto-creación del primer trato (`deal`) en la etapa inicial ("Lead") para contactos nuevos.
   - **Componente `<PipelineSelector />` & UI:** Renderizado interactivo de píldoras Kanban con colores distintivos por etapa, badge `🟢 Sincronizado CRM` y actualización optimista de estado.
   - **Service Worker (`serviceWorker.ts`):** Guardado automático del `workspace_context` (`workspace_id` y rol) al autenticarse.
   - **SQL Seeding Script (`20260728010000_seed_dev_user.sql`):** Creación del usuario dev `apexdigital70@gmail.com` en `Apex Digital Dev Workspace` (`6f5b7bed-5ac1-43de-8711-203948bad048`) con las 5 etapas del pipeline.
4. **Revisión Formal de Autenticación y Seguridad (2026-07-28):**
   - **Recuperación de Contraseña Autogestionada & Invitaciones:** ✅ VERIFICADO con capturas reales. Página web de recuperación/establecimiento de contraseña en [`apps/web/app/reset-password/page.tsx`](file:///c:/Files%20ECOTRAFFIC%2FPROYECTOS%202026%2FPULSO%20CRM%208.0.0%2Fapps%2Fweb%2Fapp%2Freset-password%2Fpage.tsx).
   - **Regla 10 de Seguridad Reforzada:** Cero contraseñas o tokens compartidos en el chat.
   - **Usuarios de Prueba Registrados:** 
     - `ecotraffic.bo@gmail.com` (`fcafea25-e829-461c-b3c0-3a061e94a0f7`) — Rol `owner`
     - `rolangutiali.rg@gmail.com` (`904498d7-c7be-4066-9561-50fd56501b3b`) — Rol `agent`

---

## 5. Auditoría Forense y Estado del Módulo de Selección de Contactos (Sesión 2026-07-28 / 2026-07-29)

### A. Diagnóstico Forense de la Causa Raíz
- **Síntoma Reportado:** Al hacer clic en cualquier chat (contactos guardados como *Don Alex Luna*, *Sebastian Gutierrez*, *Miky Primo*, o no guardados como *+591 71408123* y grupos como *PROMO 89*), la consola registraba repetidamente:
  `[PULSO DOM_SERVICE] Chat Activo actualizador: status=NO_ACTIVE_CHAT, nombre="...", jid=N/A (fuente=LOCAL_FALLBACK)`
- **Causa Raíz Identificada:**
  1. En `dom-service.ts` (línea 481) y en `mainWorldBridge.ts`, la búsqueda por regex en el HTML del sidebar (`#pane-side [role="listitem"]`) usaba expresiones holgadas como `html.match(/(\d{10,18}@g\.us)/)` o `html.includes('@g.us')`.
  2. En WhatsApp Web, los contenedores del sidebar incluyen fragmentos SVG e iconos internos cuyos atributos contienen identificadores numéricos tipo timestamp seguidos de `@g.us` (ej. `id="icon_1785265073647@g.us"`).
  3. Esto provocaba un **falso positivo masivo de grupo** (`isGroup = true`) para el 100% de las conversaciones de la lista.
  4. `evaluateDom()` ejecutaba inmediatamente `this.updateState({ status: 'NO_ACTIVE_CHAT', name: contactName })`, bloqueando la extracción de JID/teléfono y cancelando la sincronización CRM para todos los contactos.

### B. Archivos Modificados y Correcciones de Código
1. **[`apps/extension/src/content/mainWorldBridge.ts`](file:///c:/Files%20ECOTRAFFIC/PROYECTOS%202026/PULSO%20CRM%208.0.0/apps/extension/src/content/mainWorldBridge.ts):**
   - Eliminada la verificación global `html.includes('@g.us')`.
   - Implementado escaneo iterativo sobre atributos `data-id` de `#main` validando `parts[1].endsWith('@g.us')` para grupos y `/^\d{7,15}$/` para usuarios 1 a 1.
   - Compilado nativamente en Manifest V3 como `dist/content/mainWorldBridge.js` bajo `"world": "MAIN"`.

2. **[`apps/extension/src/content/dom-service.ts`](file:///c:/Files%20ECOTRAFFIC/PROYECTOS%202026/PULSO%20CRM%208.0.0/apps/extension/src/content/dom-service.ts):**
   - Incorporadas expresiones regulares de coincidencia estricta de JID:
     - `GROUP_JID_REGEX = /^(\d{10,18}|\d{7,15}-\d{10})@g\.us$/`
     - `USER_JID_REGEX = /^(\d{7,15})@(c\.us|s\.whatsapp\.net)$/`
   - Reemplazada la coincidencia de regex holgada en el escaneo del sidebar por `GROUP_JID_REGEX` y `USER_JID_REGEX`.
   - Refactorizada la búsqueda en el árbol React Fiber (`searchReactTree`) para ignorar cadenas de texto pertenecientes a SVGs o clases CSS.

3. **Recompilación del Paquete `@pulso/extension`:**
   - Ejecutado `npm run build --workspace=@pulso/extension`.
   - Archivos de salida generados limpiamente:
     - `dist/content/mainWorldBridge.js` (2.21 kB)
     - `dist/content/index.js` (405.59 kB)

### C. Lecciones Técnicas Extraídas de `Pulso_CRM 7.0.0`
- La versión legada 7.0.0 se basaba en la comunicación bidireccional por eventos `window.postMessage` (`model: "WPP"` y `action: ...`) delegando llamadas a módulos `v_7_4_3_47_...js` y escuchando eventos `chat.update_label`.
- Sirve como especificación funcional de negocio para los módulos de webhooks, automatizaciones y etiquetas del Sprint 5.

---

## 6. Protocolo Estricto e Inflexible para el Inicio de la Próxima Sesión

Al retomar el desarrollo, el agente DEBE ejecutar rigurosamente el siguiente plan de prueba de 5 pasos antes de realizar cualquier reporte o solicitar pruebas adicionales:

1. **Reinicio de Entorno:**
   - Recargar la extensión en `chrome://extensions` y refrescar la pestaña de WhatsApp Web (`F5`).
2. **Evaluación de Consola en Vivo (5 Casos de Prueba):**
   - **Caso 1 (Contacto Guardado con Nombre):** Abrir *Don Alex Luna*, *Sebastian Gutierrez* o *Rolando Gutiérrez A.* -> Confirmar `status: ACTIVE` y `jid: 591XXXXXXXX@c.us`.
   - **Caso 2 (Teléfono No Guardado):** Abrir *+591 71408123* o *+591 78756107* -> Confirmar `status: ACTIVE` y `jid: 59171408123@c.us`.
   - **Caso 3 (Grupo de WhatsApp):** Abrir *PROMO 89* o *Los 3 Loleros* -> Confirmar `status: NO_ACTIVE_CHAT` con `degradedReason: 'Los grupos no son contactos individuales de CRM.'`.
   - **Caso 4 (Chat con Adjuntos/Llamadas):** Abrir *Miky Primo* -> Confirmar `status: ACTIVE`.
   - **Caso 5 (Chat Vacío / Fallo de DOM):** Confirmar que si no se halla JID tras 2 retries (500ms), degrada obligatoriamente a `SELECTOR_DEGRADED` mostrando el banner amarillo de advertencia y el botón `🔄 Reintentar detección`.
3. **Validación de Evidencia:** Presentar el informe de consola verificado con las 5 pruebas superadas antes de proseguir con las evidencias restantes del Sprint 4/5.

---

### B. Ruta Pendiente para la Próxima Sesión

1. **Finalizar Evidencia Pendiente del Sprint 4:**
   - **Checkpoint 4:** Captura de Supabase Studio (`public.deals`) confirmando el cambio de `stage_id` al presionar una nueva etapa en el Kanban.
   - **Checkpoint 5:** Prueba Multi-agente en tiempo real abriendo dos navegadores/sesiones con dos usuarios autenticados distintos del mismo workspace.
   - **Checkpoint 6:** Captura de pantalla del log de error controlado al presionar `[ ⚠️ Error Upsert (DoD 6) ]`.
   - Declarar el **Sprint 4 — ✅ COMPLETADO FORMALMENTE**.

2. **Inicio del Sprint 5 (Notas, Etiquetas y Respuestas Rápidas):**
   - Creación de `NoteService` para almacenar e historializar notas asociadas al contacto en `public.notes`.
   - Creación de `LabelService` para asociar etiquetas de color (`public.labels` y `public.contact_labels`).
   - Módulo de Respuestas Rápidas (`public.quick_replies`) con inserción de plantillas en el chat.


