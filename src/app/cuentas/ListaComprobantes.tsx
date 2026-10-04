"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { formatoPesos } from "@/lib/numeros";
import { FiltroLista } from "./FiltroLista";
import { deshacerPago, guardarObservacion, registrarPagos } from "./actions";
import { aplicarNc, deshacerPagoArca, guardarDatosArca, quitarAplicacionNc, registrarPagosArca } from "./arca/actions";

export type FilaComprobante = {
  id: string;
  clienteId: string;
  cliente: string;
  tipo: "FACTURA" | "REMITO";
  numero: string | null;
  cargado: string;
  fecha: string;
  entregado: boolean;
  bruto: number;
  nc: number;
  cubierta: boolean;
  anulado?: string | null; // "Anulado" o "No entregado": tiene número pero ya no se debe
  ncTexto: string; // "NC 0001-00000045" (vacío si no tiene)
  monto: number;
  vence: string;
  atraso: number;
  pagada: boolean;
  medio: string | null;
  obs: string;
  hueco?: boolean; // número que no aparece en ningún pedido: se ve para que la numeración esté completa
  // Facturas y notas de crédito que vienen de ARCA (misma lista, mismas columnas):
  arca?: boolean;
  esNc?: boolean;
  cuit?: string | null;
  saldo?: number;
  sucursal?: string | null;
  puntoId?: string | null;
  puntos?: { id: string; barrio: string; direccion: string }[];
  aviso?: string;
  sinPedido?: boolean;
  pedidoId?: string | null;
  aplicaciones?: { id: string; facturaNumero: number; monto: number }[];
};

const MEDIOS = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "CHEQUE", texto: "Cheque" },
  { valor: "OTRO", texto: "Otro" },
];
const TEXTO_MEDIO: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE: "Cheque", MERCADO_PAGO: "Mercado Pago", OTRO: "Otro" };
const fechaCorta = (s: string) => (s ? `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : "");
const POR_VEZ = 250;

type ColId = "numero" | "cliente" | "sucursal" | "fecha" | "entrega" | "vence" | "monto" | "estado" | "pedido" | "nc" | "obs";
type Columna = { id: ColId; titulo: string; ancho: string; solo?: "arca" | "remito"; ordena?: boolean; filtro?: "texto" | "estado" | "pedido" | "lista" };

const COLUMNAS: Columna[] = [
  { id: "numero", titulo: "Número", ancho: "132px", ordena: true, filtro: "texto" },
  { id: "cliente", titulo: "Cliente", ancho: "minmax(180px,1.3fr)", ordena: true, filtro: "lista" },
  { id: "sucursal", titulo: "Sucursal", ancho: "128px", solo: "arca", filtro: "lista" },
  { id: "fecha", titulo: "Fecha", ancho: "78px", ordena: true, filtro: "texto" },
  { id: "entrega", titulo: "Entrega", ancho: "78px", solo: "remito", filtro: "texto" },
  { id: "vence", titulo: "Vence", ancho: "78px", solo: "remito", filtro: "texto" },
  { id: "monto", titulo: "Monto", ancho: "124px", ordena: true, filtro: "texto" },
  { id: "estado", titulo: "Estado", ancho: "184px", ordena: true, filtro: "estado" },
  { id: "pedido", titulo: "Pedido", ancho: "92px", filtro: "pedido" },
  { id: "nc", titulo: "Nota de crédito", ancho: "140px", filtro: "texto" },
  { id: "obs", titulo: "Observación", ancho: "minmax(150px,1fr)", filtro: "texto" },
];

function estadoDe(f: FilaComprobante): string {
  if (f.esNc) return (f.saldo ?? 0) > 0.01 ? "NC sin aplicar" : "NC aplicada";
  if (f.anulado) return "Anulado";
  if (f.pagada) return "Pagada";
  if (f.cubierta) return "Anulada por NC";
  if (!f.entregado) return "Por entregar";
  return "Pendiente";
}
const montoDe = (f: FilaComprobante) => (f.esNc ? -f.bruto : f.cubierta || f.anulado ? f.bruto : f.monto);
const digitos = (t: string | null) => (t ?? "").replace(/\D/g, "");

// Texto que se muestra (y por el que se filtra) en cada columna.
function textoDe(f: FilaComprobante, c: ColId): string {
  switch (c) {
    case "numero": return f.numero ?? "";
    case "cliente": return f.cliente;
    case "sucursal": return f.sucursal ?? "";
    case "fecha": return fechaCorta(f.cargado);
    case "entrega": return f.entregado ? fechaCorta(f.fecha) : "";
    case "vence": return f.entregado && !f.pagada ? fechaCorta(f.vence) : "";
    case "monto": return formatoPesos(Math.abs(montoDe(f))).replace(/\s/g, "");
    case "estado": return estadoDe(f);
    case "pedido": return f.arca ? (f.sinPedido ? "Sin pedido" : f.esNc ? "" : "Con pedido") : "";
    case "nc": return f.ncTexto + " " + (f.aplicaciones ?? []).map((a) => `F-${a.facturaNumero}`).join(" ");
    case "obs": return f.obs;
  }
}

// Observación: se escribe ahí mismo, como una celda de Excel. Se guarda al salir o con Enter.
function ObsCelda({ f }: { f: FilaComprobante }) {
  const [valor, setValor] = useState(f.obs);
  const [guardado, setGuardado] = useState(f.obs);
  const [estado, setEstado] = useState<"" | "ok" | "error">("");
  const guardar = async () => {
    if (valor.trim() === guardado.trim()) return;
    const r = f.arca ? await guardarDatosArca(f.id, f.puntoId ?? "", valor) : await guardarObservacion(f.id, valor);
    if (r.ok) { setGuardado(valor); setEstado("ok"); setTimeout(() => setEstado(""), 1500); } else setEstado("error");
  };
  return (
    <input aria-label="Observación" value={valor} maxLength={200} placeholder="—" onChange={(e) => setValor(e.target.value)} onBlur={guardar} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className={`h-7 w-full min-w-0 rounded border bg-transparent px-1.5 text-center text-[12.5px] placeholder:text-stone-300 hover:border-stone-300 focus:border-verde-700 focus:bg-white focus:outline-none ${estado === "ok" ? "border-verde-600" : estado === "error" ? "border-rojo-600" : "border-transparent"}`} />
  );
}

function SucursalCelda({ f }: { f: FilaComprobante }) {
  const [punto, setPunto] = useState(f.puntoId ?? "");
  if (!f.puntos || f.puntos.length === 0) return <span className="truncate text-stone-500">{f.sucursal ?? ""}</span>;
  return (
    <select aria-label="Sucursal" value={punto} onChange={async (e) => {
      const nuevo = e.target.value;
      const nombre = f.puntos?.find((p) => p.id === nuevo)?.barrio ?? "ninguna";
      if (!window.confirm(`¿Cambiar la sucursal de ${f.numero} a ${nombre}?`)) return; // evita cambiarla sin querer
      setPunto(nuevo);
      await guardarDatosArca(f.id, nuevo, f.obs);
    }} className="h-7 w-full min-w-0 rounded border border-transparent bg-transparent px-0.5 text-center text-[12.5px] hover:border-stone-300 focus:border-verde-700 focus:outline-none">
      <option value="">{f.sucursal ?? "—"}</option>
      {f.puntos.map((p) => <option key={p.id} value={p.id}>{p.barrio}</option>)}
    </select>
  );
}

function Punto({ color, texto, children }: { color: string; texto?: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] ${texto ?? "text-stone-700"}`}><span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />{children}</span>;
}

// Hoja de comprobantes (facturas o remitos) que funciona como un Excel: filtros arriba de cada columna, orden al tocar el título,
// columnas que se ocultan y pago con un solo toque (tildar → elegir cómo pagó).
export function ListaComprobantes({ filas, tipo, acciones, vistaInicial = "todas" }: { filas: FilaComprobante[]; tipo: "FACTURA" | "REMITO"; acciones?: React.ReactNode; vistaInicial?: "todas" | "sin-pagar" | "pagadas" }) {
  const router = useRouter();
  const esArca = filas.some((f) => f.arca);
  const disponibles = COLUMNAS.filter((c) => !c.solo || (c.solo === "arca" ? esArca : !esArca));
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [obsPago, setObsPago] = useState("");
  const [trabajando, empezar] = useTransition();
  const [picker, setPicker] = useState<string | null>(null);
  const [vista, setVista] = useState(vistaInicial);
  const [filtros, setFiltros] = useState<Partial<Record<ColId, string>>>({});
  const [orden, setOrden] = useState<{ col: ColId | null; asc: boolean }>({ col: null, asc: true });
  const [ocultas, setOcultas] = useState<Set<ColId>>(new Set());
  const [verColumnas, setVerColumnas] = useState(false);
  const [cuantas, setCuantas] = useState(POR_VEZ);
  const claveCols = `cc-columnas-${tipo}`;

  useEffect(() => {
    try { const g = localStorage.getItem(claveCols); if (g) { setOcultas(new Set(JSON.parse(g) as ColId[])); return; } } catch { /* sin almacenamiento */ }
    setOcultas(new Set<ColId>(esArca ? ["pedido"] : [])); // en Facturas, "sin pedido" se ve junto al nombre; la columna se prende desde Columnas
  }, [claveCols, esArca]);
  const alternarColumna = (id: ColId) => setOcultas((a) => {
    const n = new Set(a);
    if (n.has(id)) n.delete(id); else n.add(id);
    try { localStorage.setItem(claveCols, JSON.stringify([...n])); } catch { /* idem */ }
    return n;
  });

  const visibles = disponibles.filter((c) => !ocultas.has(c.id));
  const grilla = `28px ${visibles.map((c) => c.ancho).join(" ")}`;
  const hayFiltro = vista !== "todas" || Object.values(filtros).some((v) => v && v.trim());

  const filtradas = useMemo(() => {
    let r = filas.filter((f) => {
      if (f.hueco) return !hayFiltro;
      if (vista === "sin-pagar" && (f.esNc || f.pagada || f.cubierta || f.anulado)) return false;
      if (vista === "pagadas" && (f.esNc || !(f.pagada || f.cubierta))) return false;
      for (const c of visibles) {
        const v = (filtros[c.id] ?? "").trim();
        if (!v) continue;
        const t = textoDe(f, c.id);
        if (c.filtro === "estado" || c.filtro === "pedido" || c.filtro === "lista") { if (t !== v) return false; continue; }
        if (c.id === "monto" || c.id === "numero") { if (!digitos(t).includes(digitos(v)) && !t.toLowerCase().includes(v.toLowerCase())) return false; continue; }
        if (!t.toLowerCase().includes(v.toLowerCase())) return false;
      }
      return true;
    });
    if (orden.col) {
      const col = orden.col;
      const clave = (f: FilaComprobante): string | number => col === "numero" ? Number(digitos(f.numero)) || 0 : col === "monto" ? montoDe(f) : col === "fecha" ? f.cargado : textoDe(f, col).toLowerCase();
      r = [...r].sort((a, b) => { const x = clave(a), y = clave(b); return (x < y ? -1 : x > y ? 1 : 0) * (orden.asc ? 1 : -1); });
    }
    return r;
  }, [filas, vista, filtros, orden, visibles, hayFiltro]);

  const opcionesLista = useMemo(() => {
    const dist = (id: ColId) => [...new Set(filas.filter((f) => !f.hueco).map((f) => textoDe(f, id)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    return { cliente: dist("cliente"), sucursal: dist("sucursal") } as Partial<Record<ColId, string[]>>;
  }, [filas]);
  const pagables = filtradas.filter((f) => !f.hueco && !f.esNc && f.entregado && !f.pagada && !f.cubierta && !f.anulado);
  const mostradas = filtradas.slice(0, cuantas);
  const suma = filas.filter((f) => elegidas.has(f.id) && !f.hueco).reduce((s, f) => s + f.monto, 0);
  const sumaFiltrada = filtradas.filter((f) => !f.hueco && !f.esNc && !f.pagada && !f.cubierta && !f.anulado).reduce((s, f) => s + f.monto, 0);
  const alternar = (id: string) => setElegidas((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ordenarPor = (id: ColId) => setOrden((o) => (o.col === id ? (o.asc ? { col: id, asc: false } : { col: null, asc: true }) : { col: id, asc: true }));

  const pagar = (medio: string) => {
    setError(null);
    const cant = elegidas.size;
    if (!window.confirm(`¿Confirmás que se ${cant === 1 ? "pagó 1 comprobante" : `pagaron ${cant} comprobantes`} por ${formatoPesos(suma)} con ${MEDIOS.find((m) => m.valor === medio)?.texto.toLowerCase()}?\n\nQuedan marcados como pagados.`)) return;
    empezar(async () => {
      const r = esArca ? await registrarPagosArca([...elegidas], medio, obsPago) : await registrarPagos([...elegidas], medio, obsPago);
      if (!r.ok) setError(r.error ?? "No se pudo registrar.");
      else { setElegidas(new Set()); setObsPago(""); }
      router.refresh();
    });
  };
  const deshacer = (id: string) => {
    if (!window.confirm("¿Deshacer este pago? El comprobante vuelve a figurar sin pagar.")) return;
    empezar(async () => {
      const r = esArca ? await deshacerPagoArca(id) : await deshacerPago(id);
      if (!r.ok) window.alert(r.error);
      router.refresh();
    });
  };

  const celdaBase = "min-w-0 truncate";
  const entrada = "h-7 w-full min-w-0 rounded border border-stone-300 bg-white px-1.5 text-center text-[12px] font-normal normal-case tracking-normal text-stone-800 placeholder:text-stone-300 focus:border-verde-700 focus:outline-none";
  const opcionesEstado = esArca ? ["Pendiente", "Pagada", "Anulada por NC", "NC sin aplicar", "NC aplicada"] : ["Pendiente", "Pagada", "Por entregar", "Anulada por NC", "Anulado"];

  return (
    <div>
      {/* Barra de arriba: vistas rápidas, columnas, subir archivo y el pago (todo a la vista, nada abajo de todo). */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-300 bg-white px-3 py-2">
        <div role="group" aria-label="Mostrar" className="inline-flex overflow-hidden rounded-md border border-stone-300 text-[13px]">
          {([["todas", "Todas"], ["sin-pagar", "Pendientes de pago"], ["pagadas", "Pagadas"]] as const).map(([v, t]) => (
            <button key={v} type="button" onClick={() => setVista(v)} aria-pressed={vista === v} className={`h-8 px-3 ${vista === v ? "bg-stone-800 font-semibold text-white" : "text-stone-600 hover:bg-crema-100"}`}>{t}</button>
          ))}
        </div>
        {hayFiltro && <button type="button" onClick={() => { setVista("todas"); setFiltros({}); }} className="h-8 rounded-md border border-stone-300 px-3 text-[13px] text-stone-600 hover:border-stone-500">Quitar filtros</button>}
        <span className="text-[13px] text-stone-500">{filtradas.filter((f) => !f.hueco).length} filas{sumaFiltrada > 0 ? <> · sin pagar <b className="tabular-nums text-stone-800">{formatoPesos(sumaFiltrada)}</b></> : null}</span>
        <div className="relative ml-auto flex items-center gap-2">
          {acciones}
          <button type="button" onClick={() => setVerColumnas(!verColumnas)} aria-expanded={verColumnas} className="h-8 rounded-md border border-stone-300 bg-white px-3 text-[13px] text-stone-700 hover:border-stone-500">Columnas ▾</button>
          {verColumnas && (
            <div className="absolute right-0 top-9 z-30 w-52 rounded-md border border-stone-300 bg-white p-2 text-[13px] shadow-lg">
              {disponibles.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-crema-100">
                  <input type="checkbox" checked={!ocultas.has(c.id)} onChange={() => alternarColumna(c.id)} className="accent-[#026433]" />{c.titulo}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pago: aparece apenas se tilda algo. Un toque en cómo pagó y confirma. */}
      {elegidas.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-verde-700 bg-verde-50 px-3 py-2 text-[13px]">
          <span><b>{elegidas.size}</b> {elegidas.size === 1 ? "elegido" : "elegidos"} · <b className="tabular-nums">{formatoPesos(suma)}</b></span>
          <input value={obsPago} onChange={(e) => setObsPago(e.target.value)} maxLength={100} placeholder="Observación para todas (ej. N° de OP)" aria-label="Observación del pago" className="h-8 w-64 rounded-md border border-stone-300 bg-white px-2 text-[13px] placeholder:text-stone-400 focus:border-verde-700 focus:outline-none" />
          <span className="text-stone-500">Pagó con:</span>
          {MEDIOS.map((m) => <button key={m.valor} type="button" disabled={trabajando} onClick={() => pagar(m.valor)} className="h-8 rounded-md bg-verde-700 px-4 font-semibold text-white hover:bg-verde-800 disabled:opacity-50">{m.texto}</button>)}
          <button type="button" onClick={() => setElegidas(new Set())} className="ml-auto text-stone-500 underline hover:text-stone-800">Cancelar</button>
        </div>
      )}
      {error && <p className="border-b border-rojo-600 bg-rojo-50 px-3 py-2 text-sm text-rojo-700" role="alert">{error}</p>}

      <div className="max-h-[calc(100vh-330px)] min-h-[260px] overflow-auto">
        <div className="min-w-[1000px]">
          {/* Títulos (se ordena al tocar) y, debajo, el filtro de cada columna. */}
          <div className="sticky top-0 z-20 border-b border-stone-300 bg-crema-100">
            <div className="grid items-center gap-x-3 px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500" style={{ gridTemplateColumns: grilla }}>
              <input type="checkbox" aria-label="Elegir todos los pendientes de la lista" checked={pagables.length > 0 && pagables.every((f) => elegidas.has(f.id))} onChange={() => setElegidas(pagables.every((f) => elegidas.has(f.id)) ? new Set() : new Set(pagables.map((f) => f.id)))} className="h-4 w-4 accent-[#026433]" />
              {visibles.map((c) => (
                <button key={c.id} type="button" disabled={!c.ordena} onClick={() => ordenarPor(c.id)} className={`flex items-center justify-center gap-1 uppercase ${c.ordena ? "hover:text-stone-900" : "cursor-default"}`}>
                  {c.id === "numero" ? (tipo === "FACTURA" ? "Factura" : "Remito") : c.titulo}
                  {orden.col === c.id && <span className="text-verde-700">{orden.asc ? "▲" : "▼"}</span>}
                </button>
              ))}
            </div>
            <div className="grid items-center gap-x-3 px-3 pb-2 pt-1" style={{ gridTemplateColumns: grilla }}>
              <span />
              {visibles.map((c) => c.filtro === "lista" ? (
                <FiltroLista key={c.id} titulo={c.titulo} opciones={opcionesLista[c.id] ?? []} valor={filtros[c.id] ?? ""} onCambio={(v) => setFiltros({ ...filtros, [c.id]: v })} />
              ) : c.filtro === "estado" ? (
                <FiltroLista key={c.id} titulo="Estado" opciones={opcionesEstado} valor={filtros.estado ?? ""} onCambio={(v) => setFiltros({ ...filtros, estado: v })} />
              ) : c.filtro === "pedido" ? (
                esArca ? <select key={c.id} aria-label="Filtrar pedido" value={filtros.pedido ?? ""} onChange={(e) => setFiltros({ ...filtros, pedido: e.target.value })} className={entrada}>
                  <option value="">Todos</option><option value="Sin pedido">Sin pedido</option><option value="Con pedido">Con pedido</option>
                </select> : <span key={c.id} />
              ) : (
                <input key={c.id} aria-label={`Filtrar ${c.titulo}`} value={filtros[c.id] ?? ""} placeholder="Filtrar…" onChange={(e) => setFiltros({ ...filtros, [c.id]: e.target.value })} className={entrada} />
              ))}
            </div>
          </div>

          {mostradas.length === 0 && <p className="p-10 text-center text-sm text-stone-500">No hay comprobantes con esos filtros.</p>}
          {mostradas.map((f) => f.hueco ? (
            <div key={f.id} className="grid items-center gap-x-3 border-b border-stone-100 px-3 py-1.5 text-[13px] text-stone-300" style={{ gridTemplateColumns: grilla }}>
              <span /><span className="tabular-nums">{f.numero}</span><span className="italic">Número sin usar</span>
            </div>
          ) : (
            <Fragment key={f.id}>
              <div className={`grid h-10 items-center gap-x-3 overflow-hidden border-b border-stone-200 px-3 text-center text-[13px] hover:bg-crema-50 ${f.anulado ? "text-stone-400" : "text-stone-800"} ${elegidas.has(f.id) ? "bg-verde-50" : ""}`} style={{ gridTemplateColumns: grilla }}>
                <input type="checkbox" aria-label={`Elegir ${f.numero ?? "comprobante"}`} checked={elegidas.has(f.id)} disabled={!f.entregado || f.pagada || f.cubierta || !!f.anulado || f.esNc} onChange={() => alternar(f.id)} className="h-4 w-4 accent-[#026433] disabled:opacity-25" />
                {visibles.map((c) => {
                  switch (c.id) {
                    case "numero": return <span key={c.id} className={`${celdaBase} text-[14px] font-bold tabular-nums ${f.esNc ? "text-stone-500" : "text-stone-900"}`}>{f.numero ?? <span className="text-[13px] font-semibold text-rojo-700">sin número</span>}</span>;
                    case "cliente": return <span key={c.id} className={celdaBase} title={f.aviso || undefined}>
                      {f.clienteId ? <Link href={`/cuentas/${f.clienteId}`} className="font-semibold hover:underline">{f.cliente}</Link> : <span className="font-semibold italic text-rojo-700" title="El CUIT no está cargado en ningún cliente">{f.cliente}</span>}
                      {f.arca && f.sinPedido && <span className="ml-2 text-[12px] font-semibold text-rojo-700">sin pedido</span>}
                      {f.arca && f.pedidoId && <Link href={`/pedidos/${f.pedidoId}`} className="ml-2 text-[12px] text-verde-800 hover:underline" title="Abrir el pedido">pedido ›</Link>}
                      {f.aviso && <span className="ml-2 text-[12px] text-rojo-700">{f.aviso}</span>}
                    </span>;
                    case "sucursal": return <SucursalCelda key={c.id} f={f} />;
                    case "fecha": return <span key={c.id} className="tabular-nums text-stone-600">{fechaCorta(f.cargado)}</span>;
                    case "entrega": return <span key={c.id} className="tabular-nums text-stone-600">{f.entregado ? fechaCorta(f.fecha) : <span className="text-stone-300">—</span>}</span>;
                    case "vence": return <span key={c.id} className="tabular-nums text-stone-600">{f.entregado && !f.pagada && f.vence ? fechaCorta(f.vence) : <span className="text-stone-300">—</span>}</span>;
                    case "monto": return <span key={c.id} className={`whitespace-nowrap text-[14px] font-bold tabular-nums ${f.cubierta || f.anulado ? "text-stone-300 line-through" : f.esNc ? "text-stone-500" : "text-stone-900"}`}>{f.esNc ? "−" : ""}{formatoPesos(f.cubierta || f.anulado || f.esNc ? f.bruto : f.monto)}</span>;
                    case "estado": {
                      const e = estadoDe(f);
                      const relleno = e === "Pendiente" ? "bg-rojo-100 text-rojo-800" : e === "Pagada" ? "bg-verde-100 text-verde-800" : e === "NC sin aplicar" ? "bg-[#fbf1c7] text-[#7a5f06]" : "";
                      return <span key={c.id} className={`flex h-full items-center justify-center gap-1.5 whitespace-nowrap ${relleno}`} title={e === "Pendiente" && f.atraso > 0 ? `Vencida hace ${f.atraso} días` : undefined}>
                        {e === "NC sin aplicar" ? <button type="button" onClick={() => setPicker(picker === f.id ? null : f.id)} className="h-full w-full font-semibold hover:underline">Aplicar a factura</button>
                          : e === "Pagada" ? <><span className="font-semibold">Pagada{f.medio ? ` · ${TEXTO_MEDIO[f.medio] ?? ""}` : ""}</span><button type="button" title="Deshacer el pago" aria-label="Deshacer el pago" onClick={() => deshacer(f.id)} className="text-[12px] opacity-50 hover:opacity-100">✕</button></>
                          : e === "Pendiente" ? <span className="font-semibold">Pendiente{f.atraso > 0 ? <span className="font-normal"> · {f.atraso} d</span> : null}</span>
                          : <span className="text-stone-500">{e === "Anulado" ? f.anulado : e}</span>}
                      </span>;
                    }
                    case "pedido": return <span key={c.id} className="text-[12.5px]">
                      {f.arca ? (f.esNc ? <span className="text-stone-300">—</span> : f.sinPedido ? <span className="font-semibold text-rojo-700">Sin pedido</span> : f.pedidoId ? <Link href={`/pedidos/${f.pedidoId}`} className="font-medium text-verde-800 hover:underline">Abrir ›</Link> : <span className="text-stone-400">Con pedido</span>)
                        : <Link href={`/pedidos/${f.id}`} className="font-medium text-verde-800 hover:underline">Abrir ›</Link>}
                    </span>;
                    case "nc": return <span key={c.id} className="truncate text-[12.5px] text-stone-500">
                      {f.arca && f.esNc ? <>{(f.aplicaciones ?? []).map((a) => <span key={a.id} className="mr-2 whitespace-nowrap">→ F-{a.facturaNumero} <button type="button" title="Quitar" onClick={() => window.confirm("¿Quitar esta aplicación?") && empezar(async () => { const r = await quitarAplicacionNc(a.id); if (!r.ok) setError(r.error ?? "No se pudo."); router.refresh(); })} className="text-stone-300 hover:text-rojo-700">✕</button></span>)}{(f.aplicaciones ?? []).length === 0 && <span className="text-stone-300">—</span>}</>
                        : !f.arca && tipo === "FACTURA" && !f.pagada && !f.cubierta && !f.anulado ? <Link href={`/cuentas/${f.clienteId}/nc?factura=${f.id}`} className="font-medium text-stone-600 underline decoration-stone-300 underline-offset-4 hover:text-stone-900">+ Nota de crédito</Link>
                        : f.ncTexto ? <>{f.ncTexto}{!f.cubierta && f.nc > 0 ? ` (−${formatoPesos(f.nc)})` : ""}</> : <span className="text-stone-300">—</span>}
                    </span>;
                    case "obs": return <ObsCelda key={`${c.id}-${f.obs}`} f={f} />;
                  }
                })}
              </div>
              {picker === f.id && f.esNc && (
                <div className="border-b border-stone-300 bg-crema-50 px-3 py-3 pl-12 text-[13px]">
                  <p className="mb-2 font-medium text-stone-700">¿A qué factura corresponde la {f.numero}? <span className="font-normal text-stone-400">mismo CUIT; primero las del mismo importe</span></p>
                  {(() => {
                    const candidatas = filas.filter((x) => x.arca && !x.esNc && x.cuit === f.cuit && (x.saldo ?? 0) > 0.01).sort((a, b) => Number(Math.abs((b.saldo ?? 0) - (f.saldo ?? 0)) < 0.01) - Number(Math.abs((a.saldo ?? 0) - (f.saldo ?? 0)) < 0.01) || (b.numero ?? "").localeCompare(a.numero ?? ""));
                    if (candidatas.length === 0) return <p className="text-stone-500">No hay facturas de este CUIT con saldo.</p>;
                    return (
                      <ul className="max-w-xl">
                        {candidatas.slice(0, 12).map((c) => (
                          <li key={c.id} className="flex items-center gap-4 border-b border-stone-200 py-1.5">
                            <span className="w-36 whitespace-nowrap font-semibold tabular-nums">{c.numero}</span>
                            <span className="w-16 text-stone-400">{fechaCorta(c.fecha)}</span>
                            <span className="w-28 text-right tabular-nums">{formatoPesos(c.saldo ?? 0)}</span>
                            {Math.abs((c.saldo ?? 0) - (f.saldo ?? 0)) < 0.01 && <span className="text-[11.5px] font-medium text-verde-700">mismo importe</span>}
                            <button type="button" disabled={trabajando} onClick={() => window.confirm(`¿Aplicar la ${f.numero} a la ${c.numero} por ${formatoPesos(Math.min(f.saldo ?? 0, c.saldo ?? 0))}?`) && empezar(async () => { const r = await aplicarNc(f.id, c.id); if (!r.ok) setError(r.error ?? "No se pudo."); else setPicker(null); router.refresh(); })} className="ml-auto rounded-md border border-stone-300 bg-white px-3 py-1 text-[12px] font-medium hover:border-stone-700 hover:bg-stone-800 hover:text-white">Aplicar</button>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              )}
            </Fragment>
          ))}
          {filtradas.length > cuantas && (
            <div className="p-3 text-center"><button type="button" onClick={() => setCuantas(cuantas + POR_VEZ)} className="rounded-md border border-stone-300 bg-white px-4 py-1.5 text-[13px] text-stone-700 hover:border-stone-500">Mostrar {Math.min(POR_VEZ, filtradas.length - cuantas)} más ({filtradas.length - cuantas} sin mostrar)</button></div>
          )}
        </div>
      </div>
    </div>
  );
}
