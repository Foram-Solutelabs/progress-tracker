import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'

export type JWTPayload = {
  userId: string
  role: 'ADMIN' | 'USER'
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' })
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, SECRET) as JWTPayload
}

// requireAuth handles two paths:
// 1. Browser fetch from client components — middleware injects x-user-id/x-user-role headers
// 2. Extension API calls — sends Authorization: Bearer <token>
export function requireAuth(
  request: Request,
  requiredRole?: 'ADMIN' | 'USER'
): JWTPayload | Response {
  // Path 1: middleware-authenticated (browser fetch, cookie already validated)
  const userId = request.headers.get('x-user-id')
  const role = request.headers.get('x-user-role') as 'ADMIN' | 'USER' | null
  if (userId && role) {
    if (requiredRole === 'ADMIN' && role !== 'ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    return { userId, role }
  }

  // Path 2: direct Bearer token (extension)
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const token = authHeader.slice(7)
    const payload = verifyToken(token)
    if (requiredRole === 'ADMIN' && payload.role !== 'ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    return payload
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }
}
