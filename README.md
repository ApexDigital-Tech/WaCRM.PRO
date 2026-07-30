# PULSO CRM 8.0.0 — Monorepo

CRM colaborativo para WhatsApp Web. Stack: **Next.js + Supabase + Chrome MV3**.

## Estructura

```
pulso-crm/
├── apps/
│   ├── extension/          # Chrome Extension MV3 (Vite + React)
│   └── web/                # Panel de Administración (Next.js App Router)
├── packages/
│   └── types/              # Tipos TypeScript compartidos (@pulso/types)
├── supabase/
│   ├── migrations/         # Migraciones SQL versionadas
│   └── functions/          # Edge Functions (Sprint 5+)
├── turbo.json
├── package.json
└── tsconfig.base.json
```

## Prerrequisitos

- Node.js >= 20.0.0
- npm >= 10.0.0
- [Supabase CLI](https://supabase.com/docs/guides/cli)

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno de la extensión
cp apps/extension/.env.example apps/extension/.env.local
# Editar .env.local con las credenciales de Supabase

# 3. Aplicar migración inicial en Supabase
supabase db push

# 4. Desarrollo (todos los paquetes en paralelo)
npm run dev
```

## Decisiones Arquitectónicas

Ver [`implementation_plan.md`](../implementation_plan.md) — especialmente los ADRs.

| ADR | Decisión |
|---|---|
| ADR-01 | `profiles` + `workspace_members` para multitenancy real |
| ADR-02 | `alarms` eliminado — timers en el servidor |
| ADR-03 | Selectores DOM declarativos, validados con Zod |
| ADR-04 | JWT en `chrome.storage.session`, gestionado por SW |
| ADR-05 | `refresh_token` de Google cifrado con `pgsodium/vault` |
| ADR-06 | CS nunca accede a `chrome.storage.session` directamente |
| ADR-07 | Fetch REST → SW como proxy; WebSocket Realtime → CS directo |
| ADR-08 | `host_permissions` apunta al PROJECT_REF específico |
