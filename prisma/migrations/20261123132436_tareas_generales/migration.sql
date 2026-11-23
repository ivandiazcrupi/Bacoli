-- DropForeignKey
ALTER TABLE "Tarea" DROP CONSTRAINT "Tarea_asignadaId_fkey";

-- AlterTable
ALTER TABLE "Tarea" ALTER COLUMN "asignadaId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_asignadaId_fkey" FOREIGN KEY ("asignadaId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
