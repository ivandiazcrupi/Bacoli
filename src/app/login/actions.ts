"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { crearSesion } from "@/lib/session";

// Límite de intentos fallidos por email: 5 cada 15 minutos (en memoria; alcanza con una sola instancia).
const fallos = new Map<string, { cuenta: number; desde: number }>();
const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

function bloqueado(email: string) {
  const f = fallos.get(email);
  if (!f) return false;
  if (Date.now() - f.desde > VENTANA_MS) {
    fallos.delete(email);
    return false;
  }
  return f.cuenta >= MAX_FALLOS;
}

function registrarFallo(email: string) {
  const f = fallos.get(email);
  if (!f || Date.now() - f.desde > VENTANA_MS) fallos.set(email, { cuenta: 1, desde: Date.now() });
  else f.cuenta++;
}

const esquema = z.object({ email: z.string().trim().toLowerCase().min(1), password: z.string().min(1) });

// Hash de relleno: se compara igual aunque el email no exista, para no revelar qué emails están registrados.
const HASH_FALSO = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.yQ1vP0mJk5yJ9q8Zt3p6d0v3nJ2e";

export type EstadoLogin = { error?: string; email?: string } | undefined;

export async function iniciarSesion(_: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const emailIngresado = String(formData.get("email") ?? "");
  const datos = esquema.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { error: "Completá el email y la contraseña.", email: emailIngresado };

  if (bloqueado(datos.data.email)) {
    return { error: "Demasiados intentos. Probá de nuevo en 15 minutos.", email: emailIngresado };
  }

  const usuario = await db.usuario.findUnique({ where: { email: datos.data.email } });
  const ok = await bcrypt.compare(datos.data.password, usuario?.passwordHash ?? HASH_FALSO);
  if (!usuario || !ok || !usuario.activo) {
    registrarFallo(datos.data.email);
    return { error: "Email o contraseña incorrectos.", email: emailIngresado };
  }

  fallos.delete(datos.data.email);
  await crearSesion({ usuarioId: usuario.id, rol: usuario.rol });
  redirect("/");
}
