import { Cabecera } from "@/components/Cabecera";
import { NOMBRE_ROL } from "@/lib/roles";
import { exigirUsuario } from "@/lib/session";

export default async function Inicio() {
  const usuario = await exigirUsuario();

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-bold">Hola, {usuario.nombre}</h1>
        <p className="mt-1 text-stone-600">Ingresaste como {NOMBRE_ROL[usuario.rol]}.</p>
        <p className="mt-6 rounded-lg border border-dashed border-stone-300 p-4 text-stone-600">
          Acá va a ir el resumen del día. Los módulos de Clientes, Pedidos, Cuenta corriente y Hoja de ruta se
          van sumando de a uno.
        </p>
      </main>
    </>
  );
}
