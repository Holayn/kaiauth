"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginPageJs = void 0;
exports.renderLoginPageHtml = renderLoginPageHtml;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const HTML_TEMPLATE = fs_1.default.readFileSync(path_1.default.join(__dirname, 'login-page.html'), 'utf8');
exports.loginPageJs = fs_1.default.readFileSync(path_1.default.join(__dirname, 'login-page-client.js'), 'utf8');
const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}
// Leading slash, then only unreserved URI characters plus `/` — covers realistic path
// prefixes ('/api', '/v2/auth') while rejecting query strings, spaces, or markup outright.
const API_BASE_PATH_RE = /^\/[A-Za-z0-9\-._~/]*$/;
function renderLoginPageHtml(title = 'Sign in', apiBasePath) {
    if (apiBasePath !== undefined && !API_BASE_PATH_RE.test(apiBasePath)) {
        throw new Error(`loginPageOptions.apiBasePath is invalid: ${JSON.stringify(apiBasePath)}. Expected a path starting with "/" containing only letters, digits, and -._~/`);
    }
    const escaped = escapeHtml(title);
    const apiBasePathAttr = apiBasePath ?? '';
    return HTML_TEMPLATE
        .replace(/__TITLE__/g, () => escaped)
        .replace('__API_BASE_PATH_ATTR__', () => apiBasePathAttr);
}
//# sourceMappingURL=login-page.js.map