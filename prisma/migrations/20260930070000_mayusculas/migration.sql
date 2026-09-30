-- Datos de texto en mayúscula (nombres, direcciones, barrios, descripciones). No cambia la estructura.
-- Los comentarios libres, emails y contraseñas no se tocan.
UPDATE "Cliente" SET
  "nombre" = UPPER("nombre"),
  "razonSocial" = UPPER("razonSocial"),
  "comisionista" = UPPER("comisionista");

UPDATE "PuntoEntrega" SET
  "alias" = UPPER("alias"),
  "direccion" = UPPER("direccion"),
  "barrio" = UPPER("barrio");

UPDATE "Producto" SET "descripcion" = UPPER("descripcion");
UPDATE "ListaPrecios" SET "nombre" = UPPER("nombre") WHERE "nombre" <> UPPER("nombre");
