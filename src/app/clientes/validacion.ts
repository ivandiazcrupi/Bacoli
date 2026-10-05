import { z } from "zod";
import { cuitValido, leerMonto } from "@/lib/numeros";

const vacioANull = (v: unknown) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v);
const textoOpcional = z.preprocess(vacioANull, z.string().trim().nullable());

export const esquemaSucursal = z.object({
  alias: textoOpcional,
  direccion: z.string().trim().min(3, "Falta la dirección."),
  barrio: z.string().trim().min(2, "Falta el barrio."),
  zonaId: z.string().min(1, "Elegí la zona de reparto."),
  telefono: textoOpcional,
  comentario: textoOpcional,
});

export const esquemaCliente = z
  .object({
    nombre: z.string().trim().min(2, "Falta el nombre."),
    tipo: z.enum(["MINORISTA", "MAYORISTA", "DISTRIBUIDOR"], "Elegí el tipo de cliente."),
    razonSocial: textoOpcional,
    cuit: textoOpcional,
    observacion: z.preprocess(vacioANull, z.string().trim().max(500, "La observación es muy larga (máx. 500).").nullable()),
    facturado: z.preprocess((v) => v === "on", z.boolean()),
    condicionPago: z.enum(["CONTADO", "DIAS_7", "DIAS_15", "DIAS_30", "DIAS_45"]),
    listaPreciosId: textoOpcional,
    descuentoPct: z.preprocess(
      (v) => (typeof v === "string" && v.trim() ? leerMonto(v) : 0),
      z.number("El descuento no es válido.").min(0).max(100, "El descuento no puede pasar de 100%."),
    ),
    imputacionPago: z.preprocess((v) => v || "SALDO", z.enum(["SALDO", "PEDIDO"])),
    sinLimite: z.preprocess((v) => v === "on", z.boolean()),
    maxPedidosImpagos: z.preprocess(
      (v) => (typeof v === "string" && v.trim() ? Number(v) : null),
      z.number("El máximo de pedidos no es válido.").int().min(1).nullable(),
    ),
    maxMonto: z.preprocess((v) => leerMonto(v as string), z.number().nullable()),
    comisionista: textoOpcional,
    comisionPct: z.preprocess(
      (v) => (typeof v === "string" && v.trim() ? leerMonto(v) : null),
      z.number("La comisión no es válida.").min(0).max(100).nullable(),
    ),
  })
  .refine((c) => !c.cuit || cuitValido(c.cuit), { message: "El CUIT no es válido (11 dígitos).", path: ["cuit"] })
  .refine((c) => !c.facturado || !!c.cuit, { message: "Un cliente con factura necesita CUIT.", path: ["cuit"] });

export type EstadoForm = { error?: string; ok?: string; valores?: Record<string, string> } | undefined;

export function valoresDe(formData: FormData) {
  const v: Record<string, string> = {};
  formData.forEach((x, k) => {
    if (typeof x === "string") v[k] = x;
  });
  return v;
}
