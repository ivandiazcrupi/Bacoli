"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { puedeGestionarUsuarios } from "@/lib/roles";
import { MIN_CLAVE, emailSinCargar } from "@/lib/usuarios";
import { exigirUsuario } from "@/lib/session";

const ROLES = ["DUENO", "ADMINISTRACION", "VENDEDOR", "REPARTIDOR"] as const;

const esquema = z.object({
  nombre: z.string().trim().min(2, "Falta el nombre."),
  usuario: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{2,30}$/, "El usuario va sin espacios ni tildes (letras, números, punto o guion), de 2 a 30 caracteres."),
  email: z.string().trim().toLowerCase().refine((e) => e === "" || z.email().safeParse(e).success, "El email no es válido."),
  password: z.string().min(MIN_CLAVE, `La contraseña debe tener al menos ${MIN_CLAVE} caracteres.`),
  rol: z.enum(ROLES, "Elegí un rol."),
});

export type EstadoForm = { error?: string; ok?: string } | undefined;

export async function crearUsuario(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const actual = await exigirUsuario();
  if (!puedeGestionarUsuarios(actual.rol)) return { error: "No tenés permiso para crear usuarios." };

  const datos = esquema.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { error: datos.error.issues[0].message };

  // El email es opcional: si no hay, se guarda uno interno para no alterar la tabla.
  const email = datos.data.email || emailSinCargar(datos.data.usuario);
  const existe = await db.usuario.findFirst({ where: { OR: [{ usuario: datos.data.usuario }, { email }] } });
  if (existe) return { error: "Ya existe alguien con ese usuario o ese email." };

  await db.usuario.create({
    data: {
      nombre: datos.data.nombre,
      usuario: datos.data.usuario,
      email,
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
