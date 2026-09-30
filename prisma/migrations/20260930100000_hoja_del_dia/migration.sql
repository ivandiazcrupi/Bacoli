-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'MERCADO_PAGO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoCobro" AS ENUM ('COBRADO', 'CUENTA_CORRIENTE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoMovimiento" ADD VALUE 'PAGO';
ALTER TYPE "TipoMovimiento" ADD VALUE 'ANULACION_PAGO';

-- AlterTable
ALTER TABLE "MovimientoCuenta" ADD COLUMN     "medio" "MedioPago";

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "cobro" "EstadoCobro",
ADD COLUMN     "medioCobro" "MedioPago",
ADD COLUMN     "montoCobrado" DECIMAL(14,2),
ADD COLUMN     "numeroFactura" TEXT;

-- CreateTable
CREATE TABLE "DiaCerrado" (
    "fecha" DATE NOT NULL,
    "cerradoPor" TEXT NOT NULL,
    "cerradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaCerrado_pkey" PRIMARY KEY ("fecha")
);

