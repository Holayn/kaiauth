/**
 * Regenerate the session, set user data, and save.
 * Wraps the callback-based express-session API in a Promise.
 *
 * @param {object} req      – Express request
 * @param {object} userData – Data to store on req.session.user
 * @returns {Promise<void>}
 */
function regenerateSession(req, userData) {
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

/**
 * Clear session user data, save, and regenerate.
 * Guards against session fixation on logout.
 *
 * @param {object} req – Express request
 * @returns {Promise<void>}
 */
function destroySession(req) {
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

module.exports = { regenerateSession, destroySession };
