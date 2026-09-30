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
- Login propio: email + contraseña (bcrypt), sesión en cookie firmada (`jose`). Ver `src/lib/session.ts`.
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
- **Tipos de cliente:** minorista y mayorista. **Distribuidor NO es un tipo de cliente: es una lista de precios** (el
  producto es el mismo, cambia el precio). Los precios minoristas viven en la tienda online (Empretienda): no se cargan
  acá; la lista Minorista está oculta (`activa = false`). "Clientes de Migue" = mayorista con comisionista Migue 8%.
- **Orden:** las listas van Mayorista, Distribuidor y luego las demás (campo `orden`); una lista o un producto nuevo
  siempre va **al final**.
- **El precio se define por LISTA** (pocas: Mayorista, Distribuidor, VACALIN…), no por cliente. Cada cliente elige una
  lista en su ficha. Así crecer a miles de clientes no multiplica los precios (productos × listas). El **precio propio**
  de un cliente es solo una excepción para precios que no comparte con nadie; hay filtro "Con precio propio" en Clientes.
- Un **cliente** puede tener varias **sucursales/puntos de entrega** (ej. ALMACEN 1249, ALCANCIA; cadenas con 40).
  Cada punto tiene barrio/zona (dato clave para armar el reparto) y se relaciona con una zona de reparto
  (norte, oeste, sur, CABA). La zona-barrio se carga con cada cliente.
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
- **Límites por cliente:** máx. de pedidos impagos y máx. de monto en $. Al pasarse: avisar y pedir autorización
  de un dueño (no bloquear). Opción "cuenta sin límite" (ej. Carrefour).
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
  paquete sin IVA) y Mi cuenta (cambio de contraseña). Datos base (zonas Norte/Oeste/Sur/CABA, listas, productos)
  se crean solos en `prisma/seed.ts` si faltan.
- [x] Módulo 2 (parte A2): precio especial por cliente y producto, cargado a mano en la ficha del cliente
  (recuadro "Precios especiales"; vale para todas las sucursales). Lógica en `src/lib/precios.ts`.
  Se decidió NO hacer hoja masiva, aumentos automáticos, historial ni precios en %: el dueño prefiere manual y simple.
- [x] Módulo 2 (parte B): importación de la planilla de clientes (`/clientes/importar`, CSV con `;` o `,`):
  vista previa, propuesta de zona por barrio (corregible; no deja importar con barrios sin zona), confirmación,
  y no duplica clientes ya cargados (mismo nombre). Lógica en `src/lib/importar-clientes.ts`.
- [x] Módulo 2 (parte C): búsqueda por varias palabras. Marcas se probó y se **quitó** (ver reglas): reemplazado por listas.
- [x] Módulo 2 (parte D): Precios = **una lista a la vez** (desplegable de lista; a la izquierda nombre y código, a la derecha
  el precio con $), productos con SKU, EAN, descripción, unidad y orden; crear lista nueva puede copiar los precios de otra;
  listas VACALIN y Distribuidor; Importar es un botón en Clientes.
- [x] Módulo 3: Pedidos + **tablero semanal** (`/pedidos`). Un pedido se carga SIN fecha (buscar cliente/sucursal escribiendo,
  tocar cantidades; precio del cliente automático y editable; remito o factura) y cae en la columna **"Sin asignar"**
  (la "hoja Pedidos" de sus planillas). Se **arrastra a su día** (Lun a Sáb; domingo solo si hay algo) como sus hojas por día;
  también se puede tocar el día debajo del pedido (celular). **El número (1, 2, 3…) es la posición dentro de la hoja del día**
  (el orden del reparto); no hay número global de pedido visible. Detalle del pedido: entregar total o parcial, no entregado,
  reabrir, cancelar, editar. Límites de deuda: se avisa y solo un dueño autoriza (`autorizadoPorId`). Sin "repetir último pedido".
  Lógica: `src/app/pedidos/`, tablero con `@dnd-kit` (`Tablero.tsx`).
- [x] Módulo 3 (parte B): **hoja del día** (`/pedidos/dia/AAAA-MM-DD`), pensada para la PC y horizontal como su hoja de
  Google Sheets. Al tocar el nombre de un día en el tablero se abre. Una fila por pedido con: N° (posición del reparto; se
  reordena arrastrando el número), barrio, cliente (+sucursal), dirección (**se muestra "Como Título"**, se guarda en mayúscula;
  `titulo()`), teléfono, **pedido con el NOMBRE de cada producto y su cantidad (nunca solo el código: el repartidor se confunde)**,
  monto, FACTURA/REMITO, N° de factura (se carga a mano; más adelante ARCA), **Entrega** (casillero ✓ verde / ✗ rojo; la fila
  se pinta; "entrega parcial" abre el pedido), **Cobro** (solo si está entregado: "Cobrado" + medio efectivo/transferencia/
  cheque/Mercado Pago/otro, que registra un PAGO y baja la deuda; o "**Cuenta corriente**" — nunca abreviar como "CC") y un botón
  "Abrir" a la cuenta corriente del cliente con una marca chica si tiene deuda (el **monto NO va en la hoja**). **Cerrar el día**
  exige entrega marcada en todos y cobro marcado en los entregados; al cerrar, los rojos vuelven a "Sin asignar" con una nota;
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
- [ ] Módulo 3 (parte C, pendiente): asignar cada día a los 3 vehículos/repartidores (**falta definir con el dueño si van tablas
  separadas o una columna, y las zonas de cada vehículo**), semanas anteriores (solo lectura, con resumen y Excel), vista del
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
- Excepción de lectura: en la hoja del día la **dirección** se muestra con la primera letra de cada palabra en mayúscula.
- Campos de datos en mayúscula: nombre, razón social y comisionista del cliente; alias, dirección y barrio de la sucursal;
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
- El **tablero semanal** en el celular: columnas que se deslizan, y una fila de días con la cantidad de pedidos que salta a cada
  columna. El menú principal es una fila que se desliza de costado (`Cabecera`).
- Pie de las pantallas: **"Desarrollado por IVÁN DÍAZ CRUPI"**. La versión publicada (commit de Railway) se ve en la pantalla **Empresa**.

## Convenciones de código
- Formularios: server actions + `useActionState`; al fallar devuelven `valores` y el `<form>` usa `key` para
  conservar lo cargado (React vacía los desplegables si no). Ver `src/app/clientes/ClienteForm.tsx`.
- Montos: `src/lib/numeros.ts` (`leerMonto` entiende "3.500,50"; `cuitValido` chequea el dígito verificador).
- Páginas de oficina usan `exigirOficina()`; el repartidor vuelve al inicio.

## Navegación (regla para no llenar el menú)
- Menú principal corto (máx. ~5 entradas): Pedidos, Clientes, Precios, y a futuro Ruta, Cuentas. Usuarios y Mi cuenta son de
  administración.
- Lo que sea parte de una sección va como **pestañas o botones dentro de esa sección**, no como menú nuevo (ej.: Importar
  es un botón en Clientes).

## Pendientes conocidos
- La enumeración `TipoCliente` conserva el valor DISTRIBUIDOR (oculto en pantallas) para no alterar datos existentes.
- Login: bloqueo de 15 min tras 5 fallos por email (en memoria; revisar si se usa más de una instancia).
- Recuperación de contraseña olvidada (hoy: el dueño usa SEED_ADMIN_RESET en Railway; no hay reset para otros usuarios).
- El formulario de Usuarios pierde lo cargado si da error (aplicar el mismo `key` que en Clientes).
- `npm audit` marca 3 alertas en una herramienta interna de Prisma (solo desarrollo, no en producción).
- Registro de cambios (auditoría) todavía no existe.
