"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { MIN_CLAVE, USUARIO_VALIDO } from "@/lib/usuarios";
import { exigirUsuario } from "@/lib/session";

export type EstadoClave = { error?: string; ok?: string } | undefined;

export async function cambiarContrasena(_: EstadoClave, formData: FormData): Promise<EstadoClave> {
  const usuario = await exigirUsuario();
  const actual = String(formData.get("actual") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const repetida = String(formData.get("repetida") ?? "");

  if (!(await bcrypt.compare(actual, usuario.passwordHash))) return { error: "La contraseña actual no es correcta." };
  if (nueva.length < MIN_CLAVE) return { error: `La contraseña nueva debe tener al menos ${MIN_CLAVE} caracteres.` };
  if (nueva !== repetida) return { error: "La contraseña nueva y su repetición no coinciden." };
  if (nueva === actual) return { error: "La contraseña nueva tiene que ser distinta de la actual." };

  await db.usuario.update({ where: { id: usuario.id }, data: { passwordHash: await bcrypt.hash(nueva, 12) } });
  return { ok: "Contraseña cambiada." };
}

export async function cambiarUsuario(_: EstadoClave, formData: FormData): Promise<EstadoClave> {
  const actual = await exigirUsuario();
  const nuevo = String(formData.get("usuario") ?? "").trim().toLowerCase();
  if (!USUARIO_VALIDO.test(nuevo)) return { error: "El usuario va sin espacios ni tildes (letras, números, punto o guion), de 2 a 30 caracteres." };
  if (nuevo === actual.usuario) return { error: "Ese ya es tu usuario." };
  const existe = await db.usuario.findFirst({ where: { OR: [{ usuario: nuevo }, { email: nuevo }], NOT: { id: actual.id } } });
  if (existe) return { error: "Ese usuario ya lo usa otra persona." };
  await db.usuario.update({ where: { id: actual.id }, data: { usuario: nuevo } });
  revalidatePath("/cuenta");
  return { ok: `Listo: ahora entrás con el usuario ${nuevo}.` };
}
