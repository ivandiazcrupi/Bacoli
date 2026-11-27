/** La lista "Generales" de Tareas: tareas que todavía no tienen dueño (en la base, `asignadaId` vacío). */
export const GENERALES = "generales";

/** La lista "Encargado": no es una persona que entra al sistema; la oficina le carga y le tilda las tareas (en la base: `asignadaId` vacío y `paraEncargado` verdadero). */
export const ENCARGADO = "encargado";

/** Cómo se guarda de quién es una tarea, según el id de la lista (persona, Generales o Encargado). */
export const datosDueno = (id: string) => ({ asignadaId: id === GENERALES || id === ENCARGADO ? null : id, paraEncargado: id === ENCARGADO });
/** Filtro para traer las tareas de una lista (persona, Generales o Encargado). */
export const filtroDueno = (id: string) => (id === ENCARGADO ? { asignadaId: null, paraEncargado: true } : id === GENERALES ? { asignadaId: null, paraEncargado: false } : { asignadaId: id });
