// Se ejecuta una vez cuando arranca el servidor. Si está conectada la tienda online (casilla de Gmail o planilla), trae los pedidos nuevos cada 15 minutos.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !(process.env.EMPRETIENDA_CSV_URL || (process.env.GMAIL_USUARIO && process.env.GMAIL_CLAVE_APP && process.env.GMAIL_ETIQUETA))) return;
  const g = globalThis as { __empretiendaTimer?: ReturnType<typeof setInterval> };
  if (g.__empretiendaTimer) return;
  const { importarPedidosWeb } = await import("./lib/empretienda");
  const traer = () => importarPedidosWeb().then((r) => { if (r.nuevos) console.log(`[tienda] ${r.mensaje}`); }).catch((e) => console.error("[tienda] error al traer pedidos", e));
  setTimeout(traer, 30_000);
  g.__empretiendaTimer = setInterval(traer, 15 * 60 * 1000);
}
