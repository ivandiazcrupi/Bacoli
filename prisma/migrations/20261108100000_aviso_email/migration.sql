-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN "avisoHorario" TEXT,
ADD COLUMN "avisoTexto" TEXT;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN "webAvisoDia" TEXT,
ADD COLUMN "webAvisoEn" TIMESTAMP(3);
