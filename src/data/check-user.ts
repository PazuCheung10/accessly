import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking user: admin@solace.com\n')
  
  const user = await prisma.user.findUnique({
    where: { email: 'admin@solace.com' },
  })

  if (!user) {
    console.log('❌ User not found in database')
    return
  }

  console.log('✅ User found:')
  console.log(`   ID: ${user.id}`)
  console.log(`   Email: ${user.email}`)
  console.log(`   Name: ${user.name}`)
  console.log(`   Role: ${user.role}`)
  console.log(`   Has password: ${user.password ? 'Yes' : 'No'}`)
  
  if (user.password) {
    const testPassword = 'demo123'
    const isValid = await bcrypt.compare(testPassword, user.password)
    console.log(`   Password 'demo123' matches: ${isValid ? '✅ Yes' : '❌ No'}`)
    
    if (!isValid) {
      console.log('\n⚠️  Password mismatch! Re-hashing password...')
      const newHash = await bcrypt.hash(testPassword, 10)
      await prisma.user.update({
        where: { id: user.id },
        data: { password: newHash },
      })
      console.log('✅ Password updated!')
    }
  } else {
    console.log('\n⚠️  No password set! Setting password...')
    const hash = await bcrypt.hash('demo123', 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash },
    })
    console.log('✅ Password set!')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

