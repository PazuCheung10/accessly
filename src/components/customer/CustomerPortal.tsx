'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Ticket {
  id: string
  roomId: string
  name: string
  title: string
  description: string | null
  status: 'OPEN' | 'WAITING' | 'RESOLVED' | null
  department: string | null
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    name: string | null
    email: string | null
  } | null
  assignedAdmin: {
    id: string
    name: string | null
    email: string | null
  } | null
  lastMessage: {
    id: string
    content: string
    createdAt: string
    user: {
      id: string
      name: string | null
      email: string | null
    }
  } | null
  messageCount: number
}

export function CustomerPortal() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/tickets/my-tickets')
      const data = await response.json()

      if (data.ok && data.data?.tickets) {
        setTickets(data.data.tickets)
      }
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'OPEN':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'WAITING':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'RESOLVED':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'OPEN':
        return 'Open'
      case 'WAITING':
        return 'Waiting'
      case 'RESOLVED':
        return 'Resolved'
      default:
        return 'Open'
    }
  }

  const getDepartmentLabel = (department: string | null) => {
    if (!department) return 'General'
    switch (department) {
      case 'IT_SUPPORT':
        return 'IT Support'
      case 'BILLING':
        return 'Billing'
      case 'PRODUCT':
        return 'Product'
      case 'GENERAL':
        return 'General'
      default:
        return department
    }
  }

  const getDepartmentColor = (department: string | null) => {
    switch (department) {
      case 'IT_SUPPORT':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'BILLING':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'PRODUCT':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'GENERAL':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  // Clean title by removing department prefix
  const cleanTitle = (title: string) => {
    return title.replace(/^\[TICKET\]\[[^\]]+\]\s*/, '').replace(/^\[TICKET\]\s*/, '').replace(/^\[[^\]]+\]\s*/, '').trim()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading your tickets...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Support Tickets</h1>
            <p className="text-slate-400 mt-1">View and manage your support requests</p>
          </div>
        </div>

      {/* Submit New Ticket Button */}
      <div className="mb-6">
        <Link
          href="/support"
          className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Submit New Ticket
        </Link>
      </div>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-12 text-center">
          <p className="text-slate-400 mb-4">You don&apos;t have any support tickets yet.</p>
          <Link
            href="/support"
            className="inline-block px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
          >
            Submit Your First Ticket
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/chat?room=${ticket.roomId}`}
              className="block bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-semibold">{cleanTitle(ticket.title)}</h3>
                    {ticket.department && (
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded border ${getDepartmentColor(ticket.department)}`}
                      >
                        {getDepartmentLabel(ticket.department)}
                      </span>
                    )}
                    <span
                      className={`px-2 py-1 text-xs rounded border ${getStatusColor(ticket.status)}`}
                    >
                      {getStatusLabel(ticket.status)}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400 mb-2">
                    Created {new Date(ticket.createdAt).toLocaleDateString()}
                    {ticket.assignedAdmin && (
                      <span className="ml-4">
                        • Assigned to: {ticket.assignedAdmin.name || ticket.assignedAdmin.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Last Message Preview */}
              {ticket.lastMessage && (
                <div className="bg-slate-900/50 rounded p-3 mb-3">
                  <p className="text-sm text-slate-300 line-clamp-2">
                    {ticket.lastMessage.content}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(ticket.lastMessage.createdAt).toLocaleString()}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{ticket.messageCount} {ticket.messageCount === 1 ? 'message' : 'messages'}</span>
                <span>Last updated {new Date(ticket.updatedAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}


