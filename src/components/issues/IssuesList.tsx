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
  owner?: {
    id: string
    name: string | null
    email: string | null
  } | null
  assignedAdmin?: {
    id: string
    name: string | null
    email: string | null
  } | null
  firstMessage?: {
    id: string
    content: string
    createdAt: string
    user: {
      id: string
      name: string | null
      email: string | null
    }
  } | null
  lastMessage?: {
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

interface IssuesListProps {
  isAdmin: boolean
  userId: string
}

export function IssuesList({ isAdmin, userId }: IssuesListProps) {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'WAITING' | 'RESOLVED' | null>(null)
  const [showMyIssuesOnly, setShowMyIssuesOnly] = useState(false)

  useEffect(() => {
    fetchTickets()
  }, [statusFilter, showMyIssuesOnly, isAdmin, userId])

  const fetchTickets = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (statusFilter) {
        params.set('status', statusFilter)
      }

      let response
      if (isAdmin && !showMyIssuesOnly) {
        // Admin viewing all issues
        response = await fetch(`/api/tickets?${params.toString()}`)
      } else {
        // Non-admin or admin filtering to "My Issues"
        response = await fetch(`/api/tickets/my-tickets?${params.toString()}`)
      }

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
        <div className="text-slate-400">Loading issues...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Filter Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {/* My Issues Checkbox - only for admins */}
        {isAdmin && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMyIssuesOnly}
              onChange={(e) => setShowMyIssuesOnly(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-600 focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            />
            <span className="text-sm text-slate-300">Show only my issues</span>
          </label>
        )}

        {/* Status Filter */}
        <div className="flex gap-2">
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
      </div>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
          <p className="text-slate-400">
            {isAdmin && showMyIssuesOnly
              ? 'No issues assigned to you'
              : isAdmin
              ? 'No issues found'
              : 'No issues assigned to you'}
          </p>
          {!isAdmin && (
            <p className="text-sm text-slate-500 mt-2">Issues will appear here once you&apos;re assigned to them</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => {
            const assignedTo = ticket.owner || ticket.assignedAdmin
            const message = ticket.firstMessage || ticket.lastMessage

            return (
              <Link
                key={ticket.id}
                href={`/chat?room=${ticket.id}`}
                className="block bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
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
                        {ticket.status || 'OPEN'}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400 mb-2">
                      Created by: {ticket.creator?.name || ticket.creator?.email || 'Unknown'}
                      {assignedTo && (
                        <span className="ml-4">
                          Assigned to: {assignedTo.name || assignedTo.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </div>
                </div>
                
                {message && (
                  <div className="bg-slate-900/50 rounded p-3 mb-3">
                    <p className="text-sm text-slate-300 line-clamp-2">
                      {message.content}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{ticket.messageCount} {ticket.messageCount === 1 ? 'message' : 'messages'}</span>
                  <span>Updated {new Date(ticket.updatedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

