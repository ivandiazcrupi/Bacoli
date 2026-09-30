"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { crearSesion } from "@/lib/session";

const esquema = z.object({ email: z.string().trim().toLowerCase().min(1), password: z.string().min(1) });

// Hash de relleno: se compara igual aunque el email no exista, para no revelar qué emails están registrados.
const HASH_FALSO = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.yQ1vP0mJk5yJ9q8Zt3p6d0v3nJ2e";

export type EstadoLogin = { error?: string; email?: string } | undefined;

export async function iniciarSesion(_: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const emailIngresado = String(formData.get("email") ?? "");
  const datos = esquema.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { error: "Completá el email y la contraseña.", email: emailIngresado };

  const usuario = await db.usuario.findUnique({ where: { email: datos.data.email } });
  const ok = await bcrypt.compare(datos.data.password, usuario?.passwordHash ?? HASH_FALSO);
  if (!usuario || !ok || !usuario.activo) return { error: "Email o contraseña incorrectos.", email: emailIngresado };

  await crearSesion({ usuarioId: usuario.id, rol: usuario.rol });
  redirect("/");
}
