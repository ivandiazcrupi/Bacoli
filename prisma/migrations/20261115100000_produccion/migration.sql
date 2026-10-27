-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'PRODUCCION';

-- CreateTable
CREATE TABLE "Produccion" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "producto" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "desperdicio" INTEGER NOT NULL DEFAULT 0,
    "inicio" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Produccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Produccion_fecha_idx" ON "Produccion"("fecha");

-- AddForeignKey
ALTER TABLE "Produccion" ADD CONSTRAINT "Produccion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
