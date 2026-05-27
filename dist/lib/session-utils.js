"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regenerateSession = regenerateSession;
exports.destroySession = destroySession;
function regenerateSession(req, userData) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((regenErr) => {
            if (regenErr)
                return reject(regenErr);
            req.session.user = userData;
            req.session.save((saveErr) => {
                if (saveErr)
                    return reject(saveErr);
                resolve();
            });
        });
    });
}
function destroySession(req) {
    return new Promise((resolve, reject) => {
        req.session.user = null;
        req.session.save((saveErr) => {
            if (saveErr)
                return reject(saveErr);
            req.session.regenerate((regenErr) => {
                if (regenErr)
                    return reject(regenErr);
                resolve();
            });
        });
    });
}
//# sourceMappingURL=session-utils.js.map