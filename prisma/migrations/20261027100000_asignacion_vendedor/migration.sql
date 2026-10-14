-- CreateEnum
CREATE TYPE "EstadoAsignacion" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "comisionPct" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "AsignacionVendedor" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT,
    "anteriorId" TEXT,
    "propuestoPor" TEXT NOT NULL,
    "propuestoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoAsignacion" NOT NULL DEFAULT 'PENDIENTE',
    "resueltoPor" TEXT,
    "resueltoEn" TIMESTAMP(3),

    CONSTRAINT "AsignacionVendedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AsignacionVendedor_clienteId_estado_idx" ON "AsignacionVendedor"("clienteId", "estado");

-- AddForeignKey
ALTER TABLE "AsignacionVendedor" ADD CONSTRAINT "AsignacionVendedor_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
