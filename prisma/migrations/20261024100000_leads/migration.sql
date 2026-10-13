-- CreateEnum
CREATE TYPE "LeadEstado" AS ENUM ('NUEVO', 'CONTACTADO', 'MUESTRA', 'NEGOCIANDO', 'GANADO', 'PERDIDO');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "barrio" TEXT,
    "direccion" TEXT,
    "origen" TEXT,
    "interes" TEXT,
    "notas" TEXT,
    "estado" "LeadEstado" NOT NULL DEFAULT 'NUEVO',
    "proximoContacto" TEXT,
    "motivoPerdida" TEXT,
    "vendedor" TEXT,
    "clienteId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadContacto" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT,
    "usuario" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadContacto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadContacto_leadId_creadoEn_idx" ON "LeadContacto"("leadId", "creadoEn");

-- AddForeignKey
ALTER TABLE "LeadContacto" ADD CONSTRAINT "LeadContacto_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
