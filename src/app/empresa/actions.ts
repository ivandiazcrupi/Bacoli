"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { mayus } from "@/lib/mayusculas";
import { exigirUsuario } from "@/lib/session";

export type EstadoEmpresa = { ok?: string; error?: string; valores?: Record<string, string> } | undefined;

const texto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

export async function guardarEmpresa(_: EstadoEmpresa, formData: FormData): Promise<EstadoEmpresa> {
  const usuario = await exigirUsuario();
  if (usuario.rol !== "DUENO") return { error: "Solo un dueño puede cambiar los datos de la empresa." };
  const valores = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));

  const razonSocial = mayus(String(formData.get("razonSocial") ?? ""));
  if (razonSocial.length < 2) return { error: "Falta la razón social.", valores };

  // Próximo número de remito: sirve para seguir la numeración de otro sistema o de talonarios. Solo puede subir.
  const proximo = String(formData.get("proximoRemito") ?? "").trim();
  if (proximo) {
    const n = Number(proximo);
    if (!Number.isInteger(n) || n < 1) return { error: "El próximo número de remito tiene que ser un entero mayor a 0.", valores };
    const actual = await db.numerador.findUnique({ where: { id: "REMITO" } });
    if (n - 1 < (actual?.ultimo ?? 0)) return { error: `Ya se emitieron remitos hasta el R-${String(actual?.ultimo).padStart(6, "0")}. El próximo tiene que ser ${(actual?.ultimo ?? 0) + 1} o más.`, valores };
    await db.numerador.upsert({ where: { id: "REMITO" }, update: { ultimo: n - 1 }, create: { id: "REMITO", ultimo: n - 1 } });
  }

  const datos = {
    razonSocial,
    nombreComercial: mayus(String(formData.get("nombreComercial") ?? "")) || "BACOLI",
    cuit: texto(formData.get("cuit")),
    condicionIva: texto(formData.get("condicionIva")),
    domicilio: texto(formData.get("domicilio")),
    telefono: texto(formData.get("telefono")),
    email: texto(formData.get("email")),
    ingresosBrutos: texto(formData.get("ingresosBrutos")),
    inicioActividades: texto(formData.get("inicioActividades")),
    puntoVenta: texto(formData.get("puntoVenta")),
  };
  await db.empresa.upsert({ where: { id: "principal" }, update: datos, create: { id: "principal", ...datos } });
  revalidatePath("/empresa");
  return { ok: "Datos guardados." };
}
