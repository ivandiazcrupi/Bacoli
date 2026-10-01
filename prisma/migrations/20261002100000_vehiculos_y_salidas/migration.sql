-- CreateEnum
CREATE TYPE "OrigenPedido" AS ENUM ('MAYORISTA', 'WEB');

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "ordenRuta" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "origen" "OrigenPedido" NOT NULL DEFAULT 'MAYORISTA',
ADD COLUMN     "salidaId" TEXT;

-- CreateTable
CREATE TABLE "Vehiculo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "patente" TEXT,
    "capacidad" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Salida" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "repartidorId" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Salida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Salida_fecha_idx" ON "Salida"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Salida_fecha_vehiculoId_key" ON "Salida"("fecha", "vehiculoId");

-- CreateIndex
CREATE INDEX "Pedido_salidaId_idx" ON "Pedido"("salidaId");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_salidaId_fkey" FOREIGN KEY ("salidaId") REFERENCES "Salida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Salida" ADD CONSTRAINT "Salida_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Salida" ADD CONSTRAINT "Salida_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

