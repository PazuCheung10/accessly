'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface TicketAIAssistantProps {
  roomId: string
}

interface AIInsights {
  summary: string
  summarySource: 'deterministic' | 'ai'
  suggestions: string[]
  escalation: {
    recommended: boolean
    severity?: 'HIGH' | 'MEDIUM' | 'LOW'
    department?: string
    reason?: string
  }
}

export function TicketAIAssistant({ roomId }: TicketAIAssistantProps) {
  const { data: session } = useSession()
  const [isExpanded, setIsExpanded] = useState(true)
  const [insights, setInsights] = useState<AIInsights | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roomType, setRoomType] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const currentRoomIdRef = useRef<string>(roomId)

  // Clear state immediately when roomId changes (before API calls)
  useEffect(() => {
    if (currentRoomIdRef.current !== roomId) {
      currentRoomIdRef.current = roomId
      // Immediately clear state when room changes
      setRoomType(null)
      setInsights(null)
      setProvider(null)
      setError(null)
      setIsLoading(false)
    }
  }, [roomId])

  // Check room type and if user is admin
  useEffect(() => {
    const checkRoomAndUser = async () => {
      // Reset state at start of check
      setRoomType(null)
      setInsights(null)
      setProvider(null)
      setError(null)
      setIsLoading(false)
      
      try {
        // Check if user is admin (from session)
        const userRole = session?.user?.role
        setIsAdmin(userRole === 'ADMIN')
        
        // Check room type
        const roomRes = await fetch(`/api/chat/rooms/${roomId}`)
        const roomData = await roomRes.json()
        if (roomData.ok && roomData.data?.room) {
          // Only set room type if we're still on the same room
          if (currentRoomIdRef.current === roomId) {
            setRoomType(roomData.data.room.type)
          }
        }
      } catch (err) {
        // Silently handle errors when switching rooms
        if (currentRoomIdRef.current === roomId) {
          console.error('Error checking room/user:', err)
        }
      }
    }

    checkRoomAndUser()
  }, [roomId, session?.user?.role])

  // PEEK: Get existing insights without updating (read-only)
  const peekInsights = useCallback(async () => {
    // Guard: only fetch if it's a TICKET room and user is admin
    if (roomType !== 'TICKET' || isAdmin !== true) {
      return
    }

    // Double-check: verify we're still on the same room before making API call
    if (currentRoomIdRef.current !== roomId) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/ticket-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId, action: 'peek' }),
      })

      const data = await response.json()

      // Check again if we're still on the same room before processing response
      if (currentRoomIdRef.current !== roomId) {
        return
      }

      if (!response.ok || !data.ok) {
        // Only throw if we're still on a ticket room
        if (roomType === 'TICKET' && isAdmin === true) {
          throw new Error(data.message || 'Failed to peek AI insights')
        }
        return
      }

      // Handle null data (no existing summary)
      if (data.data === null) {
        setInsights(null)
        setProvider(null)
      } else {
        setInsights(data.data)
        setProvider(data.provider || null)
      }
    } catch (err: any) {
      // Only set error if we're still in a ticket room and on the same room
      if (currentRoomIdRef.current === roomId && roomType === 'TICKET' && isAdmin === true) {
        console.error('Error peeking AI insights:', err)
        setError(err.message || 'Failed to load AI insights')
      }
    } finally {
      // Only update loading state if we're still on the same room
      if (currentRoomIdRef.current === roomId) {
        setIsLoading(false)
      }
    }
  }, [roomId, roomType, isAdmin])

  // REFRESH: Generate/update insights (write operation)
  const refreshInsights = useCallback(async () => {
    // Guard: only fetch if it's a TICKET room and user is admin
    if (roomType !== 'TICKET' || isAdmin !== true) {
      return
    }

    // Double-check: verify we're still on the same room before making API call
    if (currentRoomIdRef.current !== roomId) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/ticket-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId, action: 'refresh' }),
      })

      const data = await response.json()

      // Check again if we're still on the same room before processing response
      if (currentRoomIdRef.current !== roomId) {
        return
      }

      if (!response.ok || !data.ok) {
        // Only throw if we're still on a ticket room
        if (roomType === 'TICKET' && isAdmin === true) {
          throw new Error(data.message || 'Failed to refresh AI insights')
        }
        return
      }

      setInsights(data.data)
      setProvider(data.provider || null)
    } catch (err: any) {
      // Only set error if we're still in a ticket room and on the same room
      if (currentRoomIdRef.current === roomId && roomType === 'TICKET' && isAdmin === true) {
        console.error('Error refreshing AI insights:', err)
        setError(err.message || 'Failed to refresh AI insights')
      }
    } finally {
      // Only update loading state if we're still on the same room
      if (currentRoomIdRef.current === roomId) {
        setIsLoading(false)
      }
    }
  }, [roomId, roomType, isAdmin])

  // PEEK insights on mount and when room changes (read-only, no update)
  useEffect(() => {
    if (roomType === 'TICKET' && isAdmin === true) {
      peekInsights()
    } else {
      // Clear insights when switching away from ticket room
      setInsights(null)
      setProvider(null)
      setError(null)
      setIsLoading(false)
    }
  }, [roomId, roomType, isAdmin, peekInsights])

  // Don't render if not a TICKET room or user is not admin
  if (roomType !== 'TICKET' || isAdmin !== true) {
    return null
  }

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleCopySuggestion = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index)
      // Reset icon after 2 seconds
      setTimeout(() => setCopiedIndex(null), 2000)
    }).catch((err) => {
      console.error('Failed to copy:', err)
    })
  }

  return (
    <div className={`bg-slate-900 border-l border-slate-800 flex flex-col h-full transition-all duration-300 ${
      isExpanded ? 'w-80' : 'w-12'
    } flex-shrink-0`}>
      {/* Collapse/Expand Toggle */}
      <div className="p-2 border-b border-slate-800 flex items-center justify-between">
        {isExpanded && (
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-200">AI Assistant</h3>
            {provider === 'fake' && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-slate-700 text-slate-300 rounded border border-slate-600">
                Mock
              </span>
            )}
          </div>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 hover:bg-slate-800 rounded transition-colors"
          aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
        >
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                <div className="h-4 bg-slate-700 rounded w-full"></div>
                <div className="h-4 bg-slate-700 rounded w-5/6"></div>
              </div>
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-slate-700 rounded w-1/2"></div>
                <div className="h-20 bg-slate-700 rounded"></div>
                <div className="h-20 bg-slate-700 rounded"></div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="space-y-3">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
              <button
                onClick={refreshInsights}
                className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty State - No summary yet */}
          {!insights && !isLoading && !error && (
            <div className="space-y-3">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-400 mb-3">
                  No AI insights available yet. Click refresh to generate insights for this ticket.
                </p>
                <button
                  onClick={refreshInsights}
                  className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Generate Insights
                </button>
              </div>
            </div>
          )}

          {/* Success State */}
          {insights && !isLoading && !error && (
            <>
              {/* Summary Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-4 h-4 text-cyan-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h4 className="text-sm font-semibold text-slate-200">Summary</h4>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {insights.summary}
                </p>
              </div>

              {/* Suggested Replies Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <svg
                    className="w-4 h-4 text-cyan-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                  <h4 className="text-sm font-semibold text-slate-200">Suggested Replies</h4>
                </div>
                <div className="space-y-2">
                  {insights.suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 hover:bg-slate-800 transition-colors group"
                    >
                      <p className="text-sm text-slate-300 mb-2 leading-relaxed">
                        {suggestion}
                      </p>
                      <button
                        onClick={() => handleCopySuggestion(suggestion, index)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                      >
                        {copiedIndex === index ? (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Escalation Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <svg
                    className="w-4 h-4 text-cyan-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <h4 className="text-sm font-semibold text-slate-200">Escalation</h4>
                </div>
                {insights.escalation.recommended ? (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-sm text-yellow-400 font-medium mb-1">
                      Escalation Recommended
                    </p>
                    {insights.escalation.department && (
                      <p className="text-xs text-slate-300 mb-1">
                        Department: {insights.escalation.department}
                      </p>
                    )}
                    {insights.escalation.reason && (
                      <p className="text-xs text-slate-400">
                        {insights.escalation.reason}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                    <p className="text-sm text-slate-400">
                      No escalation needed at this time.
                    </p>
                  </div>
                )}
              </div>

              {/* Refresh Button */}
              <button
                onClick={refreshInsights}
                className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

