import type { Request } from 'express';

export function regenerateSession(req: Request, userData: { username: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenErr) => {
      if (regenErr) return reject(regenErr);
      req.session.user = userData;
      req.session.save((saveErr) => {
        if (saveErr) return reject(saveErr);
        resolve();
      });
    });
  });
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.user = null;
    req.session.save((saveErr) => {
      if (saveErr) return reject(saveErr);
      req.session.regenerate((regenErr) => {
        if (regenErr) return reject(regenErr);
        resolve();
      });
    });
  });
}
