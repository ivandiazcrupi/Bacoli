# Asistente de preguntas ("✦ Preguntar")

Un botón flotante abajo a la izquierda (solo para gerentes y administración) abre un mini chat: se le pregunta cualquier cosa de los
pedidos, clientes y ventas y responde con IA ("¿cuánto facturamos ayer?", "¿hace cuánto no recibe tal cliente?").
**Está apagado hasta que se carga la clave (paso 1).** Sin clave, el botón ni aparece.

## Cómo funciona (en simple)
- **Plata, paquetes y unidades de un período** (`ventas`): las cuentas las hace el sistema con las mismas reglas que Estadísticas. La IA solo elige el período, el cliente y el criterio.
- **Todo lo demás** (`consultar_base`): la IA escribe una consulta de **solo lectura**. Solo funciona si se carga el paso 3.
- Los **montos en pesos están bloqueados** hasta que la persona ingrese la contraseña de Estadísticas (botón "Desbloquear" dentro del chat).
- Cada respuesta tiene "Cómo lo calculé" para controlar la cuenta.
- Tope de **150 preguntas por persona por día** (cambiable con `ASISTENTE_MAX_DIARIO`).

## Pasos para activarlo

### Paso 1 · La clave de la IA (con esto ya anda `ventas`)
1. Entrá a la consola de Anthropic (console.anthropic.com) con tu cuenta y cargá un método de pago o crédito.
2. En la sección **API keys**, creá una clave nueva (ponele "bacoli-asistente"). Se muestra **una sola vez**: copiala.
3. **Poné un tope de gasto mensual** (en la consola, sección de límites/billing; por ejemplo USD 20). Así nunca se pasa.
4. En Railway → el servicio de la app → **Variables** → agregá `ANTHROPIC_API_KEY` con esa clave. **No se la pases a nadie por chat.**
5. Railway vuelve a publicar solo. Aparece el botón **✦ Preguntar**.

### Paso 2 · Probar
Preguntá "¿cuánto facturamos ayer?" (te pide desbloquear con la contraseña de Estadísticas), "¿cuánto vamos facturado en la tienda online este mes?", "¿cuánto pidió esta semana Jazmín?". Sin el paso 3 responde solo cuentas de ventas.

### Paso 3 · El usuario de solo lectura (para las preguntas libres)
En Railway → **Postgres** → pestaña **Data / Query** corré esto (cambiá `TU_CLAVE_LARGA` por una clave larga que inventes, solo letras y números; el nombre de la base suele ser `railway`, es lo último del `DATABASE_URL`):

```sql
CREATE ROLE asistente_lectura LOGIN PASSWORD 'TU_CLAVE_LARGA';
GRANT CONNECT ON DATABASE railway TO asistente_lectura;
GRANT USAGE ON SCHEMA public TO asistente_lectura;
GRANT SELECT ON "Cliente", "PuntoEntrega", "Zona", "Producto", "Pedido", "PedidoItem", "MovimientoCuenta",
  "NotaCredito", "NotaCreditoAplicacion", "ComprobanteArca", "AplicacionNcArca",
  "Vehiculo", "Salida", "IntentoEntrega", "DiaCerrado", "DiaListo", "Vendedor", "Lead", "LeadContacto", "Produccion"
  TO asistente_lectura;
ALTER ROLE asistente_lectura SET default_transaction_read_only = on;
ALTER ROLE asistente_lectura SET statement_timeout = '10s';
ALTER ROLE asistente_lectura CONNECTION LIMIT 5;
```
Ese usuario **no puede leer** `Usuario` (contraseñas) ni `Empresa` (contraseña de totales), ni cambiar nada.

### Paso 4 · Conectarlo
En Railway → Variables → agregá `DATABASE_URL_SOLO_LECTURA`: copiá el `DATABASE_URL` de la base y cambiale el usuario y la clave:
`postgresql://asistente_lectura:TU_CLAVE_LARGA@HOST:PUERTO/railway` (el HOST y el PUERTO son los mismos que ya tiene el `DATABASE_URL`).

### Paso 5 · Probar de nuevo
Preguntá "¿hace cuánto no se le entrega a VACALIN Olivos?" o "¿qué pidió la semana pasada Jazmín?".

## Para apagarlo
Borrar `ANTHROPIC_API_KEY` en Railway (el botón desaparece). Para sacar solo las preguntas libres, borrar `DATABASE_URL_SOLO_LECTURA`.

## Otras variables (opcionales)
- `ASISTENTE_MODELO`: modelo de IA (por defecto `claude-haiku-5-5`, el más barato). Para preguntas más complejas se puede probar `claude-sonnet-5-5` (cuesta más).
- `ASISTENTE_MAX_DIARIO`: preguntas por persona por día.

## Qué datos viajan a Anthropic
Para responder, se envía la pregunta, el esquema de las tablas y los **resultados de las consultas** (nombres de clientes, fechas, cantidades y, si está desbloqueado, montos). Nunca contraseñas ni usuarios del sistema. En el registro de Railway queda cada consulta SQL (`[asistente]`).

## Límites que conviene saber
- El bloqueo de montos es una barrera de buena fe (instrucciones a la IA + revisión de la consulta): protege del uso normal, no de alguien que quiera esquivarla a propósito.
- Las preguntas libres las responde la IA escribiendo SQL: puede equivocarse. Por eso muestra "Cómo lo calculé" y, para plata, usa las cuentas del sistema.
