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
          <h1 className="text-4xl font-bold mb-2">Accessly</h1>
          <p className="text-slate-400">Sign in to continue</p>
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

          {/* Sign Up Link */}
          <div className="text-center text-sm text-slate-400">
            <p>
              Don't have an account?{' '}
              <Link href="/sign-up" className="text-cyan-400 hover:text-cyan-300 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Divider */}
        {(hasGitHub || hasEmail) && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-950 px-2 text-slate-500">Or</span>
            </div>
          </div>
        )}

        {/* Alternative Methods */}
        {(hasGitHub || hasEmail) && (
          <div className="space-y-3">
            {hasGitHub && (
              <button
                onClick={handleGitHubSignIn}
                className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Sign in with GitHub
              </button>
            )}

            {hasEmail && (
              <div className="space-y-3">
                {!showMagicLinkInput ? (
                  <button
                    onClick={handleMagicLinkClick}
                    className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Sign in with Email (Magic Link)
                  </button>
                ) : magicLinkSent ? (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-sm text-green-400">
                    <p className="font-medium mb-1">Magic link sent!</p>
                    <p className="text-xs text-green-300">
                      Check your email ({magicLinkEmail}) for the sign-in link.
                    </p>
                    <button
                      onClick={() => {
                        setShowMagicLinkInput(false)
                        setMagicLinkSent(false)
                        setMagicLinkEmail('')
                      }}
                      className="mt-2 text-xs text-green-300 hover:text-green-200 underline"
                    >
                      Use a different email
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="email"
                      value={magicLinkEmail}
                      onChange={(e) => setMagicLinkEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleMagicLinkSubmit()
                        }
                        if (e.key === 'Escape') {
                          setShowMagicLinkInput(false)
                          setMagicLinkEmail('')
                        }
                      }}
                      onBlur={(e) => {
                        // Collapse if input is empty when user clicks away
                        if (!magicLinkEmail.trim()) {
                          setShowMagicLinkInput(false)
                        }
                      }}
                      placeholder="Enter your email"
                      required
                      className="w-full px-4 py-3 pr-20 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 text-sm"
                      autoFocus
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        onClick={() => {
                          setShowMagicLinkInput(false)
                          setMagicLinkEmail('')
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                        type="button"
                        title="Cancel"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <button
                        onClick={handleMagicLinkSubmit}
                        disabled={isSendingMagicLink || !magicLinkEmail}
                        className="p-1.5 text-slate-400 hover:text-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        type="button"
                        title="Send magic link"
                      >
                        {isSendingMagicLink ? (
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-500">
          <p>Secure, role-based authentication</p>
        </div>
      </div>
    </div>
  )
}