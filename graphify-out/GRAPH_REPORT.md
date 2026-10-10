# Graph Report - Sistema-Realtor-MACH  (2026-10-10)

## Corpus Check
- 28 files · ~10,827 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .ico 1, .css 1)

## Summary
- 184 nodes · 259 edges · 13 communities (11 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `00fbba5f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- compilerOptions
- dashboard/page.tsx
- parser.ts
- next
- Despliegue — PropertyMatch
- PropertyMatch — Sistema Realtor MACH
- devDependencies
- PropertyMatch — convenciones del proyecto
- postcss.config.mjs
- CLAUDE.md
- ingest/route.ts
- Checklist de confirmación de estado

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `parseAndStoreMessage()` - 15 edges
3. `Checklist de confirmación de estado` - 10 edges
4. `PropertyMatch — Sistema Realtor MACH` - 10 edges
5. `dbRetry()` - 9 edges
6. `next` - 8 edges
7. `Despliegue — PropertyMatch` - 7 edges
8. `TransientError` - 6 edges
9. `MatchCard()` - 6 edges
10. `Integrar el número (grupos) con Evolution API` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Reglas` --references--> `parseAndStoreMessage()`  [INFERRED]
  AGENTS.md → lib/parser.ts
- `POST()` --calls--> `parseAndStoreMessage()`  [EXTRACTED]
  app/api/ingest/route.ts → lib/parser.ts
- `POST()` --calls--> `parseAndStoreMessage()`  [EXTRACTED]
  app/api/webhook/route.ts → lib/parser.ts
- `PropertyPanelProps` --references--> `MatchWithProperties`  [EXTRACTED]
  app/dashboard/page.tsx → types/index.ts
- `MatchCardProps` --references--> `MatchStatus`  [EXTRACTED]
  app/dashboard/page.tsx → types/index.ts

## Import Cycles
- None detected.

## Communities (13 total, 2 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.08
Nodes (25): eslintConfig, dependencies, next, openai, react, react-dom, @supabase/supabase-js, name (+17 more)

### Community 1 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 2 - "dashboard/page.tsx"
Cohesion: 0.19
Nodes (16): Dashboard(), formatDate(), formatPrice(), getScoreClass(), getScoreColor(), MatchCard(), MatchCardProps, PropertyPanel() (+8 more)

### Community 3 - "parser.ts"
Cohesion: 0.18
Nodes (19): buildEmbeddingText(), generateEmbedding(), findMatches(), getOpenAI(), buildRawMessage(), classifyWithOpenAI(), isDuplicate(), normalizeParsed() (+11 more)

### Community 4 - "next"
Cohesion: 0.12
Nodes (7): inter, metadata, supabaseAdmin, supabasePublic, nextConfig, next, @supabase/supabase-js

### Community 5 - "Despliegue — PropertyMatch"
Cohesion: 0.29
Nodes (7): 1. Supabase, 2. Vercel, 3. Evolution API (grupos), 4. API oficial de Meta (opcional, solo chats directos), Despliegue — PropertyMatch, Infraestructura actual, Troubleshooting

### Community 6 - "PropertyMatch — Sistema Realtor MACH"
Cohesion: 0.20
Nodes (10): Avisos, Costos (orientativo; confirmar tarifas en OpenAI), Cómo funciona, Desarrollo local, Documentación, Estructura, PropertyMatch — Sistema Realtor MACH, Reglas de matching (+2 more)

### Community 7 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+1 more)

### Community 10 - "PropertyMatch — convenciones del proyecto"
Cohesion: 0.40
Nodes (4): Flujo de trabajo, PropertyMatch — convenciones del proyecto, Reglas, This is NOT the Next.js you know

### Community 13 - "ingest/route.ts"
Cohesion: 0.13
Nodes (15): EvolutionEvent, ImageMime, jidToPhone(), maxDuration, POST(), secretMatches(), SUPPORTED_MIMES, hasValidSignature() (+7 more)

### Community 14 - "Checklist de confirmación de estado"
Cohesion: 0.11
Nodes (16): 1. Código, 2. Base de datos (Supabase `property-matcher-mach`), 3. Vercel (`sistema-realtor-mach`), 4. Evolution API (Easypanel `personaldev`), 5. Prueba de extremo a extremo, 6. Seguridad y riesgos conocidos, 6b. Incidentes vistos en producción (2026-10-10), 7. Cierre: pendientes del propietario (+8 more)

## Knowledge Gaps
- **95 isolated node(s):** `This is NOT the Next.js you know`, `Flujo de trabajo`, `1. Código`, `2. Base de datos (Supabase `property-matcher-mach`)`, `3. Vercel (`sistema-realtor-mach`)` (+90 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 104 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `package.json`, `ingest/route.ts`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **What connects `This is NOT the Next.js you know`, `Flujo de trabajo`, `1. Código` to the rest of the system?**
  _95 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `openai` connect `parser.ts` to `package.json`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `next` be split into smaller, more focused modules?**
  _Cohesion score 0.12280701754385964 - nodes in this community are weakly interconnected._