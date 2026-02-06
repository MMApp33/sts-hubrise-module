import { authenticateRequest, validateToken } from './auth/auth.js';
import { routes } from './routes/router.js';
import { getCorsHeaders } from './utils/utils.js';


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Pre-flight OPTIONS request handling for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...getCorsHeaders(request),
          'Content-Type': 'application/json'
        }
      });
    }
    return handleRequest(request, env);
  }

};

async function handleRequest(request, env) {
  try {
    const url = new URL(request.url);
    const urlPath = url.pathname;

    // ✅ Handle CORS preflight requests first
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request)
      });
    }

    // 🔍 Match route
    const route = routes.find(r => urlPath === r.path);

    if (!route) {
      return new Response(JSON.stringify({ error: 'Path not found' }), {
        status: 404,
        headers: {
          ...getCorsHeaders(request),
          'Content-Type': 'application/json'
        }
      });
    }

    // 🔐 Authentication
    const authResult = await authenticateRequest(request, route.auth, env, getCorsHeaders);
    if (authResult.response) {
      const authHeaders = new Headers(authResult.response.headers);

      // ✅ Apply CORS headers safely
      const corsHeaders = getCorsHeaders(request);
      for (const [key, value] of Object.entries(corsHeaders)) {
        authHeaders.set(key, value);
      }

      return new Response(authResult.response.body, {
        status: authResult.response.status,
        headers: authHeaders
      });
    }

    // 🧠 Run route handler
    const authData = authResult.authData;
    const handlerResult = await route.handler(request, env, authData);

    // ✅ If the handler returned a Response
    if (handlerResult instanceof Response) {
      const finalHeaders = new Headers(handlerResult.headers);
      const corsHeaders = getCorsHeaders(request);

      for (const [key, value] of Object.entries(corsHeaders)) {
        finalHeaders.set(key, value);
      }

      return new Response(handlerResult.body, {
        status: handlerResult.status,
        headers: finalHeaders
      });
    }

    // 🧾 If the handler returned an object (not a Response)
    const jsonHeaders = new Headers(getCorsHeaders(request));
    jsonHeaders.set('Content-Type', 'application/json');

    return new Response(JSON.stringify(handlerResult, null, 2), {
      status: 200,
      headers: jsonHeaders
    });

  } catch (err) {
    console.error('Global error in handleRequest:', err.stack);

    const errorHeaders = new Headers(getCorsHeaders(request));
    errorHeaders.set('Content-Type', 'application/json');

    return new Response(JSON.stringify({
      error: 'An unexpected server error occurred',
      details: err.message
    }), {
      status: 500,
      headers: errorHeaders
    });
  }
}

