const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://social-network-api-seven.vercel.app',
  'https://social-network-aplqf0k.onrender.com',
];

export const config = {
  matcher: '/api/:path*',
};

export function middleware(request: Request) {
  const origin = request.headers.get('origin') ?? '';

  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[2]; // fallback to production

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };

  // Handle preflight OPTIONS
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Add CORS headers to normal responses
  const response = new Response(null, { status: 200 });
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}
