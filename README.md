# Finanzas

App web instalable (PWA) de finanzas personales en **pesos uruguayos y dólares**, pensada para el iPhone.

- **Tus datos viven solo en tu dispositivo** (IndexedDB). No hay servidor, ni cuentas, ni base de datos en la nube.
- **Costo cero**: el código está en GitHub y la app se publica gratis con GitHub Pages.
- **Funciona sin conexión** después de la primera carga.
- La cotización de referencia es el **dólar billete del BROU, valor compra**, que se actualiza sola los días hábiles.

**App publicada:** https://rodrigocoitino-uruguay.github.io/finanzas/

> Este repositorio es público y contiene **solo código y cotizaciones**, nunca datos personales.

---

## 1. Instalarla en el iPhone

1. Abrí **https://rodrigocoitino-uruguay.github.io/finanzas/** en **Safari**.
2. Tocá el botón **Compartir** (el cuadrado con la flecha hacia arriba).
3. Elegí **Agregar a pantalla de inicio** → **Agregar**.
4. Abrila siempre desde el ícono de la pantalla de inicio (anillo verde y azul).

Instalada: se abre a pantalla completa, funciona en modo avión e iOS no borra sus datos por falta de uso.
(Desde iOS 16.4 también se puede agregar desde Chrome: menú **Compartir** → **Agregar a inicio**.)

### Primeros pasos recomendados

1. **Ajustes → PIN y Face ID**: activá el PIN y, si querés, Face ID.
2. **Ajustes → Moneda**: revisá en qué moneda querés ver los montos y cargar gastos e ingresos.
3. Cargá tu sueldo y tus gastos fijos con **"Repetir todos los meses"** (alquiler, gastos comunes…).
4. **Ajustes → Respaldo**: hacé un respaldo al menos una vez por mes (la app te lo recuerda a los 30 días).

Para ver cómo se ve llena: **Ajustes → Cargar datos demo** (y después **Borrar datos demo**).

### Actualizaciones

Cuando se publica una versión nueva, la app muestra **"Hay una versión nueva · Actualizar"**. Tus datos no se tocan.

---

## 2. Qué hace

| Pestaña | Qué tiene |
| --- | --- |
| **Resumen** | Saldo del período (y proyección a fin de mes), ingresos y gastos con variación, fijos/variables, últimos 6 meses, recurrentes para confirmar, presupuestos en alerta y recordatorio de respaldo. |
| **Movimientos** | Lista por día con total diario, búsqueda y filtros (tipo, fijo/variable, categoría, moneda). Tocar edita, deslizar a la izquierda borra (con deshacer). |
| **Gastos** | Todos / Fijos / Variables: dona + ranking por categoría, evolución mensual y presupuestos. |
| **Ingresos** | Por tipo (sueldo, freelance, otro), ingresos vs. gastos por mes, % del ingreso que se va en gastos y cuántos USD se fueron en pesos. |
| **Ajustes** | Categorías, recurrentes, presupuestos, moneda, cotización, seguridad, respaldo y datos. |

Todo está conectado: el período y la moneda son los mismos en todas las pestañas, y tocar una porción o una barra de un gráfico te lleva a los movimientos filtrados.

**Carga rápida:** botón **+** → monto → categoría (se crea sola si no existe, sin duplicados: "comida" = "Comida " = "cómida") → Guardar.

---

## 3. Cotización del dólar (BROU)

- El GitHub Action **"Cotización BROU"** (`.github/workflows/rates.yml`) corre de **lunes a viernes a las 10:30, 13:00 y 16:30** (hora de Montevideo). Lee la página oficial del BROU, toma la fila **"Dólar"** (no "Dólar eBROU") y guarda `public/rates/latest.json` y `public/rates/history.json`.
- Antes de guardar valida que los números sean razonables, que la venta sea mayor que la compra y que no haya un salto de más del 15 %. **Si algo falla, no toca nada**: queda el último valor válido y un aviso en el log.
- Si hubo cambios, hace el commit y vuelve a publicar la app.
- Los fines de semana y feriados vale la del último día hábil.
- Cada movimiento guarda la cotización de su fecha, así los meses pasados no cambian cuando se mueve el dólar.
- En la app (tocando el chip de arriba a la derecha o en **Ajustes → Cotización**): histórico, **Actualizar**, cotización **manual** para un día y **recalcular** movimientos.

### Correr el Action a mano

GitHub → repositorio → pestaña **Actions** → **Cotización BROU** → **Run workflow**.

### Si GitHub pausa el Action

En repositorios públicos, GitHub desactiva las tareas programadas si el repositorio pasa **60 días sin actividad**.
Los commits de la cotización cuentan como actividad, así que no debería pasar. Si pasa: **Actions → Cotización BROU → Enable workflow**.

Para probar el lector localmente: `node scripts/fetch-brou.mjs`.

---

## 4. Seguridad y privacidad

- **Sin servicios externos**: la app solo pide archivos a su propio dominio. Content-Security-Policy estricta (sin scripts de terceros ni en línea).
- **PIN** de 4 a 6 números guardado como hash **PBKDF2-SHA256 (600.000 iteraciones) con sal** — nunca en texto. Tras 5 errores hay que esperar 30 s, 1 min, 2 min… hasta 15 min (la espera sobrevive a recargar).
- **Face ID / Touch ID** opcional con WebAuthn: la app verifica la firma criptográfica del iPhone.
- **Bloqueo automático** al volver a la app (inmediato, 1, 5, 15 o 30 min). Mientras la app está en segundo plano se tapa el contenido.
- Es un **bloqueo de acceso a la app, no un cifrado bancario**: los datos quedan en el iPhone, protegidos por el cifrado de iOS.
- **Respaldo cifrado** con contraseña (AES-256-GCM, clave derivada con PBKDF2). Sin la contraseña no se puede abrir.
- **Importación validada** campo por campo: un archivo alterado no puede meter datos inválidos.
- **CSV** protegido contra fórmulas maliciosas (celdas que empiezan con `=`, `+`, `-`, `@`).
- Repositorio: solo Actions oficiales de GitHub fijadas por versión exacta, permisos mínimos, dependencias con versiones exactas y sin scripts de instalación (`.npmrc`), alertas de seguridad activadas.

**Si olvidás el PIN** no hay forma de recuperarlo: en la pantalla de bloqueo → **¿Olvidaste el PIN?** → borrar los datos y restaurar el último respaldo.

---

## 5. Respaldo y restauración

- **Ajustes → Respaldo → Respaldo completo**: elegís una contraseña (mínimo 8 caracteres) → **Preparar respaldo** → **Guardar archivo** → en el iPhone, **Guardar en Archivos** (iCloud Drive o En mi iPhone).
- **Movimientos en CSV**: para Excel o Google Sheets (separador `;`, decimales con coma). No está cifrado.
- **Importar un respaldo**: elegís el archivo, ponés la contraseña y elegís **Combinar** (suma sin duplicar) o **Reemplazar todo**. El PIN y Face ID del dispositivo se mantienen.
- **Borrar todos los datos**: con doble confirmación (hay que escribir BORRAR).

---

## 6. Correrla en la computadora

Requisitos: **Node.js 22 LTS** (`brew install node@22`).

```bash
npm ci          # instala exactamente las versiones del package-lock
npm run dev     # http://localhost:5173/finanzas/
npm test        # tests (Vitest)
npm run build   # chequeo de tipos + build en dist/
npm run preview # sirve dist/ en http://localhost:4173/finanzas/
```

Probar en el iPhone por Wi-Fi: `npm run dev:iphone` y abrir la dirección `Network:` que muestra Vite
(el PIN, Face ID y el respaldo cifrado necesitan https: probalos en la app publicada).

---

## 7. Publicar en GitHub Pages (paso a paso)

Ya está hecho para este repositorio; queda documentado por si hay que repetirlo:

1. Crear una cuenta en github.com y activar la verificación en dos pasos.
2. Instalar la herramienta de GitHub: `brew install gh` y ejecutar `gh auth login --web --scopes workflow`.
3. Crear el repositorio público: `gh repo create <usuario>/finanzas --public`.
4. Activar Pages con GitHub Actions como origen:
   `gh api -X POST repos/<usuario>/finanzas/pages -f build_type=workflow`
5. Si el repositorio no se llama `finanzas`, cambiar `REPO_BASE` en `vite.config.ts`.
6. Subir el código: `git push -u origin main`. El workflow **"Publicar en GitHub Pages"** corre los tests, compila y publica en `https://<usuario>.github.io/finanzas/`.
7. Correr una vez **Actions → Cotización BROU → Run workflow** para verificar la cotización.

---

## 8. Stack y estructura

Vite + React + TypeScript · Tailwind CSS (tokens propios) · Dexie (IndexedDB, esquema versionado) · Zustand ·
Recharts (se descarga aparte, solo cuando hace falta) · vite-plugin-pwa (Workbox) · date-fns (es) · Vitest.

```
src/
  app/          shell: encabezado, pestañas, botón +, bloqueo, aviso de actualización
  components/   UI reutilizable y gráficos (dona propia, barras con Recharts)
  db/           IndexedDB: movimientos, categorías, recurrentes, presupuestos, respaldo, PIN
  domain/       lógica pura y testeada: dinero, cotización, períodos, análisis, respaldo, CSV
  features/     pestañas y hojas (carga, cotización, recurrentes, presupuestos, seguridad…)
  lib/          formato es-UY, fechas, cifrado, WebAuthn, archivos
  store/        estado global (Zustand)
public/rates/   cotizaciones del BROU (las actualiza el Action)
public/icons/   íconos (fuente: icons/icon.svg)
public/splash/  pantallas de carga de iOS
scripts/        lector del BROU y generador de íconos
.github/        workflows: publicación y cotización
```

Regenerar íconos y pantallas de carga (no es parte del build):
`npm i --no-save sharp && node scripts/generate-icons.mjs`.
