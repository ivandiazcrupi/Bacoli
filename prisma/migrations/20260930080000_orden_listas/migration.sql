-- AlterTable
ALTER TABLE "ListaPrecios" ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 0;


-- Orden de las listas: primero Mayorista, luego Distribuidor y después las demás (por antigüedad de nombre).
UPDATE "ListaPrecios" SET "orden" = 1 WHERE UPPER("nombre") = 'MAYORISTA';
UPDATE "ListaPrecios" SET "orden" = 2 WHERE UPPER("nombre") = 'DISTRIBUIDOR';
UPDATE "ListaPrecios" l SET "orden" = 2 + r.n
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "nombre") AS n
  FROM "ListaPrecios"
  WHERE UPPER("nombre") NOT IN ('MAYORISTA', 'DISTRIBUIDOR')
) r
WHERE l."id" = r."id";
