# BACOLI · Continuidad: qué puede pasar y cómo se recupera todo

Escrito para el dueño (no hace falta saber programar). Fecha: 3/10/2026. Se actualiza cada vez que cambia algo de lo de acá.

## Dónde vive cada cosa
| Qué | Dónde | Quién la cuida |
|---|---|---|
| **El programa** (código) | GitHub: `ivandiazcrupi/Bacoli` (rama `claude/configuracion-inicial-v9y2bi`) | GitHub |
| **Los datos** (clientes, pedidos, cuentas…) | Base Postgres en **Railway** | Railway (sin backups propios en el plan actual) |
| **La copia de seguridad** | Archivo `.json` que se baja desde **Empresa → Copia de seguridad** y se guarda en **Drive** | **Los dueños, todos los días** |
| **Las reglas del negocio** | `CLAUDE.md` en el repositorio | Se actualiza con cada cambio |

El punto débil: **los datos solo existen en Railway** salvo que alguien baje la copia. Sin copia, si se rompe la base se pierde todo.

## Qué puede pasar
| Qué pasa | ¿Se pierden datos? | Qué se hace |
|---|---|---|
| Railway se cae unas horas | No | Esperar. Trabajar con la hoja de ruta impresa (sale en A4 horizontal). |
| Falla o se corrompe la base | **Sí**: todo lo cargado desde la última copia bajada | Restaurar la última copia en una base nueva (ver `PUBLICAR.md`). Por eso la copia es **diaria**. |
| Alguien borra algo por error | Depende: la cuenta corriente nunca se borra (solo se agregan movimientos) y los pedidos cancelados quedan guardados; no hay "deshacer" general | Restaurar una copia **pisa todo lo posterior**: no sirve para recuperar una sola cosa. |
| Se vence la prueba gratis o falla el pago de Railway | El sistema **se apaga**; los datos no se borran de inmediato pero Railway no garantiza guardarlos | **Pagar el plan antes del vencimiento.** |
| Railway desaparece o cierra la cuenta | Se pierde el sistema en línea, **no el trabajo**: el código está en GitHub y los datos en las copias | Armarlo en otro proveedor y restaurar la última copia (cuestión de horas). |
| Un cambio nuevo rompe algo | No toca los datos (solo se agregan columnas y tablas; nunca se borra sin pedir permiso) | Volver a la versión anterior (Railway → Deployments, o GitHub). |
| Se pierde el archivo de la copia | Sí, si era la única | Guardar cada copia en **dos lugares** (Drive y la computadora). |

## Rutina para que no pase nada
1. **Todos los días, al cerrar la jornada:** Empresa → "Descargar copia ahora" → guardar en Drive (carpeta "Copias BACOLI"). Si pasa más de un día, aparece un **punto rojo** junto a EMPRESA.
2. **Imprimir la hoja de ruta del día siguiente** (papel de respaldo si el sistema no anda).
3. **Una vez por mes:** probar restaurar una copia en una base de prueba.
4. **Los dos dueños** con acceso a Railway y a GitHub, con **verificación en dos pasos**, y que sepan bajar la copia.
5. **Plan pago de Railway** antes de que venza la prueba. Hobby (~5 USD/mes) alcanza con la copia diaria; Pro (~20 USD/mes) agrega backups automáticos de la base. Lo decide el dueño (cuesta plata).

## GitHub (estado al 3/10/2026)
- El código está a salvo y separado de Railway (131 versiones guardadas). No hay datos de clientes, claves ni contraseñas en el repositorio ni en su historial (revisado).
- **Pendiente: hacer el repositorio PRIVADO** (hoy es público): GitHub → Settings → Danger zone → Change visibility. Verificar después que Railway siga publicando.
- **Pendiente:** proteger la rama (que no se pueda borrar ni pisar), marcar la versión de salida como "punto de restauración" (tag) y activar la verificación en dos pasos. Pasar a una rama `main` implica cambiar la configuración de Railway (se hace juntos y con OK del dueño).

## ¿Cuánto puede durar el sistema?
Ningún sistema dura 100 años sin cuidado. Este está armado con piezas estándar y portables:
- **Los datos** están en PostgreSQL (una de las bases más usadas) y la copia es un archivo legible: no dependen de Railway ni de una persona.
- **El código** es abierto y común (Next.js, TypeScript); cualquier programador puede tomarlo. Las reglas del negocio están escritas en `CLAUDE.md`.

Con **mantenimiento una o dos veces por año** (actualizar piezas por seguridad y revisar que todo ande), **copias diarias** y **alguien que pueda mantenerlo**, puede servir **10 años o más**. Si algún día hay que cambiar de proveedor o de tecnología, los datos y las reglas se llevan.

## Mejoras pendientes de continuidad
- Copia **automática** cada noche guardada en Drive (hoy es manual; necesita una carpeta compartida de Drive y una clave: decide el dueño).
- Repositorio privado + protección de rama + tag de versión (arriba).
- Registro de cambios (auditoría: quién cambió qué y cuándo).
- Conexión de la base por la red interna de Railway (velocidad y estabilidad; requiere cambiar una variable en Railway con OK del dueño).
