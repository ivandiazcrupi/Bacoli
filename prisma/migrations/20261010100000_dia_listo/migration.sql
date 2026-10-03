-- CreateTable
CREATE TABLE "DiaListo" (
    "fecha" DATE NOT NULL,
    "listoPor" TEXT NOT NULL,
    "listoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaListo_pkey" PRIMARY KEY ("fecha")
);

