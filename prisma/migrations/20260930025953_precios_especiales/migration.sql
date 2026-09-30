-- CreateTable
CREATE TABLE "PrecioEspecial" (
    "clienteId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PrecioEspecial_pkey" PRIMARY KEY ("clienteId","productoId")
);

-- AddForeignKey
ALTER TABLE "PrecioEspecial" ADD CONSTRAINT "PrecioEspecial_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioEspecial" ADD CONSTRAINT "PrecioEspecial_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
