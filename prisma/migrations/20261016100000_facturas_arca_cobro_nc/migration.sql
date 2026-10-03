-- AlterTable
ALTER TABLE "ComprobanteArca" ADD COLUMN     "medioCobro" "MedioPago",
ADD COLUMN     "obsCobro" TEXT,
ADD COLUMN     "pagado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pagadoEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AplicacionNcArca" (
    "id" TEXT NOT NULL,
    "ncId" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT,

    CONSTRAINT "AplicacionNcArca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AplicacionNcArca_ncId_idx" ON "AplicacionNcArca"("ncId");

-- CreateIndex
CREATE INDEX "AplicacionNcArca_facturaId_idx" ON "AplicacionNcArca"("facturaId");

-- AddForeignKey
ALTER TABLE "AplicacionNcArca" ADD CONSTRAINT "AplicacionNcArca_ncId_fkey" FOREIGN KEY ("ncId") REFERENCES "ComprobanteArca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacionNcArca" ADD CONSTRAINT "AplicacionNcArca_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "ComprobanteArca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

