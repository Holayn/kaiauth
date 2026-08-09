import './types/express-session'; // Allow consumers to pick up express-session type augmentation.

export { createAuthRouter } from './lib/http/auth-router';
export type { AuthRouterOptions, AuthRouterResult } from './lib/http/auth-router';
export { UserStore } from './lib/store/user-store';
export type { User } from './lib/store/user-store';
