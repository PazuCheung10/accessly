import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Email from 'next-auth/providers/email'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import { Role } from '@prisma/client'
import { env } from './env'
import bcrypt from 'bcryptjs'

const providers: Array<
  ReturnType<typeof GitHub> | ReturnType<typeof Email> | ReturnType<typeof Credentials>
> = []

// Credentials provider for email/password authentication
providers.push(
  Credentials({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      try {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Normalize email to lowercase (case-insensitive)
        const normalizedEmail = (credentials.email as string).toLowerCase().trim()

        // Find user in database
        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        })

        if (!user || !user.password) {
          return null
        }

        // Compare password with stored hash
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        }
      } catch (error) {
        console.error('Auth error:', error)
        return null
      }
    },
  })
)

// Add GitHub OAuth provider if configured
if (env.GITHUB_ID && env.GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: env.GITHUB_ID,
      clientSecret: env.GITHUB_SECRET,
    })
  )
}

// Add Email provider if configured
if (env.EMAIL_SERVER && env.EMAIL_FROM) {
  providers.push(
    Email({
      server: env.EMAIL_SERVER,
      from: env.EMAIL_FROM,
    })
  )
}

// Check if we have OAuth providers (need adapter)
const hasOAuthProviders = providers.some(p => p.id !== 'credentials')

// Configure NextAuth
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: hasOAuthProviders ? (PrismaAdapter(prisma) as any) : undefined,

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },

  providers,

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        token.role = (user as any).role ?? Role.USER
        token.image = (user as any).image ?? null
        token.name = (user as any).name ?? null
        token.email = (user as any).email ?? null
      }
      return token
    },

    async session({ session, token }) {
      if (session.user && token) {
        const user = session.user as {
          id: string
          email: string | null
          name: string | null
          image: string | null
          role: Role
        }
        user.id = token.sub as string
        user.role = token.role as Role
        user.image = (token.image as string | null) ?? null
        user.name = (token.name as string | null) ?? null
        user.email = (token.email as string | null) ?? null
      }
      return session
    },
  },

  pages: {
    signIn: '/sign-in',
    error: '/auth/error',
  },
})
