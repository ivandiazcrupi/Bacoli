import { Cabecera } from "@/components/Cabecera";
import type { Usuario } from "@prisma/client";
import { hayClaveVendedores } from "@/lib/claveVendedores";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { EncabezadoComercial, type PestañaComercial } from "../EncabezadoComercial";
import { FormClave } from "./Formularios";

// Pantalla de la contraseña: se ve cuando todavía no se entró al apartado Vendedores.
export async function PantallaBloqueada({ usuario, activa = "vendedores", titulo = "Vendedores", volver = "/comercial/vendedores" }: { usuario: Usuario; activa?: PestañaComercial; titulo?: string; volver?: string }) {
  const hay = await hayClaveVendedores();
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoComercial activa={activa} />
        <div className="mx-auto mt-16 w-full max-w-md space-y-6 rounded-2xl border border-stone-200 bg-white px-8 py-10 text-center">
          <div>
            <h1 className="!border-0 text-xl font-semibold">{titulo}</h1>
            <p className="mt-1 text-sm text-stone-500">{hay ? "Ingresá la contraseña para ver este apartado (es la misma para Vendedores y Estadísticas)." : "Este apartado se abre con una contraseña."}</p>
          </div>
          <FormClave hayClave={hay} esDueno={usuario.rol === "DUENO"} volver={volver} />
        </div>
      </main>
    </>
  );
}
