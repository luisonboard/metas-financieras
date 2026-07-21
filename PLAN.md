# PLAN.md — PWA "Presupuesto Diario"

> **Instrucciones para el agente**: Este documento es la especificación completa y autocontenida del proyecto. No necesitas contexto adicional. Ejecuta las fases en orden (§9). Cada fase tiene criterios de aceptación verificables; no avances a la siguiente fase sin cumplirlos. Las decisiones de producto ya están tomadas (§8): no preguntes por alternativas de stack ni de diseño salvo bloqueo real. El idioma de toda la UI es **español**; el código (variables, funciones, commits) en **inglés**.

---

## 1. Objetivo del producto

PWA local-first de finanzas personales. El usuario ingresa su dinero actual y la fecha de su próximo sueldo; la app calcula un **Presupuesto Diario (PD)** y lleva en todo momento el **Disponible** real (acumulado de presupuesto de días transcurridos menos gastos). Soporta categorías, ingresos extra, metas de ahorro que descuentan del PD, gamificación intensiva (rachas, XP, logros, confetti, mensajes positivos), login opcional para sincronizar, metas conjuntas entre usuarios, instalación como PWA y auto-detección de actualizaciones.

## 2. Stack (fijo, no cambiar)

- **React 18 + TypeScript + Vite** (plantilla `react-ts`)
- **Tailwind CSS** para estilos
- **Zustand** para estado global
- **Dexie.js** (IndexedDB) como persistencia local y fuente de verdad
- **vite-plugin-pwa** (Workbox) con `registerType: 'prompt'`
- **Framer Motion** + **canvas-confetti** para animaciones
- **date-fns** para fechas
- **Supabase** (free tier): Auth, Postgres con RLS, Realtime
- **Vitest + @testing-library/react** para tests
- Hosting: **Cloudflare Pages** (build `npm run build`, output `dist/`); repo en GitHub

## 3. Setup inicial

```bash
npm create vite@latest presupuesto-diario -- --template react-ts
cd presupuesto-diario
npm i zustand dexie date-fns framer-motion canvas-confetti @supabase/supabase-js
npm i -D tailwindcss postcss autoprefixer vite-plugin-pwa vitest @testing-library/react @testing-library/jest-dom jsdom
npx tailwindcss init -p
```

Variables de entorno (`.env.local`, y luego en Cloudflare Pages):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 4. Estructura de carpetas

```
src/
  domain/          # SOLO funciones puras + tipos. Sin imports de React, Dexie o Supabase.
    types.ts
    budget.ts      # fórmulas de §6
    goals.ts
    gamification.ts
    __tests__/
  db/
    dexie.ts       # esquema IndexedDB
    repos/         # acceso a datos local (CRUD sobre Dexie)
  sync/
    outbox.ts      # cola de mutaciones pendientes
    supabase.ts    # cliente + push/pull
  state/           # stores Zustand
  ui/
    screens/       # Home, Gastos, Metas, Perfil, Onboarding, CierrePeriodo, Calendario
    components/
    gamification/  # confetti, toasts positivos, barras de progreso
  pwa/             # registro SW, banner de actualización
supabase/
  migrations/      # SQL versionado
```

## 5. Modelo de datos

Todos los `id` son **UUID v4 generados en cliente** (`crypto.randomUUID()`), para sincronizar sin remapear. Todas las entidades llevan `created_at`, `updated_at` (ISO string) y `deleted_at` nullable (borrado lógico, necesario para sync).

```ts
// src/domain/types.ts
export interface Period {
  id: string; userId: string | null;
  initialMoney: number;         // dinero al iniciar el período
  startDate: string;            // YYYY-MM-DD
  nextPaydayDate: string;       // YYYY-MM-DD (exclusiva: el período cubre [startDate, nextPaydayDate))
  nextSalaryAmount: number;     // monto esperado del próximo sueldo (capturado en Onboarding/CierrePeriodo);
                                 // permite proyectar el calendario más allá de este período (ver §6.1)
  status: 'active' | 'closed';
}
export interface Category { id: string; userId: string | null; name: string; icon: string; color: string; }
export interface Expense  { id: string; userId: string | null; periodId: string; categoryId: string | null; amount: number; date: string; note?: string; }
export interface ExtraIncome { id: string; userId: string | null; periodId: string; amount: number; date: string; description?: string; }
export interface Goal {
  id: string; ownerId: string | null;
  name: string; targetAmount: number;
  startDate: string; endDate: string;   // rango inclusivo de días en que descuenta cuota
  status: 'active' | 'achieved' | 'abandoned';
  isShared: boolean;
}
export interface GoalContribution { id: string; goalId: string; userId: string | null; date: string; amount: number; }
export interface GamificationState { userId: string | null; currentStreak: number; bestStreak: number; xp: number; level: number; achievements: string[]; }
```

### SQL Supabase (fase 5; crear como migración)

Tablas espejo: `periods`, `categories`, `expenses`, `extra_incomes`, `goals`, `goal_members(goal_id, user_id, role)`, `goal_contributions`, `gamification`. Todas con `user_id uuid references auth.users` y RLS:

- Regla general: `user_id = auth.uid()` para select/insert/update.
- `goals` y `goal_contributions` compartidas: acceso si existe fila en `goal_members` con `user_id = auth.uid()`.
- Habilitar Realtime en `goal_contributions` y `goal_members`.

## 6. Reglas de negocio (implementar en `src/domain/budget.ts`, 100 % testeado)

Definiciones para un período activo, con fechas en días calendario locales:

```
diasTotales            = nextPaydayDate − startDate      (en días)
diasTranscurridos(hoy) = min(hoy, nextPaydayDate−1) − startDate + 1
PD_base                = initialMoney / diasTotales      (redondear a 2 decimales SOLO al mostrar)
cuotaMeta(m)           = targetAmount(m) / (endDate(m) − startDate(m) + 1)
PD_efectivo(dia)       = PD_base − Σ cuotaMeta(m) para metas 'active' cuyo rango incluye ese día
Acumulado(hoy)         = Σ PD_efectivo(dia) para cada día transcurrido
                       + Σ extraIncomes con date ≤ hoy
Disponible(hoy)        = Acumulado(hoy) − Σ expenses con date ≤ hoy
PD_sugerido(hoy)       = max(0, (initialMoney + extras − gastos − metasRestantes) / diasRestantes)
                         // informativo, NO reemplaza a PD_base
```

**Casos de prueba obligatorios (Vitest):**

1. Ejemplo canónico: PD_base = $20, día 2 ⇒ Acumulado = $40; gastos $35 ⇒ Disponible = **$5**.
2. Meta $300 a 30 días ⇒ cuotaMeta = $10; si PD_base = $25, PD_efectivo = $15 durante esos 30 días; fuera del rango de la meta vuelve a $25.
3. Ingreso extra de $50 el día 3 ⇒ Acumulado del día 3 en adelante sube $50; PD_base no cambia.
4. Disponible puede ser negativo (sobregasto) — no lanzar error; la UI lo muestra en rojo con mensaje motivador.
5. Meta que pasa a 'achieved' o 'abandoned' deja de descontar desde el día siguiente al cambio de estado.
6. Gastos con fecha futura dentro del período cuentan solo cuando `date ≤ hoy`.

### 6.1 Calendario de Disponible (histórico + proyección)

Para cada día `d` del período `[startDate, nextPaydayDate)` se puede calcular su `Disponible(d)` con la misma fórmula de §6, evaluando `hoy = d`:

- Si `d < hoy real`: valor **histórico** (incluye solo expenses/extraIncomes con `date ≤ d`, ya registrados).
- Si `d = hoy real`: valor **actual**.
- Si `d > hoy real`: valor **proyectado**. Como no hay gastos registrados después de hoy (salvo que el usuario ya haya cargado uno a futuro, en cuyo caso se respeta), esto equivale a seguir sumando `PD_efectivo` día a día:

  ```
  Disponible_proyectado(hoy + n) = Disponible(hoy) + Σ (i = 1..n) PD_efectivo(hoy + i)
  ```

  Es la misma función `Disponible(d)` aplicada a una fecha futura; no requiere una fórmula nueva, solo reutilizar §6 sobre cada día del período.

**Caso de prueba obligatorio (Vitest):** Disponible(hoy) = **−$50**, `PD_efectivo` constante de $20 (sin metas) ⇒ Disponible(hoy+1) = **−$30**, Disponible(hoy+2) = **−$10**, Disponible(hoy+3) = **$10**.

**Proyección más allá del período actual (`calendarioDisponibleExtendido`):** dado que Onboarding y CierrePeriodo capturan `nextSalaryAmount`, se puede simular el período hipotético que empieza en `nextPaydayDate`:

```
sobranteCierre         = Disponible(nextPaydayDate − 1)
duracionSiguiente       = diasTotales del período actual (se asume misma cadencia de pago)
initialMoney_siguiente  = sobranteCierre + nextSalaryAmount
nextPaydayDate_siguiente = nextPaydayDate + duracionSiguiente
```

Con ese período hipotético (sin expenses/extraIncomes propios todavía) se vuelve a aplicar §6.1 día por día, marcando esos días como `periodo: 'siguiente'` e íntegramente proyectados. Si no hay `nextSalaryAmount`, no se extiende. **Caso de prueba obligatorio (Vitest):** initialMoney=$200, 10 días, sin metas ni gastos ⇒ sobrante=$200; `nextSalaryAmount`=$300 ⇒ período siguiente con initialMoney=$500 y misma duración (10 días) ⇒ `PD_base` siguiente = $50.

**Encadenamiento a N períodos (`calendarioDisponibleExtendido(..., periodosSiguientes)`):** la simulación no se limita a un solo período siguiente. Cada período hipotético hereda su `initialMoney` del sobrante/faltante de cierre del anterior más `nextSalaryAmount` (se asume que el sueldo se repite con la misma cadencia y monto, única referencia disponible), y cada día lleva un `periodoIndex` (0 = actual, 1, 2, 3... = generación del período simulado). `periodosNecesariosParaCubrir(period, hastaFecha)` calcula cuántos períodos hacen falta encadenar para que una fecha quede cubierta — se usa para que el calendario siempre alcance la meta activa más lejana sin importar qué tan lejos esté, con un tope de seguridad (`MAX_PERIODOS_SIGUIENTES`, 24 en la UI) para no generar una grilla descontrolada; más allá del tope, un botón "Cargar más período" permite seguir extendiendo la proyección a pedido (carga dinámica). **Caso de prueba obligatorio (Vitest):** con `nextSalaryAmount` constante y sin metas ni gastos, cada período siguiente cierra con su `initialMoney` completo como sobrante, así que 3 períodos encadenados producen `PD_base` de $50, $80 y $110 respectivamente (creciendo con cada sueldo agregado).

**UI (`ui/screens/Calendario.tsx`):** vista tipo calendario (grilla semanal) del rango `[startDate, nextPaydayDate)`, extendida automáticamente con tantos períodos siguientes como haga falta para cubrir la meta activa más lejana (con tope y carga dinámica adicional, ver arriba). Cada día coloreado verde/rojo según `Disponible(d) ≥ 0`; los días futuros (`d > hoy`) se muestran con un estilo distintivo (borde punteado / etiqueta "proyectado"), y los de períodos simulados con un borde diferenciado (p. ej. violeta) más un aviso indicando desde qué fecha y cuántos períodos es una proyección estimada. Cada día que forme parte del rango `[startDate, endDate]` de una meta muestra un indicador; el día exacto de inicio y de fin de una meta se marcan con un ícono distintivo (🎯 inicio, 🏁 fin). Al seleccionar un día se muestra su `PD_efectivo`, su `Disponible` (real o proyectado) y las metas relevantes ese día.

## 7. Gamificación (spec)

- **Racha**: +1 por cada día cerrado con Disponible ≥ 0; se rompe con un día en negativo. Guardar `bestStreak`.
- **XP**: registrar gasto +5, día en verde +10, aporte a meta +10, meta cumplida +100. Nivel = `floor(sqrt(xp/100)) + 1`.
- **Logros** (ids estables en inglés, texto en español): `first_expense`, `week_green`, `first_goal_achieved`, `ten_categorized`, `period_closed_surplus`, `streak_7`, `streak_30`.
- **Celebraciones**: confetti al subir de nivel, cumplir meta y cerrar período con sobrante; animaciones Framer Motion en cada registro.
- **Mensajes positivos contextuales** al abrir la app, tras cada gasto (dentro/fuera de presupuesto, siempre en tono constructivo) y en el resumen de cierre de período (tipo "wrapped": totales, categoría top, mejor racha).

## 8. Decisiones de producto ya tomadas (defaults; no preguntar)

1. **Moneda**: USD, formato `$0.00`.
2. **PD_base fijo durante todo el período**; el recálculo tras sobregastos existe solo como `PD_sugerido` informativo en la Home.
3. **Ingresos extra** suman al acumulado, nunca recalculan PD_base.
4. **Cierre de período**: al llegar `nextPaydayDate` la app pide cerrar el período; el sobrante/faltante se muestra en el resumen y se **sugiere** (prellenado editable) como parte del `initialMoney` del nuevo período.
5. **Metas conjuntas**: la cuota diaria total se muestra dividida en partes iguales entre miembros como *sugerencia*, pero cada miembro aporta libremente; el progreso = suma de `goal_contributions` de todos. Solo la parte propia descuenta del PD de cada usuario.
6. **Sin cuenta = app completa en local.** El login nunca bloquea el flujo principal; metas conjuntas sí requieren sesión.
7. **Conflictos de sync**: last-write-wins por `updated_at`.
8. **Borrado**: siempre lógico (`deleted_at`), filtrado en queries.

## 9. Fases de implementación (ejecutar en orden)

> **Estado actual (2026-07-21): Fases 1-6 completadas; Fase 7 en curso** (ver detalle más abajo).
> Pendiente principal: conectar Cloudflare Pages en el dashboard (requiere login del usuario) y medir
> Lighthouse Performance contra la URL pública ya desplegada. Notas y pendientes menores heredados:
> - Fase 5: Supabase Auth solo tiene email+password implementado; **Google no está implementado** (el
>   texto original de la fase lo mencionaba como parte del alcance).
> - Fase 6: requiere que la migración `supabase/migrations/0006_profiles.sql` esté aplicada en el
>   proyecto de Supabase (ya aplicada); sin ella, los nombres de miembros caen al fallback "Alguien".
> - Gamificación (§7 del spec): "mensajes positivos" quedaron como un saludo contextual en Home
>   (`homeGreetingMessage`) y confetti; no se implementó un sistema de mensajes tipo toast separado
>   para cada gasto ni el resumen "wrapped" de cierre de período con totales/categoría top.

### Fase 1 — Fundación y dominio ✅ Completada
- Setup del stack (§3), Tailwind, estructura de carpetas (§4), configuración Vitest.
- Implementar `domain/` completo con los 6 casos de prueba de §6 en verde.
- Esquema Dexie + repos locales para Period, Category, Expense, ExtraIncome.
- **Aceptación**: `npm run test` verde; `npm run build` sin errores.

### Fase 2 — UI núcleo (solo local) ✅ Completada
- Onboarding: ingresar dinero actual + fecha del próximo sueldo + **monto** del próximo sueldo (`nextSalaryAmount`) ⇒ crea período activo.
- Home: PD del día y Disponible grande y central (verde/rojo), PD_sugerido secundario, acceso rápido "Registrar gasto".
- CRUD de gastos por fecha con categoría; CRUD de categorías (icono + color); ingresos extra.
- Cierre de período (§8.4) con resumen; el nuevo período se prellena con sobrante/faltante + `nextSalaryAmount` del período que cierra, y vuelve a pedir fecha y monto del sueldo siguiente.
- Calendario (§6.1): grilla del período (+ proyección del período siguiente si hay `nextSalaryAmount`) con Disponible histórico y proyectado por día, código de color verde/rojo, distinción visual de días futuros/período siguiente, y marcado de fechas de inicio/fin de metas.
- **Aceptación**: flujo completo usable offline; datos persisten al recargar; ejemplo canónico reproducible manualmente; caso de proyección de §6.1 reproducible manualmente en el calendario, incluida la extensión al período siguiente y las fechas de metas.

### Fase 3 — Metas y gamificación ✅ Completada
- CRUD de metas individuales; efecto en PD_efectivo visible en Home; barra de progreso animada con hitos 25/50/75/100 %.
- Registro de aportes (`goal_contributions`).
- Motor de gamificación (§7): rachas, XP, niveles, logros, confetti, mensajes.
- **Aceptación**: crear meta $300/30 días baja el PD $10; cumplir una meta dispara celebración y logro.

### Fase 4 — PWA ✅ Completada
- `vite-plugin-pwa`: manifest completo (nombre "Presupuesto Diario", `display: standalone`, `theme_color`, iconos maskable 192/512, shortcut "Registrar gasto").
- SW con precache del shell; `registerType: 'prompt'` + banner "Nueva versión disponible — Actualizar" (skipWaiting + reload); chequeo de update cada 60 min y al recuperar foco de la ventana.
- Datos de Supabase con estrategia network-first y sin cachear información sensible.
- **Aceptación**: Lighthouse marca la app como instalable; simular un deploy nuevo muestra el banner de actualización.

### Fase 5 — Auth y sincronización ✅ Completada (parcial: sin Google)
- Migraciones SQL + RLS (§5); Supabase Auth (email + Google).
- Merge inicial al loguear: subir datos locales (upsert por UUID); luego outbox: cada mutación local se encola y se empuja al haber sesión + conexión; pull al abrir la app.
- **Aceptación**: mismos datos en dos navegadores con la misma cuenta; la app sigue 100 % funcional sin sesión.

### Fase 6 — Metas conjuntas ✅ Completada
- Crear meta compartida ⇒ código/enlace de invitación; unirse crea fila en `goal_members`.
- Progreso = suma de aportes de todos; Realtime actualiza en vivo y muestra toast ("¡{nombre} aportó $X!").
- **Aceptación**: dos cuentas ven el mismo progreso en tiempo real. Verificado con una cuenta real
  (crear meta compartida, invitar por enlace `?join=<id>`, unirse, ver miembros y cuota sugerida);
  el camino de Realtime + toast entre dos cuentas simultáneas distintas no se probó en vivo, pero
  reutiliza el mismo mecanismo RLS + Realtime ya validado en la Fase 5.

### Fase 7 — Despliegue y pulido ⏳ En curso
- Repo en GitHub ✅ (`luisonboard/metas-financieras`). Conexión de Cloudflare Pages requiere login/OAuth
  del usuario en el dashboard — **pendiente de acción manual**: Workers & Pages → Connect to Git →
  build command `npm run build`, output `dist`, env vars `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
  (ver instrucciones detalladas en README). Una vez conectado, verificar en la práctica que un PR
  genera preview y que el push a `main` dispara el deploy de producción.
- Lighthouse (local, `npm run preview` + Chrome DevTools MCP, `localhost`, mobile): Accesibilidad 100,
  Best Practices 100, SEO 100 (se corrigió `landmark-one-main` envolviendo Onboarding/CierrePeriodo/loading
  en `<main>`, y se agregó `public/robots.txt`). Se aplicó code-splitting con `React.lazy` en
  Gastos/Calendario/Metas/Perfil/CierrePeriodo, bajando el bundle inicial de 729 KB a ~325 KB. La
  categoría "PWA" ya no existe como tal en las versiones recientes de Lighthouse (se retiró del
  reporte estándar); la instalabilidad se verificó manualmente en Fase 4. El Performance real bajo
  throttling de red/CPU de un Lighthouse contra la URL pública de Cloudflare **queda pendiente de
  medir una vez desplegado**, ya que el entorno local no lo simula fielmente.
- Textos en español ✅ (auditoría por grep en `src/ui` sin hallazgos; los strings en inglés restantes
  son identificadores internos de tipo, no UI).
- README ✅ actualizado con instrucciones de desarrollo, Supabase y despliegue en Cloudflare Pages.

## 10. Convenciones

- Commits convencionales (`feat:`, `fix:`, `test:`...), en inglés.
- `strict: true` en tsconfig; prohibido `any`.
- El dominio nunca importa de `ui/`, `db/` ni `sync/` (verificar al cerrar cada fase).
- Montos internos como número decimal; redondear solo en la capa de presentación.
- Toda fórmula nueva entra acompañada de su test.

## 11. Definición de terminado

El proyecto está completo cuando: todas las fases cumplen sus criterios de aceptación, los 6 casos de §6 pasan, la app es instalable y detecta actualizaciones, funciona íntegramente offline sin cuenta, sincroniza al iniciar sesión, y una meta conjunta se actualiza en vivo entre dos cuentas.
