import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { cargarFacturas, soloDigitos } from "@/lib/facturas";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../pedidos/Encabezado";
import { SubirArchivo } from "./arca/SubirArchivo";
import { EncabezadoCuenta } from "./EncabezadoCuenta";
import { ListaFacturas } from "./ListaFacturas";

const VISTAS = [
  { id: "todas", texto: "Todas" },
  { id: "pendientes", texto: "Pendientes de pago" },
  { id: "pagadas", texto: "Pagadas" },
  { id: "nc", texto: "NC sin aplicar" },
] as const;

// CUENTA CORRIENTE → FACTURAS: las facturas y notas de crédito que emitió ARCA, con su cobranza.
export default async function Facturas({ searchParams }: { searchParams: Promise<{ ver?: string; q?: string; control?: string }> }) {
  const usuario = await exigirOficina();
  const { ver = "todas", q = "", control = "" } = await searchParams;
  const { filas, controles, puntosDeCuit } = await cargarFacturas();

  const buscado = q.trim().toLowerCase();
  const digitos = soloDigitos(q);
  let lista = filas;
  if (control === "sinPedido") lista = controles.sinPedido;
  else if (control === "diferencias") lista = controles.conDiferencias;
  else if (ver === "pendientes") lista = filas.filter((f) => !f.esNc && !f.pagada && f.saldo > 0.01);
  else if (ver === "pagadas") lista = filas.filter((f) => !f.esNc && (f.pagada || f.saldo <= 0.01));
  else if (ver === "nc") lista = controles.ncSinAplicar;
  if (buscado) lista = lista.filter((f) => `${f.cliente ?? ""} ${f.razonSocial ?? ""} ${f.sucursal ?? ""} ${f.observacion ?? ""}`.toLowerCase().includes(buscado) || (digitos && (String(f.numero).includes(digitos) || (f.cuit ?? "").includes(digitos))));

  const pendientes = filas.filter((f) => !f.esNc && !f.pagada && f.saldo > 0.01);
  const debe = pendientes.reduce((s, f) => s + f.saldo, 0);
  const puntosPorCuit: Record<string, ReturnType<typeof puntosDeCuit>> = {};
  for (const f of lista) if (f.cuit && !puntosPorCuit[f.cuit]) puntosPorCuit[f.cuit] = puntosDeCuit(f.cuit);

  const avisos: { id: string; n: number; texto: string }[] = [
    { id: "sinPedido", n: controles.sinPedido.length, texto: "sin pedido" },
    { id: "diferencias", n: controles.conDiferencias.length, texto: "con diferencias" },
  ];
  const href = (p: Record<string, string>) => { const s = new URLSearchParams(p); if (buscado) s.set("q", q.trim()); const t = s.toString(); return t ? `/cuentas?${t}` : "/cuentas"; };
  const chip = (activo: boolean) => `whitespace-nowrap rounded-full border px-3 py-1 text-[12.5px] font-semibold ${activo ? "border-stone-800 bg-stone-800 text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"}`;

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoCuenta activa="facturas" />
        <div className="flex flex-wrap items-center gap-2">
          {VISTAS.map((v) => <Link key={v.id} href={href(v.id === "todas" ? {} : { ver: v.id })} className={chip(!control && ver === v.id)}>{v.texto}</Link>)}
          <form action="/cuentas" className="ml-auto flex items-center gap-2">
            {ver !== "todas" && <input type="hidden" name="ver" value={ver} />}
            <input name="q" defaultValue={q} placeholder="Buscar cliente, número o CUIT" className="h-8 w-56 rounded-md border border-stone-300 px-2.5 text-[13px]" />
          </form>
        </div>
        <p className="text-[13px] text-stone-600">
          {filas.filter((f) => !f.esNc).length} facturas · <b className="text-stone-900">Falta cobrar {formatoPesos(debe)}</b> ({pendientes.length})
          {avisos.filter((a) => a.n > 0).map((a) => <Link key={a.id} href={href({ control: a.id })} className={`ml-3 font-semibold ${control === a.id ? "text-rojo-700 underline" : "text-rojo-700 hover:underline"}`}>{a.n} {a.texto}</Link>)}
          {controles.sinArca.length > 0 && <span className="ml-3 font-semibold text-rojo-700" title="Números escritos en la hoja de ruta que ARCA no tiene">{controles.sinArca.length} números escritos que ARCA no tiene: {controles.sinArca.map((p) => p.numeroFactura).join(", ")}</span>}
        </p>
        <ListaFacturas filas={lista} puntosPorCuit={puntosPorCuit} />
        <details className="text-[13px]">
          <summary className="cursor-pointer font-semibold text-stone-600 hover:text-stone-900">Subir archivo de ARCA</summary>
          <p className="mt-2 text-stone-600">Libro IVA Ventas (VENTAS.txt) o el CSV de Mis Comprobantes → Emitidos. No duplica lo ya cargado.</p>
          <div className="mt-2"><SubirArchivo /></div>
        </details>
      </main>
    </>
  );
}
