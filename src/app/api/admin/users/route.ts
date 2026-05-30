import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function POST(request: Request) {
  const auth = requireAuth(request, 'ADMIN')
  if (auth instanceof Response) return auth
  const { name, phone, descriptor } = await request.json()
  if (!name || !phone || !Array.isArray(descriptor) || descriptor.length !== 128)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  const user = await prisma.user.create({
    data: { name, phone, role: 'USER', faceDescriptor: descriptor },
    select: { id: true, name: true, phone: true, role: true, createdAt: true },
  })
  return NextResponse.json({ user }, { status: 201 })
}

export async function GET(request: Request) {
  const auth = requireAuth(request, 'ADMIN')
  if (auth instanceof Response) return auth
  const users = await prisma.user.findMany({
    select: { id: true, name: true, phone: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ users })
}
