-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "marcaId" TEXT;

-- CreateTable
CREATE TABLE "Marca" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Marca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioMarca" (
    "marcaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PrecioMarca_pkey" PRIMARY KEY ("marcaId","productoId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Marca_nombre_key" ON "Marca"("nombre");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioMarca" ADD CONSTRAINT "PrecioMarca_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioMarca" ADD CONSTRAINT "PrecioMarca_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
