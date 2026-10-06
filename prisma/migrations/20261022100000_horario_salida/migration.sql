-- Horario opcional de cada reparto (HH:MM): solo se agregan columnas, no se toca nada existente.
ALTER TABLE "Salida" ADD COLUMN "horaInicio" TEXT;
ALTER TABLE "Salida" ADD COLUMN "horaFin" TEXT;
