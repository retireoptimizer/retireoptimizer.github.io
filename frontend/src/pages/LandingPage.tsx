import { useEffect, useState } from 'react'
import { fetchHealth } from '@/lib/api'

export default function LandingPage() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking')

  useEffect(() => {
    fetchHealth()
      .then(() => setApiStatus('ok'))
      .catch(() => setApiStatus('error'))
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold tracking-tight mb-4">FireOpt</h1>
        <p className="text-xl text-gray-600 mb-2">
          Retirement planning that actually optimizes.
        </p>
        <p className="text-gray-500">
          Holistic Roth conversion + withdrawal strategy optimizer for your retirement.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">API status:</span>
          {apiStatus === 'checking' && (
            <span className="text-yellow-600 font-medium">checking…</span>
          )}
          {apiStatus === 'ok' && (
            <span className="text-green-600 font-medium">✓ connected</span>
          )}
          {apiStatus === 'error' && (
            <span className="text-red-600 font-medium">✗ unreachable</span>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <a
          href="/try"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Try it free
        </a>
        <a
          href="/login"
          className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Sign in
        </a>
      </div>
    </div>
  )
}
