"use server";

import { redirect } from "next/navigation";
import { borrarSesion } from "@/lib/session";

export async function salir() {
  await borrarSesion();
  redirect("/login");
}
