# Servidor de push (notificaciones reales, con el teléfono bloqueado)

Sin este servidor, Crediorbe funciona igual: se conecta a Gmail, clasifica y
te avisa **mientras la tengas abierta**. Este servidor es el salto a
notificaciones **con el teléfono bloqueado o la app cerrada** — en iOS eso
únicamente lo puede disparar un servidor real corriendo por su cuenta.

Corre en **Cloud Run** (dentro del mismo proyecto `crediorbeapp` de Google
que ya tienes), con **Firestore** guardando el estado y **Cloud Scheduler**
despertándolo cada 15 minutos a revisar el correo. Todo dentro de la capa
gratuita de Google Cloud para este volumen de uso. El despliegue es
automático vía GitHub Actions — nunca necesitas Node ni `gcloud` en tu
computador.

## Configuración (una sola vez)

### 1. Habilitar las APIs necesarias
Abre cada uno de estos links y dale **"Habilitar"**:
- [Cloud Run API](https://console.cloud.google.com/apis/library/run.googleapis.com?project=crediorbeapp)
- [Cloud Build API](https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com?project=crediorbeapp)
- [Artifact Registry API](https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com?project=crediorbeapp)
- [Firestore API](https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=crediorbeapp)
- [Cloud Scheduler API](https://console.cloud.google.com/apis/library/cloudscheduler.googleapis.com?project=crediorbeapp)

### 2. Crear la base de datos de Firestore
Ve a [console.cloud.google.com/firestore](https://console.cloud.google.com/firestore/databases?project=crediorbeapp) →
**"Crear base de datos"** → modo **Nativo** → elige una región (ej.
`us-central1`, la misma que usaremos para Cloud Run) → Crear.

### 3. Crear la cuenta de servicio para el despliegue
Ve a [IAM y administración → Cuentas de servicio](https://console.cloud.google.com/iam-admin/serviceaccounts?project=crediorbeapp) →
**"Crear cuenta de servicio"**:
- Nombre: `github-deployer`
- Roles a agregar (uno por uno, en el paso 2 del asistente): **Editor**,
  **Administrador de Cloud Run**, **Administrador de Cloud Scheduler**,
  **Usuario de cuenta de servicio**
- Termina el asistente.

Luego, dentro de esa cuenta de servicio → pestaña **"Claves"** →
**"Agregar clave"** → **"Crear clave nueva"** → tipo **JSON** → se descarga
un archivo `.json`. Ese archivo es una credencial sensible — trátalo como
una contraseña.

### 4. Agregar los secretos en GitHub
Ve a [github.com/saarevalo-wq/crediorbe/settings/secrets/actions](https://github.com/saarevalo-wq/crediorbe/settings/secrets/actions) →
**"New repository secret"** por cada uno de estos:

| Secreto | Valor |
|---|---|
| `GCP_SERVICE_ACCOUNT_KEY` | Todo el contenido del `.json` descargado en el paso 3 |
| `GOOGLE_CLIENT_ID` | El mismo Client ID de la app web (te lo pasé cuando lo creamos) |
| `GOOGLE_CLIENT_SECRET` | El "Secreto del cliente" que viste al crear el OAuth Client |
| `VAPID_PUBLIC_KEY` | `BD7UJu-wBpnChtgnm8VyGTjXAzzhSIrEdkbthWDjwz7Japj8jE2AqSVpopGP_lUvN0Jt0vcvVA7q5vwGtNgebWg` |
| `VAPID_PRIVATE_KEY` | (te la doy por aparte, es privada — no va en este archivo) |
| `POLL_SECRET` | (te lo doy por aparte también) |
| `GOOGLE_REDIRECT_URI` | Déjalo vacío por ahora — se completa en el paso 6, después del primer despliegue |

### 5. Primer despliegue
Con los secretos puestos, avísame y hago `git push` — eso dispara el
despliegue a Cloud Run automáticamente. Al terminar, el workflow imprime la
URL del servicio (algo como `https://crediorbe-server-xxxxx-uc.a.run.app`).

### 6. Cerrar el círculo del login de Gmail
Con la URL del paso 5:
1. Ve a [Credenciales](https://console.cloud.google.com/apis/credentials?project=crediorbeapp) →
   abre tu OAuth Client ("Crediorbe Web") → en **"URIs de redireccionamiento
   autorizados"** agrega: `https://TU-URL-DE-CLOUD-RUN/auth/google/callback`
2. Actualiza el secreto `GOOGLE_REDIRECT_URI` en GitHub con esa misma URL.
3. Avísame para volver a desplegar (así el servidor ya conoce esa URL).
4. Abre `https://TU-URL-DE-CLOUD-RUN/auth/google` en tu navegador, inicia
   sesión con la cuenta de Gmail a monitorear, acepta el permiso — el
   servidor guarda el token en Firestore automáticamente. No necesitas
   ningún comando ni Node en tu computador para este paso.

### 7. Crear el aviso periódico (Cloud Scheduler)
El workflow de despliegue ya lo crea/actualiza automáticamente cada vez que
se despliega — revisa cada 15 minutos. Puedes verlo en
[Cloud Scheduler](https://console.cloud.google.com/cloudscheduler?project=crediorbeapp).

### 8. Conectar la app con este servidor
Una vez tengas la URL de Cloud Run, dímela — la pongo en
`js/config.js` → `CONFIG.PUSH_BACKEND_URL` y despliego la app de nuevo. A
partir de ahí, cuando conectes Gmail en Ajustes, la app también se suscribe
a push real automáticamente.

## Nota de seguridad
Firestore guarda tu refresh token de Gmail — es equivalente a una
contraseña de solo lectura de tu correo. La cuenta de servicio de Cloud Run
es la única con acceso; no lo compartas.
