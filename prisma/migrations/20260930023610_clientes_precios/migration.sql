-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('MINORISTA', 'MAYORISTA', 'DISTRIBUIDOR');

-- CreateEnum
CREATE TYPE "CondicionPago" AS ENUM ('CONTADO', 'DIAS_7', 'DIAS_15', 'DIAS_30', 'DIAS_45');

-- CreateEnum
CREATE TYPE "ImputacionPago" AS ENUM ('SALDO', 'PEDIDO');

-- CreateTable
CREATE TABLE "Zona" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Zona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListaPrecios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "ListaPrecios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Precio" (
    "listaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "Precio_pkey" PRIMARY KEY ("listaId","productoId")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCliente" NOT NULL,
    "razonSocial" TEXT,
    "cuit" TEXT,
    "facturado" BOOLEAN NOT NULL DEFAULT false,
    "condicionPago" "CondicionPago" NOT NULL DEFAULT 'CONTADO',
    "listaPreciosId" TEXT,
    "descuentoPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "imputacionPago" "ImputacionPago" NOT NULL DEFAULT 'SALDO',
    "sinLimite" BOOLEAN NOT NULL DEFAULT false,
    "maxPedidosImpagos" INTEGER,
    "maxMonto" DECIMAL(14,2),
    "comisionista" TEXT,
    "comisionPct" DECIMAL(5,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuntoEntrega" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "alias" TEXT,
    "direccion" TEXT NOT NULL,
    "barrio" TEXT NOT NULL,
    "zonaId" TEXT NOT NULL,
    "telefono" TEXT,
    "comentario" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PuntoEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zona_nombre_key" ON "Zona"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_nombre_key" ON "Producto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ListaPrecios_nombre_key" ON "ListaPrecios"("nombre");

-- CreateIndex
CREATE INDEX "Cliente_nombre_idx" ON "Cliente"("nombre");

-- CreateIndex
CREATE INDEX "PuntoEntrega_clienteId_idx" ON "PuntoEntrega"("clienteId");

-- CreateIndex
CREATE INDEX "PuntoEntrega_barrio_idx" ON "PuntoEntrega"("barrio");

-- AddForeignKey
ALTER TABLE "Precio" ADD CONSTRAINT "Precio_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES "ListaPrecios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Precio" ADD CONSTRAINT "Precio_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_listaPreciosId_fkey" FOREIGN KEY ("listaPreciosId") REFERENCES "ListaPrecios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuntoEntrega" ADD CONSTRAINT "PuntoEntrega_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuntoEntrega" ADD CONSTRAINT "PuntoEntrega_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "Zona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
