-- Un vendedor puede indicar que un pedido de su cliente se pagó; la oficina lo confirma desde Cuenta corriente.
ALTER TABLE "Pedido" ADD COLUMN "pagoAvisadoPor" TEXT,
ADD COLUMN "pagoAvisadoEn" TIMESTAMP(3);
