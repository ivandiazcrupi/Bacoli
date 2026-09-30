"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { puedeGestionarUsuarios } from "@/lib/roles";
import { exigirUsuario } from "@/lib/session";

const ROLES = ["DUENO", "ADMINISTRACION", "VENDEDOR", "REPARTIDOR"] as const;

const esquema = z.object({
  nombre: z.string().trim().min(2, "Falta el nombre."),
  email: z.string().trim().toLowerCase().pipe(z.email("El email no es válido.")),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  rol: z.enum(ROLES, "Elegí un rol."),
});

export type EstadoForm = { error?: string; ok?: string } | undefined;

export async function crearUsuario(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const actual = await exigirUsuario();
  if (!puedeGestionarUsuarios(actual.rol)) return { error: "No tenés permiso para crear usuarios." };

  const datos = esquema.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { error: datos.error.issues[0].message };

  const existe = await db.usuario.findUnique({ where: { email: datos.data.email } });
  if (existe) return { error: "Ya existe un usuario con ese email." };

  await db.usuario.create({
    data: {
      nombre: datos.data.nombre,
      email: datos.data.email,
      rol: datos.data.rol,
      passwordHash: await bcrypt.hash(datos.data.password, 12),
    },
  });
  revalidatePath("/usuarios");
  return { ok: `Usuario ${datos.data.nombre} creado.` };
}

export async function cambiarActivo(formData: FormData) {
  const actual = await exigirUsuario();
  if (!puedeGestionarUsuarios(actual.rol)) return;

  const id = String(formData.get("id"));
  if (id === actual.id) return; // nadie puede desactivarse a sí mismo
  const usuario = await db.usuario.findUnique({ where: { id } });
  if (!usuario) return;

  await db.usuario.update({ where: { id }, data: { activo: !usuario.activo } });
  revalidatePath("/usuarios");
}
