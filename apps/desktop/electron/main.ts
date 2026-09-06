import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { app, BrowserWindow, ipcMain, Menu, protocol, safeStorage, shell } from 'electron';

import { APP_ORIGIN, APP_SCHEME, STORE_CHANNEL } from './contract';
import { createSecretStore } from './secretStore';

import type { StoreRequest } from './contract';

const dirname = path.dirname(fileURLToPath(import.meta.url));
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

// A packaged app resolves its own files; nothing here should ever be asked for a URL outside the two it serves.
export const rendererEntry = pathToFileURL(path.join(rendererDir, 'index.html')).href;
