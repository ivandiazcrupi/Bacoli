import { redirect } from "next/navigation";

// Las listas de precios se dejaron de usar por ahora (el precio se escribe en cada pedido). La pantalla de productos tomó su lugar.
export default function Precios() {
  redirect("/productos");
}
