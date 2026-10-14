-- DropForeignKey
ALTER TABLE "Cliente" DROP CONSTRAINT "Cliente_vendedorId_fkey";

-- CreateTable
CREATE TABLE "Vendedor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "comisionPct" DECIMAL(5,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendedor_usuarioId_key" ON "Vendedor"("usuarioId");

-- Los usuarios con rol Vendedor (y cualquiera que ya figure como vendedor de un cliente) pasan a la lista de vendedores CON EL MISMO id,
-- así los clientes y los cambios ya cargados siguen apuntando al mismo vendedor. No se pierde nada.
INSERT INTO "Vendedor" ("id", "nombre", "comisionPct", "activo", "usuarioId")
SELECT u."id", u."nombre", u."comisionPct", u."activo", CASE WHEN u."rol" = 'VENDEDOR' THEN u."id" ELSE NULL END
FROM "Usuario" u
WHERE u."rol" = 'VENDEDOR' OR u."id" IN (SELECT "vendedorId" FROM "Cliente" WHERE "vendedorId" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "Vendedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendedor" ADD CONSTRAINT "Vendedor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
