-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "remitoEmitidoEn" TIMESTAMP(3),
ADD COLUMN     "remitoNumero" INTEGER;

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL DEFAULT 'principal',
    "razonSocial" TEXT NOT NULL DEFAULT '',
    "nombreComercial" TEXT NOT NULL DEFAULT 'BACOLI',
    "cuit" TEXT,
    "condicionIva" TEXT,
    "domicilio" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "ingresosBrutos" TEXT,
    "inicioActividades" TEXT,
    "puntoVenta" TEXT,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Numerador" (
    "id" TEXT NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Numerador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_remitoNumero_key" ON "Pedido"("remitoNumero");

