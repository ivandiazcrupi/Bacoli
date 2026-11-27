-- Lista "Encargado" de Tareas: columna nueva (no cambia ni borra nada).
ALTER TABLE "Tarea" ADD COLUMN "paraEncargado" BOOLEAN NOT NULL DEFAULT false;
