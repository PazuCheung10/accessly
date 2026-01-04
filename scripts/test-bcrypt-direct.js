import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

;(async () => {
  try {
    console.log('🧪 Direct bcrypt test (ESM, no NextAuth)')
    console.log('🧬 Prisma client version:', prisma._clientVersion ?? 'unknown')

    const user = await prisma.user.findUnique({
      where: { email: 'admin@solace.com' },
      select: { email: true, password: true },
    })

    if (!user?.password) {
      console.log('❌ User not found or missing password')
      return
    }

    console.log('✅ User found:', user.email)
    console.log('🔐 Hash prefix:', user.password.slice(0, 20))
    console.log('🔐 Hash length:', user.password.length)

    const testPassword = 'demo123'
    console.log('\n🧪 Testing bcrypt.compare("demo123", hash)')
    console.log('🔑 Raw password received:', JSON.stringify(testPassword))
    console.log('🔑 Password length:', testPassword?.length)
    
    const result = await bcrypt.compare(testPassword, user.password)
    console.log('🔐 Result:', result ? '✅ TRUE' : '❌ FALSE')

    if (!result) {
      console.log('\n🧪 Sanity check: new hash')
      const newHash = await bcrypt.hash('demo123', 10)
      const sanity = await bcrypt.compare('demo123', newHash)
      console.log('🔐 New hash compare:', sanity ? '✅ TRUE' : '❌ FALSE')
    }

  } catch (e) {
    console.error('❌ Error:', e)
  } finally {
    await prisma.$disconnect()
  }
})()
