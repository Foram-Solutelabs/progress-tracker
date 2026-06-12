import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC = ['/login', '/setup', '/api/auth/']

// Middleware runs in Edge Runtime — jsonwebtoken (Node.js crypto) is unavailable here.
// We base64-decode the JWT payload only for routing decisions; API routes re-verify the
// signature using jsonwebtoken in Node.js runtime before trusting any data.
function decodeJWTPayload(token: string): { userId: string; role: string; exp: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((parts[1].length % 4) || 4)
    const payload = JSON.parse(atob(padded))
    if (!payload.userId || !payload.role) return null
    if (payload.exp && payload.exp < Date.now() / 1000) return null
    return payload
  } catch {
    return null
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const origin = request.headers.get('Origin') ?? '*'

  // CORS preflight — browsers strip Authorization before sending OPTIONS,
  // so we must respond here before any auth check; a redirect would fail preflight.
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    return new NextResponse(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': origin, ...CORS_HEADERS },
    })
  }

  if (PUBLIC.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Extension calls /api/* with Bearer token (no cookie) — let route handlers validate
  if (pathname.startsWith('/api/') && request.headers.get('Authorization')?.startsWith('Bearer ')) {
    const res = NextResponse.next()
    res.headers.set('Access-Control-Allow-Origin', origin)
    return res
  }

  const token = request.cookies.get('lt_token')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const payload = decodeJWTPayload(token)
  if (!payload) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname.startsWith('/admin') && payload.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const headers = new Headers(request.headers)
  headers.set('x-user-id', payload.userId)
  headers.set('x-user-role', payload.role)

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|models/).*)'],
}
