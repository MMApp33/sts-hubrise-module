export function getCorsHeaders(request) {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://scantoserve.com',
    'https://dev.scantoserve.com',
    'https://www.scantoserve.com'
  ];
  const origin = request.headers.get('Origin');
  if (allowedOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Turnstile-Token, X-Code-Token,turnstileToken,code',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
    };
  }
  // Default CORS headers if origin is not allowed or not present
  return {
    'Access-Control-Allow-Origin': 'https://scantoserve.com', // Default to a restrictive origin
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Turnstile-Token, X-Code-Token,turnstileToken,code',
    'Access-Control-Allow-Credentials': 'true'
  };
}
export function generateCode() {
  const length = 6;
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
