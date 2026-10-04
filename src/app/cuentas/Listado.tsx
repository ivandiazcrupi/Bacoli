import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { diasDeAtraso, incluirNc, partidaDe } from "@/lib/cobranza";
import { db } from "@/lib/db";
import { cargarFacturas } from "@/lib/facturas";
import { AccionesArca } from "./AccionesArca";
import { hoy } from "@/lib/fechas";
import { formatoRemito } from "@/lib/remito";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../pedidos/Encabezado";
import { EncabezadoCuenta } from "./EncabezadoCuenta";
import { CONTENEDOR_TABLA, Resumen } from "./estilo";
import { filaDeArca, filaDeRemito } from "./filas";
import { ListaComprobantes, type FilaComprobante } from "./ListaComprobantes";

const POR_PAGINA = 20000;
const pad4 = (n: number) => String(n).padStart(4, "0");

// El N° se ordena como número (0001-00000012 → 100000012); los que todavía no tienen número van al final.
const clave = (n: string | null) => {
  const d = (n ?? "").replace(/\D/g, "");
  return d ? Number(d) : Number.MAX_SAFE_INTEGER;
};

type Params = { q?: string; estado?: string; pagina?: string };

// Listado de TODAS las facturas (o remitos) de menor a mayor número, para ver que no quede ninguna sin pagar.
export async function Listado({ tipo, searchParams, ruta }: { tipo: "FACTURA" | "REMITO"; searchParams: Params; ruta: string }) {
  const usuario = await exigirOficina();
  const q: string = "", estado: string = "todas"; // los filtros ahora se hacen en la hoja (como un Excel), con todas las filas cargadas
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const hoyStr = hoy();
  const conAnulados = tipo === "REMITO" && estado === "todas";
  const palabras = q.trim().split(/\s+/).filter(Boolean);

  const pedidos = tipo === "FACTURA" ? [] : await db.pedido.findMany({
    where: {
      clienteId: { not: null },
      conFactura: false,
      // En REMITOS → Todas también se ven los anulados y no entregados que tienen número, para que la numeración se vea completa.
      ...(conAnulados
        ? { estado: { in: ["PENDIENTE", "ENTREGADO", "CANCELADO", "NO_ENTREGADO"] as ("PENDIENTE" | "ENTREGADO" | "CANCELADO" | "NO_ENTREGADO")[] }, OR: [{ estado: { in: ["PENDIENTE", "ENTREGADO"] as ("PENDIENTE" | "ENTREGADO")[] } }, { remitoNumero: { not: null } }] }
        : { estado: { in: ["PENDIENTE", "ENTREGADO"] as ("PENDIENTE" | "ENTREGADO")[] } }),
      ...(estado === "sin-pagar" ? { pagado: false } : estado === "pagadas" ? { pagado: true } : {}),
      ...(palabras.length ? { AND: palabras.map((w) => ({ cliente: { nombre: { contains: w, mode: "insensitive" as const } } })) } : {}),
    },
    include: { items: true, cliente: true, ...incluirNc },
  });

  const todas: FilaComprobante[] = pedidos.flatMap((p) => (p.cliente ? [filaDeRemito(p, p.cliente, hoyStr)] : []));

  // FACTURAS: salen de ARCA (facturas y notas de crédito), en las mismas columnas que los remitos.
  let ncSinAplicar = 0;
  const cantidadArca = tipo === "FACTURA" ? await db.comprobanteArca.count() : 0;
  let escritasSinArca: string[] = [];
  if (tipo === "FACTURA") {
    const { filas, controles, puntosDeCuit } = await cargarFacturas();
    ncSinAplicar = controles.ncSinAplicar.length;
    escritasSinArca = controles.sinArca.map((p) => p.numeroFactura ?? "");
    for (const f of filas) todas.push(filaDeArca(f, puntosDeCuit(f.cuit)));
  }

  // Remitos que se emitieron y el pedido pasó a llevar factura: el número existe, así que se ve (no es un hueco).
  if (tipo === "REMITO" && estado === "todas" && palabras.length === 0) {
    const conFacturaYRemito = await db.pedido.findMany({ where: { clienteId: { not: null }, conFactura: true, remitoNumero: { not: null } }, include: { cliente: true }, orderBy: { remitoNumero: "asc" } });
    for (const p of conFacturaYRemito) {
      if (!p.cliente || !p.remitoNumero) continue;
      todas.push({ id: p.id, clienteId: p.cliente.id, cliente: p.cliente.nombre, tipo, numero: formatoRemito(p.remitoNumero), cargado: p.creadoEn.toISOString().slice(0, 10), fecha: (p.fechaEntrega ?? p.creadoEn).toISOString().slice(0, 10), entregado: false, bruto: 0, nc: 0, cubierta: false, anulado: "Pasó a factura", ncTexto: "", monto: 0, vence: "", atraso: 0, pagada: false, medio: null, obs: "" });
    }
  }
  // Números que no aparecen en ningún pedido (saltos de numeración): se muestran como "Sin usar" para que la numeración se vea completa.
  const huecos: FilaComprobante[] = [];
  if (tipo === "REMITO" && estado === "todas" && palabras.length === 0) {
    const usados = new Set(todas.map((f) => (f.numero ?? "").replace(/\D/g, "")).filter(Boolean).map(Number));
    const nums = [...usados].filter((n) => n < 1_000_000);
    if (nums.length > 0) {
      const desde = Math.min(...nums), hasta = Math.max(...nums);
      if (hasta - desde <= 20000) {
        for (let n = desde; n <= hasta; n++) {
          if (usados.has(n)) continue;
          huecos.push({ id: `hueco-${n}`, clienteId: "", cliente: "", tipo, numero: tipo === "REMITO" ? formatoRemito(n) : `F-${pad4(n)}`, cargado: "", fecha: "", entregado: false, bruto: 0, nc: 0, cubierta: false, anulado: "Sin usar", ncTexto: "", monto: 0, vence: "", atraso: 0, pagada: false, medio: null, obs: "", hueco: true });
        }
      }
    }
  }
  const sinHuecos = todas.filter((f) => !f.esNc).length;
  todas.push(...huecos);
  todas.sort((a, b) => tipo === "FACTURA" ? a.fecha.localeCompare(b.fecha) || Number(!!a.esNc) - Number(!!b.esNc) || clave(a.numero) - clave(b.numero) : clave(a.numero) - clave(b.numero) || a.fecha.localeCompare(b.fecha));

  const sinPagar = todas.filter((f) => !f.hueco && !f.esNc).filter((f) => !f.pagada && !f.cubierta && !f.anulado);
  const montoSinPagar = sinPagar.reduce((s, f) => s + f.monto, 0);
  const vencido = sinPagar.filter((f) => f.atraso > 0).reduce((s, f) => s + f.monto, 0);
  const paginas = Math.max(1, Math.ceil(todas.length / POR_PAGINA));
  const visibles = todas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const nombre = tipo === "FACTURA" ? "facturas" : "remitos";
  const hrefPagina = (n: number) => `${ruta}?${new URLSearchParams({ ...(q ? { q } : {}), estado, pagina: String(n) })}`;
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoCuenta activa={tipo === "FACTURA" ? "facturas" : "remitos"} />

        <Resumen datos={[
          { titulo: `${tipo === "FACTURA" ? "Facturas" : "Remitos"} sin pagar`, valor: sinPagar.length },
          { titulo: "Monto sin pagar", valor: formatoPesos(montoSinPagar) },
          tipo === "FACTURA" ? { titulo: "NC sin aplicar", valor: ncSinAplicar, rojo: ncSinAplicar > 0 } : { titulo: "Vencido", valor: formatoPesos(vencido), rojo: vencido > 0 },
        ]} />

        {tipo === "FACTURA" && escritasSinArca.length > 0 && <p className="text-sm font-semibold text-rojo-700">Números escritos en pedidos que ARCA no tiene: {escritasSinArca.join(", ")}</p>}

        <section className={CONTENEDOR_TABLA} aria-label={`Listado de ${nombre}`}>
          <ListaComprobantes filas={visibles} tipo={tipo} acciones={tipo === "FACTURA" ? <AccionesArca esDueno={usuario.rol === "DUENO"} cantidad={cantidadArca} /> : undefined} />
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
