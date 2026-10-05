-- ============================================================
-- WhatsApp Property Matcher — Supabase Schema
-- Pegar completo en el SQL Editor de Supabase y ejecutar
-- ============================================================

-- PASO 1: Habilitar extensión vectorial
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- TABLA: properties
-- Pool unificado de ofertas y demandas
-- ============================================================
CREATE TABLE IF NOT EXISTS properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Origen del mensaje
  group_id      TEXT NOT NULL,         -- ID del grupo de WhatsApp
  group_name    TEXT,                   -- Nombre del grupo (opcional)
  sender_phone  TEXT NOT NULL,          -- Número del remitente (formato: 50688887777)
  sender_name   TEXT,                   -- Nombre del contacto si disponible
  raw_message   TEXT NOT NULL,          -- Mensaje original sin modificar

  -- Clasificación por IA
  type TEXT NOT NULL CHECK (type IN ('offer', 'demand')),

  -- Características extraídas por Claude
  property_type TEXT CHECK (property_type IN ('casa', 'apartamento', 'local', 'terreno', 'oficina')),
  location      TEXT,                   -- zona / barrio / ciudad
  price_min     NUMERIC,                -- precio mínimo en USD
  price_max     NUMERIC,                -- precio máximo en USD
  bedrooms_min  INT,                    -- habitaciones mínimas
  bedrooms_max  INT,
  bathrooms     INT,
  area_m2       NUMERIC,               -- metros cuadrados
  features      TEXT[],                 -- ['piscina', 'jardín', 'garaje', ...]
  condition     TEXT CHECK (condition IN ('nuevo', 'usado', 'en planos')),
  operation     TEXT CHECK (operation IN ('venta', 'alquiler')),
  extras        JSONB,                  -- datos adicionales { summary: "..." }

  -- Vector semántico para matching (OpenAI text-embedding-3-small)
  embedding     VECTOR(1536),

  -- Metadata
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE
);

-- Índice vectorial para búsqueda coseno rápida
-- Nota: ivfflat requiere al menos 100 filas para ser efectivo
CREATE INDEX IF NOT EXISTS properties_embedding_idx
  ON properties
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Índice para filtros frecuentes
CREATE INDEX IF NOT EXISTS properties_type_active_idx
  ON properties (type, is_active);

-- ============================================================
-- TABLA: matches
-- Pares oferta-demanda detectados automáticamente
-- ============================================================
CREATE TABLE IF NOT EXISTS matches (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id   UUID REFERENCES properties(id) ON DELETE CASCADE,
  demand_id  UUID REFERENCES properties(id) ON DELETE CASCADE,
  score      FLOAT NOT NULL CHECK (score >= 0 AND score <= 1),
  status     TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'closed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(offer_id, demand_id)   -- no duplicar el mismo par
);

-- Índice para consultas del dashboard
CREATE INDEX IF NOT EXISTS matches_status_score_idx
  ON matches (status, score DESC);

-- ============================================================
-- FUNCIÓN: match_properties
-- Búsqueda vectorial semántica por coseno
-- Llamada desde lib/matcher.ts vía supabase.rpc()
-- ============================================================
CREATE OR REPLACE FUNCTION match_properties(
  query_embedding VECTOR(1536),
  search_type     TEXT,
  match_threshold FLOAT DEFAULT 0.75,
  match_count     INT   DEFAULT 10
)
RETURNS TABLE (
  id         UUID,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    1 - (embedding <=> query_embedding) AS similarity
  FROM properties
  WHERE
    type      = search_type
    AND is_active = TRUE
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- RLS (Row Level Security)
-- Sin políticas para anon/authenticated: tabla cerrada al API público.
-- Todo el acceso pasa por las API routes con el service role, que
-- ignora RLS. (Antes había políticas abiertas con `true` que dejaban
-- a cualquiera con la anon key leer teléfonos y escribir datos.)
-- ============================================================
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Si ya ejecutaste la versión anterior, limpia las políticas abiertas:
DROP POLICY IF EXISTS "properties_select" ON properties;
DROP POLICY IF EXISTS "properties_insert" ON properties;
DROP POLICY IF EXISTS "properties_update" ON properties;
DROP POLICY IF EXISTS "matches_select"    ON matches;
DROP POLICY IF EXISTS "matches_insert"    ON matches;
DROP POLICY IF EXISTS "matches_update"    ON matches;
