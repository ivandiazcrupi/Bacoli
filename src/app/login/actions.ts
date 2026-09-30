"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { crearSesion } from "@/lib/session";

// Límite de intentos fallidos por usuario: 5 cada 15 minutos (en memoria; alcanza con una sola instancia).
const fallos = new Map<string, { cuenta: number; desde: number }>();
const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

function bloqueado(clave: string) {
  const f = fallos.get(clave);
  if (!f) return false;
  if (Date.now() - f.desde > VENTANA_MS) {
    fallos.delete(clave);
    return false;
  }
  return f.cuenta >= MAX_FALLOS;
}

function registrarFallo(clave: string) {
  const f = fallos.get(clave);
  if (!f || Date.now() - f.desde > VENTANA_MS) fallos.set(clave, { cuenta: 1, desde: Date.now() });
  else f.cuenta++;
}

const esquema = z.object({ usuario: z.string().trim().toLowerCase().min(1), password: z.string().min(1) });

// Hash de relleno: se compara igual aunque el usuario no exista, para no revelar quiénes están registrados.
const HASH_FALSO = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.yQ1vP0mJk5yJ9q8Zt3p6d0v3nJ2e";

export type EstadoLogin = { error?: string; usuario?: string } | undefined;

export async function iniciarSesion(_: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const ingresado = String(formData.get("usuario") ?? "");
  const datos = esquema.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { error: "Completá el usuario y la contraseña.", usuario: ingresado };

  if (bloqueado(datos.data.usuario)) {
    return { error: "Demasiados intentos. Probá de nuevo en 15 minutos.", usuario: ingresado };
  }

  // Se puede entrar con el usuario o, como antes, con el email.
  const usuario = await db.usuario.findFirst({ where: { OR: [{ usuario: datos.data.usuario }, { email: datos.data.usuario }] } });
  const ok = await bcrypt.compare(datos.data.password, usuario?.passwordHash ?? HASH_FALSO);
  if (!usuario || !ok || !usuario.activo) {
    registrarFallo(datos.data.usuario);
    return { error: "Usuario o contraseña incorrectos.", usuario: ingresado };
  }

  fallos.delete(datos.data.usuario);
  await crearSesion({ usuarioId: usuario.id, rol: usuario.rol });
  redirect("/");
}
