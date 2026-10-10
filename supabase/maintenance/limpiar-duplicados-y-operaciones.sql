-- ============================================================
-- Limpieza única de datos ya guardados (ejecutar en el SQL Editor de Supabase)
-- Corrige lo que el sistema ya evita en publicaciones nuevas:
--   1) operación vacía (venta/alquiler) deducida por el precio
--   2) la misma publicación repetida en varios grupos (crosspost)
--   3) matches entre venta y alquiler
-- Revisa los conteos del paso 0 antes y después. Los pasos 2 y 3 BORRAN filas.
-- ============================================================

-- 0) Conteos antes
SELECT (SELECT count(*) FROM properties) AS propiedades, (SELECT count(*) FROM matches) AS matches;

-- 1) Completar la operación faltante por orden de magnitud del precio (USD)
UPDATE properties
SET operation = CASE WHEN COALESCE(price_max, price_min) >= 20000 THEN 'venta' ELSE 'alquiler' END
WHERE operation IS NULL
  AND COALESCE(price_max, price_min) IS NOT NULL
  AND (COALESCE(price_max, price_min) >= 20000 OR COALESCE(price_max, price_min) <= 8000);

-- 2) Borrar publicaciones repetidas (misma persona y mismo contenido), conservando la primera.
--    Sus matches se borran en cascada.
DELETE FROM properties p
USING (
  SELECT id,
         row_number() OVER (
           PARTITION BY sender_phone, type, property_type, operation, location,
                        COALESCE(price_max, price_min), bedrooms_min
           ORDER BY created_at
         ) AS rn
  FROM properties
  WHERE sender_phone <> 'unknown' AND group_id <> 'DEMO'
) d
WHERE p.id = d.id AND d.rn > 1;

-- 3) Borrar matches incompatibles por operación (venta vs alquiler)
DELETE FROM matches m
USING properties o, properties d
WHERE m.offer_id = o.id AND m.demand_id = d.id
  AND o.operation IS NOT NULL AND d.operation IS NOT NULL
  AND o.operation <> d.operation;

-- 4) Conteos después
SELECT (SELECT count(*) FROM properties) AS propiedades, (SELECT count(*) FROM matches) AS matches;
