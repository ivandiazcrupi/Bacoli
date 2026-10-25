-- CreateTable
CREATE TABLE "AprobacionCosto" (
    "fecha" DATE NOT NULL,
    "costoDia" DECIMAL(14,2) NOT NULL,
    "unidades" INTEGER NOT NULL,
    "aprobadoPor" TEXT NOT NULL,
    "aprobadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AprobacionCosto_pkey" PRIMARY KEY ("fecha")
);
