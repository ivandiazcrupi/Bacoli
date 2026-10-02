import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { diasDeAtraso, incluirNc, partidaDe } from "@/lib/cobranza";
import { db } from "@/lib/db";
import { hoy } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../pedidos/Encabezado";
import { EncabezadoCuenta } from "./EncabezadoCuenta";
import { ListaComprobantes, type FilaComprobante } from "./ListaComprobantes";

const POR_PAGINA = 200;

// El N° se ordena como número (0001-00000012 → 100000012); los que todavía no tienen número van al final.
const clave = (n: string | null) => {
  const d = (n ?? "").replace(/\D/g, "");
  return d ? Number(d) : Number.MAX_SAFE_INTEGER;
};

type Params = { q?: string; estado?: string; pagina?: string };

// Listado de TODAS las facturas (o remitos) de menor a mayor número, para ver que no quede ninguna sin pagar.
export async function Listado({ tipo, searchParams, ruta }: { tipo: "FACTURA" | "REMITO"; searchParams: Params; ruta: string }) {
  const usuario = await exigirOficina();
  const { q = "", estado = "sin-pagar" } = searchParams;
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const hoyStr = hoy();
  const palabras = q.trim().split(/\s+/).filter(Boolean);

  const pedidos = await db.pedido.findMany({
    where: {
      clienteId: { not: null },
      conFactura: tipo === "FACTURA",
      estado: { in: ["PENDIENTE", "ENTREGADO"] },
      ...(estado === "sin-pagar" ? { pagado: false } : estado === "pagadas" ? { pagado: true } : {}),
      ...(palabras.length ? { AND: palabras.map((w) => ({ cliente: { nombre: { contains: w, mode: "insensitive" as const } } })) } : {}),
    },
    include: { items: true, cliente: true, ...incluirNc },
  });

  const todas: FilaComprobante[] = pedidos.flatMap((p) => {
    if (!p.cliente) return [];
    const x = partidaDe(p, p.cliente.condicionPago);
    return [{
      id: p.id, clienteId: p.cliente.id, cliente: p.cliente.nombre, tipo, numero: x.numero, cargado: x.cargado, fecha: x.fecha,
      entregado: x.entregado, bruto: x.bruto, nc: x.nc, cubierta: x.cubierta, ncTexto: x.ncNumeros.map((n) => `NC ${n}`).join(" · "), monto: x.monto, vence: x.vence, atraso: x.entregado ? diasDeAtraso(x.vence, hoyStr) : 0, pagada: x.pagada, medio: x.medio, obs: p.obsCobro ?? "",
    }];
  });
  todas.sort((a, b) => clave(a.numero) - clave(b.numero) || a.fecha.localeCompare(b.fecha));

  const sinPagar = todas.filter((f) => !f.pagada && !f.cubierta);
  const montoSinPagar = sinPagar.reduce((s, f) => s + f.monto, 0);
  const vencido = sinPagar.filter((f) => f.atraso > 0).reduce((s, f) => s + f.monto, 0);
  const paginas = Math.max(1, Math.ceil(todas.length / POR_PAGINA));
  const visibles = todas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const nombre = tipo === "FACTURA" ? "facturas" : "remitos";
  const hrefPagina = (n: number) => `${ruta}?${new URLSearchParams({ ...(q ? { q } : {}), estado, pagina: String(n) })}`;
  const celda = (titulo: string, valor: React.ReactNode, clase = "") => (
    <div className="min-w-0">
      <p className="border-b border-stone-300 bg-crema-100 px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">{titulo}</p>
      <p className={`px-3 py-3 text-center text-xl font-bold tabular-nums ${clase}`}>{valor}</p>
    </div>
  );

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoCuenta activa={tipo === "FACTURA" ? "facturas" : "remitos"} />

        <section aria-label="Resumen" className="grid grid-cols-1 divide-y divide-stone-300 overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {celda(`${tipo === "FACTURA" ? "Facturas" : "Remitos"} sin pagar`, sinPagar.length)}
          {celda("Monto sin pagar", formatoPesos(montoSinPagar))}
          {celda("Vencido", formatoPesos(vencido), vencido > 0 ? "text-rojo-700" : "")}
        </section>

        <form className="flex flex-wrap items-center gap-2">
          <input name="q" defaultValue={q} placeholder="Filtrar por cliente…" className="h-10 w-full max-w-md rounded-md border border-stone-400 bg-white px-3 text-sm shadow-sm focus:border-verde-700 focus:outline-none" />
          <select name="estado" defaultValue={estado} className="h-10 rounded-md border border-stone-400 bg-white px-3 text-sm shadow-sm">
            <option value="sin-pagar">Sin pagar</option>
            <option value="pagadas">Pagadas</option>
            <option value="todas">Todas</option>
          </select>
          <button className="h-10 rounded-md border border-stone-400 bg-white px-4 text-sm font-medium shadow-sm hover:border-verde-700">Filtrar</button>
          <span className="ml-auto text-sm text-stone-600">{todas.length} {todas.length === 1 ? nombre.slice(0, -1) : nombre} · de menor a mayor número</span>
        </form>

        <section className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm" aria-label={`Listado de ${nombre}`}>
          <ListaComprobantes filas={visibles} />
        </section>

        {paginas > 1 && (
          <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Páginas">
            {pagina > 1 && <Link href={hrefPagina(pagina - 1)} className="rounded-md border border-stone-400 bg-white px-3 py-2 font-medium shadow-sm">← Anteriores</Link>}
            <span className="text-stone-600">Página {pagina} de {paginas}</span>
            {pagina < paginas && <Link href={hrefPagina(pagina + 1)} className="rounded-md border border-stone-400 bg-white px-3 py-2 font-medium shadow-sm">Siguientes →</Link>}
          </nav>
        )}
      </main>
    </>
  );
}
