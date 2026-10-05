-- Cobranza: una parada de la hoja de ruta para cobrar plata (sin productos, sin cuenta corriente).
ALTER TYPE "OrigenPedido" ADD VALUE 'COBRANZA';
ALTER TABLE "Pedido" ADD COLUMN "cobrarMonto" DECIMAL(14,2);
