# Servidor de push (notificaciones reales, con el teléfono bloqueado)

Sin este servidor, Crediorbe funciona igual: se conecta a Gmail, clasifica y
te avisa **mientras la tengas abierta**. Este servidor es el salto a
notificaciones **con el teléfono bloqueado o la app cerrada** — en iOS eso
únicamente lo puede disparar un servidor real corriendo por su cuenta.

Corre en **Render.com** (gratis, cuenta aparte de Google — no depende de
ningún permiso de administrador de tu organización), con **Upstash Redis**
(gratis) guardando el estado, y **cron-job.org** (gratis) despertándolo
cada 10-15 minutos a revisar el correo. Render conecta directo con tu repo
de GitHub y despliega solo en cada `git push` — no necesitas Node ni
ninguna otra herramienta en tu computador.

## Configuración (una sola vez)

### 1. Crear la base de datos en Upstash
1. Ve a [console.upstash.com](https://console.upstash.com) → crea una
   cuenta gratis (puedes entrar con tu cuenta de Google personal).
2. **Create database** → nombre `crediorbe` → tipo **Regional** → cualquier
   región cercana → Create.
3. En la página de la base de datos, baja hasta **"REST API"** → copia
   **`UPSTASH_REDIS_REST_URL`** y **`UPSTASH_REDIS_REST_TOKEN`**.

### 2. Crear el servicio en Render
1. Ve a [render.com](https://render.com) → crea una cuenta gratis (puedes
   entrar con GitHub directamente, así queda conectado de una vez).
2. **New +** → **Web Service** → conecta el repo `saarevalo-wq/crediorbe`.
3. Configuración:
   - **Root Directory**: `server`
   - **Runtime**: Node (Render lo detecta solo)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. En **Environment Variables**, agrega todas estas (los valores marcados
   "te lo doy yo" te los paso por aparte):
   | Variable | Valor |
   |---|---|
   | `GOOGLE_CLIENT_ID` | `811686460443-86r94592ibfv48bs709jpopf0jo242kf.apps.googleusercontent.com` |
   | `GOOGLE_CLIENT_SECRET` | El secreto que viste al crear el OAuth Client |
   | `GOOGLE_REDIRECT_URI` | Déjalo vacío por ahora — se completa en el paso 4 |
   | `UPSTASH_REDIS_REST_URL` | Del paso 1 |
   | `UPSTASH_REDIS_REST_TOKEN` | Del paso 1 |
   | `VAPID_PUBLIC_KEY` | `BD7UJu-wBpnChtgnm8VyGTjXAzzhSIrEdkbthWDjwz7Japj8jE2AqSVpopGP_lUvN0Jt0vcvVA7q5vwGtNgebWg` |
   | `VAPID_PRIVATE_KEY` | te lo doy yo |
   | `VAPID_CONTACT_EMAIL` | tu correo, con el prefijo `mailto:` |
   | `POLL_SECRET` | te lo doy yo |
5. **Create Web Service** — Render empieza a construirlo. Al terminar te da
   una URL fija, algo como `https://crediorbe-server.onrender.com`.

### 3. Cerrar el círculo del login de Gmail
Con la URL del paso 2:
1. Ve a [Credenciales](https://console.cloud.google.com/apis/credentials?project=crediorbeapp) →
   abre el OAuth Client "Crediorbe Web" → en **"URIs de redireccionamiento
   autorizados"** agrega: `https://TU-URL-DE-RENDER/auth/google/callback`
2. En Render, edita la variable `GOOGLE_REDIRECT_URI` con esa misma URL →
   guarda (Render redespliega solo).
3. Abre `https://TU-URL-DE-RENDER/auth/google` en tu navegador, inicia
   sesión con la cuenta de Gmail a monitorear, acepta el permiso — el
   servidor guarda el token en Upstash automáticamente.

### 4. Mantenerlo despierto y revisando el correo
El plan gratis de Render "duerme" el servicio si no recibe tráfico por 15
minutos. [cron-job.org](https://cron-job.org) (gratis, sin tarjeta) lo
soluciona y de paso dispara el chequeo de correo:
1. Crea una cuenta gratis.
2. **Create cronjob**:
   - URL: `https://TU-URL-DE-RENDER/poll`
   - Schedule: cada 10-15 minutos
   - En "Advanced" → Headers → agrega `X-Poll-Secret: <el POLL_SECRET que te di>`
3. Guarda y actívalo.

### 5. Conectar la app con este servidor
Dame la URL de Render — la pongo en `js/config.js` → `CONFIG.PUSH_BACKEND_URL`
y despliego la app de nuevo. A partir de ahí, cuando conectes Gmail en
Ajustes, la app también se suscribe a push real automáticamente.

## Nota de seguridad
Upstash guarda tu refresh token de Gmail — es equivalente a una contraseña
de solo lectura de tu correo. Solo el servidor de Render (con el token que
le diste) tiene acceso; no compartas las variables de entorno.
