/*
Archivo: assets/js/supabase.js
Proyecto: PREDIKT™
Versión: v1.1.0
Fecha: 2026-06-08
Elaborado por: JVSys™
Descripción: Configuración central robusta del cliente Supabase para autenticación desde frontend.
Líneas versión anterior: 65
Líneas versión nueva: 116

Cambios v1.1.0:
- Ya no depende de que login.html o registro.html carguen antes la librería oficial de Supabase.
- Carga automáticamente Supabase JS desde CDN si window.supabase no existe.
- Mantiene compatibilidad con window.prediktSupabase.
- Expone window.PREDIKT_SUPABASE_READY.
- Expone window.PREDIKT_SUPABASE_INIT_PROMISE para que auth.js espere la inicialización.
- Valida URL y Publishable Key actual de Supabase 2026.
*/

(function () {
  'use strict';

  const PREDIKT_SUPABASE_URL = 'https://bhsffngulgvwfzjhiymy.supabase.co';
  const PREDIKT_SUPABASE_ANON_KEY = 'sb_publishable_Qu_KGmlGUI_5sHjacGooDg_HlNqqaPJ';
  const SUPABASE_CDN_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

  window.PREDIKT_SUPABASE_READY = false;
  window.prediktSupabase = null;

  function logError(message, error) {
    console.error('PREDIKT™ Auth:', message, error || '');
  }

  function validateSupabaseConfig() {
    if (!PREDIKT_SUPABASE_URL || !PREDIKT_SUPABASE_URL.startsWith('https://')) {
      logError('URL de Supabase inválida.');
      return false;
    }

    if (!PREDIKT_SUPABASE_ANON_KEY) {
      logError('Falta configurar la Publishable Key de Supabase.');
      return false;
    }

    if (!PREDIKT_SUPABASE_ANON_KEY.startsWith('sb_publishable_')) {
      logError('La key configurada no parece ser una Publishable Key válida.');
      return false;
    }

    return true;
  }

  function loadSupabaseLibrary() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && typeof window.supabase.createClient === 'function') {
        resolve(window.supabase);
        return;
      }

      const existingScript = document.querySelector('script[data-predikt-supabase-cdn="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', function () {
          if (window.supabase && typeof window.supabase.createClient === 'function') {
            resolve(window.supabase);
          } else {
            reject(new Error('La librería Supabase cargó, pero createClient no está disponible.'));
          }
        });
        existingScript.addEventListener('error', function () {
          reject(new Error('No se pudo cargar la librería oficial de Supabase.'));
        });
        return;
      }

      const script = document.createElement('script');
      script.src = SUPABASE_CDN_URL;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-predikt-supabase-cdn', 'true');

      script.onload = function () {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
          resolve(window.supabase);
        } else {
          reject(new Error('La librería Supabase cargó, pero createClient no está disponible.'));
        }
      };

      script.onerror = function () {
        reject(new Error('No se pudo cargar la librería oficial de Supabase.'));
      };

      document.head.appendChild(script);
    });
  }

  async function initializeSupabaseClient() {
    try {
      if (!validateSupabaseConfig()) {
        window.PREDIKT_SUPABASE_READY = false;
        return null;
      }

      const supabaseLibrary = await loadSupabaseLibrary();

      window.prediktSupabase = supabaseLibrary.createClient(
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

      window.PREDIKT_SUPABASE_READY = true;
      window.dispatchEvent(new CustomEvent('predikt:supabase-ready'));
      console.info('PREDIKT™ Auth: Supabase inicializado correctamente.');
      return window.prediktSupabase;
    } catch (error) {
      window.PREDIKT_SUPABASE_READY = false;
      window.prediktSupabase = null;
      logError('No se pudo inicializar Supabase.', error);
      window.dispatchEvent(new CustomEvent('predikt:supabase-error', { detail: error }));
      return null;
    }
  }

  window.PREDIKT_SUPABASE_INIT_PROMISE = initializeSupabaseClient();
})();

/*
Cierre de archivo
Versión: v1.1.0
Fecha: 2026-06-08
Total de líneas: 116
*/
