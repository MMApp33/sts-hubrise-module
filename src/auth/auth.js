import { jwtVerify, importSPKI } from 'jose';
export function getTokenFromHeader(headers) {
  const authHeader = headers.get('Authorization');
  return authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
}

export function turnstileTokenHeader(headers) {
  const turnstileToken = headers.get('turnstileToken');
  return turnstileToken;
}

export async function validateToken(token, env, issuer, audience) {
  if (!token) 
    {
    return { status: 401, error: 'Token not provided' };
  }
  if (!env.EC_PUBLIC_KEY_PEM) {
    console.error("EC_PUBLIC_KEY_PEM is not set in environment variables for token validation.");
    // Returning a 500 status as this is a server configuration issue.
    return { status: 500, error: "Server configuration error: Public key not found." }; 
  }
  try {
    const publicKey = await importSPKI(env.EC_PUBLIC_KEY_PEM, 'ES256');
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: issuer,
      audience: audience,
      algorithms: ['ES256'], // Explicitly state the expected algorithm
    });
    return payload; // Contains the decoded token payload
  } catch (err) {
    console.error("Token validation error (importSPKI or jwtVerify):", err);
    return { status: 401, error: err.message }; // Return an object indicating failure
  }
}

// Main authentication function to be called from handleRequest
export async function authenticateRequest(request, routeAuthType, env, getCorsHeaders) {
  let authData = null;
  if (routeAuthType === 'turnstile') {
    const turnstileToken = turnstileTokenHeader(request.headers);
    if (!turnstileToken) {
      return {
        response: new Response(JSON.stringify({ error: 'Turnstile token missing' }), {
          status: 403, headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
        })
      };
    }
    const resp = await fetch(env.TURNSTILE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: turnstileToken }),
    });
    const result = await resp.json();
    if (!result.success) {
      return {
        response: new Response(JSON.stringify({ error: 'Invalid Turnstile token', details: result }), {
          status: 403, headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
        })
      };
    }
  } else if (routeAuthType === 'token') {
    const accessToken = await getAuthenticationToken(request, env);
    const decoded = await validateToken(accessToken, env, env.TOKEN_ISSUER, env.TOKEN_AUDIANCE);
    if (decoded.status === 401) {
      return {
        response: new Response(JSON.stringify({ error: decoded.error || 'Invalid token', details: decoded.details }), {
          status: 401, headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
        })
      };
    }
    else
    {
      // License validation
          const licenceValidity = decoded.userClaims.LicenceValidity;
          const currentDate = Math.floor(Date.now() / 1000);
          const expiryDate = licenceValidity ? licenceValidity : null;
      
         if (!expiryDate || expiryDate <= currentDate) {
              return {
                response: new Response(
                    JSON.stringify({ error: "License expired or missing. Please purchase a plan." }),
                    { status: 403, headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' } }
                )
              };
          }
    }
    authData = decoded;
  }
  return { authData }; // Returns authData or an error response object
}

export async function getAuthenticationToken(request, env) {
  let token = null;

  // Always try to get token from HttpOnly cookie first
  token = getCookie(request, 'accessToken');

  // If in development and token not found in cookie, try Authorization header
  if (!token && env.APP_ENV !== 'production') {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer '
    }
    else{
      token =authHeader;
    }
  }
  return token;
}


export function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.trim().split('=');
    if (cookieName === name) {
      const cookieValue = rest.join('=');
      return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
  }
  return null;
}
