-- CreateTable
CREATE TABLE "AvisoLogistica" (
    "fecha" DATE NOT NULL,
    "avisadoPor" TEXT NOT NULL,
    "avisadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvisoLogistica_pkey" PRIMARY KEY ("fecha")
);
