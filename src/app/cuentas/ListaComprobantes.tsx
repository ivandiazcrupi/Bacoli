"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { formatoPesos } from "@/lib/numeros";
import { FiltroLista, SEP } from "./FiltroLista";
import { deshacerPago, descartarAvisoPago, guardarObservacion, registrarPagos } from "./actions";
import { aplicarNc, aplicarNcManual, quitarAplicacionManual, deshacerPagoArca, guardarDatosArca, quitarAplicacionNc, registrarPagosArca } from "./arca/actions";

export type FilaComprobante = {
  id: string;
  clienteId: string;
  cliente: string;
  tipo: "FACTURA" | "REMITO";
  numero: string | null;
  cargado: string;
  fecha: string;
  anulaManual?: { tipo: string; texto: string; motivo: string | null } | null; // NC aplicada a mano (factura fuera del sistema o nota de débito)
  entrega?: string | null; // día de entrega (solo si ya se entregó)
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
  razon?: string; // razón social: la que dice la factura (ARCA) o la del cliente (remitos)
  puntos?: { id: string; barrio: string; direccion: string }[];
  aviso?: string;
  sinPedido?: boolean;
  pedidoId?: string | null;
  ubicar?: string | null; // enlace que lleva al pedido: su hoja de ruta (resaltado) o la lista de Pedidos si espera día
  aplicaciones?: { id: string; facturaNumero: number; monto: number; motivo?: string | null }[];
  avisoPago?: string | null; // nombre del vendedor que indicó que se pagó (la oficina lo confirma)
  ncMotivos?: string; // factura: por qué se emitieron sus notas de crédito
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

type ColId = "numero" | "cliente" | "razon" | "sucursal" | "fecha" | "entrega" | "monto" | "estado" | "pedido" | "nc" | "obs";
type Columna = { id: ColId; titulo: string; ancho: string; solo?: "arca" | "remito"; ordena?: boolean; filtro?: "texto" | "estado" | "pedido" | "lista" };

const COLUMNAS: Columna[] = [
  { id: "numero", titulo: "Número", ancho: "80px", ordena: true, filtro: "texto" },
  { id: "razon", titulo: "Razón social", ancho: "minmax(262px,1.4fr)", filtro: "lista" },
  { id: "cliente", titulo: "Cliente", ancho: "minmax(200px,1.1fr)", ordena: true, filtro: "lista" },
  { id: "sucursal", titulo: "Sucursal", ancho: "118px", filtro: "lista" },
  { id: "fecha", titulo: "Pedido", ancho: "62px", ordena: true, filtro: "texto" },
  { id: "entrega", titulo: "Entrega", ancho: "62px", ordena: true, filtro: "texto" },
  { id: "monto", titulo: "Monto", ancho: "100px", ordena: true, filtro: "texto" },
  { id: "estado", titulo: "Estado", ancho: "176px", ordena: true, filtro: "estado" },
  { id: "pedido", titulo: "Ubicar", ancho: "72px", filtro: "pedido" },
  { id: "nc", titulo: "NC", ancho: "56px", filtro: "texto" },
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
    case "razon": return f.razon ?? "";
    case "sucursal": return f.sucursal ?? "";
    case "fecha": return fechaCorta(f.cargado);
    case "entrega": return fechaCorta(f.entrega ?? "");
    case "monto": return formatoPesos(Math.abs(montoDe(f))).replace(/\s/g, "");
    case "estado": return estadoDe(f);
    case "pedido": return f.ubicar?.startsWith("/pedidos/dia/") ? "En hoja de ruta" : f.ubicar ? "Esperando día" : f.arca && f.sinPedido ? "Sin pedido" : "";
    case "nc": return f.ncTexto + " " + (f.aplicaciones ?? []).map((a) => `F-${a.facturaNumero}`).join(" ");
    case "obs": return f.obs;
  }
}

// Factura anulada por una NC (o NC ya aplicada): la observación queda bloqueada y muestra su contraparte ("Anula F-5000" / "Anulada por NC 100").
const rotuloManual = (m: { tipo: string; texto: string }) => (m.tipo === "ND" ? `ND ${m.texto.replace(/^nd\s*/i, "")}` : `F-${m.texto.replace(/^f-?/i, "")}`);
function bloqueoDe(f: FilaComprobante): { texto: string; ayuda: string } | null {
  if (f.esNc && f.anulaManual) {
    const m = f.anulaManual;
    return m.tipo === "ND"
      ? { texto: `Anulada por ${rotuloManual(m)}`, ayuda: `Bloqueado: esta nota de crédito fue anulada con la nota de débito ${rotuloManual(m)} (anotada a mano, no está en el sistema).${m.motivo ? ` Motivo: ${m.motivo}.` : ""}` }
      : { texto: `Anula ${rotuloManual(m)}`, ayuda: `Bloqueado: esta nota de crédito ya está aplicada y anula la factura ${rotuloManual(m)} (anotada a mano, no está en el sistema).${m.motivo ? ` Motivo: ${m.motivo}.` : ""}` };
  }
  if (f.esNc && (f.saldo ?? 0) <= 0.01 && (f.aplicaciones?.length ?? 0) > 0) {
    const facturas = f.aplicaciones!.map((a) => `F-${a.facturaNumero}`).join(", ");
    return { texto: `Anula ${facturas}`, ayuda: `Bloqueado: esta nota de crédito ya está aplicada y anula ${facturas}.${f.aplicaciones!.some((a) => a.motivo) ? ` Motivo: ${f.aplicaciones!.filter((a) => a.motivo).map((a) => a.motivo).join(" · ")}.` : ""}` };
  }
  if (!f.esNc && f.cubierta && f.ncTexto) return { texto: `Anulada por ${f.ncTexto}`, ayuda: `Bloqueado: esta factura quedó anulada por ${f.ncTexto}, que la cubre por completo.${f.ncMotivos ? ` ${f.ncMotivos}.` : ""}` };
  return null;
}

// Observación: se escribe ahí mismo, como una celda de Excel. Se guarda al salir o con Enter.
function ObsCelda({ f }: { f: FilaComprobante }) {
  const [valor, setValor] = useState(f.obs);
  const [guardado, setGuardado] = useState(f.obs);
  const [estado, setEstado] = useState<"" | "ok" | "error">("");
  const cerrada = f.pagada && !f.esNc; // pagada: la leyenda del pago (cheque, transferencia…) queda como "ya listo" y se edita solo con el lapicito
  const [editando, setEditando] = useState(false);
  const guardar = async () => {
    if (valor.trim() !== guardado.trim()) {
      const r = f.arca ? await guardarDatosArca(f.id, null, valor) : await guardarObservacion(f.id, valor);
      if (r.ok) { setGuardado(valor); setEstado("ok"); setTimeout(() => setEstado(""), 1500); } else { setEstado("error"); return; }
    }
    setEditando(false);
  };
  if (cerrada && !editando) {
    return (
      <span className="flex min-w-0 items-center justify-center gap-1.5" title={guardado ? `${guardado}\n(Pagada: tocá el lápiz para modificarla)` : "Pagada: tocá el lápiz para agregar una leyenda"}>
        <span className="min-w-0 truncate text-[13px] font-medium text-stone-500">{guardado || <span className="text-stone-300">—</span>}</span>
        <button type="button" aria-label="Editar la observación" onClick={() => setEditando(true)} className="shrink-0 text-[13px] text-stone-400 hover:text-stone-800">✎</button>
      </span>
    );
  }
  return (
    <input aria-label="Observación" autoFocus={cerrada} value={valor} maxLength={200} placeholder="—" onChange={(e) => setValor(e.target.value)} onBlur={guardar} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape" && cerrada) { setValor(guardado); setEditando(false); } }}
      className={`h-7 w-full min-w-0 rounded border bg-transparent px-2 text-center text-[13.5px] placeholder:text-stone-300 hover:border-stone-300 focus:border-verde-700 focus:bg-white focus:outline-none ${estado === "ok" ? "border-verde-600" : estado === "error" ? "border-rojo-600" : "border-transparent"}`} />
  );
}

// La sucursal se ve como una pastilla (no como texto suelto), igual en facturas y remitos.
const PILDORA = "inline-block h-6 min-w-0 max-w-full truncate rounded-full border border-stone-300 bg-crema-100 px-2.5 text-center text-[11.5px] font-semibold uppercase leading-[22px] tracking-wide text-stone-700";

function SucursalCelda({ f }: { f: FilaComprobante }) {
  const [punto, setPunto] = useState(f.puntoId ?? "");
  if (!f.arca) return f.sucursal ? <span className={`${PILDORA} justify-self-center`} title={f.sucursal}>{f.sucursal}</span> : <span className="text-stone-300">—</span>; // remitos: la del pedido (solo se ve)
  const nombres: Record<string, string> = { "-": "Ninguna", ...Object.fromEntries((f.puntos ?? []).map((p) => [p.id, p.barrio])) };
  return (
    <select aria-label="Sucursal" value={punto} onChange={async (e) => {
      const nuevo = e.target.value;
      if (!window.confirm(nuevo === "-" ? `¿Dejar ${f.numero} sin sucursal?` : `¿Cambiar la sucursal de ${f.numero} a ${nombres[nuevo] ?? ""}?`)) return; // evita cambiarla sin querer
      setPunto(nuevo);
      await guardarDatosArca(f.id, nuevo, null);
    }} className={`${PILDORA} w-full cursor-pointer hover:border-stone-500 focus:border-verde-700 focus:outline-none`}>
      {!f.puntoId && <option value="">{f.sucursal ?? "Sin elegir"}</option>}
      <option value="-">Ninguna</option>
      {(f.puntos ?? []).map((p) => <option key={p.id} value={p.id}>{p.barrio}</option>)}
    </select>
  );
}

function Punto({ color, texto, children }: { color: string; texto?: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] ${texto ?? "text-stone-700"}`}><span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />{children}</span>;
}

// Hoja de comprobantes (facturas o remitos) que funciona como un Excel: filtros arriba de cada columna, orden al tocar el título,
// columnas que se ocultan y pago con un solo toque (tildar → elegir cómo pagó).
export function ListaComprobantes({ filas, tipo, acciones, vistaInicial = "todas" }: { filas: FilaComprobante[]; tipo: "FACTURA" | "REMITO" | "CUENTA"; acciones?: React.ReactNode; vistaInicial?: "todas" | "sin-pagar" | "pagadas" }) {
  const router = useRouter();
  const esArca = filas.some((f) => f.arca);
  const hayNc = filas.some((f) => !!f.ncTexto || (f.aplicaciones?.length ?? 0) > 0 || (!f.arca && f.tipo === "FACTURA")); // la columna Nota de crédito solo aparece si alguna fila la usa: así Observación tiene más lugar
  const disponibles = COLUMNAS.filter((c) => (c.id !== "nc" || hayNc) && (tipo === "CUENTA" || !c.solo || (c.solo === "arca" ? esArca : !esArca))); // en la cuenta de un cliente conviven facturas (ARCA) y remitos
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [obsPago, setObsPago] = useState("");
  const [trabajando, empezar] = useTransition();
  const [picker, setPicker] = useState<string | null>(null);
  const [motivoNc, setMotivoNc] = useState("");
  const [manualTipo, setManualTipo] = useState<"FACTURA" | "ND">("FACTURA");
  const [manualTexto, setManualTexto] = useState("");
  const [vista, setVista] = useState(vistaInicial);
  const [filtros, setFiltros] = useState<Partial<Record<ColId, string>>>({});
  const [orden, setOrden] = useState<{ col: ColId | null; asc: boolean }>({ col: null, asc: true });
  const [ocultas, setOcultas] = useState<Set<ColId>>(new Set());
  const [verColumnas, setVerColumnas] = useState(false);
  const [cuantas, setCuantas] = useState(POR_VEZ);
  const claveCols = `cc-columnas-v4-${tipo}`; // v2: se reinician las columnas que el navegador había guardado antes de unificar las hojas

  useEffect(() => {
    try { const g = localStorage.getItem(claveCols); if (g) { setOcultas(new Set(JSON.parse(g) as ColId[])); return; } } catch { /* sin almacenamiento */ }
    setOcultas(new Set<ColId>()); // todas a la vista, incluida "Ubicar" (el botón que lleva al pedido)
  }, [claveCols, tipo]);
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
        if (c.filtro === "estado" || c.filtro === "pedido" || c.filtro === "lista") { if (!v.split(SEP).includes(t)) return false; continue; }
        if (c.id === "monto" || c.id === "numero") { if (!digitos(t).includes(digitos(v)) && !t.toLowerCase().includes(v.toLowerCase())) return false; continue; }
        if (!t.toLowerCase().includes(v.toLowerCase())) return false;
      }
      return true;
    });
    if (orden.col) {
      const col = orden.col;
      const clave = (f: FilaComprobante): string | number => col === "numero" ? Number(digitos(f.numero)) || 0 : col === "monto" ? montoDe(f) : col === "fecha" ? f.cargado : col === "entrega" ? f.entrega ?? "" : textoDe(f, col).toLowerCase();
      r = [...r].sort((a, b) => { const x = clave(a), y = clave(b); return (x < y ? -1 : x > y ? 1 : 0) * (orden.asc ? 1 : -1); });
    }
    return r;
  }, [filas, vista, filtros, orden, visibles, hayFiltro]);

  const opcionesLista = useMemo(() => {
    const dist = (id: ColId) => [...new Set(filas.filter((f) => !f.hueco).map((f) => textoDe(f, id)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    return { cliente: dist("cliente"), razon: dist("razon"), sucursal: dist("sucursal") } as Partial<Record<ColId, string[]>>;
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
      const ids = [...elegidas];
      const deArca = ids.filter((id) => filas.find((f) => f.id === id)?.arca);
      const deRemito = ids.filter((id) => !deArca.includes(id));
      let r: { ok: boolean; error?: string } = { ok: true };
      if (deArca.length > 0) r = await registrarPagosArca(deArca, medio, obsPago);
      if (r.ok && deRemito.length > 0) r = await registrarPagos(deRemito, medio, obsPago);
      if (!r.ok) setError(r.error ?? "No se pudo registrar.");
      else { setElegidas(new Set()); setObsPago(""); }
      router.refresh();
    });
  };
  const deshacer = (id: string, esDeArca: boolean) => {
    if (!window.confirm("¿Deshacer este pago? El comprobante vuelve a figurar sin pagar.")) return;
    empezar(async () => {
      const r = esDeArca ? await deshacerPagoArca(id) : await deshacerPago(id);
      if (!r.ok) window.alert(r.error);
      router.refresh();
    });
  };

  // Si el filtro de Cliente deja a UN solo cliente, aparece el botón del estado de cuenta en PDF para pasárselo (en la cuenta del cliente ya está en el resumen).
  const clienteUnico = tipo !== "CUENTA" && (filtros.cliente ?? "").trim() ? [...new Set(filtradas.map((f) => f.clienteId))].filter(Boolean) : [];
  const celdaBase = "min-w-0 truncate";
  const entrada = "h-7 w-full min-w-0 rounded border border-stone-300 bg-white px-1.5 text-center text-[12px] font-normal normal-case tracking-normal text-stone-800 placeholder:text-stone-300 focus:border-verde-700 focus:outline-none";
  const opcionesEstado = esArca && tipo !== "CUENTA" ? ["Pendiente", "Pagada", "Anulada por NC", "NC sin aplicar", "NC aplicada"] : ["Pendiente", "Pagada", "Por entregar", "Anulada por NC", "Anulado"];

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
          {clienteUnico.length === 1 && <Link href={`/cuentas/${clienteUnico[0]}/estado`} target="_blank" className="flex h-8 items-center rounded-md border border-verde-700 bg-white px-3 text-[13px] font-semibold text-verde-800 hover:bg-verde-50">Descargar PDF para el cliente</Link>}
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
        <div className="min-w-[900px]">
          {/* Títulos (se ordena al tocar) y, debajo, el filtro de cada columna. */}
          <div className="sticky top-0 z-20 border-b border-stone-300 bg-crema-100">
            <div className="grid items-center gap-x-1.5 px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500" style={{ gridTemplateColumns: grilla }}>
              <input type="checkbox" aria-label="Elegir todos los pendientes de la lista" checked={pagables.length > 0 && pagables.every((f) => elegidas.has(f.id))} onChange={() => setElegidas(pagables.every((f) => elegidas.has(f.id)) ? new Set() : new Set(pagables.map((f) => f.id)))} className="h-4 w-4 accent-[#026433]" />
              {visibles.map((c) => (
                <button key={c.id} type="button" disabled={!c.ordena} onClick={() => ordenarPor(c.id)} className={`flex items-center justify-center gap-1 uppercase ${c.ordena ? "hover:text-stone-900" : "cursor-default"}`}>
                  {c.id === "numero" ? (tipo === "FACTURA" ? "Factura" : tipo === "REMITO" ? "Remito" : "Comprobante") : c.titulo}
                  {orden.col === c.id && <span className="text-verde-700">{orden.asc ? "▲" : "▼"}</span>}
                </button>
              ))}
            </div>
            <div className="grid items-center gap-x-1.5 px-3 pb-2 pt-1" style={{ gridTemplateColumns: grilla }}>
              <span />
              {visibles.map((c) => c.filtro === "lista" ? (
                <FiltroLista key={c.id} varios titulo={c.titulo} opciones={opcionesLista[c.id] ?? []} valor={filtros[c.id] ?? ""} onCambio={(v) => setFiltros({ ...filtros, [c.id]: v })} />
              ) : c.filtro === "estado" ? (
                <FiltroLista key={c.id} varios titulo="Estado" opciones={opcionesEstado} valor={filtros.estado ?? ""} onCambio={(v) => setFiltros({ ...filtros, estado: v })} />
              ) : c.filtro === "pedido" ? (
                <FiltroLista key={c.id} varios titulo="Ubicar" opciones={["En hoja de ruta", "Esperando día", ...(esArca ? ["Sin pedido"] : [])]} valor={filtros.pedido ?? ""} onCambio={(v) => setFiltros({ ...filtros, pedido: v })} />
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
              <div className={`grid h-11 items-center gap-x-1.5 overflow-hidden border-b border-stone-200 px-3 text-center text-[13px] hover:bg-crema-50 ${f.anulado ? "text-stone-400" : "text-stone-800"} ${elegidas.has(f.id) ? "bg-verde-50" : ""}`} style={{ gridTemplateColumns: grilla }}>
                <input type="checkbox" aria-label={`Elegir ${f.numero ?? "comprobante"}`} checked={elegidas.has(f.id)} disabled={!f.entregado || f.pagada || f.cubierta || !!f.anulado || f.esNc} onChange={() => alternar(f.id)} className="h-4 w-4 accent-[#026433] disabled:opacity-25" />
                {visibles.map((c) => {
                  switch (c.id) {
                    case "numero": return <span key={c.id} className={`${celdaBase} text-[14px] font-bold tabular-nums ${f.esNc ? "text-stone-500" : "text-stone-900"}`}>{f.numero ? (!f.arca && f.tipo === "REMITO" ? <Link href={`/pedidos/${f.id}/remito`} target="_blank" title="Abrir el remito" className="hover:underline">{f.numero}</Link> : f.numero) : <span className="text-[13px] font-semibold text-rojo-700">sin número</span>}</span>;
                    case "cliente": {
                      const rojo = !f.clienteId || (f.arca && f.sinPedido); // sin cliente cargado o sin pedido: el nombre va en rojo
                      const nombre = <span className={`block truncate text-left text-[12.5px] font-semibold ${rojo ? "text-rojo-700" : ""} ${!f.clienteId ? "italic" : ""}`}>{f.cliente}</span>;
                      const ayuda = [!f.clienteId ? "El CUIT no está cargado en ningún cliente" : "", f.arca && f.sinPedido ? "Sin pedido" : "", f.aviso].filter(Boolean).join(" · ") || f.cliente;
                      return <span key={c.id} className="min-w-0" title={ayuda}>{f.clienteId ? <Link href={`/cuentas/${f.clienteId}`} className="block min-w-0 hover:underline">{nombre}</Link> : nombre}</span>;
                    }
                    case "razon": return <span key={c.id} className="block min-w-0 truncate text-left text-[12.5px] font-semibold text-stone-800" title={f.razon || undefined}>{f.razon || <span className="text-stone-300">—</span>}</span>;
                    case "sucursal": return <SucursalCelda key={c.id} f={f} />;
                    case "fecha": return <span key={c.id} className="tabular-nums text-stone-600">{fechaCorta(f.cargado)}</span>;
                    case "entrega": return <span key={c.id} className="tabular-nums text-stone-600">{f.entrega ? fechaCorta(f.entrega) : <span className="text-stone-300">—</span>}</span>;
                    case "monto": return <span key={c.id} className={`whitespace-nowrap text-[14px] font-bold tabular-nums ${f.cubierta || f.anulado ? "text-stone-300 line-through" : f.esNc ? "text-stone-500" : "text-stone-900"}`}>{f.esNc ? "−" : ""}{formatoPesos(f.cubierta || f.anulado || f.esNc ? f.bruto : f.monto)}</span>;
                    case "estado": {
                      const e = estadoDe(f);
                      const color = e === "Pendiente" && f.avisoPago ? "bg-[#fdf8e3] text-[#8a6a05]" : e === "Pendiente" ? "bg-rojo-50 text-rojo-700" : e === "Pagada" ? "bg-verde-50 text-verde-700" : e === "NC sin aplicar" ? "bg-[#fdf8e3] text-[#8a6a05]" : e === "NC aplicada" || e === "Anulada por NC" ? "text-sky-700" : "";
                      return <span key={c.id} className="flex min-w-0 items-center justify-center gap-2" title={e === "Pendiente" && f.atraso > 0 ? `Vencida hace ${f.atraso} días` : undefined}>
                        <span className={`flex h-7 w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 font-bold ${color}`}>
                          {e === "NC sin aplicar" ? <button type="button" onClick={() => { setMotivoNc(""); setPicker(picker === f.id ? null : f.id); }} className="font-bold hover:underline">Aplicar a factura</button>
                            : e === "Pagada" ? <><span>Pagada{f.medio ? <span className="text-[11.5px] font-medium"> · {TEXTO_MEDIO[f.medio] ?? ""}</span> : null}</span><button type="button" title="Deshacer el pago" aria-label="Deshacer el pago" onClick={() => deshacer(f.id, !!f.arca)} className="text-[11px] opacity-50 hover:opacity-100">✕</button></>
                            : e === "Pendiente" && f.avisoPago ? <><span title={`${f.avisoPago} indicó que se pagó. Falta tu confirmación: registrá el pago (tildá el comprobante) o descartá el aviso con la ✕.`}>{f.avisoPago.split(" ")[0].slice(0, 12)} avisó pago</span><button type="button" title="Descartar el aviso (no se pagó)" aria-label="Descartar el aviso" onClick={() => window.confirm(`¿Descartar el aviso de ${f.avisoPago}? El comprobante sigue pendiente.`) && f.pedidoId !== null && empezar(async () => { await descartarAvisoPago(f.pedidoId ?? f.id); router.refresh(); })} className="text-[11px] opacity-50 hover:opacity-100">✕</button></>
                            : e === "Pendiente" ? <span>Pendiente{f.atraso > 0 ? <span className="text-[12px] font-medium opacity-80"> · {f.atraso} d</span> : null}</span>
                            : <span className={e === "NC aplicada" || e === "Anulada por NC" ? "font-bold" : "font-medium text-stone-500"}>{e === "Anulado" ? f.anulado : e}</span>}
                        </span>
                      </span>;
                    }
                    case "pedido": return f.ubicar
                      ? <Link key={c.id} href={f.ubicar} title="Te lleva al pedido: a su hoja de ruta (resaltado) o, si todavía espera día, a la lista de Pedidos" className="mx-auto inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-stone-300 bg-white px-2.5 text-[12px] font-semibold text-stone-700 hover:border-stone-700 hover:bg-stone-800 hover:text-white">Ubicar <span aria-hidden>›</span></Link>
                      : <span key={c.id} className="text-[12.5px] text-stone-300">—</span>;
                    case "nc": return <span key={c.id} title={f.ncMotivos || undefined} className="truncate text-[12.5px] text-stone-500">
                      {f.arca && f.esNc ? <>{(f.aplicaciones ?? []).map((a) => <span key={a.id} title={a.motivo ? `Motivo: ${a.motivo}` : undefined} className="mr-2 whitespace-nowrap">→ F-{a.facturaNumero}{a.motivo ? <span className="text-stone-400"> · {a.motivo}</span> : null} <button type="button" title="Quitar" onClick={() => window.confirm("¿Quitar esta aplicación?") && empezar(async () => { const r = await quitarAplicacionNc(a.id); if (!r.ok) setError(r.error ?? "No se pudo."); router.refresh(); })} className="text-stone-300 hover:text-rojo-700">✕</button></span>)}{f.anulaManual && <span title={f.anulaManual.motivo ? `Motivo: ${f.anulaManual.motivo}` : undefined} className="mr-2 whitespace-nowrap">→ {rotuloManual(f.anulaManual)}{f.anulaManual.motivo ? <span className="text-stone-400"> · {f.anulaManual.motivo}</span> : null} <button type="button" title="Quitar" onClick={() => window.confirm("¿Quitar esta aplicación anotada a mano?") && empezar(async () => { const r = await quitarAplicacionManual(f.id); if (!r.ok) setError(r.error ?? "No se pudo."); router.refresh(); })} className="text-stone-300 hover:text-rojo-700">✕</button></span>}{(f.aplicaciones ?? []).length === 0 && !f.anulaManual && <span className="text-stone-300">—</span>}</>
                        : !f.arca && f.tipo === "FACTURA" && !f.pagada && !f.cubierta && !f.anulado ? <Link href={`/cuentas/${f.clienteId}/nc?factura=${f.id}`} className="font-medium text-stone-600 underline decoration-stone-300 underline-offset-4 hover:text-stone-900">+ Nota de crédito</Link>
                        : f.ncTexto ? <>{f.ncTexto}{!f.cubierta && f.nc > 0 ? ` (−${formatoPesos(f.nc)})` : ""}</> : <span className="text-stone-300">—</span>}
                    </span>;
                    case "obs": {
                      const b = bloqueoDe(f);
                      return b ? <span key={c.id} title={b.ayuda} className="block min-w-0 cursor-not-allowed truncate rounded bg-stone-50 px-2 text-center text-[12.5px] font-medium leading-7 text-stone-400">{b.texto}</span> : <ObsCelda key={`${c.id}-${f.obs}`} f={f} />;
                    }
                  }
                })}
              </div>
              {picker === f.id && f.esNc && (
                <div className="border-b border-stone-300 bg-crema-50 px-3 py-3 pl-12 text-[13px]">
                  <label className="mb-3 flex max-w-xl flex-col gap-1">
                    <span className="font-medium text-stone-700">Motivo de la {f.numero} <span className="font-normal text-rojo-700">(obligatorio: por qué se emitió)</span></span>
                    <input value={motivoNc} onChange={(e) => setMotivoNc(e.target.value)} maxLength={200} placeholder="Ej.: Devolución de mercadería, error en el precio, factura duplicada…" className="h-9 rounded-md border border-stone-400 bg-white px-3 text-[13px]" />
                  </label>
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
                            <button type="button" disabled={trabajando || motivoNc.trim().length < 3} title={motivoNc.trim().length < 3 ? "Primero escribí el motivo de la nota de crédito" : undefined} onClick={() => window.confirm(`¿Aplicar la ${f.numero} a la ${c.numero} por ${formatoPesos(Math.min(f.saldo ?? 0, c.saldo ?? 0))}?\nMotivo: ${motivoNc.trim()}`) && empezar(async () => { const r = await aplicarNc(f.id, c.id, motivoNc); if (!r.ok) setError(r.error ?? "No se pudo."); else setPicker(null); router.refresh(); })} className="ml-auto rounded-md border border-stone-300 bg-white px-3 py-1 text-[12px] font-medium hover:border-stone-700 hover:bg-stone-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-stone-300 disabled:hover:bg-white disabled:hover:text-stone-900">Aplicar</button>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                  <div className="mt-4 max-w-xl border-t border-stone-300 pt-3">
                    <p className="mb-2 font-medium text-stone-700">¿No está en el sistema? <span className="font-normal text-stone-400">anotala a mano (usa el motivo de arriba)</span></p>
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={manualTipo} onChange={(e) => setManualTipo(e.target.value as "FACTURA" | "ND")} aria-label="Qué hace la nota" className="h-9 rounded-md border border-stone-400 bg-white px-2 text-[13px]">
                        <option value="FACTURA">Se aplica a la factura…</option>
                        <option value="ND">La anula la nota de débito…</option>
                      </select>
                      <input value={manualTexto} onChange={(e) => setManualTexto(e.target.value)} maxLength={40} placeholder={manualTipo === "ND" ? "N° de la ND (ej. 55)" : "N° de la factura (ej. 4700)"} className="h-9 w-48 rounded-md border border-stone-400 bg-white px-3 text-[13px]" />
                      <button type="button" disabled={trabajando || motivoNc.trim().length < 3 || !manualTexto.trim()} title={motivoNc.trim().length < 3 ? "Primero escribí el motivo de la nota de crédito" : undefined} onClick={() => window.confirm(`¿Anotar que la ${f.numero} ${manualTipo === "ND" ? "queda anulada por la ND" : "se aplica a la factura"} ${manualTexto.trim()}?\nMotivo: ${motivoNc.trim()}`) && empezar(async () => { const r = await aplicarNcManual(f.id, manualTipo, manualTexto, motivoNc); if (!r.ok) setError(r.error ?? "No se pudo."); else { setPicker(null); setManualTexto(""); } router.refresh(); })} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[12px] font-medium hover:border-stone-700 hover:bg-stone-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-stone-300 disabled:hover:bg-white disabled:hover:text-stone-900">Anotar a mano</button>
                    </div>
                  </div>
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
