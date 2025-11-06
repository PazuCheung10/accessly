'use client'

import { signIn } from 'next-auth/react'
import { useState, useEffect } from 'react'

interface SignInPageProps {
  searchParams?: Promise<{ callbackUrl?: string; error?: string }>
}

export default function SignInPage({ searchParams }: SignInPageProps) {
  const [callbackUrl, setCallbackUrl] = useState('/')
  const [error, setError] = useState<string | null>(null)
  const [hasGitHub, setHasGitHub] = useState(false)
  const [hasEmail, setHasEmail] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Parse search params from URL (client-side)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const cb = params.get('callbackUrl') || '/'
      const err = params.get('error')
      setCallbackUrl(cb)
      if (err) setError(err)
    }

    // Check for auth providers from environment (only on client)
    // In a real app, you'd fetch this from an API endpoint
    // For now, we'll assume providers are configured if we reach this page
    setHasGitHub(true) // Assume GitHub is configured
    setHasEmail(true) // Assume Email is configured
    setLoading(false)
  }, [])

  if (loading) {
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

  const handleEmailSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    await signIn('email', { email, callbackUrl })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Accessly</h1>
          <p className="text-slate-400">Sign in to continue</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-400">
            {error === 'CredentialsSignin'
              ? 'Invalid credentials'
              : 'An error occurred during sign in'}
          </div>
        )}

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

          {/* Credentials (Email/Password) login */}
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
          >
            <div className="space-y-3">
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
                className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
              >
                Sign In
              </button>
            </div>
          </form>

          {hasEmail && (
            <form onSubmit={handleEmailSignIn}>
              <div className="space-y-3">
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email (magic link)"
                  required
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  Sign in with Email (Magic Link)
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="text-center text-sm text-slate-500">
          <p>Secure, role-based authentication</p>
        </div>
      </div>
    </div>
  )
}