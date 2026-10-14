import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { db } from "./db";

// El apartado Vendedores (comisiones) se abre con una contraseña propia: la saben los que tienen que verlo y, con ella, todos pueden hacer todo ahí.
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

/** ¿Esta persona ya entró con la contraseña del apartado? */
export async function vendedoresDesbloqueado(): Promise<boolean> {
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
