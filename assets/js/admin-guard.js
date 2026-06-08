/*
===============================================================================
Archivo: admin-guard.js
Proyecto: PREDIKT™
Versión: 1.0.2 WAR MODE
Fecha: 2026-06-08
Elaborado por: JVSys
Descripción:
  Guardia Admin temporal de guerra para pantallas administrativas de PREDIKT™.

  Esta versión valida la sesión local creada por admin-login.html mediante:
  - predikt_admin_beta_session
  - predikt_admin_last_page

  Objetivo:
  Evitar el bucle admin-login.html ⇄ dashboard-admin.html y permitir operación
  del Backoffice Beta antes del lanzamiento público del 10 de junio.

  Nota:
  Esta versión es operativa temporal. Después del lanzamiento debe migrarse a
  Supabase Auth + roles + RLS server-side.

Protege:
  - dashboard-admin.html
  - usuarios.html
  - pronosticos-admin.html
  - partidos-admin.html
  - ranking-admin.html
===============================================================================
*/

(function () {
  "use strict";

  const LOGIN_PAGE = "admin-login.html";
  const ADMIN_SESSION_KEY = "predikt_admin_beta_session";
  const ADMIN_LAST_PAGE_KEY = "predikt_admin_last_page";
  const UNAUTHORIZED_MESSAGE = "Acceso administrativo no autorizado.";

  function hidePageImmediately() {
    document.documentElement.style.visibility = "hidden";
    document.documentElement.style.opacity = "0";
  }

  function showPage() {
    document.documentElement.style.visibility = "visible";
    document.documentElement.style.opacity = "1";
  }

  function buildBlockedScreen(message) {
    document.body.innerHTML = `
      <main style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#07111f;
        color:#ffffff;
        font-family:Arial, Helvetica, sans-serif;
        padding:24px;
        text-align:center;
      ">
        <section style="
          max-width:420px;
          width:100%;
          border:1px solid rgba(255,255,255,.15);
          border-radius:22px;
          padding:28px;
          background:rgba(255,255,255,.06);
          box-shadow:0 20px 60px rgba(0,0,0,.35);
        ">
          <img
            src="assets/logos/predikt-logo.png"
            alt="PREDIKT™"
            style="width:86px;height:auto;margin-bottom:16px;"
          />
          <h1 style="font-size:22px;margin:0 0 10px;">PREDIKT™</h1>
          <p style="font-size:16px;line-height:1.5;margin:0 0 18px;color:#d7e3f5;">
            ${message}
          </p>
          <p style="font-size:13px;margin:0;color:#9fb2c9;">
            Redirigiendo al acceso administrativo...
          </p>
        </section>
      </main>
    `;
    showPage();
  }

  function getLocalAdminSession() {
    try {
      const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw);

      if (!session || session.ok !== true) return null;
      if (!session.expiresAt || Number(session.expiresAt) <= Date.now()) {
        clearAdminSession();
        return null;
      }

      return session;
    } catch (error) {
      clearAdminSession();
      return null;
    }
  }

  function clearAdminSession() {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    window.localStorage.removeItem(ADMIN_LAST_PAGE_KEY);
  }

  async function redirectUnauthorized(message = UNAUTHORIZED_MESSAGE) {
    clearAdminSession();
    buildBlockedScreen(message);

    window.setTimeout(() => {
      window.location.href = LOGIN_PAGE;
    }, 900);
  }

  async function requireAdminAccess() {
    hidePageImmediately();

    const session = getLocalAdminSession();

    if (!session) {
      await redirectUnauthorized("Debes iniciar sesión para entrar a administración.");
      return false;
    }

    window.localStorage.setItem(
      ADMIN_LAST_PAGE_KEY,
      window.location.pathname.split("/").pop() || "dashboard-admin.html"
    );

    window.PREDIKT_ADMIN_USER = {
      id: "beta-admin-local",
      email: "xve.montes@gmail.com",
      role: "master_admin",
      mode: "war_mode_local_pin",
      expiresAt: session.expiresAt
    };

    showPage();
    return true;
  }

  async function logoutAdmin() {
    clearAdminSession();
    window.location.href = LOGIN_PAGE;
  }

  async function redirectUnauthorizedPublic(message) {
    await redirectUnauthorized(message || UNAUTHORIZED_MESSAGE);
  }

  async function getFounderStatusByEmail(email) {
    return null;
  }

  function getSupabaseClient() {
    if (window.supabase && window.supabase.createClient) {
      return null;
    }
    return null;
  }

  window.PrediktAdminGuard = {
    requireAdminAccess,
    redirectUnauthorized: redirectUnauthorizedPublic,
    logoutAdmin,
    getFounderStatusByEmail,
    getSupabaseClient
  };
})();
