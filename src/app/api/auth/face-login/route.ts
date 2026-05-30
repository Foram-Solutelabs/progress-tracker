import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import { findMatch } from '@/lib/face'

export async function POST(request: Request) {
  const body = await request.json()
  const descriptor: number[] = body.descriptor
  if (!Array.isArray(descriptor) || descriptor.length !== 128)
    return NextResponse.json({ error: 'Invalid descriptor' }, { status: 400 })
  const users = await prisma.user.findMany({ select: { id: true, name: true, role: true, faceDescriptor: true } })
  const matchId = findMatch(descriptor, users)
  if (!matchId) return NextResponse.json({ error: 'Face not recognised' }, { status: 401 })
  const user = users.find(u => u.id === matchId)!
  const token = signToken({ userId: user.id, role: user.role as 'ADMIN' | 'USER' })
  const response = NextResponse.json({ token, user: { id: user.id, name: user.name, role: user.role } })
  response.cookies.set('lt_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 28800, path: '/' })
  return response
}
