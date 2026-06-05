import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const count = await prisma.user.count()
    if (count > 0)
      return NextResponse.json({ error: 'Setup already completed' }, { status: 403 })

    const { name, phone, descriptor } = await request.json()
    if (!name || !phone || !Array.isArray(descriptor) || descriptor.length !== 128)
      return NextResponse.json({ error: 'Invalid setup data' }, { status: 400 })

    const admin = await prisma.user.create({
      data: { name, phone, role: 'ADMIN', faceDescriptor: descriptor },
    })
    const token = signToken({ userId: admin.id, role: 'ADMIN' })
    const response = NextResponse.json({ token, user: { id: admin.id, name: admin.name, role: admin.role } })
    response.cookies.set('lt_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 28800,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('setup error:', err)
    return NextResponse.json({ error: 'Server error — check database connection' }, { status: 500 })
  }
}
