# Graph Report - Sistema-Realtor-MACH  (2026-10-05)

## Corpus Check
- 27 files · ~9,699 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .ico 1, .css 1)

## Summary
- 171 nodes · 229 edges · 15 communities (13 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8065267b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- compilerOptions
- dashboard/page.tsx
- parser.ts
- next
- matches/route.ts
- Checklist de confirmación de estado
- devDependencies
- dependencies
- Integrar el número (grupos) con Evolution API
- PropertyMatch — convenciones del proyecto
- postcss.config.mjs
- CLAUDE.md
- ingest/route.ts
- PropertyMatch — Sistema Realtor MACH

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `parseAndStoreMessage()` - 12 edges
3. `PropertyMatch — Sistema Realtor MACH` - 9 edges
4. `Checklist de confirmación de estado` - 8 edges
5. `next` - 8 edges
6. `Despliegue — PropertyMatch` - 7 edges
7. `MatchCard()` - 6 edges
8. `Integrar el número (grupos) con Evolution API` - 6 edges
9. `MatchWithProperties` - 5 edges
10. `getOpenAI()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Reglas` --references--> `parseAndStoreMessage()`  [INFERRED]
  AGENTS.md → lib/parser.ts
- `POST()` --calls--> `parseAndStoreMessage()`  [EXTRACTED]
  app/api/ingest/route.ts → lib/parser.ts
- `PropertyPanelProps` --references--> `MatchWithProperties`  [EXTRACTED]
  app/dashboard/page.tsx → types/index.ts
- `POST()` --calls--> `parseAndStoreMessage()`  [EXTRACTED]
  app/api/webhook/route.ts → lib/parser.ts
- `MatchCardProps` --references--> `MatchWithProperties`  [EXTRACTED]
  app/dashboard/page.tsx → types/index.ts

## Import Cycles
- None detected.

## Communities (15 total, 2 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.10
Nodes (19): eslintConfig, name, private, scripts, build, dev, lint, start (+11 more)

### Community 1 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 2 - "dashboard/page.tsx"
Cohesion: 0.18
Nodes (17): Dashboard(), formatDate(), formatPrice(), getScoreClass(), getScoreColor(), MatchCard(), MatchCardProps, PropertyPanel() (+9 more)

### Community 3 - "parser.ts"
Cohesion: 0.16
Nodes (17): hasValidSignature(), POST(), buildEmbeddingText(), generateEmbedding(), getOpenAI(), buildRawMessage(), classifyWithOpenAI(), isDuplicate() (+9 more)

### Community 4 - "next"
Cohesion: 0.20
Nodes (4): inter, metadata, nextConfig, next

### Community 5 - "matches/route.ts"
Cohesion: 0.21
Nodes (5): findMatches(), supabaseAdmin, supabasePublic, @supabase/supabase-js, Property

### Community 6 - "Checklist de confirmación de estado"
Cohesion: 0.25
Nodes (8): 1. Código, 2. Base de datos (Supabase `property-matcher-mach`), 3. Vercel (`sistema-realtor-mach`), 4. Evolution API (Easypanel `personaldev`), 5. Prueba de extremo a extremo, 6. Seguridad y riesgos conocidos, 7. Mejoras pendientes (no bloquean la puesta en marcha), Checklist de confirmación de estado

### Community 7 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+1 more)

### Community 8 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, next, openai, react, react-dom, @supabase/supabase-js

### Community 9 - "Integrar el número (grupos) con Evolution API"
Cohesion: 0.33
Nodes (6): 0. Una vez (lado Vercel), 1. Crear la instancia y el webhook, 2. Vincular el número, 3. Probar, Integrar el número (grupos) con Evolution API, Notas

### Community 10 - "PropertyMatch — convenciones del proyecto"
Cohesion: 0.40
Nodes (4): Flujo de trabajo, PropertyMatch — convenciones del proyecto, Reglas, This is NOT the Next.js you know

### Community 13 - "ingest/route.ts"
Cohesion: 0.32
Nodes (6): EvolutionEvent, ImageMime, jidToPhone(), POST(), secretMatches(), SUPPORTED_MIMES

### Community 14 - "PropertyMatch — Sistema Realtor MACH"
Cohesion: 0.11
Nodes (16): 1. Supabase, 2. Vercel, 3. Evolution API (grupos), 4. API oficial de Meta (opcional, solo chats directos), Despliegue — PropertyMatch, Infraestructura actual, Troubleshooting, Avisos (+8 more)

## Knowledge Gaps
- **89 isolated node(s):** `This is NOT the Next.js you know`, `Flujo de trabajo`, `1. Código`, `2. Base de datos (Supabase `property-matcher-mach`)`, `3. Vercel (`sistema-realtor-mach`)` (+84 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 97 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `package.json`, `matches/route.ts`, `parser.ts`, `ingest/route.ts`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **What connects `This is NOT the Next.js you know`, `Flujo de trabajo`, `1. Código` to the rest of the system?**
  _89 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `parseAndStoreMessage()` connect `parser.ts` to `PropertyMatch — convenciones del proyecto`, `matches/route.ts`, `ingest/route.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `PropertyMatch — Sistema Realtor MACH` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._