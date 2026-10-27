import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";
import type { Rol } from "@prisma/client";
import { esPersonalDeOficina, esVendedor, puedeVerProduccion } from "./roles";

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

/** Pantallas del vendedor (/vendedor): solo entra quien tiene rol Vendedor; el resto vuelve al inicio. */
export async function exigirVendedor() {
  const usuario = await exigirUsuario();
  if (!esVendedor(usuario.rol)) redirect("/");
  return usuario;
}

/** Cargar pedidos: oficina o vendedor. Un vendedor solo puede cargarle pedidos a SUS clientes (cada acción lo verifica con soloSusClientes). */
export async function exigirCarga() {
  const usuario = await exigirUsuario();
  if (!esPersonalDeOficina(usuario.rol) && !esVendedor(usuario.rol)) redirect("/");
  return usuario;
}

/** El vendedor (de la lista de Vendedores) que corresponde a un usuario de rol Vendedor, o null si todavía no lo enlazaron con ninguno. */
export async function vendedorDeUsuario(usuarioId: string) {
  const { db } = await import("./db");
  return db.vendedor.findFirst({ where: { usuarioId, activo: true } }); // un vendedor dado de baja ya no entra a ver ni cargar nada
}

/** Pantalla de Producción: el rol Producción y la oficina; el resto vuelve al inicio. */
export async function exigirProduccion() {
  const usuario = await exigirUsuario();
  if (!puedeVerProduccion(usuario.rol)) redirect("/");
  return usuario;
}
