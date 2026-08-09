import type { Request } from 'express';
export declare function regenerateSession(req: Request, userData: {
    username: string;
}): Promise<void>;
export declare function destroySession(req: Request): Promise<void>;
//# sourceMappingURL=session-utils.d.ts.map