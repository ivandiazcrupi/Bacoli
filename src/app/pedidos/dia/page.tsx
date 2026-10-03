import { Cabecera } from "@/components/Cabecera";
import { esFechaValida, hoy, lunesDe, diaMes, nombreDia, sumarDias } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS, EncabezadoPedidos } from "../Encabezado";
import { DiasSemana } from "./[fecha]/DiasSemana";

// HOJA DE RUTA sin día elegido: la pantalla queda en blanco y hay que tocar el día (así nunca se abre una hoja sin querer).
export default async function ElegirDia({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const usuario = await exigirOficina();
  const { semana } = await searchParams;
  const lunes = lunesDe(semana && esFechaValida(semana) ? semana : hoy());
  const fechas = Array.from({ length: 6 }, (_, n) => sumarDias(lunes, n));
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoPedidos activa="ruta" fechaRuta={lunes} />
        <DiasSemana
          fecha=""
          lunesTexto={diaMes(lunes)}
          hrefAnterior={`/pedidos/dia?semana=${sumarDias(lunes, -7)}`}
          hrefSiguiente={`/pedidos/dia?semana=${sumarDias(lunes, 7)}`}
          hrefSemana={`/pedidos/semana?semana=${lunes}`}
          dias={fechas.map((f) => ({ fecha: f, texto: `${nombreDia(f).slice(0, 3)} ${Number(f.slice(8))}`, pedidos: 0, vehiculos: 0, cerrado: false }))}
        />
        <p className="py-16 text-center text-lg text-stone-500">Elegí un día para ver su hoja de ruta.</p>
      </main>
    </>
  );
}
