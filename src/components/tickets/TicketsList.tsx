'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Ticket {
  id: string
  name: string
  title: string
  description: string | null
  status: 'OPEN' | 'WAITING' | 'RESOLVED' | null
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    name: string | null
    email: string | null
  } | null
  owner: {
    id: string
    name: string | null
    email: string | null
  } | null
  firstMessage: {
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

export function TicketsList() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'WAITING' | 'RESOLVED' | null>(null)

  useEffect(() => {
    fetchTickets()
  }, [statusFilter])

  const fetchTickets = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (statusFilter) {
        params.set('status', statusFilter)
      }
      const response = await fetch(`/api/tickets?${params.toString()}`)
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading tickets...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Status Filter */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-4 py-2 rounded-lg transition-colors ${
            statusFilter === null
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setStatusFilter('OPEN')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            statusFilter === 'OPEN'
              ? 'bg-green-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Open
        </button>
        <button
          onClick={() => setStatusFilter('WAITING')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            statusFilter === 'WAITING'
              ? 'bg-yellow-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Waiting
        </button>
        <button
          onClick={() => setStatusFilter('RESOLVED')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            statusFilter === 'RESOLVED'
              ? 'bg-slate-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Resolved
        </button>
      </div>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
          <p className="text-slate-400">No tickets found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/chat?room=${ticket.id}`}
              className="block bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{ticket.title}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded border ${getStatusColor(ticket.status)}`}
                    >
                      {ticket.status || 'OPEN'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400 mb-2">
                    From: {ticket.creator?.name || ticket.creator?.email || 'Unknown'} ({ticket.creator?.email})
                    {ticket.owner && (
                      <span className="ml-4">
                        Assigned to: {ticket.owner.name || ticket.owner.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              {ticket.firstMessage && (
                <div className="bg-slate-900/50 rounded p-3 mb-3">
                  <p className="text-sm text-slate-300 line-clamp-2">
                    {ticket.firstMessage.content}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{ticket.messageCount} {ticket.messageCount === 1 ? 'message' : 'messages'}</span>
                <span>Updated {new Date(ticket.updatedAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

