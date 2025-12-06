# Room, Ticket, and DM Separation - Audit Report & Migration Plan

## Executive Summary

This document provides a comprehensive audit of how Rooms, Tickets, and DMs are currently displayed and filtered, identifies misclassifications, and proposes a clean separation framework with a step-by-step migration plan.

---

## 1. Current State Audit

### 1.1 Components That Display Room Lists

#### **Home Page (`src/app/page.tsx`)**
- ✅ **"My Rooms" Section**: Correctly filters to only `PUBLIC` and `PRIVATE` rooms (line 45)
- ✅ **"Discover" Section**: Correctly filters to only `PUBLIC` rooms (line 108)
- ✅ **Status**: Already compliant - excludes `DM` and `TICKET` from both sections

#### **Chat Page (`src/app/chat/ChatPageClient.tsx`)**
- ⚠️ **"Rooms" Tab**: Shows `PUBLIC`, `PRIVATE`, AND `TICKET` rooms (lines 394-395)
  - **Problem**: Tickets appear in the "Rooms" section, violating requirement
  - **Current Behavior**: 
    - "Team Rooms" subsection: `PUBLIC` and `PRIVATE` (line 394)
    - "Tickets" subsection: `TICKET` rooms (line 395)
- ✅ **"Direct Messages" Tab**: Correctly shows only `DM` rooms (line 332)
- ⚠️ **Issue**: Tickets should NOT appear in the "Rooms" tab at all

#### **Tickets Page (`src/app/tickets/page.tsx` + `TicketsList.tsx`)**
- ✅ **Status**: Correctly shows only `TICKET` rooms (admin-only)
- ✅ **Navigation**: Links to `/chat?room={ticketId}` for viewing ticket conversations

#### **Room Card Component (`src/components/rooms/RoomCard.tsx`)**
- ⚠️ **Issue**: Displays "Ticket" badge for `TICKET` rooms (line 55-56)
  - This is fine for the Tickets page, but tickets shouldn't appear as cards on the Home page
  - Currently, tickets don't appear on Home page, so this is acceptable

---

### 1.2 API Routes - Filtering Logic

#### **`GET /api/chat/rooms`** (`src/app/api/chat/rooms/route.ts`)
- ⚠️ **Issue**: Returns ALL room types (PUBLIC, PRIVATE, DM, TICKET) that user is a member of (line 72-144)
  - No filtering by type
  - This is used by `ChatPageClient` to populate the sidebar
  - **Problem**: External customers who submit tickets will see their tickets mixed with rooms (if they somehow got access to rooms)

#### **`GET /api/chat/rooms/discover`** (`src/app/api/chat/rooms/discover/route.ts`)
- ✅ **Status**: Correctly filters to only `PUBLIC` rooms (line 32)
- ✅ **Status**: Already compliant

#### **`GET /api/tickets`** (`src/app/api/tickets/route.ts`)
- ✅ **Status**: Correctly filters to only `TICKET` rooms (line 43)
- ✅ **Status**: Admin-only access (line 29)

---

### 1.3 User Role & Access Control Issues

#### **Critical Gap: No Distinction Between Internal Users and External Customers**

**Current State:**
- Both internal staff and external customers have `role: USER`
- External customers are created when they submit a ticket via `/support` (line 59-65 in `src/app/api/support/tickets/route.ts`)
- There's no way to distinguish:
  - **Internal USER** (staff member who should see PUBLIC/PRIVATE rooms, can create DMs)
  - **External customer USER** (should only see their own tickets, cannot see any rooms)

**Impact:**
- External customers who submit tickets could theoretically see rooms if they navigate to `/chat`
- No clear separation of access based on user origin

**Proposed Solution (Without Schema Changes):**
- Use a heuristic: If a user has created a TICKET room, they are likely an external customer
- OR: Add a flag in User model (but user said no schema changes)
- OR: Check if user has any PUBLIC/PRIVATE room memberships - if not, treat as external customer

---

## 2. Misclassifications Identified

### 2.1 Tickets Appearing in "Rooms" Tab

**Location**: `src/app/chat/ChatPageClient.tsx` lines 394-395

**Current Behavior:**
```typescript
const teamRooms = myRooms.filter((r) => r.type === 'PUBLIC' || r.type === 'PRIVATE')
const tickets = myRooms.filter((r) => r.type === 'TICKET')
```

**Problem**: Tickets are displayed in the "Rooms" tab sidebar, which violates the requirement that "Tickets should NOT appear in the room list on the homepage" (and by extension, not in the chat "Rooms" tab).

**Fix**: Remove tickets from the "Rooms" tab. Tickets should only be accessible via:
- `/tickets` page (admin-only)
- Direct navigation to `/chat?room={ticketId}` from the tickets list

---

### 2.2 No Access Control for External Customers

**Location**: Multiple (API routes, page components)

**Problem**: External customers (who submit tickets) can potentially:
- See PUBLIC rooms in discovery
- Access the chat page and see rooms they shouldn't have access to
- Create DMs (which should be internal-only)

**Fix**: Add access control checks:
- External customers should be redirected away from `/` (home page) or see an empty state
- External customers should only see their own tickets in `/chat`
- External customers should not be able to create PUBLIC/PRIVATE rooms or DMs

---

## 3. Clean Classification Framework

### 3.1 Room Type Definitions (Reconfirmed)

| Type | Visibility | Who Can See | Where It Appears |
|------|-----------|-------------|------------------|
| **PUBLIC** | Internal only | Internal users (USER, ADMIN) | Home page "Discover", Chat "Rooms" tab |
| **PRIVATE** | Internal only | Internal users (USER, ADMIN) who are members | Home page "My Rooms", Chat "Rooms" tab |
| **TICKET** | Customer + Admin | Customer who created it + Admins | `/tickets` page (admin), `/chat?room={id}` (customer + admin) |
| **DM** | Internal 1:1 | Two internal users | Chat "Direct Messages" tab only |

### 3.2 User Type Classification (Proposed Heuristic)

Since we cannot change the schema, use a heuristic to distinguish user types:

**Internal User (Staff):**
- Has at least one membership in a PUBLIC or PRIVATE room (not just TICKET)
- OR: Has role ADMIN
- Can see: PUBLIC/PRIVATE rooms, DMs, Tickets (if admin)

**External Customer:**
- Has NO memberships in PUBLIC or PRIVATE rooms
- Has only TICKET room memberships (or none)
- Can see: Only their own tickets

**Implementation:**
```typescript
// Helper function to check if user is internal
async function isInternalUser(userId: string): Promise<boolean> {
  const hasInternalRoom = await prisma.roomMember.findFirst({
    where: {
      userId,
      room: {
        type: { in: ['PUBLIC', 'PRIVATE'] }
      }
    }
  })
  return !!hasInternalRoom
}
```

---

## 4. UI Separation Rules

### 4.1 Home Page (`/`)
- ✅ Show: PUBLIC and PRIVATE rooms only
- ✅ Hide: DM and TICKET rooms
- ✅ Status: Already compliant

### 4.2 Chat Page (`/chat`)
- **"Rooms" Tab**:
  - ✅ Show: PUBLIC and PRIVATE rooms only
  - ❌ Remove: TICKET rooms (they should not appear here)
  - ✅ Hide: DM rooms
- **"Direct Messages" Tab**:
  - ✅ Show: DM rooms only
  - ✅ Hide: All other types
- **Main Chat Area**:
  - Can display any room type when explicitly selected
  - Tickets accessible via direct URL (`/chat?room={ticketId}`)

### 4.3 Tickets Page (`/tickets`)
- ✅ Show: TICKET rooms only (admin-only)
- ✅ Navigation: Links to `/chat?room={ticketId}`

### 4.4 Access Control
- **Internal Users**: Can access `/`, `/chat`, `/tickets` (if admin)
- **External Customers**: Should be redirected or see limited view:
  - Cannot access `/` (home page) - redirect to `/support` or show "Your Tickets" view
  - Can access `/chat` but only see their own tickets
  - Cannot access `/tickets` (admin-only)

---

## 5. Step-by-Step Migration Plan

### Phase 1: Remove Tickets from Chat "Rooms" Tab

**Files to Modify:**
1. `src/app/chat/ChatPageClient.tsx`

**Changes:**
- Remove the "Tickets" subsection from the "Rooms" tab (lines 433-467)
- Keep only "Team Rooms" (PUBLIC/PRIVATE) in the "Rooms" tab
- Update empty state message if needed

**Expected Result:**
- "Rooms" tab shows only PUBLIC and PRIVATE rooms
- Tickets are only accessible via `/tickets` page or direct URL

---

### Phase 2: Add User Type Detection Helper

**Files to Create/Modify:**
1. `src/lib/user-utils.ts` (new file)

**Changes:**
```typescript
// src/lib/user-utils.ts
import { prisma } from './prisma'

/**
 * Check if a user is an internal staff member (not an external customer)
 * Heuristic: User has at least one PUBLIC or PRIVATE room membership
 */
export async function isInternalUser(userId: string): Promise<boolean> {
  const hasInternalRoom = await prisma.roomMember.findFirst({
    where: {
      userId,
      room: {
        type: { in: ['PUBLIC', 'PRIVATE'] }
      }
    }
  })
  return !!hasInternalRoom
}

/**
 * Check if user is external customer (only has TICKET memberships or none)
 */
export async function isExternalCustomer(userId: string): Promise<boolean> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })
  
  // Admins are never external customers
  if (dbUser?.role === 'ADMIN') return false
  
  // Check if user has any internal room memberships
  const isInternal = await isInternalUser(userId)
  return !isInternal
}
```

---

### Phase 3: Filter API Responses by User Type

**Files to Modify:**
1. `src/app/api/chat/rooms/route.ts`

**Changes:**
- After fetching memberships (line 72), filter rooms based on user type:
  - **Internal users**: Return all room types (PUBLIC, PRIVATE, DM, TICKET they're members of)
  - **External customers**: Return only TICKET rooms they're members of

**Implementation:**
```typescript
// After line 144, before mapping rooms
const userId = dbUser.id
const userIsInternal = await isInternalUser(userId)

// Filter memberships based on user type
const filteredMemberships = userIsInternal
  ? memberships // Internal users see all their rooms
  : memberships.filter(m => m.room.type === 'TICKET') // External customers only see tickets

const rooms = filteredMemberships.map((m) => ({
  ...m.room,
  role: m.role,
  lastMessage: m.room.messages[0] || null,
  otherUser: m.room.type === 'DM' && m.room.members[0] ? m.room.members[0].user : null,
}))
```

---

### Phase 4: Add Access Control to Home Page

**Files to Modify:**
1. `src/app/page.tsx`

**Changes:**
- Check if user is external customer
- If external customer, redirect to a "Your Tickets" view or `/support`
- OR: Show a limited view with only their tickets

**Implementation:**
```typescript
// After line 30, before fetching rooms
const userIsInternal = await isInternalUser(dbUser.id)

if (!userIsInternal) {
  // External customer - redirect to support or show tickets-only view
  // Option A: Redirect to support page
  redirect('/support?message=Please use the support form to submit tickets')
  
  // Option B: Show a "Your Tickets" view (requires new component)
  // return <CustomerTicketsView userId={dbUser.id} />
}
```

---

### Phase 5: Update Chat Page for External Customers

**Files to Modify:**
1. `src/app/chat/ChatPageClient.tsx`

**Changes:**
- Detect if user is external customer
- If external customer:
  - Hide "Rooms" and "Direct Messages" tabs
  - Show only their tickets in a simplified list
  - OR: Redirect to `/support` with message

**Implementation:**
```typescript
// Add user type check in useEffect
const [userIsInternal, setUserIsInternal] = useState<boolean | null>(null)

useEffect(() => {
  if (status !== 'authenticated') return
  
  // Check if user is internal
  fetch('/api/user/type')
    .then(res => res.json())
    .then(data => setUserIsInternal(data.isInternal))
}, [status])

// Conditionally render tabs
{userIsInternal === false ? (
  // External customer view - show only tickets
  <CustomerTicketsView />
) : (
  // Internal user view - show Rooms and DM tabs
  <InternalChatView />
)}
```

**Alternative (Simpler):**
- If external customer, show a message: "You can view your tickets at /tickets (admin access required) or contact support at /support"
- Hide the sidebar entirely for external customers

---

### Phase 6: Prevent External Customers from Creating Rooms/DMs

**Files to Modify:**
1. `src/app/api/chat/rooms/route.ts` (POST handler)
2. `src/app/api/chat/dm/[userId]/route.ts` (if exists)

**Changes:**
- Check if user is external customer before allowing room/DM creation
- Return 403 if external customer tries to create PUBLIC/PRIVATE room or DM

**Implementation:**
```typescript
// In POST /api/chat/rooms
const userIsInternal = await isInternalUser(session.user.id)

if (!userIsInternal && validated.data.type !== 'TICKET') {
  return Response.json({
    ok: false,
    code: 'FORBIDDEN',
    message: 'External customers cannot create rooms or DMs',
  }, { status: 403 })
}
```

---

### Phase 7: Update Room Discovery API

**Files to Modify:**
1. `src/app/api/chat/rooms/discover/route.ts`

**Changes:**
- Check if user is external customer
- If external customer, return empty array or 403

**Implementation:**
```typescript
// After line 21, before building where clause
const dbUser = await prisma.user.findUnique({
  where: { email: session.user.email || '' },
  select: { id: true },
})

if (!dbUser) {
  return Response.json({
    ok: false,
    code: 'USER_NOT_FOUND',
    message: 'User not found',
  }, { status: 404 })
}

const userIsInternal = await isInternalUser(dbUser.id)

if (!userIsInternal) {
  // External customers cannot discover rooms
  return Response.json({
    ok: true,
    code: 'SUCCESS',
    message: 'Rooms retrieved successfully',
    data: {
      rooms: [],
      cursor: null,
      hasMore: false,
      count: 0,
    },
  })
}
```

---

## 6. Testing Checklist

### 6.1 Internal User (Staff) Testing
- [ ] Can see PUBLIC and PRIVATE rooms on Home page
- [ ] Can see PUBLIC and PRIVATE rooms in Chat "Rooms" tab
- [ ] Can see DMs in Chat "Direct Messages" tab
- [ ] Cannot see TICKET rooms in Chat "Rooms" tab
- [ ] Can access `/tickets` page (if admin)
- [ ] Can create PUBLIC/PRIVATE rooms
- [ ] Can create DMs

### 6.2 External Customer Testing
- [ ] Cannot see any rooms on Home page (redirected or empty state)
- [ ] Cannot see rooms in Chat "Rooms" tab (or tabs hidden)
- [ ] Can only see their own tickets in Chat
- [ ] Cannot access `/tickets` page (403 or redirect)
- [ ] Cannot create PUBLIC/PRIVATE rooms (403)
- [ ] Cannot create DMs (403)
- [ ] Can submit tickets via `/support`
- [ ] Can view their own ticket conversations via direct URL

### 6.3 Admin Testing
- [ ] Can see all room types in appropriate places
- [ ] Can access `/tickets` page
- [ ] Can manage tickets
- [ ] Can see all tickets regardless of creator

---

## 7. Files Summary

### Files to Create:
1. `src/lib/user-utils.ts` - User type detection helpers

### Files to Modify:
1. `src/app/chat/ChatPageClient.tsx` - Remove tickets from "Rooms" tab
2. `src/app/api/chat/rooms/route.ts` - Filter by user type
3. `src/app/page.tsx` - Redirect external customers
4. `src/app/api/chat/rooms/discover/route.ts` - Block external customers
5. `src/app/api/chat/rooms/route.ts` (POST) - Prevent external customers from creating rooms
6. `src/app/api/chat/dm/[userId]/route.ts` (if exists) - Prevent external customers from creating DMs

### Files Already Compliant:
1. `src/app/page.tsx` - Home page filtering (already correct)
2. `src/app/tickets/page.tsx` - Tickets page (already correct)
3. `src/app/api/tickets/route.ts` - Tickets API (already correct)
4. `src/app/api/chat/rooms/discover/route.ts` - Discovery API (already filters PUBLIC only)

---

## 8. Risk Assessment

### Low Risk:
- Removing tickets from Chat "Rooms" tab (Phase 1)
- Adding user type detection helper (Phase 2)

### Medium Risk:
- Filtering API responses by user type (Phase 3)
  - **Mitigation**: Test thoroughly with both user types
  - **Rollback**: Remove filter if issues arise

### High Risk:
- Redirecting external customers from home page (Phase 4)
  - **Mitigation**: Provide clear messaging and alternative navigation
  - **Rollback**: Revert redirect, show empty state instead

---

## 9. Implementation Order

**Recommended Sequence:**
1. Phase 1 (Remove tickets from Rooms tab) - Quick win, low risk
2. Phase 2 (User type detection) - Foundation for other phases
3. Phase 3 (Filter API responses) - Core separation logic
4. Phase 4 (Home page access control) - User-facing change
5. Phase 5 (Chat page for external customers) - User-facing change
6. Phase 6 (Prevent room/DM creation) - Security hardening
7. Phase 7 (Block discovery for external customers) - Security hardening

**Alternative (Incremental):**
- Start with Phases 1-3 (backend separation)
- Test with internal users
- Then add Phases 4-7 (access control) incrementally

---

## 10. Success Criteria

✅ **Tickets do not appear in Chat "Rooms" tab**
✅ **External customers cannot see PUBLIC/PRIVATE rooms**
✅ **External customers can only see their own tickets**
✅ **Internal users can see PUBLIC/PRIVATE rooms and DMs**
✅ **Home page shows only PUBLIC/PRIVATE rooms (already compliant)**
✅ **Tickets page shows only TICKET rooms (already compliant)**
✅ **DM tab shows only DM rooms (already compliant)**

---

## End of Document

