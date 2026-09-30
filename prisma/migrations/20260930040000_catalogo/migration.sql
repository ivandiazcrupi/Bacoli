-- AlterTable
ALTER TABLE "ListaPrecios" ADD COLUMN     "activa" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "ean" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "unidad" TEXT NOT NULL DEFAULT 'paquete';

-- CreateIndex
CREATE UNIQUE INDEX "Producto_sku_key" ON "Producto"("sku");


-- Catálogo inicial (se ejecuta una sola vez; no pisa lo que ya exista).
-- Unidad de venta: prepizzas y pizzetas por paquete; focaccia y pizzas congeladas por unidad.

-- La lista Minorista se oculta (los precios minoristas viven en la tienda online). No se borra.
UPDATE "ListaPrecios" SET "activa" = false WHERE "nombre" = 'Minorista';

-- Listas de precios (en una base ya en uso solo se agrega la que falte, VACALIN).
INSERT INTO "ListaPrecios" ("id", "nombre", "activa")
SELECT gen_random_uuid()::text, v.nombre, true
FROM (VALUES ('Mayorista'), ('Distribuidor'), ('VACALIN')) AS v(nombre)
WHERE NOT EXISTS (SELECT 1 FROM "ListaPrecios" l WHERE l."nombre" = v.nombre);

-- Códigos para los productos que ya existían.
UPDATE "Producto" SET "sku" = 'PPT01', "unidad" = 'paquete', "descripcion" = 'Prepizza de tomate x 2 un'
WHERE "nombre" = 'Prepizza tomate' AND "sku" IS NULL AND NOT EXISTS (SELECT 1 FROM "Producto" WHERE "sku" = 'PPT01');
UPDATE "Producto" SET "sku" = 'PPC02', "unidad" = 'paquete', "descripcion" = 'Prepizza de cebolla x 2 un'
WHERE "nombre" = 'Prepizza cebolla' AND "sku" IS NULL AND NOT EXISTS (SELECT 1 FROM "Producto" WHERE "sku" = 'PPC02');

-- Productos nuevos (solo si no existe uno con ese nombre o ese código).
INSERT INTO "Producto" ("id", "nombre", "sku", "unidad", "descripcion", "activo")
SELECT gen_random_uuid()::text, v.nombre, v.sku, v.unidad, v.descripcion, true
FROM (VALUES
  ('Prepizza tomate',             'PPT01', 'paquete', 'Prepizza de tomate x 2 un'),
  ('Prepizza cebolla',            'PPC02', 'paquete', 'Prepizza de cebolla x 2 un'),
  ('Pizzeta tomate',              'PZT03', 'paquete', 'Pizzeta de tomate x 6 un'),
  ('Focaccia oliva',              'FOO04', 'unidad',  'Focaccia de oliva'),
  ('Pizza congelada muzzarella',  'PCM05', 'unidad',  'Pizza congelada de muzzarella'),
  ('Pizza congelada jamón',       'PCJ06', 'unidad',  'Pizza congelada de jamón'),
  ('Pizza congelada fugazzeta',   'PCF07', 'unidad',  'Pizza congelada fugazzeta')
) AS v(nombre, sku, unidad, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM "Producto" p WHERE p."nombre" = v.nombre OR p."sku" = v.sku);
