-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 0;


-- Orden 1 a 7 según el número del código, y nombres en mayúscula (pizzas congeladas sin la palabra "congelada").
UPDATE "Producto" SET "orden" = 1, "nombre" = 'PREPIZZA TOMATE'    WHERE "sku" = 'PPT01';
UPDATE "Producto" SET "orden" = 2, "nombre" = 'PREPIZZA CEBOLLA'   WHERE "sku" = 'PPC02';
UPDATE "Producto" SET "orden" = 3, "nombre" = 'PIZZETA TOMATE'     WHERE "sku" = 'PZT03';
UPDATE "Producto" SET "orden" = 4, "nombre" = 'FOCACCIA OLIVA'     WHERE "sku" = 'FOO04';
UPDATE "Producto" SET "orden" = 5, "nombre" = 'PIZZA MUZZARELLA'   WHERE "sku" = 'PCM05';
UPDATE "Producto" SET "orden" = 6, "nombre" = 'PIZZA JAMÓN'        WHERE "sku" = 'PCJ06';
UPDATE "Producto" SET "orden" = 7, "nombre" = 'PIZZA FUGAZZETA'    WHERE "sku" = 'PCF07';
-- Productos agregados a mano: van al final y también en mayúscula.
UPDATE "Producto" SET "orden" = 100 WHERE "orden" = 0;
UPDATE "Producto" SET "nombre" = UPPER("nombre") WHERE "nombre" <> UPPER("nombre");
