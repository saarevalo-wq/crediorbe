# Crediorbe — PWA para iOS (sin Mac, sin cuenta Apple Developer)

Esta es una **app web instalable (PWA)**: se abre una vez desde Safari en el
iPhone, se "agrega a inicio", y desde ahí se comporta como una app —
ícono propio, pantalla completa, sin barra de navegador. No pasa por la
App Store, así que no necesitas Mac, Xcode, ni cuenta de Apple Developer.

Lo que sí necesitas: **hosting HTTPS** (gratis, ver §2) y una **credencial de
Google OAuth** (gratis, ver §1) para que la app pueda leer tu Gmail.

## 0. Antes de nada: pruébala con datos de ejemplo
Puedes ver las 3 pantallas funcionando ahora mismo, sin configurar nada:
abre `index.html` en un navegador (o súbelo a hosting, §2) y toca
**"Ver con datos de ejemplo"** en la bandeja. Así validas el diseño antes de
meterte con Google Cloud.

## 1. Crear credenciales de Google (para conectar Gmail)
1. Ve a [Google Cloud Console](https://console.cloud.google.com/) → crea un
   proyecto nuevo (ej. "Crediorbe").
2. **APIs & Services → Library** → busca "Gmail API" → Enable.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** (a menos que tengas Google Workspace).
   - Completa nombre de la app, correo de soporte, correo de contacto.
   - Scopes: agrega `https://www.googleapis.com/auth/gmail.readonly`.
   - **Test users**: agrega tu propia cuenta de Gmail (mientras la app esté
     en modo "Testing" solo estas cuentas pueden usarla — está bien para uso
     personal, no necesitas publicarla para Google).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: agrega la URL donde vas a alojar la
     app (ej. `https://tu-usuario.github.io` o `https://crediorbe.netlify.app`).
     Para probar en tu computador local con `serve.ps1`, agrega también
     `http://localhost:8787`.
   - Copia el **Client ID** generado.
5. Pega ese Client ID en [js/config.js](js/config.js) → `CONFIG.GOOGLE_CLIENT_ID`.

## 2. Hospedar la app (gratis, HTTPS obligatorio)
Los service workers y "Add to Home Screen" en iOS **requieren HTTPS** (o
`localhost` para pruebas).

**Recomendado: Firebase Hosting (Google)** — ver [DEPLOY.md](DEPLOY.md) para
el paso a paso completo. Ya dejé `firebase.json` listo; solo falta instalar
Node.js (un paso tuyo, requiere aprobar un diálogo de Windows), crear el
proyecto en Firebase, e iniciar sesión — de ahí en adelante yo puedo correr
el despliegue por ti. Como Firebase Hosting vive en el mismo proyecto de
Google Cloud que usas para el paso 1, todo queda junto bajo tu cuenta de
Google.

Otras opciones igual de válidas si prefieres no usar Firebase (sin build
step, solo sube la carpeta `CrediorbeWeb/` tal cual):
- **Netlify Drop**: arrastra la carpeta a [app.netlify.com/drop](https://app.netlify.com/drop) — URL HTTPS al instante, sin cuenta ni comandos.
- **GitHub Pages**: sube a un repo, Settings → Pages → Deploy from branch.
- **Cloudflare Pages** / **Vercel**: similar, conectando el repo.

Sea cual sea, **agrega esa URL exacta** como Authorized JavaScript origin en
el OAuth Client ID (paso 1.4).

## 3. Instalar en el iPhone
1. Abre la URL de tu hosting en **Safari** (tiene que ser Safari, no Chrome,
   para que aparezca la opción de instalar).
2. Toca el ícono de **Compartir** (el cuadrado con flecha hacia arriba).
3. Toca **"Agregar a pantalla de inicio"** → Agregar.
4. Abre la app desde el ícono nuevo en tu pantalla de inicio (no desde
   Safari) — así corre en modo standalone, pantalla completa.
5. Ve a **Ajustes** dentro de la app → **Conectar Gmail** → inicia sesión →
   acepta el permiso de solo lectura.

## 4. Notificaciones — qué esperar
- **Con la app abierta**: sincroniza cada 5 minutos y te notifica según el
  modo elegido en Ajustes (esto funciona ya, sin nada adicional).
- **Con el teléfono bloqueado o la app cerrada**: iOS solo permite esto para
  apps instaladas a pantalla de inicio (que ya hiciste en el paso 3) en
  **iOS 16.4 o superior**, y requiere un servidor que le avise a Apple cuándo
  notificarte — no lo puede hacer el navegador solo. Ver [server/README.md](server/README.md)
  para desplegar ese servidor opcional (gratis en el free tier de Render/Railway).
  Sin ese servidor, la app sigue funcionando perfecto, solo que el aviso
  llega cuando la abres, no mientras está cerrada.

## 5. Qué es heurístico, no "IA" todavía
El clasificador (`js/classifier.js`) usa reglas de palabras clave en español
(desacato, tutela, impugnación, etc.) — funciona bien para el caso descrito,
pero no es un modelo de lenguaje. Si más adelante quieres clasificación real
con IA (mejor manejo de casos ambiguos, resúmenes más naturales), eso
requiere un backend con una API key de un proveedor de LLM — puedo
construirlo como una extensión del servidor en `server/` cuando lo necesites.

## Límite conocido: el token de Gmail expira
Como la conexión a Gmail corre 100% en el navegador (sin backend), el token
dura ~1 hora; después de eso el próximo intento de sincronizar pedirá
reconectar en Ajustes. El servidor opcional de `server/` no tiene este
límite (usa un refresh token de larga duración) porque corre del lado del
servidor.
