/*
Archivo: assets/js/auth.js
Proyecto: PREDIKT™
Versión: v1.0.0
Fecha: 2026-06-08
Elaborado por: JVSys™
Descripción: Motor frontend de autenticación PREDIKT™ con registro, login, logout, sesión persistente y protección de páginas.
Líneas versión anterior: 0 — archivo nuevo
Líneas versión nueva: 231
*/

(function () {
  'use strict';

  const AUTH = {
    loginPage: 'login.html',
    registerPage: 'registro.html',
    profilePage: 'perfil.html',
    homePage: 'index.html'
  };

  function getClient() {
    if (!window.PREDIKT_SUPABASE_READY || !window.prediktSupabase) {
      showAuthMessage('No se ha configurado Supabase correctamente.', 'error');
      return null;
    }
    return window.prediktSupabase;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function cleanText(value) {
    return String(value || '').trim();
  }

  function showAuthMessage(message, type) {
    const box = $('authMessage');
    if (!box) return;
    box.textContent = message || '';
    box.className = 'auth-message ' + (type || 'info');
    box.style.display = message ? 'block' : 'none';
  }

  function setButtonLoading(button, isLoading, loadingText, normalText) {
    if (!button) return;
    button.disabled = !!isLoading;
    button.textContent = isLoading ? loadingText : normalText;
  }

  function normalizeRedirect(path) {
    if (!path) return AUTH.profilePage;
    if (path.includes('http://') || path.includes('https://')) return AUTH.profilePage;
    return path;
  }

  async function getCurrentSession() {
    const client = getClient();
    if (!client) return null;

    const { data, error } = await client.auth.getSession();
    if (error) {
      console.error('PREDIKT™ Auth getSession error:', error);
      return null;
    }

    return data && data.session ? data.session : null;
  }

  async function getCurrentUser() {
    const client = getClient();
    if (!client) return null;

    const { data, error } = await client.auth.getUser();
    if (error) {
      console.error('PREDIKT™ Auth getUser error:', error);
      return null;
    }

    return data && data.user ? data.user : null;
  }

  async function createOrUpdateUserProfile(user, profileInput) {
    const client = getClient();
    if (!client || !user) return { ok: false, error: 'Usuario no disponible.' };

    const alias = cleanText(profileInput.alias) || cleanText(user.email).split('@')[0];
    const fullName = cleanText(profileInput.fullName) || alias;

    const payload = {
      id: user.id,
      email: user.email,
      alias: alias,
      full_name: fullName,
      avatar_url: profileInput.avatarUrl || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await client
      .schema('core')
      .from('user_profiles')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('PREDIKT™ Profile upsert error:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  }

  async function registerUser(event) {
    event.preventDefault();

    const client = getClient();
    if (!client) return;

    const button = $('registerButton');
    const fullName = cleanText($('fullName') && $('fullName').value);
    const alias = cleanText($('alias') && $('alias').value);
    const email = cleanText($('email') && $('email').value).toLowerCase();
    const password = cleanText($('password') && $('password').value);
    const confirmPassword = cleanText($('confirmPassword') && $('confirmPassword').value);

    if (!fullName || !alias || !email || !password || !confirmPassword) {
      showAuthMessage('Completa todos los campos para crear tu cuenta.', 'error');
      return;
    }

    if (password.length < 6) {
      showAuthMessage('La contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showAuthMessage('Las contraseñas no coinciden.', 'error');
      return;
    }

    setButtonLoading(button, true, 'Creando cuenta...', 'Crear mi cuenta');
    showAuthMessage('', 'info');

    const { data, error } = await client.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: fullName,
          alias: alias
        },
        emailRedirectTo: window.location.origin + '/' + AUTH.profilePage
      }
    });

    if (error) {
      setButtonLoading(button, false, 'Creando cuenta...', 'Crear mi cuenta');
      showAuthMessage(error.message || 'No fue posible crear la cuenta.', 'error');
      return;
    }

    if (data && data.user) {
      await createOrUpdateUserProfile(data.user, {
        fullName: fullName,
        alias: alias,
        avatarUrl: null
      });
    }

    showAuthMessage('Cuenta creada. Si Supabase solicita confirmación, revisa tu correo. Si no, entraremos directo a tu perfil.', 'success');

    setTimeout(function () {
      window.location.href = AUTH.profilePage;
    }, 1200);
  }

  async function loginUser(event) {
    event.preventDefault();

    const client = getClient();
    if (!client) return;

    const button = $('loginButton');
    const email = cleanText($('email') && $('email').value).toLowerCase();
    const password = cleanText($('password') && $('password').value);
    const redirect = normalizeRedirect(new URLSearchParams(window.location.search).get('redirect'));

    if (!email || !password) {
      showAuthMessage('Escribe tu correo y contraseña.', 'error');
      return;
    }

    setButtonLoading(button, true, 'Entrando...', 'Entrar');
    showAuthMessage('', 'info');

    const { error } = await client.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      setButtonLoading(button, false, 'Entrando...', 'Entrar');
      showAuthMessage(error.message || 'No fue posible iniciar sesión.', 'error');
      return;
    }

    window.location.href = redirect;
  }

  async function logoutUser() {
    const client = getClient();
    if (!client) return;

    await client.auth.signOut();
    window.location.href = AUTH.loginPage;
  }

  async function requireAuth() {
    const session = await getCurrentSession();
    if (!session) {
      const currentPage = window.location.pathname.split('/').pop() || AUTH.homePage;
      window.location.href = AUTH.loginPage + '?redirect=' + encodeURIComponent(currentPage);
      return null;
    }
    return session;
  }

  async function redirectIfAuthenticated(targetPage) {
    const session = await getCurrentSession();
    if (session) {
      window.location.href = targetPage || AUTH.profilePage;
    }
  }

  window.PrediktAuth = {
    registerUser: registerUser,
    loginUser: loginUser,
    logoutUser: logoutUser,
    requireAuth: requireAuth,
    redirectIfAuthenticated: redirectIfAuthenticated,
    getCurrentSession: getCurrentSession,
    getCurrentUser: getCurrentUser,
    createOrUpdateUserProfile: createOrUpdateUserProfile,
    showAuthMessage: showAuthMessage
  };
})();

/*
Cierre de archivo
Versión: v1.0.0
Fecha: 2026-06-08
Total de líneas: 231
*/

