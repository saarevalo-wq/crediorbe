# Servidor de push (opcional)

Sin este servidor, Crediorbe funciona igual: se conecta a Gmail, clasifica y
te avisa **mientras la tengas abierta**. Este servidor es solo para el salto
a notificaciones reales **con el teléfono bloqueado o la app cerrada** — eso
en iOS únicamente lo puede disparar un servidor real (Apple no permite que
JavaScript en el navegador programe una notificación futura).

Qué hace: cada `POLL_CRON` minutos, revisa el correo con un token propio
(no depende de que abras la app), clasifica los nuevos correos, y le manda un
push a cada dispositivo suscrito vía el Push API estándar (VAPID).

## 1. Instalar
```bash
cd server
npm install
cp .env.example .env
```

## 2. Credenciales de Google (server-side)
Reutiliza el mismo Client ID de `../SETUP.md` §1, pero aquí también necesitas
el **Client Secret** (Google Cloud Console → tu OAuth Client → "Client secret").
Agrega también un Redirect URI para este servidor:
`http://localhost:8788/auth/google/callback` (Authorized redirect URIs en el
mismo OAuth Client). Completa `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y
`GOOGLE_REDIRECT_URI` en `.env`.

## 3. Conectar Gmail (una sola vez)
```bash
npm run auth
```
Abre la URL que imprime, inicia sesión con la cuenta a monitorear, acepta el
permiso. Esto guarda un refresh token en `data.json` (nunca lo subas a git —
ya está en `.gitignore`).

## 4. Claves VAPID (para el Push API)
```bash
npm run vapid
```
Copia `Public Key` y `Private Key` a `.env`. Copia también la Public Key a
`../js/config.js` → `CONFIG.VAPID_PUBLIC_KEY`, y la URL donde termines
desplegando este servidor a `CONFIG.PUSH_BACKEND_URL`.

## 5. Correr
```bash
npm start
```

## 6. Desplegar (para que corra sin tu computador prendido)
Cualquier host de Node sirve — ej. [Render.com](https://render.com) (free
tier de Web Service):
1. Sube `server/` a un repo de GitHub.
2. En Render: New → Web Service → conecta el repo, root directory `server/`,
   build command `npm install`, start command `npm start`.
3. Agrega las variables de entorno de `.env` en el dashboard de Render
   (incluye `GOOGLE_REDIRECT_URI` apuntando a tu URL de Render:
   `https://tu-app.onrender.com/auth/google/callback`, y agrégala también como
   Authorized redirect URI en Google Cloud).
4. Corre `npm run auth` una vez apuntando a esa URL desplegada (puedes
   correrlo localmente con `GOOGLE_REDIRECT_URI` en modo local para generar
   el token, y luego subir `data.json` una sola vez, o correr `auth.js` desde
   la shell de Render).
5. El free tier de Render "duerme" el servicio tras inactividad — como este
   servidor no recibe tráfico de usuarios (solo cron interno), considera un
   plan pago o un servicio con cron activo (Railway, Fly.io) para que el
   `POLL_CRON` no se detenga.

## Nota de seguridad
`data.json` contiene tu refresh token de Gmail — trátalo como una contraseña.
No lo subas a git, no lo compartas.
