"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserStore = exports.createAuthRouter = void 0;
require("./types/express-session"); // Allow consumers to pick up express-session type augmentation.
var auth_router_1 = require("./lib/http/auth-router");
Object.defineProperty(exports, "createAuthRouter", { enumerable: true, get: function () { return auth_router_1.createAuthRouter; } });
var user_store_1 = require("./lib/store/user-store");
Object.defineProperty(exports, "UserStore", { enumerable: true, get: function () { return user_store_1.UserStore; } });
//# sourceMappingURL=index.js.map