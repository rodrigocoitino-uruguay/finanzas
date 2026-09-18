# Finanzas

App web instalable (PWA) de finanzas personales en pesos uruguayos y dólares.
Los datos viven **solo en tu dispositivo** (IndexedDB): no hay servidor, ni login, ni base de datos en la nube.

> Este README se completa en la fase 6 con la publicación en GitHub Pages, el GitHub Action de la cotización
> y la instalación en el iPhone.

## Requisitos

- Node.js 22 LTS (instalado con Homebrew: `brew install node@22`)

## Correr en la computadora

```bash
npm ci          # instala exactamente las versiones del package-lock
npm run dev     # abre http://localhost:5173/finanzas/
```

## Probar en el iPhone (misma red Wi-Fi)

```bash
npm run dev:iphone
```

Vite muestra una dirección `Network: http://192.168.x.x:5173/finanzas/`. Abrila en Safari del iPhone.
Hacelo solo en la red de tu casa y cortá el servidor (Ctrl+C) cuando termines.

## Datos de ejemplo

En **Ajustes → Datos de ejemplo** podés cargar seis meses de movimientos inventados para ver la app llena
(y borrarlos después sin tocar tus datos reales).

## Cotización del dólar (BROU)

- La referencia es el **dólar billete del BROU, valor compra**.
- El GitHub Action **"Cotización BROU"** (`.github/workflows/rates.yml`) corre los días hábiles a las 10:30,
  13:00 y 16:30 (hora de Montevideo), lee la página oficial y guarda `public/rates/latest.json` y
  `public/rates/history.json`. Si hubo cambios, vuelve a publicar la app.
- Si la lectura falla, **no toca nada**: queda el último valor válido y un aviso en el log del Action.
- Para probar el lector a mano: `node scripts/fetch-brou.mjs`.
- En la app, tocando el chip de la cotización (arriba a la derecha) o en **Ajustes → Cotización**: ver el
  histórico, actualizar, cargar una cotización manual para un día y recalcular movimientos.

## Tests y build

```bash
npm test          # tests unitarios (Vitest)
npm run build     # chequeo de tipos + build de producción en dist/
npm run preview   # sirve dist/ en http://localhost:4173/finanzas/
```

## Seguridad

- Sin servicios externos en tiempo de ejecución: la app solo pide archivos a su propio dominio.
- Content-Security-Policy estricta en el build (sin scripts en línea ni de terceros).
- Dependencias con versiones exactas y `ignore-scripts=true` (los paquetes no ejecutan código al instalarse).
- El repositorio es público: contiene código y cotizaciones, **nunca** datos personales.
  Los respaldos exportados están en `.gitignore` por las dudas.

## Estructura

```
src/
  app/          shell: encabezado, pestañas, botón +, manejo de errores
  components/   UI reutilizable (sheet, controles, toast, filas deslizables)
  db/           Dexie (IndexedDB): esquema versionado y operaciones
  domain/       lógica pura y testeada: dinero, cotización, categorías, períodos
  features/     pestañas y formularios
  lib/          formato es-UY, fechas, utilidades
  store/        estado global (Zustand)
public/rates/   cotizaciones del BROU (las actualiza un GitHub Action)
scripts/        lector de la cotización del BROU (lo usa el Action)
.github/        workflows: publicación en GitHub Pages y cotización diaria
```
