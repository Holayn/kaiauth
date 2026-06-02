import './types/express-session'; // Allow consumers to pick up express-session type augmentation.

export { createAuthRouter } from './lib/auth-router';
export type { AuthRouterOptions, AuthRouterResult } from './lib/auth-router';
export { UserStore } from './lib/user-store';
export type { User } from './lib/user-store';
