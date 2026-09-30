-- Nombre de usuario para entrar (además del email, que no se toca). Las personas ya cargadas reciben uno
-- a partir de su email (lo que va antes de la @) y lo pueden cambiar desde "Mi cuenta".
ALTER TABLE "Usuario" ADD COLUMN "usuario" TEXT;

WITH base AS (
  SELECT id, "creadoEn",
         COALESCE(NULLIF(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g'), ''), 'usuario') AS b
  FROM "Usuario"
), num AS (
  SELECT id, b, row_number() OVER (PARTITION BY b ORDER BY "creadoEn", id) AS n FROM base
)
UPDATE "Usuario" u
SET "usuario" = CASE WHEN num.n = 1 THEN num.b ELSE num.b || num.n::text END
FROM num WHERE u.id = num.id;

ALTER TABLE "Usuario" ALTER COLUMN "usuario" SET NOT NULL;
CREATE UNIQUE INDEX "Usuario_usuario_key" ON "Usuario"("usuario");
