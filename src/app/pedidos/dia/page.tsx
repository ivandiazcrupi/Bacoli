import { Cabecera } from "@/components/Cabecera";
import { diasDeSemana, esFechaValida, hoy, inicioSemana, diaMes, nombreDia, sumarDias, semanaDeTrabajo } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS, EncabezadoPedidos } from "../Encabezado";
import { DiasSemana } from "./[fecha]/DiasSemana";

// HOJA DE RUTA sin día elegido: la pantalla queda en blanco y hay que tocar el día (así nunca se abre una hoja sin querer).
export default async function ElegirDia({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const usuario = await exigirOficina();
  const { semana } = await searchParams;
  const inicio = semana && esFechaValida(semana) ? inicioSemana(semana) : semanaDeTrabajo();
  const fechas = diasDeSemana(inicio);
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoPedidos activa="ruta" fechaRuta={inicio} />
        <DiasSemana
          fecha=""
          inicioTexto={diaMes(inicio)}
          hrefAnterior={`/pedidos/dia?semana=${sumarDias(inicio, -7)}`}
          hrefSiguiente={`/pedidos/dia?semana=${sumarDias(inicio, 7)}`}
          hrefSemana={`/pedidos/semana?semana=${inicio}`}
          dias={fechas.map((f) => ({ fecha: f, texto: `${nombreDia(f).slice(0, 3)} ${Number(f.slice(8))}`, pedidos: 0, vehiculos: 0, cerrado: false }))}
        />
        <p className="py-16 text-center text-lg text-stone-500">Elegí un día para ver su hoja de ruta.</p>
      </main>
    </>
  );
}
