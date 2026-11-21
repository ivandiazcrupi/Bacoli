import { db } from "@/lib/db";
import { hoy } from "@/lib/fechas";
import { titulo } from "@/lib/mayusculas";
import { exigirOficina } from "@/lib/session";
import { BarraImpresion } from "../../../pedidos/remito/BarraImpresion";
import { NombreDelPdf } from "../../../cuentas/[id]/estado/NombreDelPdf";
import { clientesConVendedor } from "../datos";

type Params = Promise<{ v?: string; q?: string; inactivos?: string }>;

async function nombreDe(v: string) {
  if (v === "todos") return "TODOS";
  if (v === "fabrica") return "FABRICA";
  const x = await db.vendedor.findUnique({ where: { id: v }, select: { nombre: true } });
  return titulo(x?.nombre ?? "Vendedor").toUpperCase();
}

// El título es el nombre con el que el navegador propone guardar el PDF: CLIENTES-NOMBRE-DDMMAAAA.
export async function generateMetadata({ searchParams }: { searchParams: Params }) {
  const { v = "todos" } = await searchParams;
  const [a, m, d] = hoy().split("-");
  return { title: `CLIENTES-${(await nombreDe(v)).replace(/[\\/:*?"<>|]+/g, " ")}-${d}${m}${a}` };
}

// Lista de clientes de un vendedor (o de la fábrica) lista para imprimir o guardar como PDF.
export default async function ImprimirAsignacion({ searchParams }: { searchParams: Params }) {
  await exigirOficina();
  const { v = "todos", q = "", inactivos } = await searchParams;
  const filas = await clientesConVendedor(v, q, inactivos === "1");
  const nombre = await nombreDe(v);
  const [a, m, d] = hoy().split("-");
  const quien = v === "todos" ? "Todos los clientes" : v === "fabrica" ? "Clientes de la fábrica" : `Clientes de ${titulo(nombre.toLowerCase())}`;

  return (
    <div className="bg-stone-200 print:bg-white">
      <NombreDelPdf nombre={`CLIENTES-${nombre.replace(/[\\/:*?"<>|]+/g, " ")}-${d}${m}${a}`} />
      <style>{"@page { size: A4; margin: 12mm } @media print { html { font-size: 13px !important } body { background: #fff !important; padding-bottom: 0 !important } tr { break-inside: avoid } thead { display: table-header-group } }"}</style>
      <BarraImpresion volver="/comercial/asignacion" />
      <p className="mx-auto mt-3 max-w-[210mm] px-2 text-right text-sm text-stone-500 print:hidden">Para guardar en PDF: Imprimir → destino “Guardar como PDF”.</p>
      <div className="py-4 print:py-0">
        <section className="mx-auto min-h-[270mm] w-full max-w-[210mm] bg-white p-[10mm] font-[Helvetica,Arial,sans-serif] text-neutral-900 shadow print:min-h-0 print:max-w-none print:w-full print:p-0 print:shadow-none">
          <header className="flex items-end justify-between border-b border-neutral-900 pb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-500">BACOLI</p>
              <h1 className="mt-1 text-[24px] font-bold leading-none tracking-tight">{quien}</h1>
            </div>
            <p className="text-right text-[12px] text-neutral-600">{d}/{m}/{a} · {filas.length} {filas.length === 1 ? "cliente" : "clientes"}</p>
          </header>
          <table className="mt-4 w-full text-[12px]">
            <thead>
              <tr className="border-b border-neutral-900 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                <th className="w-8 py-2 pr-2 text-right">N°</th><th className="py-2">Cliente</th><th>Sucursales (barrio · dirección)</th><th>Teléfono</th>{v === "todos" && <th>Atiende</th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={f.id} className="border-b border-neutral-200 align-top">
                  <td className="py-1.5 pr-2 text-right tabular-nums text-neutral-400">{i + 1}</td>
                  <td className="py-1.5 pr-3 font-bold">{f.nombre}</td>
                  <td className="py-1.5 pr-3 leading-snug">{f.sucursales.length === 0 ? "—" : f.sucursales.map((s, k) => <div key={k}><b>{s.barrio}</b> · {s.direccion}</div>)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{f.telefonos.length === 0 ? "—" : f.telefonos.map((t) => <div key={t}>{t}</div>)}</td>
                  {v === "todos" && <td className="py-1.5">{f.vendedor}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length === 0 && <p className="py-10 text-center text-neutral-500">No hay clientes en esta lista.</p>}
        </section>
      </div>
    </div>
  );
}
