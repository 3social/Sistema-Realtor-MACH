-- ============================================================
-- PropertyMatch — Supabase Schema
-- Pegar completo en el SQL Editor de Supabase y ejecutar.
-- (Refleja el estado del proyecto `property-matcher-mach`.)
-- ============================================================

-- Extensiones (en el schema `extensions`, como recomienda Supabase)
CREATE EXTENSION IF NOT EXISTS vector   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA extensions;

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

  -- Características extraídas por IA
  property_type TEXT CONSTRAINT properties_property_type_check
                CHECK (property_type IN ('casa', 'apartamento', 'lote', 'finca', 'local', 'oficina')),
  location      TEXT,                   -- zona / barrio / ciudad
  price_min     NUMERIC,                -- USD (oferta: rango bajo; demanda: "desde")
  price_max     NUMERIC,                -- USD (oferta: precio; demanda: presupuesto máximo)
  bedrooms_min  INT,
  bedrooms_max  INT,
  bathrooms     INT,
  area_m2       NUMERIC,
  features      TEXT[],                 -- ['piscina', 'jardín', 'garaje', ...]
  condition     TEXT CHECK (condition IN ('nuevo', 'usado', 'en planos')),
  operation     TEXT CHECK (operation IN ('venta', 'alquiler')),
  extras        JSONB,                  -- { summary, source, messageId, mediaId }

  -- Vector semántico (OpenAI text-embedding-3-small)
  embedding     extensions.VECTOR(1536),

  -- Metadata
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS properties_embedding_idx
  ON properties USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS properties_type_active_idx ON properties (type, is_active);

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
  UNIQUE(offer_id, demand_id)
);

CREATE INDEX IF NOT EXISTS matches_status_score_idx ON matches (status, score DESC);

-- ============================================================
-- FUNCIÓN: zones_compatible
-- Dos zonas son compatibles si alguna está vacía, una contiene a la otra
-- (ej. "Escazú" ⊂ "San Rafael de Escazú"; también "Escazú o Santa Ana") o
-- son muy parecidas (sin acentos ni mayúsculas).
-- ============================================================
CREATE OR REPLACE FUNCTION zones_compatible(a TEXT, b TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
SET search_path = public, extensions
AS $$
  WITH n AS (
    SELECT
      btrim(regexp_replace(lower(unaccent(coalesce(a, ''))), '[^a-z0-9 ]', ' ', 'g')) AS x,
      btrim(regexp_replace(lower(unaccent(coalesce(b, ''))), '[^a-z0-9 ]', ' ', 'g')) AS y
  )
  SELECT x = '' OR y = ''
      OR position(x in y) > 0
      OR position(y in x) > 0
      OR similarity(x, y) >= 0.5
  FROM n;
$$;

-- ============================================================
-- FUNCIÓN: match_properties
-- Contrapartes compatibles de una propiedad, ordenadas por similitud.
-- Filtros duros (si ambos datos existen; un dato vacío no descarta):
--   · tipo de propiedad igual (casa / apartamento / lote / finca / local / oficina)
--   · operación igual (venta / alquiler)
--   · zona compatible
--   · precio más bajo de la oferta <= presupuesto máximo de la demanda + 10%
--   · habitaciones de la oferta dentro de lo que pide la demanda
--   · remitentes distintos y propiedades activas
-- Luego similitud coseno (características / resumen) > match_threshold.
-- Llamada desde lib/matcher.ts vía supabase.rpc().
-- ============================================================
CREATE OR REPLACE FUNCTION match_properties(
  p_property_id   UUID,
  match_threshold FLOAT DEFAULT 0.6,
  match_count     INT   DEFAULT 10
)
RETURNS TABLE (id UUID, similarity FLOAT)
LANGUAGE SQL STABLE
SET search_path = public, extensions
AS $$
  SELECT c.id, 1 - (c.embedding <=> s.embedding) AS similarity
  FROM properties s
  JOIN properties c ON c.type <> s.type
  JOIN properties o ON o.id = CASE WHEN s.type = 'offer'  THEN s.id ELSE c.id END
  JOIN properties d ON d.id = CASE WHEN s.type = 'demand' THEN s.id ELSE c.id END
  WHERE s.id = p_property_id
    AND c.is_active
    AND c.embedding IS NOT NULL
    AND s.embedding IS NOT NULL
    AND c.sender_phone <> s.sender_phone
    AND (s.property_type IS NULL OR c.property_type IS NULL OR s.property_type = c.property_type)
    AND (s.operation     IS NULL OR c.operation     IS NULL OR s.operation     = c.operation)
    AND zones_compatible(s.location, c.location)
    AND (d.price_max IS NULL
         OR COALESCE(o.price_min, o.price_max) IS NULL
         OR COALESCE(o.price_min, o.price_max) <= d.price_max * 1.10)
    AND (d.bedrooms_min IS NULL
         OR COALESCE(o.bedrooms_max, o.bedrooms_min) IS NULL
         OR COALESCE(o.bedrooms_max, o.bedrooms_min) >= d.bedrooms_min)
    AND (d.bedrooms_max IS NULL
         OR o.bedrooms_min IS NULL
         OR o.bedrooms_min <= d.bedrooms_max)
    AND 1 - (c.embedding <=> s.embedding) > match_threshold
  ORDER BY c.embedding <=> s.embedding
  LIMIT match_count;
$$;

-- Solo el backend (service_role) ejecuta las funciones
REVOKE EXECUTE ON FUNCTION match_properties(UUID, FLOAT, INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION zones_compatible(TEXT, TEXT)       FROM PUBLIC, anon, authenticated;

-- ============================================================
-- RLS (Row Level Security)
-- Sin políticas para anon/authenticated: tablas cerradas al API público.
-- Todo el acceso pasa por las API routes con el service role, que ignora RLS.
-- ============================================================
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- MIGRACIÓN desde la versión anterior (si ya tenías el esquema viejo)
-- ============================================================
-- UPDATE properties SET property_type = 'lote' WHERE property_type = 'terreno';
-- ALTER TABLE properties DROP CONSTRAINT properties_property_type_check;
-- ALTER TABLE properties ADD CONSTRAINT properties_property_type_check
--   CHECK (property_type IN ('casa','apartamento','lote','finca','local','oficina'));
-- DROP FUNCTION IF EXISTS match_properties(extensions.vector, text, double precision, integer);
-- DROP POLICY IF EXISTS "properties_select" ON properties; (e igual insert/update y los de matches)
