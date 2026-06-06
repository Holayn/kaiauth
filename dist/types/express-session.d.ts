import 'express-session';
declare module 'express-session' {
    interface SessionData {
        user?: {
            username: string;
        } | null;
    }
}
//# sourceMappingURL=express-session.d.ts.map