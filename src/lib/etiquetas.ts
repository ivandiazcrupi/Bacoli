export const TIPO_CLIENTE = { MINORISTA: "Minorista", MAYORISTA: "Mayorista", DISTRIBUIDOR: "Distribuidor" } as const;

export const CONDICION_PAGO = {
  CONTADO: "Contado",
  DIAS_7: "7 días",
  DIAS_15: "15 días",
  DIAS_30: "30 días",
  DIAS_45: "45 días",
} as const;

export const IMPUTACION_PAGO = { SALDO: "Contra el saldo total", PEDIDO: "Contra cada pedido" } as const;
