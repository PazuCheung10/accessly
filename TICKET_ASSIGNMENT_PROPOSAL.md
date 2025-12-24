# Ticket Assignment & "My Issues" Proposal

## Current State

**What Exists:**
- ✅ `/api/tickets/[ticketId]/assign` - Assignment endpoint (admin-only, assigns as OWNER)
- ✅ RoomHeader has assignment UI (but may not be visible/working for tickets)
- ✅ `/api/tickets/my-tickets` - Returns tickets where user is a member
- ✅ Room membership logic: Users can access tickets if they're members OR admins

**What's Missing:**
1. **Assignment UI in ticket rooms** - Admins need easy way to add participants
2. **"My Issues" entry point** - Assigned users need to discover their tickets

## Proposed Solution

### 1. Assignment UI in Ticket Rooms

**Location:** `RoomHeader` component (already has `handleAssign` function)

**Changes Needed:**
- Make assignment UI visible for TICKET rooms (currently may be hidden)
- Allow admins/owners to add participants (not just assign as OWNER)
- Use existing `/api/chat/rooms/[roomId]/invite` endpoint OR extend it for TICKET rooms

**Option A: Extend invite endpoint for TICKET rooms**
- Modify `/api/chat/rooms/[roomId]/invite` to allow TICKET rooms
- Only OWNER/MODERATOR can invite (same as PRIVATE rooms)
- Add user as MEMBER (not OWNER) - allows multiple participants

**Option B: Use existing assign endpoint**
- Keep `/api/tickets/[ticketId]/assign` for OWNER assignment
- Add new "Add Participant" button that uses invite endpoint

**Recommendation:** Option A - Extend invite endpoint to support TICKET rooms

### 2. "My Issues" Entry Point

**Location:** Navbar or Home page

**Implementation:**
- Add "My Issues" link in navbar (visible to all authenticated users)
- Create `/issues` page (or `/my-tickets`) that shows assigned tickets
- Use existing `/api/tickets/my-tickets` endpoint
- Display tickets where user is a member (regardless of role)

**UI Flow:**
```
Navbar: [Workspace] [My Issues] [Dashboard] [Issues (admin only)]
         ↓
My Issues Page: List of tickets where user is a member
         ↓
Click ticket → Navigate to `/chat?room={ticketId}`
```

## Implementation Plan

### Phase 1: Enable Assignment in Ticket Rooms

**File: `src/app/api/chat/rooms/[roomId]/invite/route.ts`**
- Remove restriction that blocks TICKET rooms (line 55)
- Allow OWNER/MODERATOR to invite users to TICKET rooms
- Add user as MEMBER role (not OWNER)

**File: `src/components/rooms/RoomHeader.tsx`**
- Ensure assignment/invite UI is visible for TICKET rooms
- Show "Add Participant" button for admins/owners in ticket rooms
- Display list of current participants

### Phase 2: Add "My Issues" Entry Point

**File: `src/components/Navbar.tsx`**
- Add "My Issues" link (visible to all authenticated users)
- Link to `/issues` or `/my-tickets`

**File: `src/app/issues/page.tsx` (new)**
- Server component that requires auth
- Fetches tickets using `/api/tickets/my-tickets`
- Displays list of assigned tickets
- Similar UI to `/tickets` but filtered to user's assignments

**File: `src/components/issues/MyIssuesList.tsx` (new)**
- Client component to display assigned tickets
- Reuse ticket card UI from `TicketsList`
- Show status, department, last message, etc.

## Access Control Summary

**Ticket Visibility:**
- ✅ Admins: See all tickets via `/tickets` page
- ✅ Assigned users: See their tickets via `/issues` page
- ✅ Access control: Must be member OR admin (already implemented)

**Assignment Permissions:**
- ✅ OWNER/MODERATOR can add participants (via invite endpoint)
- ✅ Admins can assign tickets (via assign endpoint)
- ✅ Department is label only - no implicit access

## Benefits

1. **Explicit Assignment Model** - Clear who can see what
2. **Uses Existing Logic** - Room membership already handles access
3. **Minimal Changes** - Extend existing endpoints, add one new page
4. **Clean RBAC** - No implicit permissions, department stays as label

## Demo Flow

1. Admin creates ticket: "Payment method not working" (BILLING department)
2. Admin assigns May (BILLING user) via "Add Participant" button
3. May logs in, sees "My Issues" in navbar
4. May clicks "My Issues", sees the ticket
5. May clicks ticket, can participate in conversation
6. Other BILLING users (Lisa, Tom) don't see it unless also assigned

