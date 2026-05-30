import { signToken, verifyToken, requireAuth } from '@/lib/auth'

describe('auth', () => {
  const payload = { userId: 'abc-123', role: 'USER' as const }

  test('signToken returns a string', () => {
    const token = signToken(payload)
    expect(typeof token).toBe('string')
    expect(token.split('.').length).toBe(3)
  })

  test('verifyToken returns original payload', () => {
    const token = signToken(payload)
    const result = verifyToken(token)
    expect(result.userId).toBe(payload.userId)
    expect(result.role).toBe(payload.role)
  })

  test('verifyToken throws on invalid token', () => {
    expect(() => verifyToken('bad.token.here')).toThrow()
  })

  test('requireAuth returns payload for valid Bearer token', () => {
    const token = signToken(payload)
    const req = new Request('http://localhost', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const result = requireAuth(req)
    expect(result).not.toBeInstanceOf(Response)
    if (!(result instanceof Response)) {
      expect(result.userId).toBe(payload.userId)
    }
  })

  test('requireAuth returns payload from middleware-set headers (browser fetch path)', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-user-id': 'abc-123', 'x-user-role': 'USER' }
    })
    const result = requireAuth(req)
    expect(result).not.toBeInstanceOf(Response)
    if (!(result instanceof Response)) {
      expect(result.userId).toBe('abc-123')
      expect(result.role).toBe('USER')
    }
  })

  test('requireAuth returns 401 Response for missing token', () => {
    const req = new Request('http://localhost')
    const result = requireAuth(req)
    expect(result).toBeInstanceOf(Response)
    if (result instanceof Response) {
      expect(result.status).toBe(401)
    }
  })

  test('requireAuth returns 403 for non-admin accessing admin route', () => {
    const token = signToken({ userId: 'abc', role: 'USER' })
    const req = new Request('http://localhost', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const result = requireAuth(req, 'ADMIN')
    expect(result).toBeInstanceOf(Response)
    if (result instanceof Response) {
      expect(result.status).toBe(403)
    }
  })
})
