-- DropForeignKey
ALTER TABLE "Cliente" DROP CONSTRAINT "Cliente_marcaId_fkey";

-- DropForeignKey
ALTER TABLE "PrecioMarca" DROP CONSTRAINT "PrecioMarca_marcaId_fkey";

-- DropForeignKey
ALTER TABLE "PrecioMarca" DROP CONSTRAINT "PrecioMarca_productoId_fkey";

-- AlterTable
ALTER TABLE "Cliente" DROP COLUMN "marcaId";

-- DropTable
DROP TABLE "Marca";

-- DropTable
DROP TABLE "PrecioMarca";

