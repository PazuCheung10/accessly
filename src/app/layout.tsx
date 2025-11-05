import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/AuthProvider'
import { Navbar } from '@/components/Navbar'
import { ToasterWrapper } from '@/components/ToasterWrapper'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Accessly',
  description: 'Secure, role-based login → realtime chat → SSR dashboard data',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-slate-950 text-white antialiased`}>
        <AuthProvider>
          <div className="flex flex-col h-screen">
            <Navbar />
            <main className="flex-1 min-h-0 overflow-hidden" role="main">
              {children}
            </main>
            <ToasterWrapper />
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}