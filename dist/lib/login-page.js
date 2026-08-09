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
function renderLoginPageHtml(title = 'Sign in') {
    const escaped = escapeHtml(title);
    return HTML_TEMPLATE.replace(/__TITLE__/g, () => escaped);
}
//# sourceMappingURL=login-page.js.map