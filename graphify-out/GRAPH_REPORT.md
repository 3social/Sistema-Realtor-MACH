# Graph Report - Sistema-Realtor-MACH  (2026-10-05)

## Corpus Check
- 25 files · ~6,989 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .ico 1, .css 1)

## Summary
- 143 nodes · 187 edges · 14 communities (11 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1878d5c6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- compilerOptions
- dashboard/page.tsx
- webhook/route.ts
- matches/route.ts
- Resumen para retomar (2026-10-05)
- 🚀 Guía de Deploy — WhatsApp Property Matcher
- devDependencies
- dependencies
- README.md
- AGENTS.md
- postcss.config.mjs
- CLAUDE.md
- parser.ts

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `🚀 Guía de Deploy — WhatsApp Property Matcher` - 9 edges
3. `parseAndStoreMessage()` - 8 edges
4. `next` - 7 edges
5. `Resumen para retomar (2026-10-05)` - 6 edges
6. `MatchCard()` - 6 edges
7. `getOpenAI()` - 5 edges
8. `scripts` - 5 edges
9. `MatchWithProperties` - 5 edges
10. `supabaseAdmin` - 5 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `parseAndStoreMessage()`  [EXTRACTED]
  app/api/webhook/route.ts → lib/parser.ts
- `PropertyPanelProps` --references--> `MatchWithProperties`  [EXTRACTED]
  app/dashboard/page.tsx → types/index.ts
- `POST()` --calls--> `downloadWhatsAppMedia()`  [EXTRACTED]
  app/api/webhook/route.ts → lib/whatsapp.ts
- `MatchCardProps` --references--> `MatchWithProperties`  [EXTRACTED]
  app/dashboard/page.tsx → types/index.ts
- `MatchCardProps` --references--> `MatchStatus`  [EXTRACTED]
  app/dashboard/page.tsx → types/index.ts

## Import Cycles
- None detected.

## Communities (14 total, 3 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.10
Nodes (19): eslintConfig, name, private, scripts, build, dev, lint, start (+11 more)

### Community 1 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 2 - "dashboard/page.tsx"
Cohesion: 0.23
Nodes (14): Dashboard(), formatDate(), formatPrice(), getScoreClass(), getScoreColor(), MatchCard(), MatchCardProps, PropertyPanel() (+6 more)

### Community 3 - "webhook/route.ts"
Cohesion: 0.18
Nodes (10): hasValidSignature(), POST(), downloadWhatsAppMedia(), MediaDownloadResult, SUPPORTED_MIMES, SupportedMime, MessageSource, ParsedProperty (+2 more)

### Community 4 - "matches/route.ts"
Cohesion: 0.15
Nodes (4): inter, metadata, nextConfig, next

### Community 5 - "Resumen para retomar (2026-10-05)"
Cohesion: 0.29
Nodes (6): Actualización: solo OpenAI, Estado de la infraestructura (revisado por MCP), Hecho esta noche (sin cambiar el comportamiento existente), Para salir a producción (orden), Pendiente (no lo toqué porque cambia comportamiento; decídelo tú), Resumen para retomar (2026-10-05)

### Community 6 - "🚀 Guía de Deploy — WhatsApp Property Matcher"
Cohesion: 0.20
Nodes (9): 🚀 Guía de Deploy — WhatsApp Property Matcher, PASO 1 — Crear proyecto en Supabase, PASO 2 — Ejecutar el Schema SQL, PASO 3 — Completar `.env.local`, PASO 4 — Probar en local, PASO 5 — Deploy en Vercel, PASO 6 — Configurar Webhook en Meta, PASO 7 — Verificación final (+1 more)

### Community 7 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+1 more)

### Community 8 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, next, openai, react, react-dom, @supabase/supabase-js

### Community 9 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 13 - "parser.ts"
Cohesion: 0.23
Nodes (11): buildEmbeddingText(), generateEmbedding(), findMatches(), getOpenAI(), buildRawMessage(), classifyWithOpenAI(), parseAndStoreMessage(), supabaseAdmin (+3 more)

## Knowledge Gaps
- **72 isolated node(s):** `PASO 1 — Crear proyecto en Supabase`, `PASO 2 — Ejecutar el Schema SQL`, `PASO 3 — Completar `.env.local``, `PASO 4 — Probar en local`, `PASO 5 — Deploy en Vercel` (+67 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 85 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `matches/route.ts` to `package.json`, `webhook/route.ts`, `parser.ts`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **What connects `PASO 1 — Crear proyecto en Supabase`, `PASO 2 — Ejecutar el Schema SQL`, `PASO 3 — Completar `.env.local`` to the rest of the system?**
  _72 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `react` connect `package.json` to `dashboard/page.tsx`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._