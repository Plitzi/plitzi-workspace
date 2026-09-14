/**
 * The SMTP server a space sends its flows' mail through, as its credential stores it — one rule for everybody who
 * reads one: the editor saving it, the API accepting it, the check reporting on it and the `email.send` task using it.
 *
 * A credential is a bag of strings, so every value arrives as text and is judged here: a port that is not a port, a
 * sender that is not one address, a password with no user to go with it. Each problem names the key it is about, so a
 * form can put the sentence under the field.
 */

export type SmtpSecurity = 'tls' | 'starttls' | 'none';

export type SmtpSettings = {
  host: string;
  port: number;
  /** `tls` connects encrypted (usually 465); `starttls` upgrades a plain connection (usually 587); `none` never does. */
  security: SmtpSecurity;
  /** Empty with an empty password: a relay that authenticates by where the connection comes from. */
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
};

export type SmtpCredentialProblem = { key: keyof SmtpSettings; message: string };

export type SmtpCredentialReading = { settings: SmtpSettings; problems: [] } | { problems: SmtpCredentialProblem[] };

/** The keys an SMTP credential holds, in the order an editor asks for them. */
export const SMTP_CREDENTIAL_KEYS: readonly (keyof SmtpSettings)[] = [
  'host',
  'port',
  'security',
  'username',
  'password',
  'fromEmail',
  'fromName'
];

const SECURITY: readonly SmtpSecurity[] = ['tls', 'starttls', 'none'];

/** A host name or an IPv4 address, and nothing a scheme, a path or a port could hide in. */
const HOST = /^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/;

/**
 * One address, and nothing a mail header could be split on.
 *
 * Stricter than the standard on purpose: a comma or a semicolon is how one recipient becomes a hundred, and a line
 * break is how a subject becomes a second header. A flow renders what a visitor typed, so this is where that stops.
 */
const ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

export const isSingleEmailAddress = (value: string): boolean => ADDRESS.test(value);

const isSecurity = (value: string): value is SmtpSecurity => SECURITY.some(option => option === value);

const textOf = (data: Record<string, unknown>, key: keyof SmtpSettings): string => {
  const value = data[key];
  if (typeof value === 'number') {
    return String(value);
  }

  return typeof value === 'string' ? value.trim() : '';
};

export const readSmtpCredential = (data: Record<string, unknown>): SmtpCredentialReading => {
  const host = textOf(data, 'host');
  const port = Number(textOf(data, 'port'));
  const security = textOf(data, 'security');
  const username = textOf(data, 'username');
  const password = typeof data.password === 'string' ? data.password : '';
  const fromEmail = textOf(data, 'fromEmail');
  const fromName = textOf(data, 'fromName');
  const problems: SmtpCredentialProblem[] = [];

  if (!HOST.test(host)) {
    problems.push({ key: 'host', message: 'A host name like smtp.example.com, with no scheme and no port' });
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push({ key: 'port', message: 'A port number, usually 587 or 465' });
  }

  if (!isSecurity(security)) {
    problems.push({ key: 'security', message: 'One of tls, starttls or none' });
  }

  if (password !== '' && username === '') {
    problems.push({ key: 'username', message: 'A password needs the user it belongs to' });
  }

  if (!isSingleEmailAddress(fromEmail)) {
    problems.push({ key: 'fromEmail', message: 'The one address this server sends as' });
  }

  if (/[\r\n]/.test(fromName) || fromName.length > 100) {
    problems.push({ key: 'fromName', message: 'One line of at most 100 characters' });
  }

  if (problems.length > 0 || !isSecurity(security)) {
    return { problems };
  }

  return { settings: { host, port, security, username, password, fromEmail, fromName }, problems: [] };
};
