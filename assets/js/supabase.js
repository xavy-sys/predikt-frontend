/*
Archivo: assets/js/supabase.js
Proyecto: PREDIKT™
Versión: v1.0.0
Fecha: 2026-06-08
Elaborado por: JVSys™
Descripción: Configuración central del cliente Supabase para autenticación y acceso seguro desde frontend.
Líneas versión anterior: 0 — archivo nuevo
Líneas versión nueva: 65
*/

(function () {
  'use strict';

  const PREDIKT_SUPABASE_URL = 'https://bhsffngulgvwfzjhiymy.supabase.co';

  /*
    IMPORTANTE:
    Sustituir este valor por tu anon public key real de Supabase.
    Ruta en Supabase:
    Project Settings → API → Project API keys → anon public
  */
  const PREDIKT_SUPABASE_ANON_KEY = 'https://bhsffngulgvwfzjhiymy.supabase.co';

  function validateSupabaseConfig() {
    if (!PREDIKT_SUPABASE_URL || !PREDIKT_SUPABASE_URL.startsWith('https://')) {
      console.error('PREDIKT™ Auth: URL de Supabase inválida.');
      return false;
    }

    if (
      !PREDIKT_SUPABASE_ANON_KEY ||
      PREDIKT_SUPABASE_ANON_KEY === 'sb_publishable_Qu_KGmlGUI_5sHjacGooDg_HlNqqaPJ'
    ) {
      console.error('PREDIKT™ Auth: falta configurar la anon public key de Supabase.');
      return false;
    }

    return true;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('PREDIKT™ Auth: no se cargó la librería oficial de Supabase.');
    window.PREDIKT_SUPABASE_READY = false;
    return;
  }

  if (!validateSupabaseConfig()) {
    window.PREDIKT_SUPABASE_READY = false;
    return;
  }

  window.PREDIKT_SUPABASE_READY = true;
  window.prediktSupabase = window.supabase.createClient(
    PREDIKT_SUPABASE_URL,
    PREDIKT_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();

/*
Cierre de archivo
Versión: v1.0.0
Fecha: 2026-06-08
Total de líneas: 65
*/

