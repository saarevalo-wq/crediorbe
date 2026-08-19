# Desplegar en Firebase Hosting (Google) vía GitHub Actions

Como este computador no puede instalar Node.js, el despliegue corre en la
nube de GitHub (gratis), no en tu máquina. Cada vez que se sube código al
repo, un robot de GitHub lo publica automáticamente en Firebase Hosting.

**Ya listo:**
- Proyecto de Firebase: `crediorbeapp`
- Repo de GitHub: https://github.com/saarevalo-wq/crediorbe
- `.github/workflows/firebase-hosting.yml` — configurado con tu Project ID.
- `firebase.json` — le dice qué carpeta publicar (excluye `server/`).

**Falta un solo paso que solo tú puedes hacer** (genera una credencial —
nunca debo tocar ni ver ese archivo yo mismo, y tú tampoco debes compartirlo
fuera de GitHub):

## Paso 1 — Generar la llave de servicio de Firebase
1. Ve a [console.firebase.google.com/project/crediorbeapp/settings/serviceaccounts/adminsdk](https://console.firebase.google.com/project/crediorbeapp/settings/serviceaccounts/adminsdk)
2. Click **"Generar nueva clave privada"** (Generate new private key).
3. Confirma — se descarga un archivo `.json` a tu computador.

## Paso 2 — Agregarla como secreto en GitHub
1. Ve a [github.com/saarevalo-wq/crediorbe/settings/secrets/actions](https://github.com/saarevalo-wq/crediorbe/settings/secrets/actions)
2. Click **"New repository secret"**.
3. Name: `FIREBASE_SERVICE_ACCOUNT`
4. Secret: abre el archivo `.json` que se descargó (con el Bloc de notas,
   por ejemplo), copia **todo** el contenido, y pégalo aquí.
5. Click **"Add secret"**.
6. Puedes borrar el archivo `.json` de tu computador después de pegarlo
   (ya quedó guardado, cifrado, dentro de GitHub).

## Paso 3 — avísame
En cuanto agregues ese secreto, dime y yo subo el código (`git push`) — eso
dispara el despliegue automático. Al terminar, tu app queda publicada en:
```
https://crediorbeapp.web.app
```

## Paso 4 — Conectar esa URL con el permiso de Gmail
1. Ve a [console.cloud.google.com](https://console.cloud.google.com),
   selecciona el proyecto `crediorbeapp` (arriba a la izquierda).
2. Sigue **SETUP.md §1** (habilitar Gmail API, configurar la pantalla de
   consentimiento OAuth, crear el OAuth Client ID tipo "Web application").
3. En **Authorized JavaScript origins**, agrega exactamente:
   `https://crediorbeapp.web.app` (sin barra al final).
4. Copia el **Client ID** generado — pásamelo y lo pego en
   [js/config.js](js/config.js), o pégalo tú mismo en
   `CONFIG.GOOGLE_CLIENT_ID`.
5. Avísame para volver a subir el cambio (se redespliega solo).

## Paso 5 — Instalar en el iPhone
1. Abre `https://crediorbeapp.web.app` en **Safari** en el iPhone (tiene
   que ser Safari).
2. Ícono de **Compartir** → **"Agregar a pantalla de inicio"** → Agregar.
3. Abre la app desde el ícono nuevo (no desde Safari) para que corra en
   modo pantalla completa.
4. Ajustes → **Conectar Gmail** → inicia sesión → acepta el permiso.

Listo — desde ahí es exactamente lo descrito en SETUP.md §4 (notificaciones
en primer plano ya funcionan; push con el teléfono bloqueado es el paso
opcional de `server/`).

## Actualizaciones futuras
De aquí en adelante, cualquier cambio de código solo necesita `git push` —
ni tú ni yo necesitamos Node.js ni el CLI de Firebase nunca más en este
computador. Puedes ver el progreso de cada despliegue en
[github.com/saarevalo-wq/crediorbe/actions](https://github.com/saarevalo-wq/crediorbe/actions).
No hace falta reinstalar nada en el iPhone — la próxima vez que abras la app
instalada, el service worker trae la versión nueva sola.
