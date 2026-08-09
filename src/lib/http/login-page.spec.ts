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

  it('embeds an empty value attribute for the API base when apiBasePath is omitted', () => {
    const html = renderLoginPageHtml();
    expect(html).toContain('<data id="kaiauth-config" value="" hidden></data>');
  });

  it('embeds a valid apiBasePath as the value attribute', () => {
    const html = renderLoginPageHtml('Sign in', '/api');
    expect(html).toContain('<data id="kaiauth-config" value="/api" hidden></data>');
  });

  it('accepts a multi-segment path', () => {
    const html = renderLoginPageHtml('Sign in', '/v2/auth');
    expect(html).toContain('<data id="kaiauth-config" value="/v2/auth" hidden></data>');
  });

  it('does not embed apiBasePath via an inline script (CSP-friendly)', () => {
    const html = renderLoginPageHtml('Sign in', '/api');
    expect(html).not.toMatch(/<script>[^<]*__KAIAUTH_API_BASE__/);
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
