'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function TestReactionsPage() {
  const { data: session, status } = useSession()
  const [testResults, setTestResults] = useState<any[]>([])
  const [messageId, setMessageId] = useState('')
  const [testEmoji, setTestEmoji] = useState('👍')

  const addResult = (label: string, data: any) => {
    setTestResults(prev => [...prev, { 
      timestamp: new Date().toISOString(),
      label,
      data: JSON.stringify(data, null, 2)
    }])
  }

  const clearResults = () => {
    setTestResults([])
  }

  // Test 1: Check session
  const testSession = () => {
    addResult('Session Check', {
      status,
      session: session ? {
        user: {
          id: session.user?.id,
          email: session.user?.email,
          name: session.user?.name,
        },
        expires: session.expires,
      } : null,
    })
  }

  // Test 2: Check cookies
  const testCookies = () => {
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=')
      acc[key] = value
      return acc
    }, {} as Record<string, string>)

    addResult('Cookies Check', {
      allCookies: cookies,
      hasNextAuthCookie: Object.keys(cookies).some(k => 
        k.includes('next-auth') || k.includes('session-token')
      ),
      cookieCount: Object.keys(cookies).length,
    })
  }

  // Test 3: Test a simple API call (health check)
  const testHealthCheck = async () => {
    try {
      const response = await fetch('/api/chat/messages?roomId=test&limit=1', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })

      const contentType = response.headers.get('content-type') || ''
      let body: any = {}
      try {
        body = await response.json()
      } catch (e) {
        body = { error: 'Not JSON', text: await response.text().catch(() => '') }
      }

      addResult('Health Check (GET /api/chat/messages)', {
        status: response.status,
        statusText: response.statusText,
        contentType,
        ok: response.ok,
        body,
      })
    } catch (err: any) {
      addResult('Health Check Error', {
        error: err.message,
        stack: err.stack,
      })
    }
  }

  // Test 4: Test reaction endpoint with a real message
  const testReactionEndpoint = async () => {
    if (!messageId.trim()) {
      addResult('Error', { message: 'Please enter a message ID first' })
      return
    }

    try {
      addResult('Starting Reaction Test', {
        messageId,
        emoji: testEmoji,
        url: `/api/chat/messages/${messageId}/reactions`,
      })

      const response = await fetch(`/api/chat/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ emoji: testEmoji }),
      })

      const contentType = response.headers.get('content-type') || ''
      let payload: any = {}
      let parseError = null

      try {
        payload = await response.clone().json()
      } catch (e: any) {
        parseError = e.message
      }

      const text = await response.text().catch(() => '')

      addResult('Reaction API Response', {
        status: response.status,
        statusText: response.statusText,
        contentType,
        ok: response.ok,
        jsonParseError: parseError,
        payload,
        textSnippet: text.slice(0, 500),
        headers: Object.fromEntries(response.headers.entries()),
      })
    } catch (err: any) {
      addResult('Reaction Test Error', {
        error: err.message,
        stack: err.stack,
      })
    }
  }

  // Test 5: Get a real message ID from a room
  const getTestMessageId = async () => {
    try {
      // First, get rooms
      const roomsRes = await fetch('/api/chat/rooms', {
        credentials: 'include',
        cache: 'no-store',
      })
      const roomsData = await roomsRes.json()
      
      if (roomsData.data?.rooms?.length > 0) {
        const roomId = roomsData.data.rooms[0].id
        
        // Get messages from first room
        const messagesRes = await fetch(`/api/chat/messages?roomId=${roomId}&limit=1`, {
          credentials: 'include',
          cache: 'no-store',
        })
        const messagesData = await messagesRes.json()
        
        if (messagesData.data?.messages?.[0]?.id) {
          setMessageId(messagesData.data.messages[0].id)
          addResult('Found Test Message', {
            roomId,
            messageId: messagesData.data.messages[0].id,
            messageContent: messagesData.data.messages[0].content?.slice(0, 50),
          })
        } else {
          addResult('No Messages Found', {
            roomId,
            messagesData,
          })
        }
      } else {
        addResult('No Rooms Found', { roomsData })
      }
    } catch (err: any) {
      addResult('Get Message ID Error', {
        error: err.message,
      })
    }
  }

  // Auto-run session check on mount
  useEffect(() => {
    if (status === 'authenticated' || status === 'unauthenticated') {
      testSession()
      testCookies()
    }
  }, [status, session])

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Reaction API Diagnostic Tool</h1>

        <div className="bg-slate-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Quick Tests</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={testSession}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded"
            >
              Test Session
            </button>
            <button
              onClick={testCookies}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded"
            >
              Test Cookies
            </button>
            <button
              onClick={testHealthCheck}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded"
            >
              Test Health Check
            </button>
            <button
              onClick={getTestMessageId}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
            >
              Get Test Message ID
            </button>
            <button
              onClick={clearResults}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
            >
              Clear Results
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Message ID (or use "Get Test Message ID" button)
              </label>
              <input
                type="text"
                value={messageId}
                onChange={(e) => setMessageId(e.target.value)}
                placeholder="Enter message ID..."
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Emoji to Test</label>
              <input
                type="text"
                value={testEmoji}
                onChange={(e) => setTestEmoji(e.target.value)}
                maxLength={10}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white text-2xl"
              />
            </div>
            <button
              onClick={testReactionEndpoint}
              disabled={!messageId.trim()}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              Test Reaction Endpoint
            </button>
          </div>
        </div>

        <div className="bg-slate-900 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Test Results ({testResults.length})</h2>
            {testResults.length > 0 && (
              <button
                onClick={clearResults}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Clear All
              </button>
            )}
          </div>

          {testResults.length === 0 ? (
            <p className="text-slate-400 italic">No test results yet. Run some tests above.</p>
          ) : (
            <div className="space-y-4">
              {testResults.map((result, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800 rounded p-4 border border-slate-700"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-cyan-400">{result.label}</h3>
                    <span className="text-xs text-slate-500">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="text-xs bg-slate-950 p-3 rounded overflow-x-auto">
                    {result.data}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 bg-slate-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Current Session Info</h2>
          <pre className="text-xs bg-slate-800 p-4 rounded overflow-x-auto">
            {JSON.stringify(
              {
                status,
                session: session
                  ? {
                      user: {
                        id: session.user?.id,
                        email: session.user?.email,
                        name: session.user?.name,
                      },
                      expires: session.expires,
                    }
                  : null,
              },
              null,
              2
            )}
          </pre>
        </div>
      </div>
    </div>
  )
}

