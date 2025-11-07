import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

export async function GET() {
  const msg = Prisma.dmmf.datamodel.models.find(m => m.name === 'Message')
  return NextResponse.json({
    fields: msg?.fields.map(f => f.name),
    prismaVersion: Prisma.prismaVersion.client,
    hasDeletedAt: msg?.fields.some(f => f.name === 'deletedAt'),
    hasReactions: msg?.fields.some(f => f.name === 'reactions'),
    hasEditedAt: msg?.fields.some(f => f.name === 'editedAt'),
  })
}

