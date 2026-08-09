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

  const setError = (el, message) => {
    el.textContent = message || '';
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
    setError(loginError, '');
    setBusy(loginForm, true);
    try {
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const { ok, data } = await postJson('/auth', { username, password });

      if (!ok) {
        setError(loginError, 'Something went wrong. Please try again.');
        return;
      }

      if (data?.twoFA) {
        loginForm.classList.add('hidden');
        document.getElementById('twofa-form').classList.remove('hidden');
        document.getElementById('twoFACode').focus();
        return;
      }

      if (data?.success === false) {
        setError(loginError, data.reason === 'Locked out'
          ? 'Too many failed attempts. Try again later.'
          : 'Invalid username or password.');
        return;
      }

      location.href = redirectTo;
    } catch {
      setError(loginError, 'Something went wrong. Please try again.');
    } finally {
      setBusy(loginForm, false);
    }
  });

  const twoFAForm = document.getElementById('twofa-form');
  const twoFAError = document.getElementById('twofa-error');

  twoFAForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    setError(twoFAError, '');
    setBusy(twoFAForm, true);
    try {
      const twoFACode = document.getElementById('twoFACode').value;
      const { ok, data } = await postJson('/auth/2fa', { twoFACode });

      if (!ok) {
        setError(twoFAError, 'Something went wrong. Please try again.');
        return;
      }

      if (data?.success === false) {
        setError(twoFAError, 'Invalid code.');
        return;
      }

      location.href = redirectTo;
    } catch {
      setError(twoFAError, 'Something went wrong. Please try again.');
    } finally {
      setBusy(twoFAForm, false);
    }
  });
})();
