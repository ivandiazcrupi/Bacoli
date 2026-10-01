import { Cabecera } from "@/components/Cabecera";
import { exigirUsuario } from "@/lib/session";
import { esEmailSinCargar } from "@/lib/usuarios";
import { FormularioClave, FormularioUsuario } from "./FormularioClave";

export default async function Cuenta() {
  const usuario = await exigirUsuario();
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-6 sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight">Mi cuenta</h1>
        <p className="-mt-3 text-stone-600">{usuario.nombre}{!esEmailSinCargar(usuario.email) && ` · ${usuario.email}`}</p>
        <div className="space-y-3">
          <FormularioUsuario usuario={usuario.usuario} />
          <FormularioClave />
        </div>
      </main>
    </>
  );
}
