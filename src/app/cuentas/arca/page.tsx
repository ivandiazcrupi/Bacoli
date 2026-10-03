import { redirect } from "next/navigation";

// La pantalla de ARCA pasó a ser la pestaña Facturas.
export default function Arca() {
  redirect("/cuentas");
}
