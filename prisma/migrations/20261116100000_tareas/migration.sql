-- CreateTable
CREATE TABLE "Tarea" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "asignadaId" TEXT NOT NULL,
    "creadaPorId" TEXT,
    "hecha" BOOLEAN NOT NULL DEFAULT false,
    "hechaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tarea_asignadaId_idx" ON "Tarea"("asignadaId");

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_asignadaId_fkey" FOREIGN KEY ("asignadaId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
