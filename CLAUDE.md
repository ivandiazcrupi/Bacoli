# BACOLI · Sistema de gestión

Sistema web (en español, pensado para celular) para BACOLI, fábrica de prepizzas y focaccias artesanales
del Gran Buenos Aires. Reemplaza las planillas de Google Sheets (pedidos, cuentas corrientes, rutas).

**Quien pide el trabajo no es programador:** explicar en términos simples antes de hacer, y **pedir
confirmación antes de borrar o publicar** cualquier cosa (incluido el despliegue en Railway).

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
- **Todo se cuenta en PAQUETES** (1 paquete = 2 prepizzas). Caja = 12 paquetes. Productos hoy: prepizza
  tomate y prepizza cebolla.
- **Precios SIN IVA.** Clientes facturados: se suma IVA 10,5%.
- Tipos de cliente: minorista, mayorista, distribuidor (precio propio, ej. $3.500) y "clientes de Migue"
  (Miguel cobra 8% de comisión). Listas de precios + descuento por cliente especial. Precios minoristas =
  los de la tienda online (Empretienda; vincular más adelante).
- Un **cliente** puede tener varias **sucursales/puntos de entrega** (ej. ALMACEN 1249, ALCANCIA; cadenas con 40).
  Cada punto tiene barrio/zona (dato clave para armar el reparto) y se relaciona con una zona de reparto
  (norte, oeste, sur, CABA). La zona-barrio se carga con cada cliente.
- Condiciones de pago: contado, 7, 15, 30, 45 días. Medios: efectivo, transferencia, cheque, etc.
- Dos tipos de pedido: **con factura** (con IVA) y **con remito**. Se marca al cargar.
- **Cuenta corriente = libro de movimientos**; el saldo se calcula sumando, nunca se edita a mano.
  - Al cargar el pedido: "pendiente de entrega" (no toca el saldo real).
  - Al entregar (repartidor desde su celular, o Miguel/Nicolás): sube el saldo por lo realmente entregado
    (hay entregas parciales).
  - Al marcar abonado (hoja de ruta o cuenta corriente): baja el saldo.
  - Hay devoluciones, notas de crédito y descuentos. Cada cliente paga contra saldo total o contra pedido puntual.
- **Límites por cliente:** máx. de pedidos impagos y máx. de monto en $. Al pasarse: avisar y pedir autorización
  de un dueño (no bloquear). Opción "cuenta sin límite" (ej. Carrefour).
- Facturas cargadas a mano hoy (numeración 1 a 5000). Después: emitir con ARCA vía intermediario (Afip SDK /
  Tusfacturas), quedando "por revisar" hasta que Miguel confirme. Preparar campos: CUIT, condición IVA,
  punto de venta, CAE. Muchos clientes no tienen CUIT/razón social: campos opcionales.
- Hoja de ruta: se arma el día anterior (Nicolás/Miguel) arrastrando pedidos a vehículos (3 vehículos), ordenando
  el recorrido; link a Google Maps con paradas. Más adelante botón "Sugerir ruta" (Google Maps API) que
  Miguel/Nicolás revisan y ajustan. El repartidor solo ve su ruta.
- Migración de planilla de clientes (columnas: Zona, Nombre, Cliente, Dirección, Teléfono, Razón Social, CUIT,
  Estado, Comentario): **no migrar comentarios ni notas** mezcladas en dirección. Agrupar sucursales por nombre.

## Equipo / usuarios
Dueños (2), Miguel (administración y logística), Nicolás (empleado; ve lo mismo que Miguel), 3 repartidores
(usuarios aparte, usan su celular). Volumen: ~25 pedidos minoristas + 15-20 mayoristas por día; ~250 mayoristas
y ~1000 minoristas.

## Estado del proyecto
- [x] Módulo 1: base, login, roles, usuarios (alta, activar/desactivar).
- [x] Módulo 2 (parte A): Clientes (con sucursales, zonas, límites, comisión), Precios (listas × productos, por
  paquete sin IVA) y Mi cuenta (cambio de contraseña). Datos base (zonas Norte/Oeste/Sur/CABA, listas, productos)
  se crean solos en `prisma/seed.ts` si faltan.
- [ ] Módulo 2 (parte B): importar la planilla de clientes (CSV) con vista previa y confirmación.
- [ ] Módulo 3: Pedidos.
- [ ] Módulo 4: Cuenta corriente.
- [ ] Módulo 5: Hoja de ruta + vista del repartidor.
- [ ] Publicación en Railway (guiar al dueño paso a paso; él crea el proyecto y carga las claves).
- [ ] Más adelante: facturación ARCA, reportes, migración de planillas, Empretienda, sugerencia de ruta.

## Convenciones de código
- Formularios: server actions + `useActionState`; al fallar devuelven `valores` y el `<form>` usa `key` para
  conservar lo cargado (React vacía los desplegables si no). Ver `src/app/clientes/ClienteForm.tsx`.
- Montos: `src/lib/numeros.ts` (`leerMonto` entiende "3.500,50"; `cuitValido` chequea el dígito verificador).
- Páginas de oficina usan `exigirOficina()`; el repartidor vuelve al inicio.

## Pendientes conocidos
- Login: bloqueo de 15 min tras 5 fallos por email (en memoria; revisar si se usa más de una instancia).
- Recuperación de contraseña olvidada (hoy: el dueño usa SEED_ADMIN_RESET en Railway; no hay reset para otros usuarios).
- El formulario de Usuarios pierde lo cargado si da error (aplicar el mismo `key` que en Clientes).
- `npm audit` marca 3 alertas en una herramienta interna de Prisma (solo desarrollo, no en producción).
- Registro de cambios (auditoría) todavía no existe.
