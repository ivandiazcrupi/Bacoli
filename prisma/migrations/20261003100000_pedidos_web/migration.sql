-- Pedidos de la tienda online (Empretienda): no tienen cliente ni sucursal y guardan sus datos de entrega en el mismo pedido.
-- Solo vuelve opcionales dos columnas y agrega columnas nuevas: no cambia ni borra ningún dato cargado.
ALTER TABLE "Pedido" ALTER COLUMN "clienteId" DROP NOT NULL;
ALTER TABLE "Pedido" ALTER COLUMN "puntoId" DROP NOT NULL;
ALTER TABLE "Pedido" ADD COLUMN "webOrden" TEXT;
ALTER TABLE "Pedido" ADD COLUMN "webNombre" TEXT;
ALTER TABLE "Pedido" ADD COLUMN "webDireccion" TEXT;
ALTER TABLE "Pedido" ADD COLUMN "webBarrio" TEXT;
ALTER TABLE "Pedido" ADD COLUMN "webTelefono" TEXT;
ALTER TABLE "Pedido" ADD COLUMN "webTotal" DECIMAL(14,2);
ALTER TABLE "Pedido" ADD COLUMN "webPago" TEXT;
CREATE UNIQUE INDEX "Pedido_webOrden_key" ON "Pedido"("webOrden");

-- Renglones de la tienda que no están en el catálogo (ej. el combo) y cuántos paquetes ocupa cada unidad.
ALTER TABLE "PedidoItem" ALTER COLUMN "productoId" DROP NOT NULL;
ALTER TABLE "PedidoItem" ADD COLUMN "paquetesPor" INTEGER NOT NULL DEFAULT 1;

-- Las relaciones pasan a ser opcionales (Prisma las vuelve a crear con "ON DELETE SET NULL").
ALTER TABLE "Pedido" DROP CONSTRAINT "Pedido_clienteId_fkey";
ALTER TABLE "Pedido" DROP CONSTRAINT "Pedido_puntoId_fkey";
ALTER TABLE "PedidoItem" DROP CONSTRAINT "PedidoItem_productoId_fkey";
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_puntoId_fkey" FOREIGN KEY ("puntoId") REFERENCES "PuntoEntrega"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
