import Link from 'next/link'

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const errorMessages: Record<string, string> = {
    Configuration: 'There is a problem with the server configuration.',
    AccessDenied: 'You do not have permission to sign in.',
    Verification: 'The verification token has expired or has already been used.',
    Default: 'An error occurred during authentication.',
  }

  const params = await searchParams
  const error = params.error || 'Default'
  const message = errorMessages[error] || errorMessages.Default

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Authentication Error</h1>
          <p className="text-slate-400">{message}</p>
        </div>

        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-sm text-red-400">
            Error code: <code className="font-mono">{error}</code>
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/sign-in"
            className="block px-4 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
          >
            Try again
          </Link>
          <Link
            href="/"
            className="block px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}