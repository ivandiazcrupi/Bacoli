# Cómo se publica y se recupera el sistema BACOLI

Guía en lenguaje simple. Está pensada para retomar el trabajo aunque no recuerdes nada de la primera vez.
**Acá nunca se escriben claves ni contraseñas**, solo los nombres de las variables.

## Dónde vive cada cosa
| Qué | Dónde |
|---|---|
| Código | GitHub: `ivandiazcrupi/Bacoli` (rama `claude/configuracion-inicial-v9y2bi`) |
| Sistema publicado | Railway, proyecto `welcoming-gentleness`, servicio **Bacoli** |
| Base de datos | Railway, servicio **Postgres** (con su volumen `postgres-volume`) |
| Link | https://bacoli-production.up.railway.app |

`bacoli.com.ar` es la tienda online y **no se usa** para este sistema.

## Cómo se actualiza el sistema
1. Los cambios de código se suben a la rama de GitHub.
2. **Railway publica solo** cada vez que llega un cambio a esa rama (tarda 1 o 2 minutos).
3. Al arrancar, el sistema hace tres cosas solo: aplica los cambios a la base (migraciones), crea los datos base
   que falten (zonas, listas de precios, productos) y recién ahí abre.
4. Mientras se publica, el sistema puede quedar unos minutos sin responder.

**Regla de trabajo:** antes de subir cambios que toquen la base o los datos, se le pide confirmación al dueño.

## Variables de entorno (Railway → Bacoli → Variables)
| Variable | Para qué sirve | Notas |
|---|---|---|
| `DATABASE_URL` | Conexión a la base | Se agrega con **Add Reference** apuntando a Postgres. No se escribe a mano. |
| `SESSION_SECRET` | Firma las sesiones de login | Mínimo 32 caracteres al azar. Si se cambia, todos deben volver a entrar. |
| `SEED_ADMIN_NOMBRE` | Nombre del primer dueño | Solo se usa al crear el usuario inicial. |
| `SEED_ADMIN_EMAIL` | Email del primer dueño | Ídem. |
| `SEED_ADMIN_USUARIO` | Usuario del primer dueño (opcional) | Si falta, se usa lo que va antes de la @ del email. |
| `SEED_ADMIN_PASSWORD` | Contraseña del primer dueño | **Temporal.** Se borra después del primer ingreso. |
| `SEED_ADMIN_RESET` | Restablecer la contraseña del dueño | **Temporal.** Solo para emergencias. Ver abajo. |

| `EMPRETIENDA_CSV_URL` | Enlace de **solo lectura** de la hoja "Minorista" (Archivo → Compartir → Publicar en la web → esa hoja → formato CSV) | Es un secreto: quien lo tenga ve los datos de los clientes de la tienda. Sin esta variable, la tienda online no se conecta. |
| `EMPRETIENDA_DESDE` | Primer N° de orden de Empretienda que se trae (ej. `13400`) | Obligatoria. Evita cargar los pedidos viejos que ya están en la planilla. |

**Tienda online:** con esas dos variables, el sistema lee la planilla cada 15 minutos (y con el botón "Traer pedidos ahora" de Pedidos → Minoristas (web)) y carga un pedido por cada N° de orden nuevo. No repite ni vuelve a leer los que ya cargó.

Railway suele mostrar `SEED_ADMIN_PASSWORD` como "variable sugerida": no hay que agregarla salvo que se necesite.

## Primera puesta en marcha (ya hecha, queda como referencia)
1. Railway → **New Project → Deploy from GitHub repo** → elegir `Bacoli` (si no aparece, "Configure GitHub App" y dar permiso al repositorio).
2. **+ Add → Database → PostgreSQL**.
3. Bacoli → Settings → confirmar la rama `claude/configuracion-inicial-v9y2bi`.
4. Bacoli → Variables → cargar las cinco variables de la tabla (las de `SEED_ADMIN_*` y `SESSION_SECRET` con valores propios).
5. Esperar que diga **Online**. Bacoli → Settings → Networking → **Generate Domain**.
6. Entrar, y **borrar `SEED_ADMIN_PASSWORD`** de las variables.

## Si se olvida la contraseña del dueño
1. En Railway → Bacoli → Variables, agregar:
   - `SEED_ADMIN_EMAIL` (debe ser el email del dueño),
   - `SEED_ADMIN_PASSWORD` con una contraseña nueva (mín. 8 caracteres),
   - `SEED_ADMIN_RESET` con el valor `si`.
2. Esperar que Railway publique de nuevo y entrar con la contraseña nueva.
3. **Borrar `SEED_ADMIN_PASSWORD` y `SEED_ADMIN_RESET`.** Si `SEED_ADMIN_RESET` queda, la contraseña se vuelve a cambiar en cada publicación.

Para cualquier otro usuario: el dueño puede crear uno nuevo desde **Usuarios** o desactivar el anterior. Todavía no hay
"recuperar contraseña" para el resto del equipo.

## Si el login dice "Demasiados intentos"
Hay un bloqueo de 15 minutos tras 5 intentos fallidos con el mismo email. Se libera solo, o al publicar de nuevo.

## Si algo falla al publicar
1. Bacoli → **Deployments** → tocar el intento marcado **Failed** o **Crashed** → **View logs**.
2. Copiar las últimas 15 líneas. Ahí Railway dice el motivo.
3. Causas comunes: falta una variable, `SESSION_SECRET` con menos de 32 caracteres, o la base todavía no está en línea.

## Backups (PENDIENTE)
- **Todavía no verificados.** Antes de cargar datos reales hay que:
  1. entrar a Railway → Postgres → pestaña **Backups** y activarlos si el plan lo permite (la prueba gratis puede no incluirlos),
  2. si el plan no los ofrece, armar una copia diaria propia.
- Hasta entonces, **usar solo datos de prueba**.

## Seguridad: qué cuidar
- No compartir capturas de la pestaña **Variables** sin taparla: muestran la clave de la base y de las sesiones.
- Las claves que hayan aparecido en capturas o chats (`SESSION_SECRET`, contraseña de la base, contraseñas iniciales)
  hay que **cambiarlas antes de cargar datos reales**:
  - `SESSION_SECRET`: cambiar el valor en Railway (todos vuelven a entrar).
  - Contraseña de cada persona: desde **Mi cuenta**.
  - Contraseña de la base: se regenera desde el servicio Postgres en Railway (pedir ayuda para hacerlo sin cortar el sistema).
- La prueba gratis de Railway dura 30 días o USD 5. Pasar a un plan pago **antes** de que venza, para que el sistema no se apague.
