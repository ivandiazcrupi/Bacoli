"use server";

import { vendedoresDesbloqueado } from "@/lib/claveVendedores";
import { asistenteDisponible, responder, type Mensaje, type Respuesta } from "@/lib/asistente/asistente";
import { db } from "@/lib/db";
import { esPersonalDeOficina } from "@/lib/roles";
import { leerSesion } from "@/lib/session";

// Solo oficina (gerentes y administración). Los montos en pesos solo se los da a los gerentes.
async function usuarioDeOficina() {
  const sesion = await leerSesion();
  if (!sesion) return null;
  const u = await db.usuario.findUnique({ where: { id: sesion.usuarioId }, select: { id: true, nombre: true, rol: true, activo: true } });
  return u && u.activo && esPersonalDeOficina(u.rol) ? u : null;
}

const MAX_DIARIO = Number(process.env.ASISTENTE_MAX_DIARIO) || 150; // preguntas por persona por día (en memoria: se reinicia al republicar)
const usos = new Map<string, { dia: string; n: number }>();

export async function preguntarAlAsistente(historial: Mensaje[]): Promise<Respuesta> {
  const u = await usuarioDeOficina();
  if (!u) return { ok: false, error: "Entrá de nuevo al sistema para usar el asistente." };
  if (!asistenteDisponible()) return { ok: false, error: "El asistente todavía no está activado." };

  // Solo texto, últimos mensajes, empezando por una pregunta de la persona.
  const limpio = (Array.isArray(historial) ? historial : [])
    .filter((m) => m && (m.rol === "user" || m.rol === "assistant") && typeof m.texto === "string" && m.texto.trim())
    .map((m) => ({ rol: m.rol, texto: m.texto.trim().slice(0, 1500) }))
    .slice(-8);
  while (limpio.length && limpio[0].rol !== "user") limpio.shift();
  if (!limpio.length || limpio[limpio.length - 1].rol !== "user") return { ok: false, error: "Escribí una pregunta." };

  const dia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const uso = usos.get(u.id);
  const n = uso && uso.dia === dia ? uso.n : 0;
  if (n >= MAX_DIARIO) return { ok: false, error: `Llegaste al máximo de ${MAX_DIARIO} preguntas por hoy. Mañana se renueva.` };
  usos.set(u.id, { dia, n: n + 1 });

  return responder(limpio, { nombre: u.nombre.split(" ")[0], bloqueado: !(await vendedoresDesbloqueado()) });
}
