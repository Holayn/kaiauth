(() => {
  // The page is always served at ".../login" (optionally with a trailing
  // slash); strip that suffix to get the router's mount prefix so the
  // fetch calls below work no matter where the router is mounted.
  const base = location.pathname.replace(/\/login\/?$/, '');

  const redirectTo = (() => {
    const params = new URLSearchParams(location.search);
    const target = params.get('redirect');
    if (target && target.startsWith('/') && !target.startsWith('//')) {
      return target;
    }
    return '/';
  })();

  const setText = (el, message) => {
    el.textContent = message || '';
  };

  const CHANNEL_LABELS = {
    discord: 'Code was sent via Discord.',
    email: 'Code was sent to email.',
  };

  const setBusy = (form, busy) => {
    form.querySelector('button').disabled = busy;
  };

  const postJson = async (path, body) => {
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { /* not JSON */ }
    }
    return { ok: res.ok, data };
  };

  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');

  loginForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    setText(loginError, '');
    setBusy(loginForm, true);
    try {
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const { ok, data } = await postJson('/auth', { username, password });

      if (!ok) {
        setText(loginError, 'Something went wrong. Please try again.');
        return;
      }

      if (data?.twoFA) {
        resetTwoFAForm();
        loginForm.classList.add('hidden');
        twoFAForm.classList.remove('hidden');
        setText(twoFASentTo, CHANNEL_LABELS[data.channel]);
        resendEmailBtn.classList.toggle('hidden', !data.emailFallbackAvailable);
        document.getElementById('twoFACode').focus();
        return;
      }

      if (data?.success === false) {
        setText(loginError, data.reason === 'Locked out'
          ? 'Too many failed attempts. Try again later.'
          : 'Invalid username or password.');
        return;
      }

      location.href = redirectTo;
    } catch {
      setText(loginError, 'Something went wrong. Please try again.');
    } finally {
      setBusy(loginForm, false);
    }
  });

  const twoFAForm = document.getElementById('twofa-form');
  const twoFASentTo = document.getElementById('twofa-sent-to');
  const twoFAError = document.getElementById('twofa-error');
  const twoFAStatus = document.getElementById('twofa-status');
  const resendEmailBtn = document.getElementById('resend-email-btn');

  // Clears the 2FA form back to its pristine state — used both when a fresh challenge
  // starts (in case stale state lingers from a prior attempt on this same page load) and
  // when mustRetry sends the user back to the username/password form.
  const resetTwoFAForm = () => {
    document.getElementById('twoFACode').value = '';
    setText(twoFAError, '');
    setText(twoFAStatus, '');
    setText(twoFASentTo, '');
    resendEmailBtn.classList.add('hidden');
    setText(resendEmailBtn, 'Send code via email instead');
  };

  twoFAForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    setText(twoFAError, '');
    setBusy(twoFAForm, true);
    try {
      const twoFACode = document.getElementById('twoFACode').value;
      const { ok, data } = await postJson('/auth/2fa', { twoFACode });

      if (!ok) {
        setText(twoFAError, 'Something went wrong. Please try again.');
        return;
      }

      if (data?.success === false) {
        if (data.mustRetry) {
          resetTwoFAForm();
          twoFAForm.classList.add('hidden');
          loginForm.classList.remove('hidden');
          setText(loginError, 'Your session expired or had too many attempts. Please sign in again.');
          document.getElementById('password').value = '';
          document.getElementById('username').focus();
          return;
        }
        setText(twoFAError, 'Invalid code.');
        return;
      }

      location.href = redirectTo;
    } catch {
      setText(twoFAError, 'Something went wrong. Please try again.');
    } finally {
      setBusy(twoFAForm, false);
    }
  });

  resendEmailBtn.addEventListener('click', async () => {
    setText(twoFAError, '');
    setText(twoFAStatus, '');
    resendEmailBtn.disabled = true;
    try {
      const { ok, data } = await postJson('/auth/2fa/resend-email', {});
      if (ok && data?.success) {
        setText(twoFAStatus, 'Code sent via email.');
        setText(twoFASentTo, CHANNEL_LABELS[data.channel]);
        setText(resendEmailBtn, 'Resend code via email');
      } else {
        setText(twoFAStatus, 'Failed to send verification email.');
      }
    } catch {
      setText(twoFAStatus, 'Failed to send verification email.');
    } finally {
      resendEmailBtn.disabled = false;
    }
  });
})();
