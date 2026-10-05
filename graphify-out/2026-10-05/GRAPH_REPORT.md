# Graph Report - Sistema-Realtor-MACH  (2026-10-05)

## Corpus Check
- 27 files · ~8,783 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .ico 1, .css 1)

## Summary
- 167 nodes · 224 edges · 13 communities (11 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `30939301`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- compilerOptions
- dashboard/page.tsx
- parser.ts
- next
- PropertyMatch — Sistema Realtor MACH
- devDependencies
- dependencies
- PropertyMatch — convenciones del proyecto
- postcss.config.mjs
- CLAUDE.md
- ingest/route.ts
- Checklist de confirmación de estado

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `parseAndStoreMessage()` - 12 edges
3. `Checklist de confirmación de estado` - 8 edges
4. `PropertyMatch — Sistema Realtor MACH` - 8 edges
5. `next` - 8 edges
6. `Despliegue — PropertyMatch` - 7 edges
7. `MatchCard()` - 6 edges
8. `Integrar el número (grupos) con Evolution API` - 6 edges
9. `MatchWithProperties` - 5 edges
10. `getOpenAI()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Reglas` --references--> `parseAndStoreMessage()`  [INFERRED]
  AGENTS.md → lib/parser.ts
- `PropertyPanelProps` --references--> `MatchWithProperties`  [EXTRACTED]
  app/dashboard/page.tsx → types/index.ts
- `POST()` --calls--> `parseAndStoreMessage()`  [EXTRACTED]
  app/api/ingest/route.ts → lib/parser.ts
- `POST()` --calls--> `parseAndStoreMessage()`  [EXTRACTED]
  app/api/webhook/route.ts → lib/parser.ts
- `MatchCardProps` --references--> `MatchStatus`  [EXTRACTED]
  app/dashboard/page.tsx → types/index.ts

## Import Cycles
- None detected.

## Communities (13 total, 2 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.10
Nodes (19): eslintConfig, name, private, scripts, build, dev, lint, start (+11 more)

### Community 1 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 2 - "dashboard/page.tsx"
Cohesion: 0.16
Nodes (16): Dashboard(), formatDate(), formatPrice(), getScoreClass(), getScoreColor(), MatchCard(), MatchCardProps, PropertyPanel() (+8 more)

### Community 3 - "parser.ts"
Cohesion: 0.22
Nodes (12): buildEmbeddingText(), generateEmbedding(), findMatches(), getOpenAI(), buildRawMessage(), classifyWithOpenAI(), isDuplicate(), parseAndStoreMessage() (+4 more)

### Community 4 - "next"
Cohesion: 0.20
Nodes (4): inter, metadata, nextConfig, next

### Community 5 - "PropertyMatch — Sistema Realtor MACH"
Cohesion: 0.25
Nodes (8): Avisos, Cómo funciona, Desarrollo local, Documentación, Estructura, PropertyMatch — Sistema Realtor MACH, Stack, Variables de entorno

### Community 7 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+1 more)

### Community 8 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, next, openai, react, react-dom, @supabase/supabase-js

### Community 10 - "PropertyMatch — convenciones del proyecto"
Cohesion: 0.40
Nodes (4): Flujo de trabajo, PropertyMatch — convenciones del proyecto, Reglas, This is NOT the Next.js you know

### Community 13 - "ingest/route.ts"
Cohesion: 0.14
Nodes (14): EvolutionEvent, ImageMime, jidToPhone(), POST(), secretMatches(), SUPPORTED_MIMES, hasValidSignature(), POST() (+6 more)

### Community 14 - "Checklist de confirmación de estado"
Cohesion: 0.08
Nodes (21): 1. Código, 2. Base de datos (Supabase `property-matcher-mach`), 3. Vercel (`sistema-realtor-mach`), 4. Evolution API (Easypanel `personaldev`), 5. Prueba de extremo a extremo, 6. Seguridad y riesgos conocidos, 7. Mejoras pendientes (no bloquean la puesta en marcha), Checklist de confirmación de estado (+13 more)

## Knowledge Gaps
- **86 isolated node(s):** `This is NOT the Next.js you know`, `Flujo de trabajo`, `1. Código`, `2. Base de datos (Supabase `property-matcher-mach`)`, `3. Vercel (`sistema-realtor-mach`)` (+81 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 94 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `package.json`, `dashboard/page.tsx`, `parser.ts`, `ingest/route.ts`?**
  _High betweenness centrality (0.153) - this node is a cross-community bridge._
- **What connects `This is NOT the Next.js you know`, `Flujo de trabajo`, `1. Código` to the rest of the system?**
  _86 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `parseAndStoreMessage()` connect `parser.ts` to `PropertyMatch — convenciones del proyecto`, `ingest/route.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `ingest/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14035087719298245 - nodes in this community are weakly interconnected._