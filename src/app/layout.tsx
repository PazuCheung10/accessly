import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/AuthProvider'
import { Navbar } from '@/components/Navbar'
import { ToasterWrapper } from '@/components/ToasterWrapper'
import { ErrorBoundaryWrapper } from '@/components/common/ErrorBoundaryWrapper'
import '@/styles/globals.css'

// Sentry client config is automatically loaded by Next.js from root (sentry.client.config.ts)
// No manual import needed - Next.js handles it automatically

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
          <ErrorBoundaryWrapper errorBoundaryName="RootLayout">
            <div className="flex flex-col h-screen">
              <Navbar />
              <main className="flex-1 min-h-0 overflow-y-auto" role="main">
                {children}
              </main>
              <ToasterWrapper />
            </div>
          </ErrorBoundaryWrapper>
        </AuthProvider>
      </body>
    </html>
  )
}