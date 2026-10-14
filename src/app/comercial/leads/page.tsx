import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { hoy } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { enlaceWhatsApp } from "@/lib/telefonos";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { EncabezadoComercial } from "../EncabezadoComercial";
import { ListaLeads, type FilaLead } from "./ListaLeads";

const fechaAR = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

// LEADS: mini CRM de posibles clientes. Quién entró, en qué está, cuándo se le escribió y cuándo hay que volver a hacerlo.
export default async function Leads() {
  const usuario = await exigirOficina();
  const hoyStr = hoy();
  const leads = await db.lead.findMany({
    include: { contactos: { where: { tipo: { not: "ESTADO" } }, orderBy: { creadoEn: "desc" }, take: 1, select: { creadoEn: true, tipo: true, texto: true } } },
    orderBy: { creadoEn: "desc" },
  });
  const filas: FilaLead[] = leads.map((l) => ({
    id: l.id, nombre: l.nombre, contacto: l.contacto, telefono: l.telefono, wa: enlaceWhatsApp(l.telefono),
    barrio: l.barrio, origen: l.origen, estado: l.estado, vendedor: l.vendedor,
    proximo: l.proximoContacto, ingreso: fechaAR(l.creadoEn),
    ultimo: l.contactos[0] ? fechaAR(l.contactos[0].creadoEn) : null,
    ultimoTipo: l.contactos[0]?.tipo ?? null,
  }));
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoComercial activa="leads" esDueno={usuario.rol === "DUENO"} derecha={<Link href="/comercial/leads/nuevo" className="flex h-10 items-center rounded-lg bg-verde-700 px-5 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800">+ Cargar lead</Link>} />
        <ListaLeads filas={filas} hoy={hoyStr} />
      </main>
    </>
  );
}
