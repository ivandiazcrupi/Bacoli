-- Nombres de zona en mayúscula y en el orden que pidió el dueño: CABA, ZONA SUR, ZONA NORTE, ZONA OESTE.
-- Solo cambia el texto del nombre: los clientes y sucursales siguen apuntando a la misma zona.
UPDATE "Zona" SET "nombre" = 'CABA', "orden" = 0 WHERE "nombre" = 'CABA';
UPDATE "Zona" SET "nombre" = 'ZONA SUR', "orden" = 1 WHERE "nombre" = 'Sur';
UPDATE "Zona" SET "nombre" = 'ZONA NORTE', "orden" = 2 WHERE "nombre" = 'Norte';
UPDATE "Zona" SET "nombre" = 'ZONA OESTE', "orden" = 3 WHERE "nombre" = 'Oeste';
