"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { borrarSesion } from "@/lib/session";

export async function salir() {
  await borrarSesion();
  redirect("/login");
}

/** Prueba piloto: elige el aspecto del sistema (moderna = la de siempre, intermedia o clásica). Se guarda en este navegador. */
export async function elegirVista(formData: FormData) {
  const v = String(formData.get("vista"));
  const valor = v === "clasica" || v === "intermedia" ? v : "moderna";
  (await cookies()).set("vista", valor, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
