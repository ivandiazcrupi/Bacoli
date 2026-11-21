import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { db } from "./db";
import { leerSesion } from "./session";

// Vendedores, Estadísticas, Tienda online, el total de la SEMANA y los montos del asistente: los GERENTES (rol DUENO) entran directo, sin contraseña;
// el resto del equipo de oficina los ve pero tiene que poner la contraseña del apartado (y, con ella, puede hacer todo ahí).
// La contraseña se guarda cifrada en Empresa. Al entrar queda una cookie firmada (12 h); si se cambia la contraseña, las cookies viejas dejan de valer.
const COOKIE = "bacoli_vend";
const HORAS = 12;
export const MIN_CLAVE_VENDEDORES = 4;

function secreto() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("Falta SESSION_SECRET (mínimo 32 caracteres) en las variables de entorno.");
  return new TextEncoder().encode(s);
}
const huella = (hash: string) => hash.slice(-12);
const hashActual = async () => (await db.empresa.findUnique({ where: { id: "principal" }, select: { claveVendedoresHash: true } }))?.claveVendedoresHash ?? null;

export const hayClaveVendedores = async () => !!(await hashActual());

/** ¿Quien está logueado es gerente? (se lee de la base: un cambio de rol vale enseguida) */
export async function esGerente(): Promise<boolean> {
  const sesion = await leerSesion();
  if (!sesion) return false;
  const u = await db.usuario.findUnique({ where: { id: sesion.usuarioId }, select: { rol: true, activo: true } });
  return !!u && u.activo && u.rol === "DUENO";
}

/** ¿Puede ver el apartado? Un gerente siempre; el resto, si ya entró con la contraseña. */
export async function vendedoresDesbloqueado(): Promise<boolean> {
  if (await esGerente()) return true;
  const hash = await hashActual();
  if (!hash) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secreto());
    return payload.h === huella(hash);
  } catch {
    return false;
  }
}

async function dejarEntrar(hash: string) {
  const token = await new SignJWT({ h: huella(hash) }).setProtectedHeader({ alg: "HS256" }).setExpirationTime(`${HORAS}h`).sign(secreto());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: HORAS * 3600 });
}

export async function desbloquearVendedores(clave: string): Promise<boolean> {
  const hash = await hashActual();
  if (!hash || !(await bcrypt.compare(clave, hash))) return false;
  await dejarEntrar(hash);
  return true;
}

export async function ponerClaveVendedores(clave: string) {
  const hash = await bcrypt.hash(clave, 12);
  await db.empresa.upsert({ where: { id: "principal" }, update: { claveVendedoresHash: hash }, create: { id: "principal", claveVendedoresHash: hash } });
  await dejarEntrar(hash);
}

export async function bloquearVendedores() {
  (await cookies()).delete(COOKIE);
}
