-- CreateTable
CREATE TABLE "IntentoEntrega" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "salidaId" TEXT,
    "vehiculo" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "resumen" JSONB NOT NULL,
    "usuarioId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntentoEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntentoEntrega_fecha_idx" ON "IntentoEntrega"("fecha");

-- CreateIndex
CREATE INDEX "IntentoEntrega_pedidoId_idx" ON "IntentoEntrega"("pedidoId");

-- AddForeignKey
ALTER TABLE "IntentoEntrega" ADD CONSTRAINT "IntentoEntrega_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

