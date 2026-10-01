# BACOLI · Sistema de gestión

Sistema web (en español, pensado para celular) para BACOLI, fábrica de prepizzas y focaccias artesanales
del Gran Buenos Aires. Reemplaza las planillas de Google Sheets (pedidos, cuentas corrientes, rutas).

**Quien pide el trabajo no es programador:** explicar en términos simples antes de hacer.

**Publicar (acordado con el dueño):** los cambios de rutina se suben directo a la rama y Railway los publica solo; se
avisa después qué se subió. **Se pide confirmación antes de** (1) borrar datos o tablas, o cambiar/renombrar columnas
existentes (agregar tablas o columnas nuevas no lo requiere); (2) importar o modificar datos reales; (3) tocar login,
sesiones, roles o permisos; (4) cambiar variables/configuración de Railway o algo que cueste plata; (5) cualquier cambio
que pueda romper el sistema en uso o no se pueda deshacer; (6) usar credenciales o secretos.
Si hay duda, preguntar. Probar siempre antes de subir.

## Cómo está armado
- Next.js 16 (App Router) + TypeScript + Tailwind 3. Una sola app: pantallas y lógica juntas (server actions).
- PostgreSQL + Prisma 6 (`prisma/schema.prisma`). Despliegue en Railway con backups.
- Login propio: **usuario** (o el email, como antes) + contraseña (bcrypt; mínimo 4 caracteres, decisión del dueño; `src/lib/usuarios.ts`). El usuario se cambia en Mi cuenta; el email es opcional (si falta se guarda `usuario@sin-email.local`, que no se muestra), sesión en cookie firmada (`jose`). Ver `src/lib/session.ts`.
- `proxy.ts` manda al login si no hay cookie; cada página verifica la sesión con `exigirUsuario()`.
- Roles en `src/lib/roles.ts`: DUENO, ADMINISTRACION, VENDEDOR, REPARTIDOR.
  Hoy todo el personal de oficina ve todo; el repartidor solo verá su ruta. Restringir más adelante ahí.
- **Ninguna clave en el código**: todo por variables de entorno (ver `.env.example`).

## Comandos
- Guía de publicación en Railway y recuperación: `docs/PUBLICAR.md`.
- `npm run dev` · `npm run build` · `npm run typecheck`
- `npm run db:migrate` (desarrollo) · `npm run db:deploy` (producción) · `npm run db:seed` (crea el primer dueño)
- Local: necesita un PostgreSQL y un `.env` copiado de `.env.example`.

## Reglas del negocio (acordadas con el dueño)
- **Cada producto tiene su unidad de venta** (campo `unidad`: "paquete" o "unidad"), y todo (pedidos, precios, remito) se
  cuenta en esa unidad. **Nombres de producto SIEMPRE EN MAYÚSCULA** (se fuerza al guardar) y ordenados por el campo `orden`
  (1 al 7, el número del código). Catálogo (SKU): PPT01 PREPIZZA TOMATE y PPC02 PREPIZZA CEBOLLA (paquete de 2), PZT03 PIZZETA
  TOMATE (paquete de 6), FOO04 FOCACCIA OLIVA, PCM05 PIZZA MUZZARELLA, PCJ06 PIZZA JAMÓN y PCF07 PIZZA FUGAZZETA (por unidad).
  Cada producto guarda además EAN (opcional) y descripción para el remito.
- **Precios SIN IVA.** Clientes facturados: se suma IVA 10,5%.
- **Tipo de cliente: en pantallas todos son MAYORISTA** (no hay selector ni filtro de tipo; el dueño lo probó y lo sacó). **Distribuidor es una lista de precios**, no un tipo. Los **minoristas NO se cargan como clientes**: salen de Empretienda
  (ver "Pedidos de tienda online" abajo). Los precios minoristas viven en la tienda online (Empretienda): no se cargan
  acá; la lista Minorista está oculta (`activa = false`). "Clientes de Migue" = mayorista con comisionista Migue 8%.
- **Orden:** las listas van Mayorista, Distribuidor y luego las demás (campo `orden`); una lista o un producto nuevo
  siempre va **al final**.
- **El precio se define por LISTA** (pocas: Mayorista, Distribuidor, VACALIN…), no por cliente. Cada cliente elige una
  lista en su ficha. Así crecer a miles de clientes no multiplica los precios (productos × listas). El **precio propio**
  de un cliente es solo una excepción para precios que no comparte con nadie; (la lista Clientes ya no tiene filtro por lista ni por precio: se busca por nombre, p. ej. "vacalin").
- Un **cliente** puede tener varias **sucursales/puntos de entrega** (ej. ALMACEN 1249, ALCANCIA; cadenas con 40).
  Cada punto tiene barrio/zona (dato clave para armar el reparto) y se relaciona con una zona de reparto
  (**CABA, ZONA SUR, ZONA NORTE, ZONA OESTE**, en ese orden y en mayúscula). La zona-barrio se carga con cada cliente.
- Condiciones de pago: contado, 7, 15, 30, 45 días. Medios: efectivo, transferencia, cheque, etc.
- Dos tipos de pedido: **con factura** (con IVA) y **con remito**. Se marca al cargar.
- **Toda venta lleva un número de comprobante** (regla del dueño): el **N° de factura** si el pedido lleva factura, o el **N° de
  remito** (R-000001…) si lleva remito. Se ve en cada movimiento de la cuenta corriente del cliente (`/clientes/[id]/cuenta`), en la
  hoja del día y en el detalle del pedido. **No se puede cerrar un día** con un pedido entregado sin su número. El N° de factura no
  puede repetirse en dos pedidos. Un pedido con factura puede tener además su remito de entrega.
- **Cuenta corriente = libro de movimientos** (`MovimientoCuenta`); el saldo es la suma, los movimientos nunca se editan ni se
  borran, solo se agregan. **El pedido cuenta en la cuenta corriente DESDE QUE SE CARGA** (decisión del dueño: para que ningún
  pedido pueda quedar afuera por olvidar marcarlo como entregado). `sincronizarCuentaPedido` (`src/lib/cuenta.ts`) se llama al
  crear, editar, entregar, marcar no entregado, reabrir o cancelar, y agrega UN movimiento con la diferencia:
  - Pedido abierto = lo pedido (con IVA 10,5% si lleva factura). Entregado = lo realmente entregado (hay entregas parciales).
    No entregado o cancelado = 0. Al reabrir vuelve a contar.
  - La cuenta corriente (módulo 4) debe mostrar aparte **"Entregado"** y **"Por entregar"**.
  - Módulo Ruta: cada pedido se marca verde (entregado) o rojo (no entregado) y **no se puede cerrar la semana** con pedidos
    sin marcar. Hoy el Inicio avisa los "vencidos sin marcar entregado".
  - Hay devoluciones, notas de crédito y descuentos (módulo 4). Cada cliente paga contra saldo total o contra pedido puntual.
- **Límites por cliente:** "Deuda máxima ($)" y "Pedidos sin pagar (máx.)", **uno al lado del otro; si no se completa nada, no hay límite** (ya no hay casillero
  "cuenta sin límite"; la columna `sinLimite` queda por compatibilidad y se apaga al guardar). Al pasarse: avisar y pedir autorización de un dueño (no bloquear).
- **Ficha del cliente:** "Se le factura normalmente" (`facturado`) solo **pre-marca** "con factura" al cargarle un pedido (cada pedido se puede cambiar) y exige CUIT.
  "Los pagos se aplican contra saldo total / cada pedido" (`imputacionPago`) **no se usa todavía**: se sacó de la pantalla y vuelve con Cuenta corriente (módulo 4).
  **Precio propio por cliente: el dueño lo considera innecesario** (si tiene un precio distinto, es una lista de precios —ej. VACALIN— o un descuento %). Se sacó de la ficha; la tabla y la lógica (`precioParaCliente`) siguen, y la sección "Precios propios anteriores" solo aparece si el cliente ya tenía alguno (para poder vaciarlo). No borrar la tabla sin OK del dueño.
  **Ficha (pedido del dueño: tarjetas pero siempre la información en horizontal):** cada bloque es una tarjeta ancha, con el título y una línea de ayuda a la izquierda y los campos en UNA fila a la derecha: Datos del cliente, Precios y pago, Límites de deuda, Comisión (y Primera sucursal al crear). **Sucursales: todas siempre visibles, una por fila horizontal y editables ahí mismo** (orden de columnas pedido por el dueño: **BARRIO - DIRECCIÓN - ZONA**, y después teléfono y comentario; **ya no hay "nombre" de sucursal** en pantalla —muchas veces el nombre es el barrio—: la columna `alias` queda en la base y se conserva si ya tenía; el título "Sucursales (N)" va centrado y grande + Guardar / Desactivar / **Eliminar**; al final una fila punteada para agregar). **Eliminar** pide confirmación y solo se permite si la sucursal nunca tuvo pedidos y no es la única del cliente; si tiene historial se usa Desactivar. (Ojo: en botones con `formAction` de server action el `name` se prefija, por eso el id va en un `<input type="hidden">`.)
  Comisión (comisionista + %): solo queda anotada (ej. Migue 8%); servirá para calcular cuánto se le debe (reportes).
- **Cliente → Sucursal.** Cliente = quien tiene CUIT: lleva su **cuenta corriente, factura y límites** (cada franquicia de
  VACALIN paga por su cuenta). Sucursal = el local (dirección, barrio, zona de reparto). El nombre del cliente lleva la
  marca ("VACALIN - Pomelo Producciones"); se vende a "VACALIN Olivos" = sucursal Olivos. La búsqueda entiende varias
  palabras ("vacalin olivos"). **No hay entidad "Marca"** (se probó, se descartó y sus tablas se borraron con OK del dueño en
  la migración `quitar_marcas`); VACALIN es una lista de precios.
- **Precio de un cliente por producto** (`precioParaCliente`): precio propio del cliente (final, sin descuento encima) o,
  si no tiene, el de su lista menos el descuento general del cliente. **Un cambio de precio no toca pedidos ya hechos**:
  el pedido guardará el precio que tenía (implementar así en el módulo de Pedidos).
- Facturas cargadas a mano hoy (numeración 1 a 5000). Después: emitir con ARCA vía intermediario (Afip SDK /
  Tusfacturas), quedando "por revisar" hasta que Miguel confirme. Preparar campos: CUIT, condición IVA,
  punto de venta, CAE. Muchos clientes no tienen CUIT/razón social: campos opcionales.
- Hoja de ruta: se arma el día anterior (Nicolás/Miguel) arrastrando pedidos a vehículos (3 vehículos), ordenando
  el recorrido; link a Google Maps con paradas. Más adelante botón "Sugerir ruta" (Google Maps API) que
  Miguel/Nicolás revisan y ajustan. El repartidor solo ve su ruta.
- Migración de planilla de clientes (columnas: Zona=barrio, Nombre, Cliente=tipo, Dirección, Teléfono, Razón Social,
  CUIT, Estado, Comentario, Día entrega, Volumen semanal, Facturación estimada). Reglas acordadas:
  - **No migrar** comentarios, volumen semanal, facturación estimada ni notas entre paréntesis en la dirección.
  - Sucursales: se agrupan solo nombres **idénticos**, más los nombres VACALIN, PARMEGIANO, ABASTECEDOR y BAQUIANO. En
    esos, las **franquicias con otro CUIT son clientes aparte** (los locales con el mismo CUIT quedan juntos). Cada cliente
    de VACALIN usa la lista VACALIN; "Dist." usa la lista Distribuidor; el resto, Mayorista.
  - Tipo "Migue." = mayorista con comisionista Migue 8%. Estados Baja/Contactar = clientes desactivados.
  - Filas de tipo "Cobro"/"Muestra" NO son clientes: son **paradas de cobranza/muestra de la hoja de ruta**
    (hoy se cargaban como clientes solo para poder ponerlas en la ruta).
  - "NO SE COBRA ENVIO" aparecía en Razón Social: hay clientes sin cobro de envío. El **envío se maneja en el módulo
    de reparto/hoja de ruta, no en Clientes**.

## Equipo / usuarios
Dueños (2), Miguel (administración y logística), Nicolás (empleado; ve lo mismo que Miguel), 3 repartidores
(usuarios aparte, usan su celular). Volumen: ~25 pedidos minoristas + 15-20 mayoristas por día; ~250 mayoristas
y ~1000 minoristas.

## Estado del proyecto
- [x] Módulo 1: base, login, roles, usuarios (alta, activar/desactivar).
- [x] Módulo 2 (parte A): Clientes (con sucursales, zonas, límites, comisión), Precios (listas × productos, por
  paquete sin IVA) y Mi cuenta (cambio de contraseña). Datos base (zonas CABA/ZONA SUR/ZONA NORTE/ZONA OESTE, listas, productos)
  se crean solos en `prisma/seed.ts` si faltan.
- [x] Módulo 2 (parte A2): precio especial por cliente y producto, cargado a mano en la ficha del cliente
  (recuadro "Precios especiales"; vale para todas las sucursales). Lógica en `src/lib/precios.ts`.
  Se decidió NO hacer hoja masiva, aumentos automáticos, historial ni precios en %: el dueño prefiere manual y simple.
- [x] Módulo 2 (parte B): importación de la planilla de clientes (`/clientes/importar`, CSV con `;` o `,`):
  vista previa, propuesta de zona por barrio (corregible; no deja importar con barrios sin zona), confirmación,
  y no duplica clientes ya cargados (mismo nombre). Lógica en `src/lib/importar-clientes.ts`.
- [x] Módulo 2 (parte C): búsqueda por varias palabras. Marcas se probó y se **quitó** (ver reglas): reemplazado por listas.
- [x] Módulo 2 (parte D): Precios = **una lista a la vez** (pastillas de lista arriba —Mayorista, Distribuidor, VACALIN— y "+ Nueva lista"; tarjeta ancha con los precios en 2 columnas; abajo **Productos** como desplegable de color con el contador, cada producto con "Editar" y "+ Agregar producto"; rediseño pedido por el dueño: más espacio, minimalista, con vida; a la izquierda nombre y código, a la derecha
  el precio con $), productos con SKU, EAN, descripción, unidad y orden; crear lista nueva puede copiar los precios de otra;
  listas VACALIN y Distribuidor; Importar es un botón en Clientes.
- [x] Módulo 3 — **Pedidos = 3 pestañas** (`Pestanas.tsx`, se va y se vuelve con un toque), según cómo trabaja el dueño en su planilla (cargar → elegir día → armar la hoja de ruta con vehículos). **Son 4 pestañas: PEDIDOS · SEMANA · HOJA DE RUTA · VEHÍCULOS** (la SEMANA es el resumen de todo; la HOJA DE RUTA es donde se organizan las vueltas; se entra y se sale con un toque):
  1. **PEDIDOS** (`/pedidos`, `Bandeja.tsx`): la "hoja PEDIDOS" = **solo los pedidos cargados que esperan día** (PENDIENTE y sin fecha). **Dos listas separadas** con botones: **Mayoristas** y **Minoristas (web)** (`Pedido.origen`; la de web queda vacía hasta conectar Empretienda). Cada pedido es una fila con las columnas **BARRIO · CLIENTE · DIRECCIÓN · TELÉFONO · PEDIDO (un producto debajo del otro, como en la hoja de ruta) · MONTO · FACTURA/REMITO · Abrir** (donde se ve y se edita el pedido) **· ASIGNAR con los botones L M M J V S** (cada uno con el número del día debajo). La semana se llama **"SEMANA 28/9"** (= el primer día, el lunes): flechas ← → para elegirla ("Asignar a ← SEMANA 28/9 →"). Al tocar el día el pedido **se MUEVE** (sale de esta lista y aparece en ese día, como el cortar y pegar de la planilla; `asignarADia`). Siempre **dos pasos, manual** (primero el día, después el vehículo); sin atajo directo al vehículo. Estilo serio y minimalista: tabla con barra verde, **todo centrado (títulos y datos, también el monto), "Abrir ›" como enlace discreto sin caja, y los botones de día con la letra y el número centrados**.
  2. **SEMANA** (`/pedidos/semana`): **"SEMANA 28/9"** con una tabla de un renglón por día (filas altas y letra grande), columnas **DÍA · PEDIDOS · PAQUETES · FACTURACIÓN · ENTREGAS ("N de M") · VEHÍCULOS** (solo la **cantidad** de vehículos que salen ese día, informativo: sin rojo ni alertas, 0 si no hay). **Sin tarjetas de resumen** (el dueño las sacó). Tocar un día **lleva a su hoja de ruta**.
  2b. **HOJA DE RUTA** (`/pedidos/dia/AAAA-MM-DD`; la pestaña abre el día de hoy): es **la organización de las rutas**. Arriba, para ir día por día: ← SEMANA 28/9 → y los seis días (`DiasSemana.tsx`). Debajo, **PENDIENTES** (`Pendientes.tsx`): los pedidos cargados que todavía no tienen día; **se arrastran hasta un día de arriba** (o se toca L M M J V S) y salen de la lista. Después, un desplegable chico **"+ Sumar vehículo"** (al elegirlo se abre su cuadro en el día) y los cuadros de cada vehículo.
  3. **VEHÍCULOS** (`/pedidos/vehiculos`): el equipo carga sus camionetas/autos (nombre, patente, **capacidad máxima en PAQUETES, la define el dueño**; vacía = sin tope), con Guardar/Desactivar/Eliminar (eliminar solo si nunca salió).
  **Hoja de ruta del día** (`/pedidos/dia/AAAA-MM-DD`): se **suman vehículos al día** (de la lista cargada; `Salida` = vehículo+fecha+repartidor), los pedidos del día quedan "**Sin vehículo**" (franja roja) y se reparten con los botones "→ vehículo"; cada vehículo es un cuadro con su **medidor de carga "N de M paquetes"** (rojo "te pasaste", **avisa pero no frena**), el repartidor, "**Ver ruta en Google Maps**" (todas las paradas en orden) y el recorrido numerado que se reordena arrastrando (`ordenRuta`). Cada pedido tiene "Mover a…" (otro vehículo, sin vehículo, devolver a Pedidos, pasar a otro día). **Paquete** = lo que se cuenta como carga (suma de las cantidades pedidas, paquetes y unidades; **el dueño no usa la palabra "bulto"**; `bultosDe`). Lógica: `src/app/pedidos/ruta/actions.ts`. El número de remito sigue el orden de la ruta (`porReparto`).
  Pendiente de esta parte: la tabla de cada vehículo todavía es muy ancha (se desplaza de costado): **rediseñar con menos información por fila**; vista del repartidor (solo su vehículo) en el celular. - [x] Módulo 3 (parte B): **hoja del día** (`/pedidos/dia/AAAA-MM-DD`), pensada para la PC y horizontal como su hoja de
  Google Sheets. Se abre al tocar el día en la página de Pedidos (o directo en su dirección). Una fila por pedido con: N° (posición del reparto; se
  reordena arrastrando el número), barrio, cliente (+sucursal), dirección (**se muestra "Como Título"**, se guarda en mayúscula;
  `titulo()`), teléfono, **pedido con el NOMBRE de cada producto y su cantidad (nunca solo el código: el repartidor se confunde)**,
  monto, FACTURA/REMITO, N° de factura (se carga a mano; más adelante ARCA), **Entrega** (casillero ✓ verde / ✗ rojo; la fila
  se pinta; "entrega parcial" abre el pedido), **Cobro** (solo si está entregado: "Cobrado" + medio efectivo/transferencia/
  cheque/Mercado Pago/otro, que registra un PAGO y baja la deuda; o "**Cuenta corriente**" — nunca abreviar como "CC") y un botón
  "Abrir" a la cuenta corriente del cliente con una marca chica si tiene deuda (el **monto NO va en la hoja**). **Cerrar el día**
  exige que todos los pedidos estén **en un vehículo**, entrega marcada en todos y cobro marcado en los entregados; al cerrar, los rojos vuelven a "Sin asignar" con una nota;
  un día cerrado es de solo lectura (no se mueven pedidos desde/hacia él); solo un dueño lo reabre (`DiaCerrado`).
- [x] Remito (`src/app/pedidos/remito/`): botón **Remito** en cada fila de la hoja del día y en el detalle del pedido, y **"Imprimir
  todos los remitos"** del día. Número correlativo con letra **R** (`R-000001`, `formatoRemito`), que se asigna **al emitir** (no al
  cargar el pedido), desde un contador atómico (`Numerador`), y **no cambia nunca**; los de un día se numeran en el orden del
  reparto. Sale en A4 listo para imprimir (opción "con precios"), con datos de la empresa (menú **Empresa**, solo dueños: razón
  social, CUIT, domicilio, IVA, y "próximo número de remito", que solo puede subir), firma/aclaración/fecha de recepción y la
  leyenda **"Documento no válido como factura"**. Un remito es un documento de entrega; **no reemplaza a la factura ante ARCA**
  (confirmar el uso con el contador).
- [ ] **Factura electrónica (pendiente, necesita ARCA):** el botón "Factura" solo puede emitir una factura válida con la
  autorización de ARCA (CAE) vía un intermediario (Afip SDK, Tusfacturas u otro; tiene costo). Requisitos: CUIT con factura
  electrónica por web service y punto de venta habilitado, condición frente al IVA, contador. **No generar PDF de factura sin
  CAE**: hasta entonces el N° de factura se carga a mano en la hoja. Al conectarla: queda "por revisar" hasta que Miguel confirme.
- [ ] Módulo 3 (parte C, pendiente): (los vehículos y la hoja de ruta ya están, ver arriba) semanas anteriores (solo lectura, con resumen y Excel), vista del
  repartidor en el celular (tarjetas grandes), cobro parcial (hoy se cobra el total), cierre de semana automático.
- [ ] Módulo 4: Cuenta corriente (ya existe la pantalla de lectura `/clientes/[id]/cuenta` con saldo total, "Entregado" y "Por entregar" y los movimientos con saldo corrido; falta registrar pagos sueltos, notas de crédito, devoluciones y descuentos).
- [ ] Módulo 5: Hoja de ruta (asignar cada día a un vehículo/repartidor y ordenar el recorrido, sobre el tablero ya hecho) + vista del repartidor. Debe incluir: paradas de cobranza/muestra (sin pedido) y el cobro de
  envío (con opción "no se cobra envío" por cliente o parada).
- [ ] Publicación en Railway (guiar al dueño paso a paso; él crea el proyecto y carga las claves).
- [ ] Más adelante: facturación ARCA, reportes, migración de planillas, Empretienda, sugerencia de ruta.

## Mayúsculas (acordado con el dueño): mix
- **El sistema** (menús, botones, títulos, etiquetas, ayudas, filtros) va en **minúscula normal**.
- **Lo que cargan ellos va en MAYÚSCULA**, para no depender del teclado: nombres, productos, listas de precios, direcciones,
  barrios, razón social. Se logra de tres maneras juntas: (1) el campo se ve en mayúscula al escribir (`estiloDato` /
  clase `dato` en `src/components/campos.tsx`); (2) el celular abre el teclado en mayúsculas (`autoCapitalize="characters"`);
  (3) se **fuerza al guardar** con `mayus()` de `src/lib/mayusculas.ts` (también al importar).
- **Excepción (pedido del dueño): la dirección va en Mayúscula y minúscula** ("Malvinas Argentina 2842"): se guarda así (`titulo()` al guardar y al importar), el campo no la fuerza a mayúscula y las direcciones ya cargadas en MAYÚSCULA se muestran con `titulo()` en todas las pantallas. El **barrio** sigue en MAYÚSCULA.
- Campos de datos en mayúscula: nombre, razón social y comisionista del cliente; alias y barrio de la sucursal (la dirección NO, ver arriba);
  nombre, SKU y descripción del producto; nombre de la lista. **No** se fuerzan: email (minúscula), contraseñas, comentarios
  libres, CUIT/teléfono, ni el nombre de las personas usuarias del sistema.
- Al agregar un formulario nuevo con datos de este tipo: usar `estiloDato` + `autoCapitalize="characters"` y `mayus()` en la acción.

## PC primero, celular para consultar (decisión del dueño)
- **Se diseña y se pule primero para la PC.** El celular sirve sobre todo para **ver**, **cambiar algo rápido** (marcar entregado,
  cobrar) y **comunicarse con un cliente** (botones **Llamar** y **WhatsApp**, `enlaceWhatsApp` en `src/lib/telefonos.ts`). No
  invertir en un celular complejo para el resto de las pantallas; solo que no se rompa (sin scroll horizontal de la página a 390 px).
- La **hoja del día** tiene dos presentaciones del mismo dato: **tabla horizontal** en pantallas grandes (`lg:`), y **tarjetas
  grandes** en el celular (`FilaTarjeta`: dirección → Google Maps, teléfono → llama / WhatsApp, ✓/✗ y cobro con botones de 48 px).
  Esas tarjetas son la base de la futura vista del repartidor.
- En el celular, "Sin asignar" son tarjetas con los botones de día grandes, y los días son una lista desplegable. El menú
  principal es una fila que se desliza de costado (`Cabecera`).
- Pie de las pantallas: **"Desarrollado por IVÁN DÍAZ CRUPI"**. La versión publicada (commit de Railway) se ve en la pantalla **Empresa**.

## Pantalla de inicio y anchos (pedido del dueño)
- **Inicio** (`src/app/page.tsx`; ver "Aspecto propio"): un saludo al azar según la hora de Argentina ("Buenos días, equipo. ¿Cómo va?"…) y abajo dos
  botones grandes del mismo color, en MAYÚSCULA: **CARGAR PEDIDO** y **CARGAR CLIENTE** (estilo pantalla de bienvenida de Claude); sin números ni resumen (el dueño los sacó). El repartidor solo ve el saludo.
- El sistema debe **aprovechar el ancho de la PC**: listas en columnas (Clientes: 1/2/3 según ancho), contenedores `max-w-6xl` o más,
  cabecera y hojas hasta `max-w-[1900px]`. No volver a centrar todo en una columna angosta.

## Colores de la marca (pedido del dueño)
- **Crema `#ede6c8`, verde `#026433`, rojo `#aa0e1d`** (`tailwind.config.ts`: escalas `crema`, `verde`, `rojo`; el 700 del verde y del rojo y el 200 de la crema son los exactos).
  **Verde = marca y acciones** (botones principales, pastilla activa, menú, "entregado/cobrado"); **crema = fondos y detalles suaves** (fondo de página `crema-50`,
  insignias, desplegable de Productos, "cuenta corriente"); **rojo = avisos y lo que borra** (Eliminar, errores, deuda, falta de N° de factura, "no entregado").
  La marca en la cabecera es **BACOLI** en verde y **GESTIÓN** en rojo, con una línea verde debajo. No usar `amber-*`, `green-*` ni `red-*` de Tailwind: usar `verde-*`, `rojo-*`, `crema-*`.
- **Barrio se escribe a mano** (sin desplegable de sugerencias).

## Estilo "sistema de trabajo": firme y robusto (pedido del dueño)
- Nada de gris pálido ni "sistemita": **bordes definidos** (`stone-300/400`, no `stone-200`), sombras suaves, campos blancos con borde marcado y foco verde
  (`estiloCampo`), etiquetas en semibold, **encabezados de tabla en barra verde oscura con letras blancas** (`cabeceraTabla` en `campos.tsx`).
- **Ficha del cliente:** banner verde oscuro con el nombre grande, etiquetas (activo, N sucursales, lista) y los accesos; cada bloque es una tarjeta con panel lateral crema y
  barra verde; **Sucursales = una tabla de verdad** (barra verde de títulos, filas con franjas alternadas, botones sólidos: Guardar verde, Desactivar con borde, Eliminar rojo).
- **Contenido de cada recuadro centrado de arriba a abajo** (verticalmente), no de izquierda a derecha. Las sucursales de la ficha son grandes (campos de letra normal, filas altas) y todas las pantallas usan el mismo ancho (`max-w-[1600px]`).
- La lista de Clientes y los Pedidos del cliente usan la misma barra de encabezado. Ya aplicado en Pedidos, Usuarios, Empresa, Mi cuenta y Precios (tablas con barra verde; formularios con `Bloque` de `campos.tsx`). Pendiente: afinar la tabla de cada vehículo en la hoja de ruta.

## Desplegables (regla)
- La opción inicial de un `<select>` ("Elegí la zona", "Elegí un rol"…) va con `disabled hidden`: se ve en el campo cerrado pero **no aparece en la lista desplegada** (antes aparecía como opción inclickeable).

## Convenciones de código
- Formularios: server actions + `useActionState`; al fallar devuelven `valores` y el `<form>` usa `key` para
  conservar lo cargado (React vacía los desplegables si no). Ver `src/app/clientes/ClienteForm.tsx`.
- Montos: `src/lib/numeros.ts` (`leerMonto` entiende "3.500,50"; `cuitValido` chequea el dígito verificador).
- Páginas de oficina usan `exigirOficina()`; el repartidor vuelve al inicio.

## Navegación (regla para no llenar el menú)
- **Cabecera** (`src/components/Cabecera.tsx`, decisión del dueño): marca **BACOLI GESTIÓN** a la izquierda; menú **centrado y en
  MAYÚSCULA** ordenado por importancia: **CLIENTES y PEDIDOS (en ese orden: primero Clientes)** grandes y en negrita, y después, más chicos y grises, PRECIOS, USUARIOS,
  EMPRESA y MI CUENTA; a la derecha los botones **CARGAR PEDIDO** y **CARGAR CLIENTE** (los dos del mismo color naranja; y Salir). En el celular: los botones de carga
  arriba y el menú en una fila que se desliza. Esto es una excepción a "el sistema va en minúscula": el menú va en mayúscula.
- Menú principal corto (máx. ~5 entradas): Clientes, Pedidos, Precios, y a futuro Ruta, Cuentas. Usuarios y Mi cuenta son de
  administración.
- Lo que sea parte de una sección va como **pestañas o botones dentro de esa sección**, no como menú nuevo (ej.: Importar
  es un botón en Clientes).
- **Las cuatro pantallas de Pedidos comparten el mismo ancho y el mismo encabezado** (`Encabezado.tsx`: `CONTENEDOR_PEDIDOS`, título, botón y pestañas) para que al pasar de una a otra nada se mueva.

## Pedidos de tienda online (minoristas) — decisión en curso
- Los minoristas (~25 pedidos/día) vienen de Empretienda y **no se cargan como clientes** (los datos ya viven allá). Hay que hacer un tipo de
  pedido **"Tienda online"**: datos de entrega escritos en el mismo pedido (nombre, dirección, barrio, teléfono, N° de pedido de Empretienda), sin
  cuenta corriente ni lista ni límites, y que aparezca en la hoja del día con Llamar/WhatsApp. Falta confirmar con el dueño si pagan antes o al
  recibir y si todos los reparte la empresa. Más adelante, importar esos pedidos solos desde Empretienda.
- Clientes (pantalla): arriba de la lista dice **"N clientes · M sucursales (puntos de entrega) · X activas y Y desactivadas"** (un cliente tiene varias sucursales; los números siguen los filtros). **Aparecen TODOS** (sin límite), **en horizontal y por orden alfabético del nombre del comercio**. **Cada cliente es un cuadrante** (tarjeta) y **cada sucursal es una línea con TODA la información completa** (BARRIO · NOMBRE · DIRECCIÓN · TELÉFONO · accesos CUENTA CORRIENTE y PEDIDOS —en mayúscula, chicos— y **Editar** (mayúscula y minúscula) **a la derecha de todo**) y una columna **ESTADO** por sucursal (**Activa** verde / **Desactivada** gris; queda "Desactivada" también si el cliente entero está desactivado): el nombre y los accesos **se repiten en cada sucursal** (así cada línea se entiende sola); un cliente con 6 sucursales tiene 6 líneas dentro de su cuadrante. **Sin desplegables.** Editar abre la ficha del cliente. Lista compacta (letra y botones chicos). Una sucursal **desactivada** se ve en gris (ej. BUHA tiene una activa y otra desactivada).
  **Comentario de la sucursal** (ej. restricción horaria: "Recibe solo hasta las 10 hs"): se carga **una sola vez en la sucursal** (campo Comentario de la ficha) y **se ve en rojo, debajo de la dirección y alineado justo donde ella empieza** en la lista de Clientes, en Pedidos (Sin asignar) y en la hoja del día —para que el repartidor lo lea—.  **Delante va el BARRIO (no la zona), en negrita igual que el nombre.** El **teléfono es un enlace que abre WhatsApp** para escribirle (sin la palabra "WhatsApp"; si el número no sirve, llama). En el celular cada cuadrante se apila. Filtros (`FiltrosClientes.tsx`): **buscador que filtra mientras se escribe** (sin Enter ni botón) y, debajo, dos **desplegables que se reparten el ancho del buscador**: zona (un cliente aparece en una zona si alguna sucursal está ahí) y estado (**Activos** por defecto, siempre; Desactivados; Todos). Nueva pantalla **`/clientes/[id]/pedidos`**: historial de pedidos del cliente (día, sucursal, pedido, monto, comprobante, estado). **Próximo (lo pidió el dueño como lo último): hoja de informes comerciales**; también a futuro el filtro "hace cuánto no piden", con deuda, con/sin factura y datos incompletos.

## Aspecto propio de BACOLI (decisión del dueño)
- Tras probar tres vistas (moderna / intermedia / clásica) el dueño eligió la **intermedia** y quedó como **el único aspecto** (se sacaron el selector, la cookie `vista` y las otras dos).
  Vive en el bloque final de `src/app/globals.css` (clase `intermedio` puesta siempre en `<html>` desde `layout.tsx`): cabecera clara con filete verde, esquinas casi rectas, sin sombras,
  letra de 14 px, filas compactas (una línea por sucursal), bordes firmes, títulos sobrios (verde con subrayado) y barra de estado fija abajo. Para ajustar el estilo general se toca ese bloque.
  El dueño dijo que "de última lo mejoramos" más adelante. Una versión un punto más moderna (esquinas de 6 px, sombra leve, más aire) se probó y NO la eligió (commit `7330b71`, por si la quiere).
- **Inicio**: sin tarjetas ni color de más (pedido del dueño): solo la fecha, el saludo al azar y los dos botones CARGAR PEDIDO / CARGAR CLIENTE. Nada más.

## Pendientes conocidos
- La enumeración `TipoCliente` conserva el valor DISTRIBUIDOR (oculto en pantallas) para no alterar datos existentes.
- Contraseñas cortas (mín. 4) y usuarios simples: riesgo aceptado por el dueño; el bloqueo de intentos es la defensa. Sin email no hay recuperación por correo.
- Login: bloqueo de 15 min tras 5 fallos por usuario (en memoria; revisar si se usa más de una instancia).
- Contraseña olvidada: un **dueño** la cambia desde **Usuarios** (botón "Cambiar contraseña" en cada persona, `restablecerClave`). Las contraseñas se guardan cifradas: **no se pueden ver**, solo reponer. Si un dueño pierde la suya, el otro dueño la cambia; último recurso: SEED_ADMIN_RESET en Railway.
- El formulario de Usuarios pierde lo cargado si da error (aplicar el mismo `key` que en Clientes).
- `npm audit` marca 3 alertas en una herramienta interna de Prisma (solo desarrollo, no en producción).
- Registro de cambios (auditoría) todavía no existe.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
