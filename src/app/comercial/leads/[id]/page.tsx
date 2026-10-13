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
const fechaHora = (d: Date) => d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

        <section className="rounded-lg border border-stone-300 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">{lead.nombre}</h1>
                <span className={`rounded px-2.5 py-1 text-[13px] font-bold ${PASTILLA[lead.estado]}`}>{nombreEstado(lead.estado)}</span>
              </div>
              <p className="mt-1 text-sm text-stone-600">
                {[lead.contacto, lead.barrio, lead.direccion].filter(Boolean).join(" · ") || "Sin más datos"}
              </p>
              {lead.estado === "PERDIDO" && lead.motivoPerdida && <p className="mt-1 text-sm font-medium text-rojo-700">Motivo: {lead.motivoPerdida}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {wa && <a href={wa} target="_blank" rel="noreferrer" className="rounded-lg bg-verde-700 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800">Escribir por WhatsApp</a>}
              {lead.telefono && <a href={`tel:${lead.telefono.replace(/[^\d+]/g, "")}`} className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold hover:border-stone-500">Llamar</a>}
              {lead.estado === "GANADO" || lead.estado === "NEGOCIANDO" ? <Link href="/clientes/nuevo" className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold hover:border-stone-500">Cargarlo como cliente ›</Link> : null}
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-stone-200 pt-4 text-sm md:grid-cols-5">
            <div><dt className="text-xs text-stone-500">Ingresó</dt><dd className="font-medium">{fmt(ingreso)} · hace {dias(hoyStr, ingreso)} d</dd></div>
            <div><dt className="text-xs text-stone-500">Cómo llegó</dt><dd className="font-medium">{lead.origen ?? "—"}</dd></div>
            <div><dt className="text-xs text-stone-500">Teléfono</dt><dd className="font-medium">{lead.telefono ?? "—"}</dd></div>
            <div><dt className="text-xs text-stone-500">Vendedor</dt><dd className="font-medium">{lead.vendedor ?? "—"}</dd></div>
            <div>
              <dt className="text-xs text-stone-500">Próximo contacto</dt>
              <dd className="flex items-center gap-2 font-medium">
                {lead.proximoContacto && abierto ? (
                  <>
                    <span className={atraso !== null && atraso >= 0 ? "rounded bg-rojo-50 px-2 py-0.5 font-bold text-rojo-700" : ""}>{lead.proximoContacto === hoyStr ? "Hoy" : fmt(lead.proximoContacto)}{atraso !== null && atraso > 0 ? ` · ${atraso} d de atraso` : ""}</span>
                    <form action={borrarProximo.bind(null, lead.id)}><button className="text-xs text-stone-500 underline hover:text-stone-800">quitar</button></form>
                  </>
                ) : <span className="text-stone-400">Sin fecha</span>}
              </dd>
            </div>
          </dl>
          {(lead.interes || lead.notas) && (
            <div className="mt-4 grid gap-4 border-t border-stone-200 pt-4 text-sm md:grid-cols-2">
              {lead.interes && <div><div className="text-xs text-stone-500">Qué le interesa</div><p className="whitespace-pre-wrap">{lead.interes}</p></div>}
              {lead.notas && <div><div className="text-xs text-stone-500">Notas</div><p className="whitespace-pre-wrap">{lead.notas}</p></div>}
            </div>
          )}
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
              inicial={{ nombre: lead.nombre, contacto: lead.contacto ?? "", telefono: lead.telefono ?? "", email: lead.email ?? "", barrio: lead.barrio ?? "", direccion: lead.direccion ?? "", origen: lead.origen ?? "", interes: lead.interes ?? "", notas: lead.notas ?? "", vendedor: lead.vendedor ?? "", proximoContacto: lead.proximoContacto ?? "" }}
            />
            {usuario.rol === "DUENO" && <div className="mt-3 flex justify-end"><BotonEliminar accion={eliminarLead.bind(null, lead.id)} nombre={lead.nombre} /></div>}
          </div>
        </details>
      </main>
    </>
  );
}
