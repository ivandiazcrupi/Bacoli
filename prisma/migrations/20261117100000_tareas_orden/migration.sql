-- AlterTable
ALTER TABLE "Tarea" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;

-- Las tareas que ya existían quedan ordenadas por antigüedad dentro de la lista de cada persona.
UPDATE "Tarea" t SET "orden" = r.n FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "asignadaId" ORDER BY "creadoEn", id) AS n FROM "Tarea"
) r WHERE t.id = r.id;
