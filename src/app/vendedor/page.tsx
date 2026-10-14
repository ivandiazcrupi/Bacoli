import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { esFechaValida, hoy } from "@/lib/fechas";
import { exigirVendedor, vendedorDeUsuario } from "@/lib/session";
import { filasDelPeriodo, mesAnterior, mesSiguiente, nombreMes } from "@/lib/vendedores";
import { HojaVendedor } from "../comercial/vendedores/HojaVendedor";
import { CONTENEDOR_PEDIDOS } from "../pedidos/Encabezado";
import { EncabezadoVendedor } from "./EncabezadoVendedor";

const nav = "flex h-9 items-center rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold hover:border-stone-600";

// ESTADÍSTICAS (vendedor): cómo viene su mes (la misma hoja que ve la oficina en Comercial → Vendedores, sin la tabla de pedidos: esa está en PEDIDOS).
export default async function MiHoja({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const usuario = await exigirVendedor();
  const vendedor = await vendedorDeUsuario(usuario.id); // su ficha en Comercial → Vendedores (si todavía no la enlazaron, no ve nada)
  const { mes: mesParam } = await searchParams;
  const actual = hoy().slice(0, 7);
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) && esFechaValida(`${mesParam}-01`) ? mesParam : actual;
  const id = vendedor?.id ?? "-";
  const [filasMes, filasAnt] = vendedor
    ? await Promise.all([filasDelPeriodo(`${mes}-01`, `${mesSiguiente(mes)}-01`), filasDelPeriodo(`${mesAnterior(mes)}-01`, `${mes}-01`)])
    : [[], []];
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={`${CONTENEDOR_PEDIDOS} space-y-5`}>
        <EncabezadoVendedor
          activa="estadisticas" titulo={vendedor?.nombre}
          derecha={
            <>
              <nav className="flex items-center gap-2" aria-label="Mes">
                <Link href={`/vendedor?mes=${mesAnterior(mes)}`} className={nav} aria-label="Mes anterior">←</Link>
                <span className="min-w-44 rounded-md border border-stone-800 bg-stone-800 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">{nombreMes(mes)}</span>
                <Link href={`/vendedor?mes=${mesSiguiente(mes)}`} className={nav} aria-label="Mes siguiente">→</Link>
                {mes !== actual && <Link href="/vendedor" className={nav}>Este mes</Link>}
              </nav>
              <Link href="/vendedor/nuevo" className="ml-2 whitespace-nowrap rounded-lg bg-verde-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800 sm:px-10">+ Cargar pedido</Link>
            </>
          }
        />
        {vendedor ? (
          <HojaVendedor nombre={vendedor.nombre} pct={Number(vendedor.comisionPct ?? 0)} mes={mes} filas={filasMes.filter((x) => x.vendedorId === id)} anteriores={filasAnt.filter((x) => x.vendedorId === id)} modo="vendedor" conTabla={false} />
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-stone-500">Todavía no te enlazaron con tu ficha de vendedor. Pedile a la oficina que lo haga.</p>
        )}
      </main>
    </>
  );
}
