import { bultosDe, focacciasPorTipo, num, totalUnidades, unidadesPorSabor } from "@/lib/ruta";

type Renglon = { nombre: string; cantidad: number; sinCargo: number; unidad: string; paquetesPor: number };

// Cuánto hay que fabricar/entregar: suma de todos los pedidos de la lista (igual que el resumen de la hoja de ruta).
function sumar(pedidos: { items: Renglon[] }[]) {
  const t = { pedidos: pedidos.length, paquetes: 0, unidades: 0, tomate: 0, cebolla: 0, pizzas: 0, oliva: 0, cherry: 0 };
  for (const p of pedidos) {
    const s = unidadesPorSabor(p.items);
    const f = focacciasPorTipo(p.items);
    t.paquetes += bultosDe(p.items); t.unidades += totalUnidades(s);
    t.tomate += s.tomate; t.cebolla += s.cebolla; t.pizzas += s.pizzas; t.oliva += f.oliva; t.cherry += f.cherry;
  }
  return t;
}

function Fila({ titulo, pedidos }: { titulo: string; pedidos: { items: Renglon[] }[] }) {
  const t = sumar(pedidos);
  const celdas: [string, number, boolean][] = [
    ["Pedidos", t.pedidos, true], ["Paquetes", t.paquetes, true], ["Unidades", t.unidades, true],
    ["Tomate", t.tomate, true], ["Cebolla", t.cebolla, true], ["Pizzas", t.pizzas, t.pizzas > 0],
    ["Focaccia oliva", t.oliva, true], ["Focaccia cherry", t.cherry, true],
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-2 min-w-40 text-xs font-semibold uppercase tracking-wide text-stone-600">{titulo}</span>
      {celdas.filter(([, , ver]) => ver).map(([rotulo, n]) => (
        <div key={rotulo} className={`inline-flex items-baseline gap-2 rounded-md border px-4 py-1.5 ${n === 0 ? "border-stone-300 bg-stone-100 text-stone-400" : "border-stone-400 bg-white"}`}>
          <span className={`text-xs font-medium uppercase tracking-wide ${n === 0 ? "text-stone-400" : "text-stone-600"}`}>{rotulo}</span>
          <span className="text-base font-bold tabular-nums">{num(n)}</span>
        </div>
      ))}
    </div>
  );
}

// Dos renglones: lo que espera día en esta lista, y todo lo que falta entregar (con y sin día asignado).
export function ContadorPedidos({ esperando, conDia }: { esperando: { items: Renglon[] }[]; conDia: { items: Renglon[] }[] }) {
  return (
    <section aria-label="Cuánto hay por entregar" className="space-y-2 rounded-lg border border-stone-300 bg-white px-4 py-3">
      <Fila titulo="Esperando día" pedidos={esperando} />
      <Fila titulo="Por entregar en total" pedidos={[...esperando, ...conDia]} />
    </section>
  );
}
