import { describe, it, expect } from 'vitest';
import { renderLoginPageHtml } from './login-page';

describe('renderLoginPageHtml', () => {
  it('defaults the title to "Sign in"', () => {
    const html = renderLoginPageHtml();
    expect(html).toContain('<title>Sign in</title>');
  });

  it('escapes the title for safe HTML embedding', () => {
    const html = renderLoginPageHtml('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('embeds null for the API base when apiBasePath is omitted', () => {
    const html = renderLoginPageHtml();
    expect(html).toContain('window.__KAIAUTH_API_BASE__ = null;');
  });

  it('embeds a valid apiBasePath as a JSON string', () => {
    const html = renderLoginPageHtml('Sign in', '/api');
    expect(html).toContain('window.__KAIAUTH_API_BASE__ = "/api";');
  });

  it('accepts a multi-segment path', () => {
    const html = renderLoginPageHtml('Sign in', '/v2/auth');
    expect(html).toContain('window.__KAIAUTH_API_BASE__ = "/v2/auth";');
  });

  it.each([
    ['missing leading slash', 'api'],
    ['contains a space', '/ap i'],
    ['contains a query string', '/api?x=1'],
    ['contains markup', '/api"><script>alert(1)</script>'],
    ['empty string', ''],
  ])('rejects an apiBasePath that is invalid (%s)', (_label, value) => {
    expect(() => renderLoginPageHtml('Sign in', value)).toThrow(/apiBasePath is invalid/);
  });
});
