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

/**
 * Credentials Provider
 * 用於 email / password 登入
 */
providers.push(
  Credentials({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },

    async authorize(credentials) {
      try {
        console.log('🔍 Auth attempt started')

        /**
         * ✅ 最重要的 Debug：檢查實際收到的 password
         * （這一步就是整個案子的關鍵）
         */
        const rawPassword = credentials?.password
        console.log('🔑 Raw password received:', JSON.stringify(rawPassword))

        if (typeof rawPassword === 'string') {
          console.log('🔑 Password length:', rawPassword.length)
        } else {
          console.log('❌ Password is not a string:', typeof rawPassword)
          return null
        }

        if (!credentials?.email) {
          console.log('❌ Missing email')
          return null
        }

        /**
         * Normalize email
         */
        const normalizedEmail = (credentials.email as string).toLowerCase().trim()
        console.log('📧 Normalized email:', normalizedEmail)

        /**
         * 查 user
         */
        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        })

        if (!user || !user.password) {
          console.log('❌ User not found or no password:', normalizedEmail)
          return null
        }

        console.log('✅ User found:', user.email, 'Role:', user.role)
        console.log('🔐 Stored hash prefix:', user.password.substring(0, 7))
        console.log('🔐 Stored hash length:', user.password.length)

        /**
         * bcrypt compare
         */
        const isValid = await bcrypt.compare(rawPassword, user.password)
        console.log('🔐 bcrypt.compare result:', isValid)

        if (!isValid) {
          console.log('❌ Invalid password for:', normalizedEmail)
          return null
        }

        console.log('✅ Login successful for:', user.email)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        }
      } catch (error) {
        console.error('❌ Auth error:', error)
        return null
      }
    },
  })
)

/**
 * OAuth Providers（可選）
 */
if (env.GITHUB_ID && env.GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: env.GITHUB_ID,
      clientSecret: env.GITHUB_SECRET,
    })
  )
}

if (env.EMAIL_SERVER && env.EMAIL_FROM) {
  providers.push(
    Email({
      server: env.EMAIL_SERVER,
      from: env.EMAIL_FROM,
    })
  )
}

const hasOAuthProviders = providers.some(p => p.id !== 'credentials')

/**
 * NextAuth Config
 */
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
      }
      return token
    },

    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.sub as string
        session.user.role = token.role as Role
      }
      return session
    },
  },

  pages: {
    signIn: '/sign-in',
    error: '/auth/error',
  },
})