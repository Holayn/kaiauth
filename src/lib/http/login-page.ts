import fs from 'fs';
import path from 'path';

const HTML_TEMPLATE = fs.readFileSync(path.join(__dirname, 'login-page.html'), 'utf8');
export const loginPageJs = fs.readFileSync(path.join(__dirname, 'login-page-client.js'), 'utf8');

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

// Leading slash, then only unreserved URI characters plus `/` — covers realistic path
// prefixes ('/api', '/v2/auth') while rejecting query strings, spaces, or markup outright.
const API_BASE_PATH_RE = /^\/[A-Za-z0-9\-._~/]*$/;

export function renderLoginPageHtml(title: string = 'Sign in', apiBasePath?: string): string {
  if (apiBasePath !== undefined && !API_BASE_PATH_RE.test(apiBasePath)) {
    throw new Error(
      `loginPageOptions.apiBasePath is invalid: ${JSON.stringify(apiBasePath)}. Expected a path starting with "/" containing only letters, digits, and -._~/`
    );
  }

  const escaped = escapeHtml(title);
  const apiBasePathAttr = apiBasePath ?? '';
  return HTML_TEMPLATE
    .replace(/__TITLE__/g, () => escaped)
    .replace('__API_BASE_PATH_ATTR__', () => apiBasePathAttr);
}
