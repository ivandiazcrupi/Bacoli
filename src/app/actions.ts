"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { borrarSesion } from "@/lib/session";

export async function salir() {
  await borrarSesion();
  redirect("/login");
}

/** Prueba piloto: cambia entre la vista moderna (la de siempre) y la clásica, de sistema de gestión de escritorio. Se guarda en este navegador. */
export async function cambiarVista() {
  const jar = await cookies();
  const clasica = jar.get("vista")?.value === "clasica";
  jar.set("vista", clasica ? "moderna" : "clasica", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
