"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/session";

export type EstadoClave = { error?: string; ok?: string } | undefined;

export async function cambiarContrasena(_: EstadoClave, formData: FormData): Promise<EstadoClave> {
  const usuario = await exigirUsuario();
  const actual = String(formData.get("actual") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const repetida = String(formData.get("repetida") ?? "");

  if (!(await bcrypt.compare(actual, usuario.passwordHash))) return { error: "La contraseña actual no es correcta." };
  if (nueva.length < 8) return { error: "La contraseña nueva debe tener al menos 8 caracteres." };
  if (nueva !== repetida) return { error: "La contraseña nueva y su repetición no coinciden." };
  if (nueva === actual) return { error: "La contraseña nueva tiene que ser distinta de la actual." };

  await db.usuario.update({ where: { id: usuario.id }, data: { passwordHash: await bcrypt.hash(nueva, 12) } });
  return { ok: "Contraseña cambiada." };
}
