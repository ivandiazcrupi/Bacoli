-- IVA variable: cada cliente tiene su IVA (10,5 por defecto, como hasta ahora), cada producto puede tener el suyo propio y cada renglón del pedido guarda el que se usó.
ALTER TABLE "Cliente" ADD COLUMN "ivaPct" DECIMAL(5,2) NOT NULL DEFAULT 10.5;
ALTER TABLE "Producto" ADD COLUMN "ivaPct" DECIMAL(5,2);
ALTER TABLE "PedidoItem" ADD COLUMN "ivaPct" DECIMAL(5,2);
