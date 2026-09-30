import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";
import type { Rol } from "@prisma/client";
import { esPersonalDeOficina } from "./roles";

const COOKIE = "bacoli_sesion";
const DURACION_HORAS = 12;

export type Sesion = { usuarioId: string; rol: Rol };

function clave() {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error("Falta SESSION_SECRET (mínimo 32 caracteres) en las variables de entorno.");
  }
  return new TextEncoder().encode(secreto);
}

export async function crearSesion(sesion: Sesion) {
  const token = await new SignJWT({ ...sesion })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${DURACION_HORAS}h`)
    .sign(clave());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_HORAS * 3600,
  });
}

export async function borrarSesion() {
  (await cookies()).delete(COOKIE);
}

export async function leerSesion(): Promise<Sesion | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave());
    return { usuarioId: payload.usuarioId as string, rol: payload.rol as Rol };
  } catch {
    return null;
  }
}

/** Devuelve el usuario logueado (verificando en la base que siga activo) o manda a /login. */
export async function exigirUsuario() {
  const { db } = await import("./db");
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");
  const usuario = await db.usuario.findUnique({ where: { id: sesion.usuarioId } });
  if (!usuario || !usuario.activo) redirect("/login");
  return usuario;
}

/** Igual que exigirUsuario, pero los repartidores vuelven al inicio (no ven clientes ni precios). */
export async function exigirOficina() {
  const usuario = await exigirUsuario();
  if (!esPersonalDeOficina(usuario.rol)) redirect("/");
  return usuario;
}
