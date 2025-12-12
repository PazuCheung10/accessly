import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SignUpInput = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(6).max(100),
})

/**
 * POST /api/auth/signup
 * Create a new user account (for external customers)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate input
    const validated = SignUpInput.safeParse(body)
    if (!validated.success) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: validated.error.errors,
      }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.data.email },
    })

    if (existingUser) {
      return Response.json({
        ok: false,
        code: 'USER_EXISTS',
        message: 'An account with this email already exists. Please sign in instead.',
      }, { status: 409 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validated.data.password, 10)

    // Create new user (external customer by default)
    const user = await prisma.user.create({
      data: {
        email: validated.data.email,
        name: validated.data.name,
        password: hashedPassword,
        role: Role.USER,
        department: null, // External customers have no department
        emailVerified: new Date(),
      },
    })

    return Response.json({
      ok: true,
      message: 'Account created successfully',
      data: {
        userId: user.id,
        email: user.email,
        name: user.name,
      },
    })
  } catch (error: any) {
    console.error('Error creating user:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to create account',
    }, { status: 500 })
  }
}

