-- ============================================================
-- PropertyMatch — Bootstrap para Postgres propio (VPS / Easypanel)
-- Ejecutar UNA vez, ANTES de `supabase/schema.sql`, en una base nueva
-- con imagen `pgvector/pgvector:pg17` (pgWeb o psql como `postgres`).
--
-- Crea lo que Supabase trae de serie y PostgREST necesita: el schema
-- `extensions` y los roles `anon`, `authenticated`, `service_role` y
-- `authenticator`. Con esto `schema.sql` corre sin cambios.
--
-- La contraseña de `authenticator` NO va en el repo: reemplaza el
-- marcador antes de ejecutar y usa la misma en PGRST_DB_URI (pm-rest).
-- ============================================================

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT;
  END IF;
END $$;

ALTER ROLE authenticator WITH PASSWORD 'REEMPLAZAR_CON_LA_CLAVE_DE_AUTHENTICATOR';
GRANT anon, authenticated, service_role TO authenticator;

GRANT USAGE ON SCHEMA public, extensions TO anon, authenticated, service_role;

-- Como en Supabase: el backend (service_role) accede a todo lo que se cree en public.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL     ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL     ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;

-- Tras ejecutar schema.sql, recargar la caché de PostgREST:
-- NOTIFY pgrst, 'reload schema';
