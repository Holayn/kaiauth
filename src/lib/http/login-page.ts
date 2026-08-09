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

export function renderLoginPageHtml(title: string = 'Sign in'): string {
  const escaped = escapeHtml(title);
  return HTML_TEMPLATE.replace(/__TITLE__/g, () => escaped);
}
