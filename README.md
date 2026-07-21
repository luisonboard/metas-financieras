# Presupuesto Diario

PWA local-first de finanzas personales. Calcula un Presupuesto Diario (PD) y el Disponible en tiempo real a partir del dinero actual y la fecha del próximo sueldo. Soporta categorías, ingresos extra, metas de ahorro (individuales y conjuntas), gamificación y sincronización opcional con Supabase. Funciona 100 % offline sin cuenta.

Ver [PLAN.md](./PLAN.md) para la especificación completa del producto (modelo de datos, reglas de negocio, fases de implementación).

## Stack

React 18 + TypeScript + Vite · Tailwind CSS · Zustand · Dexie.js (IndexedDB) · vite-plugin-pwa · Framer Motion + canvas-confetti · date-fns · Supabase (Auth, Postgres, Realtime) · Vitest.

## Desarrollo local

Requiere Node 20 (ver `.nvmrc`).

```bash
npm install
cp .env.example .env.local   # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

Sin las variables de Supabase configuradas, la app funciona igual: sincronización y metas conjuntas quedan deshabilitadas, el resto es 100 % funcional en local.

Otros scripts:

```bash
npm run test     # Vitest
npm run lint     # Oxlint
npm run build    # tsc -b && vite build → dist/
npm run preview  # sirve dist/ localmente para probar el build de producción
```

## Supabase

Las migraciones SQL versionadas están en `supabase/migrations/`. Aplicarlas en orden sobre el proyecto de Supabase (SQL Editor o `supabase db push`) antes de habilitar Auth/sync. Sin la migración `0006_profiles.sql` aplicada, los nombres de miembros en metas conjuntas caen al fallback "Alguien".

## Despliegue en Cloudflare Pages

1. En el dashboard de Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** y seleccionar este repositorio de GitHub.
2. Configuración de build:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. Variables de entorno (Settings → Environment variables, en Production y Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Cada push a `main` dispara un deploy a producción; cada Pull Request genera automáticamente un deploy de preview con su propia URL.
5. El proyecto incluye `public/_headers` con cache-control ajustado para `sw.js` y el manifest, necesario para que el banner de actualización de la PWA detecte nuevas versiones correctamente.
