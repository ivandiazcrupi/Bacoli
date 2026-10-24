-- CreateTable
CREATE TABLE "BarrioCp" (
    "cp" TEXT NOT NULL,
    "barrio" TEXT NOT NULL,
    "veces" INTEGER NOT NULL DEFAULT 1,
    "total" INTEGER NOT NULL DEFAULT 1,
    "detalle" TEXT,
    "actualizado" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarrioCp_pkey" PRIMARY KEY ("cp")
);
