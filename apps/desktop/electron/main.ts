import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { app, BrowserWindow, ipcMain, Menu, protocol, safeStorage, session, shell } from 'electron';

import { contentSecurityPolicy } from './contentSecurityPolicy';
import { APP_ORIGIN, APP_SCHEME, SIGN_IN_CHANNEL, STORE_CHANNEL } from './contract';
import { createSecretStore } from './secretStore';
import { renewThroughToken, revokeGrant, signInThroughBrowser } from './signIn';

import type { SignInRequest, StoreRequest } from './contract';

/**
 * Where this file was written to, which is what every path below is relative to.
 *
 * `__dirname` and not `import.meta.url`: this is bundled as CommonJS (see `vite.electron.config.ts`), where the
 * import-meta form does not exist. Declared because the package is `"type": "module"`, so TypeScript does not
 * offer it by default.
 */
declare const __dirname: string;
const dirname = __dirname;
const isDev = !app.isPackaged;
/** Where the renderer lives while developing: Vite serves it, so it reloads and keeps its state. */
const devServerUrl = process.env.PLITZI_DESKTOP_DEV_SERVER ?? 'http://localhost:5180';
const rendererDir = path.join(dirname, '../renderer');

/**
 * The renderer is served from a scheme of its own rather than from `file://`.
 *
 * A `file://` document has the opaque origin `null`, and the API this app talks to decides what a request may do
 * from its `Origin` — the CSRF rule that protects signing in, the CORS answer, the origins a token may be
 * presented from. An opaque origin can be named in none of those, so the old build could only work by forcing a
 * header, which today's server would (rightly) refuse.
 *
 * `plitzi-app://home` is a real, stable origin: one line in the deployment's `PLATFORM_ORIGINS` and every check
 * the server makes has something to match.
 */
protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
};

/**
 * Serves the built renderer, and answers every unknown path with `index.html`.
 *
 * The app routes on the client, so a reload at `/spaces/view/x` asks this for a file that was never built. The
 * fallback is what makes a deep link survive a reload — and it is confined to paths inside `rendererDir`, so a
 * request that climbs out of it is refused rather than answered from the disk.
 */
const serveRenderer = async (request: Request): Promise<Response> => {
  const requested = decodeURIComponent(new URL(request.url).pathname);
  const candidate = path.join(rendererDir, requested);
  const inside = candidate === rendererDir || candidate.startsWith(`${rendererDir}${path.sep}`);
  const file = inside && path.extname(candidate) ? candidate : path.join(rendererDir, 'index.html');

  try {
    const body = await readFile(file);

    return new Response(body, { headers: { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};

const createWindow = async (): Promise<void> => {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    autoHideMenuBar: !isDev,
    backgroundColor: '#101013',
    show: false,
    webPreferences: {
      preload: path.join(dirname, 'preload.cjs'),
      // The three that matter, stated rather than inherited: the renderer runs a real web app against a real API,
      // and none of it has any business reaching Node.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev
    }
  });

  // Nothing about this app wants a second window it did not open: a target="_blank" and any navigation away from
  // the app's own origin belong to the user's browser, where they can see the address bar.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);

    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(isDev ? devServerUrl : APP_ORIGIN)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  window.once('ready-to-show', () => window.show());

  if (isDev) {
    await window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: 'detach' });

    return;
  }

  await window.loadURL(`${APP_ORIGIN}/index.html`);
};

const buildMenu = (): void => {
  const template: Parameters<typeof Menu.buildFromTemplate>[0] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{ label: 'Plitzi docs', click: () => void shell.openExternal('https://plitzi.com/docs') }]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

void app.whenReady().then(async () => {
  if (!isDev) {
    protocol.handle(APP_SCHEME, serveRenderer);
  }

  // Set on the response rather than in a `<meta>` tag: the tag lives in the document the policy is meant to
  // constrain, so anything that can write the document can drop it.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [contentSecurityPolicy(isDev)]
      }
    });
  });

  /**
   * The session, kept where the operating system keeps secrets.
   *
   * The 2023 build put the access token in `localStorage`, which on the desktop is a plain file in the user's
   * profile that anything running as them can read. `safeStorage` hands it to the Keychain / DPAPI / the
   * libsecret keyring instead, and the renderer only ever sees the value it asked for.
   */
  const store = createSecretStore({
    file: path.join(app.getPath('userData'), 'session.bin'),
    encrypt: value => safeStorage.encryptString(value),
    decrypt: buffer => safeStorage.decryptString(buffer),
    available: () => safeStorage.isEncryptionAvailable()
  });

  ipcMain.handle(STORE_CHANNEL, async (_event, request: StoreRequest) => {
    switch (request.action) {
      case 'read':
        return store.read();

      case 'write':
        return store.write(request.value);

      case 'clear':
        return store.clear();
    }
  });

  /**
   * Signing in, which happens in the person's own browser.
   *
   * Here and not in the window because the flow needs a loopback listener and the system browser — and because a
   * window that cannot run it is a window a password never reaches. What comes back is a session; the app stores
   * it the same way it stores any other, in the keyring above.
   *
   * The registration travels back with it: a native client registers per flow (the redirect carries a port the OS
   * picked this time), so renewing later needs the client the session was granted to.
   */
  ipcMain.handle(SIGN_IN_CHANNEL, async (_event, request: SignInRequest) => {
    if (request.action === 'revoke') {
      await revokeGrant(request.apiUrl, request.clientId, request.refreshToken);

      return { ok: true };
    }

    if (request.action === 'renew') {
      const renewed = await renewThroughToken(request.apiUrl, request.clientId, request.refreshToken);

      return renewed.ok ? { ...renewed, clientId: request.clientId } : renewed;
    }

    return signInThroughBrowser(request.apiUrl);
  });

  buildMenu();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
