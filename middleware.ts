const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://social-network-mzdhoa71p-ptanh05s-projects.vercel.app',
  'https://social-network-5emiiq1c9-ptanh05s-projects.vercel.app',
  'https://frontend-delta-bice-22.vercel.app',
  'https://frontend-jds2yl23u-ptanh05s-projects.vercel.app',
  'https://frontend-2pmqjxpmt-ptanh05s-projects.vercel.app',
  'https://social-network-aplqf0k.onrender.com',
  'https://api-roan-rho-71.vercel.app',
  'https://social-network-g68stlz7u-ptanh05s-projects.vercel.app',
];

export const config = {
  matcher: ['/api/:path*'],
};

export function middleware(request: Request) {
  const origin = request.headers.get('origin') ?? '';

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return;
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  return;
}
