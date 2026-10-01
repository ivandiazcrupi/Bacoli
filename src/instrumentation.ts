// Se ejecuta una vez cuando arranca el servidor. Si está conectada la planilla de la tienda online, trae los pedidos nuevos cada 15 minutos.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.EMPRETIENDA_CSV_URL) return;
  const g = globalThis as { __empretiendaTimer?: ReturnType<typeof setInterval> };
  if (g.__empretiendaTimer) return;
  const { importarPedidosWeb } = await import("./lib/empretienda");
  const traer = () => importarPedidosWeb().then((r) => { if (r.nuevos) console.log(`[tienda] ${r.mensaje}`); }).catch((e) => console.error("[tienda] error al traer pedidos", e));
  setTimeout(traer, 30_000);
  g.__empretiendaTimer = setInterval(traer, 15 * 60 * 1000);
}
