-- Contraseña del apartado Comercial (Vendedores, Estadísticas, Tienda online, total de la semana, montos del asistente) para quienes NO son gerentes.
-- Se guarda cifrada (bcrypt). Solo cambia esa columna de la fila de la empresa; no toca nada más. Un gerente puede cambiarla desde Comercial → Vendedores.
INSERT INTO "Empresa" ("id", "claveVendedoresHash") VALUES ('principal', '$2b$12$ABkF9KKeJWE5AuJQrmo73uXVdqP.6ncZMr09Ln3wfx7aCAqnjNtRK')
ON CONFLICT ("id") DO UPDATE SET "claveVendedoresHash" = EXCLUDED."claveVendedoresHash";
