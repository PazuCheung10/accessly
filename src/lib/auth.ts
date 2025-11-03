import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Email from 'next-auth/providers/email'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import { Role } from '@prisma/client'
import { env } from './env'

const providers: Array<
  ReturnType<typeof GitHub> | ReturnType<typeof Email>
> = []

// Add GitHub provider if env vars are present
if (env.GITHUB_ID && env.GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: env.GITHUB_ID,
      clientSecret: env.GITHUB_SECRET,
    })
  )
}

// Add Email provider if env vars are present
if (env.EMAIL_SERVER && env.EMAIL_FROM) {
  providers.push(
    Email({
      server: env.EMAIL_SERVER,
      from: env.EMAIL_FROM,
    })
  )
}

// Ensure at least one provider is configured
if (providers.length === 0) {
  console.warn(
    '⚠️  No authentication providers configured. Please set GITHUB_ID/GITHUB_SECRET or EMAIL_SERVER/EMAIL_FROM'
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers,
  cookies: {
    sessionToken: {
      name: `${env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id
        session.user.role = (user as any).role as Role
      }
      return session
    },
  },
  pages: {
    signIn: '/sign-in',
    error: '/auth/error',
  },
})