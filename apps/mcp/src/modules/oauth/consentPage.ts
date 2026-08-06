import type { OAuthConsentView } from '@plitzi/sdk-shared';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/gu, character => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });

// Deliberately one stylesheet and zero script tags: this page takes a password, so the less of it that can be
// influenced from anywhere else, the better. It is also why the flow is plain form POSTs and not the SDK runtime.
const STYLES = `
  :root { color-scheme: light dark; --bg: #f6f7f9; --panel: #ffffff; --ink: #16181d; --muted: #6b7280;
    --line: #e2e5ea; --accent: #2563eb; --danger: #b91c1c; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0f1115; --panel: #171a21; --ink: #e8eaee; --muted: #9aa1ad; --line: #262b35;
      --accent: #60a5fa; --danger: #f87171; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
    background: var(--bg); color: var(--ink);
    font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { width: 100%; max-width: 420px; background: var(--panel); border: 1px solid var(--line);
    border-radius: 14px; padding: 32px; }
  img.logo { display: block; height: 32px; margin-bottom: 20px; }
  h1 { margin: 0 0 6px; font-size: 20px; font-weight: 600; }
  p.lede { margin: 0 0 24px; color: var(--muted); font-size: 14px; }
  label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; }
  input[type="text"], input[type="password"] { width: 100%; margin-bottom: 16px; padding: 10px 12px;
    border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); font: inherit; }
  input:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  ul.targets { list-style: none; margin: 0 0 20px; padding: 0; display: grid; gap: 8px; }
  ul.targets label { display: flex; gap: 10px; align-items: flex-start; margin: 0; padding: 12px;
    border: 1px solid var(--line); border-radius: 8px; font-weight: 400; cursor: pointer; }
  ul.targets strong { display: block; font-weight: 500; }
  ul.targets span { color: var(--muted); font-size: 13px; }
  button { width: 100%; padding: 11px 16px; border: 0; border-radius: 8px; background: var(--accent);
    color: #fff; font: inherit; font-weight: 500; cursor: pointer; }
  button.guest { margin-top: 10px; background: transparent; color: var(--accent);
    border: 1px solid var(--line); }
  p.error { margin: 0 0 16px; padding: 10px 12px; border-radius: 8px; color: var(--danger);
    border: 1px solid currentColor; font-size: 14px; }
  p.note { margin: 10px 0 0; color: var(--muted); font-size: 13px; text-align: center; }
`;

const hiddenFields = (hidden: Record<string, string>): string =>
  Object.entries(hidden)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
    .join('\n      ');

// `formnovalidate` is what makes the guest button work at all: the credential inputs are `required`, and without it
// the browser refuses to submit the form for someone who deliberately typed nothing.
const guestButton = (guest: NonNullable<OAuthConsentView['guest']>): string => {
  const note = guest.description ? `\n      <p class="note">${escapeHtml(guest.description)}</p>` : '';

  return `\n      <button class="guest" type="submit" name="guest" value="1" formnovalidate>${escapeHtml(
    guest.label
  )}</button>${note}`;
};

const credentialsFields = (view: OAuthConsentView): string => `<label for="username">Email or username</label>
      <input id="username" name="username" type="text" autocomplete="username" autocapitalize="none"
        spellcheck="false" required autofocus>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Sign in</button>${view.guest ? guestButton(view.guest) : ''}`;

const targetFields = (view: OAuthConsentView): string => {
  const options = view.targets
    .map((target, index) => {
      const description = target.description ? `<span>${escapeHtml(target.description)}</span>` : '';

      return `<li><label>
          <input type="radio" name="target" value="${escapeHtml(target.value)}"${index === 0 ? ' checked' : ''}>
          <span><strong>${escapeHtml(target.label)}</strong>${description}</span>
        </label></li>`;
    })
    .join('\n        ');

  return `<ul class="targets">
        ${options}
      </ul>
      <button type="submit">Allow access</button>`;
};

/** The built-in consent screen: a credentials step, then a step to pick what the client gets access to. Replace it
 *  wholesale via `oauth.renderConsent` — the field names read back here are the contract, not the markup. */
export const renderConsentPage = (view: OAuthConsentView): string => {
  const productName = view.branding.productName ?? 'Plitzi';
  const logo = view.branding.logoUrl
    ? `<img class="logo" src="${escapeHtml(view.branding.logoUrl)}" alt="${escapeHtml(productName)}">`
    : '';
  const error = view.error ? `<p class="error">${escapeHtml(view.error)}</p>` : '';
  const lede =
    view.step === 'credentials'
      ? `Sign in to connect ${escapeHtml(productName)}.`
      : `Signed in as ${escapeHtml(view.user?.label ?? '')}. Choose what to grant access to.`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <link rel="icon" href="data:,">
  <title>${escapeHtml(productName)}</title>
  <style>${STYLES}${view.branding.css ?? ''}</style>
</head>
<body>
  <main>
    ${logo}
    <h1>${escapeHtml(productName)}</h1>
    <p class="lede">${lede}</p>
    ${error}
    <form method="post" action="${escapeHtml(view.action)}">
      ${hiddenFields(view.hidden)}
      ${view.step === 'credentials' ? credentialsFields(view) : targetFields(view)}
    </form>
  </main>
</body>
</html>`;
};

/** The dead end for a request that cannot be redirected back — a bad `redirect_uri` or an unknown client. Bouncing
 *  those to the client would make this server an open redirector, so the user is told here instead. */
export const renderErrorPage = (title: string, detail: string): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <link rel="icon" href="data:,">
  <title>${escapeHtml(title)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p class="lede">${escapeHtml(detail)}</p>
  </main>
</body>
</html>`;
