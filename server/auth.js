// One-time setup script: run `npm run auth`, open the printed URL, sign in
// with the Gmail account you want the app to monitor, and grant offline
// access. This stores a refresh token in data.json so the server can poll
// Gmail on its own schedule without you being logged into the app.
import "dotenv/config";
import http from "http";
import { google } from "googleapis";
import { setRefreshToken } from "./store.js";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // forces a refresh_token even on repeat runs
  scope: ["https://www.googleapis.com/auth/gmail.readonly"],
});

const redirectUrl = new URL(process.env.GOOGLE_REDIRECT_URI);
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== redirectUrl.pathname) {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("Falta el parámetro 'code'.");
    return;
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    setRefreshToken(tokens.refresh_token);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>Listo</h1><p>Refresh token guardado en server/data.json. Puedes cerrar esta pestaña y correr <code>npm start</code>.</p>");
  } catch (err) {
    res.writeHead(500).end(`Error obteniendo el token: ${err.message}`);
  } finally {
    setTimeout(() => server.close(), 500);
  }
});

server.listen(redirectUrl.port, () => {
  console.log("Abre esta URL, inicia sesión con la cuenta de Gmail a monitorear, y acepta el permiso:\n");
  console.log(authUrl);
  console.log(`\nEsperando el callback en ${process.env.GOOGLE_REDIRECT_URI} ...`);
});
