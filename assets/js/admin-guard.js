/*
===============================================================================
Archivo: assets/js/admin-guard.js
Proyecto: PREDIKT™
Versión: 2.0.1 RPC ADMIN GUARD PRODUCTION
Fecha: 2026-06-09
Elaborado por: JVSys
Descripción:
  Guardia Admin de producción para pantallas administrativas de PREDIKT™.

  Esta versión corrige el problema detectado en v2.0.0:
    - Supabase REST no expone directamente el schema core desde el frontend.
    - El error PGRST106 impedía consultar core.admin_users con .schema("core").

  Solución v2.0.1:
    - El frontend NO consulta core.admin_users directamente.
    - El frontend llama una función RPC segura en schema public:
        public.predikt_current_admin_access()
    - La función SQL usa SECURITY DEFINER y valida auth.uid() contra core.admin_users.

  Valida acceso administrativo mediante:
    1. Supabase Auth real
    2. Sesión activa del usuario autenticado
    3. RPC pública segura
    4. core.admin_users interno
    5. role = SUPER_ADMIN o ADMIN
    6. is_active = true

  Bloquea:
    - usuarios no autenticados
    - USER
    - FOUNDER
    - roles nulos
    - administradores inactivos
    - acceso directo por URL sin sesión válida

  Protege:
    - dashboard-admin.html
    - usuarios.html
    - pronosticos-admin.html
    - partidos-admin.html
    - ranking-admin.html
    - pantallas administrativas futuras que invoquen PrediktAdminGuard.requireAdminAccess()

Líneas versión anterior: 294
Líneas versión nueva: 316
===============================================================================
*/

(function () {
  "use strict";

  const CONFIG = {
    supabaseUrl: "https://bhsffngulgvwfzjhiymy.supabase.co",
    supabaseKey: "sb_publishable_Qu_KGmlGUI_5sHjacGooDg_HlNqqaPJ",
    loginPage: "admin-login.html",
    homePage: "index.html",
    allowedRoles: ["SUPER_ADMIN", "ADMIN"],
    adminAccessRpc: "predikt_current_admin_access",
    legacySessionKeys: [
      "predikt_admin_beta_session",
      "predikt_admin_last_page"
    ]
  };

  const STATE = {
    client: null,
    currentUser: null,
    currentAdmin: null,
    lastError: null
  };

  function hidePageImmediately() {
    document.documentElement.style.visibility = "hidden";
    document.documentElement.style.opacity = "0";
  }

  function showPage() {
    document.documentElement.style.visibility = "visible";
    document.documentElement.style.opacity = "1";
    document.documentElement.classList.remove("admin-guard-pending");
  }

  function clearLegacyLocalAdminSession() {
    try {
      CONFIG.legacySessionKeys.forEach((key) => window.localStorage.removeItem(key));
    } catch (error) {
      console.warn("PREDIKT Admin Guard: no se pudo limpiar sesión local temporal.", error);
    }
  }

  function normalizeRole(role) {
    return String(role || "").trim().toUpperCase();
  }

  function getCurrentPageName() {
    return window.location.pathname.split("/").pop() || "dashboard-admin.html";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function buildBlockedScreen(title, message, actionLabel, actionHref) {
    document.body.innerHTML = `
      <main style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        background:
          radial-gradient(circle at top left, rgba(245,185,66,.14), transparent 30%),
          linear-gradient(145deg,#061826 0%,#020b13 100%);
        color:#ffffff;
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
        padding:24px;
        text-align:center;
      ">
        <section style="
          max-width:440px;
          width:100%;
          border:1px solid rgba(255,255,255,.14);
          border-radius:26px;
          padding:30px 24px;
          background:rgba(15,39,64,.88);
          box-shadow:0 24px 70px rgba(0,0,0,.42);
        ">
          <img
            src="assets/logos/predikt-logo.png"
            alt="PREDIKT™"
            style="width:88px;height:auto;margin-bottom:16px;border-radius:18px;"
          />
          <p style="
            color:#f5b942;
            font-size:12px;
            font-weight:900;
            letter-spacing:.08em;
            text-transform:uppercase;
            margin:0 0 8px;
          ">PREDIKT™ · Guardia Admin</p>
          <h1 style="font-size:23px;line-height:1.12;margin:0 0 12px;font-weight:950;">
            ${escapeHtml(title)}
          </h1>
          <p style="font-size:15px;line-height:1.55;margin:0 0 22px;color:#d7e3f5;">
            ${escapeHtml(message)}
          </p>
          <a href="${escapeHtml(actionHref)}" style="
            display:inline-flex;
            align-items:center;
            justify-content:center;
            min-height:44px;
            padding:0 18px;
            border-radius:999px;
            background:linear-gradient(135deg,#f5b942,#ffe28a);
            color:#061826;
            text-decoration:none;
            font-size:13px;
            font-weight:950;
            letter-spacing:.04em;
            text-transform:uppercase;
          ">${escapeHtml(actionLabel)}</a>
        </section>
      </main>
    `;
    showPage();
  }

  function getSupabaseClient() {
    if (STATE.client) {
      return STATE.client;
    }

    if (!window.supabase || !window.supabase.createClient) {
      STATE.lastError = "Supabase JS no está disponible en la página.";
      return null;
    }

    STATE.client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    });

    return STATE.client;
  }

  async function getAuthenticatedUser() {
    const client = getSupabaseClient();

    if (!client) {
      return null;
    }

    const { data, error } = await client.auth.getUser();

    if (error || !data || !data.user) {
      STATE.lastError = error ? error.message : "No existe sesión Supabase activa.";
      return null;
    }

    STATE.currentUser = data.user;
    return data.user;
  }

  async function fetchAdminRecordViaRpc() {
    const client = getSupabaseClient();

    if (!client) {
      return null;
    }

    const { data, error } = await client.rpc(CONFIG.adminAccessRpc);

    if (error) {
      STATE.lastError = error.message;
      console.error("PREDIKT Admin Guard: error consultando RPC admin.", error);
      return null;
    }

    const record = Array.isArray(data) ? data[0] : data;

    if (!record) {
      STATE.lastError = "Usuario autenticado sin autorización administrativa activa.";
      return null;
    }

    const role = normalizeRole(record.role);

    if (!CONFIG.allowedRoles.includes(role)) {
      STATE.lastError = `Rol no autorizado: ${role || "SIN_ROL"}`;
      return null;
    }

    if (record.is_active !== true) {
      STATE.lastError = "Administrador inactivo.";
      return null;
    }

    STATE.currentAdmin = {
      authUserId: record.auth_user_id,
      role,
      isActive: record.is_active === true,
      createdAt: record.created_at || null
    };

    return STATE.currentAdmin;
  }

  async function redirectToLogin(message) {
    buildBlockedScreen(
      "Sesión administrativa requerida",
      message || "Debes iniciar sesión con una cuenta autorizada para entrar a administración.",
      "Ir al acceso Admin",
      CONFIG.loginPage
    );

    window.setTimeout(() => {
      window.location.href = `${CONFIG.loginPage}?next=${encodeURIComponent(getCurrentPageName())}`;
    }, 900);
  }

  async function redirectUnauthorized(message) {
    buildBlockedScreen(
      "Acceso no autorizado",
      message || "Tu cuenta no tiene permisos administrativos activos para ver esta pantalla.",
      "Volver al inicio",
      CONFIG.homePage
    );
  }

  async function requireAdminAccess() {
    hidePageImmediately();
    clearLegacyLocalAdminSession();

    const user = await getAuthenticatedUser();

    if (!user) {
      await redirectToLogin("No encontramos una sesión activa de Supabase Auth.");
      return false;
    }

    const admin = await fetchAdminRecordViaRpc();

    if (!admin) {
      await redirectUnauthorized("Tu sesión existe, pero no está registrada como SUPER_ADMIN o ADMIN activo.");
      return false;
    }

    window.PREDIKT_ADMIN_USER = {
      id: user.id,
      email: user.email || "",
      role: admin.role,
      mode: "supabase_auth_rpc_production",
      isActive: admin.isActive,
      page: getCurrentPageName()
    };

    showPage();
    return true;
  }

  async function logoutAdmin() {
    const client = getSupabaseClient();
    clearLegacyLocalAdminSession();

    try {
      if (client && client.auth) {
        await client.auth.signOut();
      }
    } catch (error) {
      console.warn("PREDIKT Admin Guard: error al cerrar sesión Supabase.", error);
    }

    window.location.href = CONFIG.loginPage;
  }

  async function getFounderStatusByEmail(email) {
    if (!email) {
      return null;
    }

    return null;
  }

  function getGuardState() {
    return {
      currentUser: STATE.currentUser,
      currentAdmin: STATE.currentAdmin,
      lastError: STATE.lastError,
      allowedRoles: CONFIG.allowedRoles.slice(),
      mode: "supabase_auth_rpc_production"
    };
  }

  window.PrediktAdminGuard = {
    requireAdminAccess,
    redirectUnauthorized,
    logoutAdmin,
    getFounderStatusByEmail,
    getSupabaseClient,
    getGuardState
  };
})();
