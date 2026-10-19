import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonVolver } from "@/components/BotonVolver";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { hoy, sumarDias } from "@/lib/fechas";
import { ABIERTOS, nombreEstado, nombreTipo } from "@/lib/leads";
import { exigirOficina } from "@/lib/session";
import { enlaceWhatsApp } from "@/lib/telefonos";
import { CONTENEDOR_PEDIDOS } from "../../../pedidos/Encabezado";
import { borrarProximo, cambiarEstadoLead, eliminarLead, guardarLead, registrarContacto } from "../actions";
import { FormLead } from "../FormLead";
import { BotonEliminar, CambiarEstado, FormContacto } from "./Panel";

const PASTILLA: Record<string, string> = {
  NUEVO: "bg-sky-50 text-sky-800", CONTACTADO: "bg-stone-100 text-stone-700", MUESTRA: "bg-amber-50 text-amber-800",
  NEGOCIANDO: "bg-violet-50 text-violet-800", GANADO: "bg-verde-50 text-verde-800", PERDIDO: "bg-rojo-50 text-rojo-700",
};
const ICONO: Record<string, string> = { WHATSAPP: "💬", LLAMADA: "📞", RESPUESTA: "↩", VISITA: "📍", MUESTRA: "🎁", NOTA: "✎", ESTADO: "●" };
const fmt = (s: string) => `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const fechaHora = (d: Date) => d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", hourCycle: "h23", minute: "2-digit" });
const dias = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

export default async function FichaLead({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id }, include: { contactos: { orderBy: { creadoEn: "desc" } } } });
  if (!lead) notFound();
  const hoyStr = hoy();
  const wa = enlaceWhatsApp(lead.telefono);
  const abierto = ABIERTOS.includes(lead.estado);
  const atraso = lead.proximoContacto ? dias(hoyStr, lead.proximoContacto) : null;
  const vendedores = [...new Set([...(await db.lead.findMany({ distinct: ["vendedor"], select: { vendedor: true } })).map((l) => l.vendedor).filter(Boolean) as string[], usuario.nombre])];
  const ingreso = lead.creadoEn.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={`${CONTENEDOR_PEDIDOS} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/comercial/leads" className="text-sm font-semibold text-stone-600 hover:underline">‹ Leads</Link>
          <BotonVolver fallback="/comercial/leads" />
        </div>

        <section className="rounded-lg border border-stone-300 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight">{lead.nombre}</h1>
              <span className={`rounded px-2.5 py-1 text-[13px] font-bold ${PASTILLA[lead.estado]}`}>{nombreEstado(lead.estado)}</span>
              {lead.estado === "PERDIDO" && lead.motivoPerdida && <span className="text-sm font-medium text-rojo-700">Motivo: {lead.motivoPerdida}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {wa && <a href={wa} target="_blank" rel="noreferrer" className="rounded-lg bg-verde-700 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800">WhatsApp</a>}
              {lead.telefono && <a href={`tel:${lead.telefono.replace(/[^\d+]/g, "")}`} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold hover:border-stone-500">Llamar</a>}
              {lead.estado === "GANADO" || lead.estado === "NEGOCIANDO" ? <Link href="/clientes/nuevo" className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold hover:border-stone-500">Cargarlo como cliente ›</Link> : null}
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-stone-200 pt-3 text-sm md:grid-cols-[1.4fr_1fr_1fr_1fr_1.6fr]">
            <div><dt className="text-xs text-stone-500">Nombre</dt><dd className="font-medium">{lead.nombre}</dd></div>
            <div><dt className="text-xs text-stone-500">Teléfono</dt><dd className="font-medium">{lead.telefono ?? "—"}</dd></div>
            <div><dt className="text-xs text-stone-500">Barrio</dt><dd className="font-medium">{lead.barrio ?? "—"}</dd></div>
            <div><dt className="text-xs text-stone-500">Tipo de comercio</dt><dd className="font-medium">{lead.tipoComercio ?? "—"}</dd></div>
            <div><dt className="text-xs text-stone-500">Nota</dt><dd className="whitespace-pre-wrap font-medium">{lead.notas ?? "—"}</dd></div>
          </dl>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-200 pt-3 text-xs text-stone-500">
            <span>Ingresó {fmt(ingreso)} · hace {dias(hoyStr, ingreso)} d</span>
            {lead.origen && <span>Llegó por {lead.origen}</span>}
            {lead.vendedor && <span>Vendedor {lead.vendedor}</span>}
            {lead.proximoContacto && abierto && (
              <span className="flex items-center gap-2">
                <span className={atraso !== null && atraso >= 0 ? "rounded bg-rojo-50 px-2 py-0.5 font-bold text-rojo-700" : ""}>Escribirle: {lead.proximoContacto === hoyStr ? "hoy" : fmt(lead.proximoContacto)}{atraso !== null && atraso > 0 ? ` · ${atraso} d de atraso` : ""}</span>
                <form action={borrarProximo.bind(null, lead.id)}><button className="underline hover:text-stone-800">quitar</button></form>
              </span>
            )}
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <section className="rounded-lg border border-stone-300 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-600">Historial · {lead.contactos.length}</h2>
            {lead.contactos.length === 0 ? <p className="text-sm text-stone-500">Todavía no hay nada anotado.</p> : (
              <ol className="space-y-0">
                {lead.contactos.map((c) => (
                  <li key={c.id} className="flex gap-3 border-t border-stone-200 py-3 first:border-t-0 first:pt-0">
                    <span className="w-6 shrink-0 text-center text-base">{ICONO[c.tipo] ?? "•"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{nombreTipo(c.tipo)}</span>
                        <span className="text-xs text-stone-500">{fechaHora(c.creadoEn)}{c.usuario ? ` · ${c.usuario}` : ""}</span>
                      </div>
                      {c.texto && <p className="mt-0.5 whitespace-pre-wrap text-sm text-stone-700">{c.texto}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="space-y-4">
            <section className="rounded-lg border border-stone-300 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-600">Anotar contacto</h2>
              <FormContacto accion={registrarContacto.bind(null, lead.id)} manana={abierto ? sumarDias(hoyStr, 2) : ""} />
            </section>
            <section className="rounded-lg border border-stone-300 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-600">Estado</h2>
              <CambiarEstado actual={lead.estado} accion={cambiarEstadoLead.bind(null, lead.id)} />
            </section>
          </div>
        </div>

        <details className="rounded-lg border border-stone-300 bg-white">
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold uppercase tracking-wide text-stone-600">Editar datos del lead</summary>
          <div className="border-t border-stone-200 p-3">
            <FormLead
              accion={guardarLead.bind(null, lead.id)} textoBoton="Guardar cambios" vendedores={vendedores}
              inicial={{ nombre: lead.nombre, tipoComercio: lead.tipoComercio ?? "", contacto: lead.contacto ?? "", telefono: lead.telefono ?? "", email: lead.email ?? "", barrio: lead.barrio ?? "", direccion: lead.direccion ?? "", origen: lead.origen ?? "", interes: lead.interes ?? "", notas: lead.notas ?? "", vendedor: lead.vendedor ?? "", proximoContacto: lead.proximoContacto ?? "" }}
            />
            {usuario.rol === "DUENO" && <div className="mt-3 flex justify-end"><BotonEliminar accion={eliminarLead.bind(null, lead.id)} nombre={lead.nombre} /></div>}
          </div>
        </details>
      </main>
    </>
  );
}
