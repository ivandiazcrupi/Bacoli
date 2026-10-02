-- AlterEnum
ALTER TYPE "TipoMovimiento" ADD VALUE 'NOTA_CREDITO';

-- CreateTable
CREATE TABLE "NotaCredito" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "numero" TEXT,
    "motivo" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,
    "anuladaEn" TIMESTAMP(3),

    CONSTRAINT "NotaCredito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaCreditoAplicacion" (
    "id" TEXT NOT NULL,
    "notaId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "NotaCreditoAplicacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotaCredito_clienteId_idx" ON "NotaCredito"("clienteId");

-- CreateIndex
CREATE INDEX "NotaCreditoAplicacion_pedidoId_idx" ON "NotaCreditoAplicacion"("pedidoId");

-- CreateIndex
CREATE INDEX "NotaCreditoAplicacion_notaId_idx" ON "NotaCreditoAplicacion"("notaId");

-- AddForeignKey
ALTER TABLE "NotaCredito" ADD CONSTRAINT "NotaCredito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaCreditoAplicacion" ADD CONSTRAINT "NotaCreditoAplicacion_notaId_fkey" FOREIGN KEY ("notaId") REFERENCES "NotaCredito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaCreditoAplicacion" ADD CONSTRAINT "NotaCreditoAplicacion_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

