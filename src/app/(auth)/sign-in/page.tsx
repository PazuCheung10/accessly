'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function SignInPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [callbackUrl, setCallbackUrl] = useState('/')
  const [error, setError] = useState<string | null>(null)
  const [hasGitHub, setHasGitHub] = useState(false)
  const [hasEmail, setHasEmail] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showMagicLinkInput, setShowMagicLinkInput] = useState(false)
  const [magicLinkEmail, setMagicLinkEmail] = useState('')
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  useEffect(() => {
    // Parse search params from URL (client-side)
    const params = new URLSearchParams(window.location.search)
    const cb = params.get('callbackUrl') || '/'
    const err = params.get('error')
    const message = params.get('message')
    setCallbackUrl(cb)
    if (err) setError(err)
    if (message) {
      // Show success message if redirected from sign-up
      setError(null)
    }

    // Check for auth providers from environment (only on client)
    // In a real app, you'd fetch this from an API endpoint
    // For now, we'll assume providers are configured if we reach this page
    setHasGitHub(true) // Assume GitHub is configured
    setHasEmail(true) // Assume Email is configured
    setLoading(false)
  }, [])

  // Redirect authenticated users away from sign-in page
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // User is already logged in, redirect to callbackUrl or home
      const params = new URLSearchParams(window.location.search)
      const cb = params.get('callbackUrl') || '/'
      router.push(cb)
    }
  }, [status, session, router])

  // Show loading while checking session or if user is authenticated (will redirect)
  if (loading || status === 'loading' || (status === 'authenticated' && session?.user)) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    )
  }

  if (!hasGitHub && !hasEmail) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Sign In</h1>
          <p className="text-slate-400 mb-6">No authentication providers configured</p>
          <p className="text-sm text-slate-500">
            Please configure GITHUB_ID/GITHUB_SECRET or EMAIL_SERVER/EMAIL_FROM
          </p>
        </div>
      </div>
    )
  }

  const handleGitHubSignIn = () => {
    signIn('github', { callbackUrl })
  }

  const handleMagicLinkClick = () => {
    setShowMagicLinkInput(true)
  }

  const handleMagicLinkSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    if (!magicLinkEmail || !magicLinkEmail.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setIsSendingMagicLink(true)
    setError(null)

    try {
      await signIn('email', { email: magicLinkEmail, callbackUrl, redirect: false })
      // NextAuth will handle the email sending
      // Show success message
      setMagicLinkSent(true)
      setError(null)
    } catch (err) {
      console.error('Magic link error:', err)
      setError('Failed to send magic link. Please try again.')
    } finally {
      setIsSendingMagicLink(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">SolaceDesk</h1>
          <p className="text-slate-400">Internal Helpdesk Portal</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-400">
            {error === 'CredentialsSignin'
              ? 'Invalid credentials'
              : error}
          </div>
        )}

        {/* Primary Method: Email/Password */}
        <div className="space-y-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const email = formData.get('email') as string
              const password = formData.get('password') as string
              
              setError(null) // Clear previous errors
              
              try {
                const result = await signIn('credentials', {
                  email,
                  password,
                  redirect: false,
                  callbackUrl,
                })

                if (result?.error) {
                  console.error('Sign in error:', result.error)
                  setError('Invalid email or password')
                } else if (result?.ok) {
                  window.location.href = callbackUrl
                } else {
                  setError('Sign in failed. Please try again.')
                }
              } catch (err) {
                console.error('Sign in exception:', err)
                setError('An error occurred. Please try again.')
              }
            }}
            className="space-y-3"
          >
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              required
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              required
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <button
              type="submit"
              className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors font-medium"
            >
              Sign In
            </button>
          </form>

          {/* Demo Account */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
            <div className="text-sm font-semibold text-white">Demo Account (Read-only)</div>
            <div className="mt-2 text-sm text-slate-300 whitespace-pre-line">
              {'Email: demo@solace.com\nPassword: demo123\nRole: DEMO_OBSERVER\n\nThis account is read-only and resets daily.'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 space-y-1">
          <p>Enterprise collaboration platform</p>

          <p>
            This is a demo project ·{' '}
            <Link
              href="https://pazu.dev/projects/accessly"
              className="underline underline-offset-2 hover:text-slate-300"
            >
              View case study
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}