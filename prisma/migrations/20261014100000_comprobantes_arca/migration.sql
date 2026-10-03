-- CreateTable
CREATE TABLE "ComprobanteArca" (
    "id" TEXT NOT NULL,
    "tipo" INTEGER NOT NULL,
    "puntoVenta" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "cuitReceptor" TEXT,
    "razonSocial" TEXT,
    "total" DECIMAL(14,2) NOT NULL,
    "cae" TEXT,
    "esNotaCredito" BOOLEAN NOT NULL DEFAULT false,
    "importadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importadoPor" TEXT,

    CONSTRAINT "ComprobanteArca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComprobanteArca_numero_idx" ON "ComprobanteArca"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "ComprobanteArca_tipo_puntoVenta_numero_key" ON "ComprobanteArca"("tipo", "puntoVenta", "numero");

