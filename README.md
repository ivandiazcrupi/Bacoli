# BACOLI · Gestión

Sistema web de gestión de BACOLI. Ver `CLAUDE.md` para qué es, cómo está armado y qué falta.
Para publicar y recuperar el sistema en Railway: `docs/PUBLICAR.md`.

## Poner en marcha en una computadora
1. `npm install`
2. Copiar `.env.example` a `.env` y completarlo.
3. `npm run db:deploy` (crea las tablas) y `npm run db:seed` (crea el primer dueño).
4. `npm run dev` y abrir http://localhost:3000
