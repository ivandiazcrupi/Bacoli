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
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Cargar lead</h1>
          <BotonVolver fallback="/comercial/leads" />
        </div>
        <p className="mt-1 text-sm text-stone-600">Un posible cliente que todavía no pidió. Con el nombre y un dato para contactarlo alcanza; lo demás se completa después.</p>
        <div className="mt-4"><FormLead accion={crearLead} inicial={LEAD_VACIO} textoBoton="Cargar lead" vendedores={vendedores} /></div>
      </main>
    </>
  );
}
