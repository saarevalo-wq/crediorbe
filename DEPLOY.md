# Desplegar en Firebase Hosting (Google) y abrir en el iPhone

Firebase es el hosting de Google — vive en el mismo proyecto de Google Cloud
donde vas a crear la credencial para leer Gmail (SETUP.md §1), así que todo
queda bajo una sola cuenta/proyecto. Te da una URL HTTPS gratis del tipo
`https://tu-proyecto.web.app`.

Ya dejé `firebase.json` listo en esta carpeta (le dice al CLI qué publicar,
excluyendo `server/`). Solo faltan **dos cosas que tienes que hacer tú
mismo** — ninguna se la puedo delegar a un asistente automatizado: instalar
Node.js requiere que apruebes un diálogo de seguridad de Windows (UAC), e
iniciar sesión en Firebase requiere que entres con tu propia cuenta de
Google. Todo lo demás (instalar el CLI, desplegar, redesplegar) lo hago yo
en cuanto termines esas dos.

## Paso 1 — Instalar Node.js (una vez, requiere tu aprobación en Windows)
Corre esto en tu propia terminal (o pídeme que lo corra — igual te va a
aparecer el diálogo de Windows pidiendo tu aprobación, que solo tú puedes
aceptar):
```bash
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
```
Acepta el diálogo de Windows que te pida permiso de administrador. Cierra y
vuelve a abrir la terminal después de que termine.

## Paso 2 — Crear el proyecto de Firebase
1. Ve a **[console.firebase.google.com](https://console.firebase.google.com)**
   con tu cuenta de Google.
2. **Agregar proyecto** → nómbralo, por ejemplo, `crediorbe` → sigue el
   asistente (puedes desactivar Google Analytics, no lo necesitas).
3. Copia el **ID del proyecto** (⚙️ → Configuración del proyecto → "ID de
   proyecto", ej. `crediorbe-a1b2c`).

Este mismo proyecto ES tu proyecto de Google Cloud — no necesitas crear uno
aparte para el OAuth de Gmail (SETUP.md §1), solo reutiliza este.

## Paso 3 — Iniciar sesión en Firebase (una vez, requiere tu cuenta de Google)
```bash
npm install -g firebase-tools
firebase login
```
El segundo comando abre tu navegador para que inicies sesión — hazlo tú
mismo, es tu cuenta de Google.

## A partir de aquí, dime y lo corro yo
Con Node instalado y la sesión de Firebase iniciada, dime el **ID del
proyecto** y yo corro el despliegue por ti:
```bash
firebase deploy --project TU_PROJECT_ID
```
(o córrelo tú mismo si prefieres). Al terminar imprime tu URL:
```
Hosting URL: https://TU_PROJECT_ID.web.app
```
Esa es la URL que vas a abrir desde el iPhone.

## Paso 4 — Conectar esa URL con el permiso de Gmail
1. Ve a **[console.cloud.google.com](https://console.cloud.google.com)**,
   selecciona el mismo proyecto (arriba a la izquierda).
2. Sigue **SETUP.md §1** (habilitar Gmail API, configurar la pantalla de
   consentimiento OAuth, crear el OAuth Client ID tipo "Web application").
3. En **Authorized JavaScript origins**, agrega exactamente tu URL de
   Firebase: `https://TU_PROJECT_ID.web.app` (sin barra al final).
4. Copia el **Client ID** generado — pásamelo y lo pego en
   [js/config.js](js/config.js), o pégalo tú mismo en
   `CONFIG.GOOGLE_CLIENT_ID`.
5. Redespliega para publicar el cambio (yo lo corro, o tú):
   ```bash
   firebase deploy --project TU_PROJECT_ID
   ```

## Paso 5 — Instalar en el iPhone
1. Abre `https://TU_PROJECT_ID.web.app` en **Safari** en el iPhone (tiene
   que ser Safari).
2. Ícono de **Compartir** → **"Agregar a pantalla de inicio"** → Agregar.
3. Abre la app desde el ícono nuevo (no desde Safari) para que corra en
   modo pantalla completa.
4. Ajustes → **Conectar Gmail** → inicia sesión → acepta el permiso.

Listo — desde ahí es exactamente lo descrito en SETUP.md §4 (notificaciones
en primer plano ya funcionan; push con el teléfono bloqueado es el paso
opcional de `server/`).

## Actualizaciones futuras
Cada vez que cambie algo en el código, solo hace falta:
```bash
firebase deploy --project TU_PROJECT_ID
```
No hace falta reinstalar nada en el iPhone — la próxima vez que abras la app
instalada, el service worker trae la versión nueva sola.

## Nota
Intenté primero un CLI standalone (sin necesitar Node) pero su chequeo de
primer uso fallaba dentro de mi entorno sandboxed, así que lo descarté — el
plan de arriba usa `npm` en su lugar, que es el camino estándar y más
confiable.
