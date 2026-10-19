import { BotonVolver } from "@/components/BotonVolver";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../../../pedidos/Encabezado";
import { crearLead } from "../actions";
import { FormLead, LEAD_VACIO } from "../FormLead";

export default async function NuevoLead() {
  const usuario = await exigirOficina();
  const vendedores = [...new Set([...(await db.lead.findMany({ distinct: ["vendedor"], select: { vendedor: true } })).map((l) => l.vendedor).filter(Boolean) as string[], usuario.nombre])];
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={`${CONTENEDOR_PEDIDOS} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Cargar lead</h1>
          <BotonVolver fallback="/comercial/leads" />
        </div>
        <p className="text-sm text-stone-600">Solo el nombre es obligatorio. En “Más datos” podés sumar la persona de contacto, el email, la dirección y cuándo volver a escribirle.</p>
        <FormLead accion={crearLead} inicial={LEAD_VACIO} textoBoton="Cargar lead" vendedores={vendedores} />
      </main>
    </>
  );
}
