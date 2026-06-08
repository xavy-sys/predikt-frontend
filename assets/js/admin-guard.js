/*
===============================================================================
Archivo: admin-guard.js
Proyecto: PREDIKT™
Versión: 1.0.0
Fecha: 2026-06-08
Elaborado por: JVSys
Descripción:
  Guardia Admin Real para pantallas administrativas de PREDIKT™.

Uso:
  1. Guardar este archivo como:
     assets/js/admin-guard.js

  2. Cargar Supabase antes de este archivo:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

  3. Cargar este archivo después de Supabase:
     <script src="assets/js/admin-guard.js"></script>

  4. En cada pantalla admin ejecutar:
     <script>
       document.addEventListener("DOMContentLoaded", async () => {
         await PrediktAdminGuard.requireAdminAccess();
       });
     </script>

Protege:
  - dashboard-admin.html
  - usuarios.html
  - pronosticos-admin.html
  - partidos-admin.html
  - ranking-admin.html

Nota importante:
  Esta guardia protege la interfaz.
  La protección real de datos debe complementarse con RLS en Supabase.
===============================================================================
*/

(function () {
  "use strict";

  /*
  ---------------------------------------------------------------------------
  CONFIGURACIÓN SUPABASE
  ---------------------------------------------------------------------------
  IMPORTANTE:
  Reemplaza SUPABASE_ANON_KEY con tu anon public key real.

  Nunca pongas aquí service_role key.
  Nunca subas service_role key al frontend.
  ---------------------------------------------------------------------------
  */

  const SUPABASE_URL = "https://bhsffngulgvwfzjhiymy.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_Qu_KGmlGUI_5sHjacGooDg_HlNqqaPJ";

  const LOGIN_PAGE = "login.html";
  const UNAUTHORIZED_MESSAGE = "Acceso administrativo no autorizado.";

  const ALLOWED_ROLES = ["master_admin", "super_admin", "admin", "directivo"];

  let supabaseClient = null;

  function getSupabaseClient() {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase JS no está cargado. Carga @supabase/supabase-js antes de admin-guard.js.");
    }

    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    return supabaseClient;
  }

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
            Redirigiendo a inicio de sesión...
          </p>
        </section>
      </main>
    `;
    showPage();
  }

  async function redirectUnauthorized(message = UNAUTHORIZED_MESSAGE) {
    try {
      const client = getSupabaseClient();
      await client.auth.signOut();
    } catch (error) {
      console.warn("No se pudo cerrar sesión automáticamente:", error);
    }

    buildBlockedScreen(message);

    window.setTimeout(() => {
      window.location.href = LOGIN_PAGE;
    }, 1200);
  }

  async function getCurrentSession() {
    const client = getSupabaseClient();

    const { data, error } = await client.auth.getSession();

    if (error) {
      throw new Error("No se pudo validar la sesión.");
    }

    return data && data.session ? data.session : null;
  }

  async function getCurrentUser() {
    const client = getSupabaseClient();

    const { data, error } = await client.auth.getUser();

    if (error) {
      throw new Error("No se pudo validar el usuario.");
    }

    return data && data.user ? data.user : null;
  }

  async function getAdminPermissionByEmail(email) {
    const client = getSupabaseClient();

    const { data, error } = await client
      .schema("core")
      .from("admin_email_allowlist")
      .select("email, role, is_active")
      .eq("email", String(email || "").toLowerCase())
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      throw new Error("No se pudo consultar la autorización administrativa.");
    }

    return data;
  }

  async function requireAdminAccess() {
    hidePageImmediately();

    try {
      const session = await getCurrentSession();

      if (!session) {
        await redirectUnauthorized("Debes iniciar sesión para entrar a administración.");
        return false;
      }

      const user = await getCurrentUser();

      if (!user || !user.email) {
        await redirectUnauthorized("No se pudo validar tu usuario.");
        return false;
      }

      const permission = await getAdminPermissionByEmail(user.email);

      if (!permission || !permission.is_active) {
        await redirectUnauthorized(UNAUTHORIZED_MESSAGE);
        return false;
      }

      if (!ALLOWED_ROLES.includes(permission.role)) {
        await redirectUnauthorized(UNAUTHORIZED_MESSAGE);
        return false;
      }

      window.PREDIKT_ADMIN_USER = {
        id: user.id,
        email: user.email,
        role: permission.role
      };

      showPage();
      return true;
    } catch (error) {
      console.error("PREDIKT Admin Guard Error:", error);
      await redirectUnauthorized("No fue posible validar el acceso administrativo.");
      return false;
    }
  }

  async function getFounderStatusByEmail(email) {
    const client = getSupabaseClient();

    const { data, error } = await client
      .schema("core")
      .from("founder_email_allowlist")
      .select("display_name, email, founder_type, is_active")
      .eq("email", String(email || "").toLowerCase())
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.warn("No se pudo consultar fundador:", error);
      return null;
    }

    return data;
  }

  window.PrediktAdminGuard = {
    requireAdminAccess,
    redirectUnauthorized,
    getFounderStatusByEmail,
    getSupabaseClient
  };
})();

