# OpenClaw Session Manager - Product Requirements Document

## 1. Concept & Vision

A powerful web-based client for managing multiple OpenClaw agent sessions. The interface combines Discord's familiar sidebar navigation with a modern chat-first experience, allowing users to interact with AI sessions, browse web content within an embedded iframe, and monitor system logs - all within a single unified dashboard.

**Target Users:** Developers and power users who run OpenClaw and need multi-session management with team collaboration features.

---

## 2. Design Language

### Aesthetic Direction
Modern, dark-mode first interface inspired by Discord and Linear. Clean lines, subtle borders, and purposeful use of color to indicate state and hierarchy.

### Color Palette
```
Background Primary:    #0a0a0b (near black)
Background Secondary:  #121214 (card surfaces)
Background Tertiary:   #1a1a1d (elevated elements)
Border:                #2a2a2e (subtle borders)
Border Hover:          #3a3a3e (interactive borders)

Text Primary:          #fafafa (white)
Text Secondary:        #a1a1aa (muted gray)
Text Tertiary:         #71717a (disabled)

Accent Primary:        #6366f1 (indigo - primary actions)
Accent Hover:          #818cf8 (lighter indigo)
Accent Success:        #22c55e (green - online/active)
Accent Warning:        #f59e0b (amber - warnings)
Accent Error:          #ef4444 (red - errors)
Accent Info:           #3b82f6 (blue - info)
```

### Typography
```
Font Family:   Inter (Google Fonts) with system fallbacks
Headings:      Inter 600 (semibold)
Body:          Inter 400 (regular)
Mono/Code:     JetBrains Mono (for logs)
```

### Spatial System
```
Base unit:     4px
Spacing:       4, 8, 12, 16, 24, 32, 48, 64
Border radius: 6px (small), 8px (medium), 12px (large)
```

### Motion Philosophy
- Transitions: 150ms ease-out for interactive states
- Page transitions: 200ms fade
- Loading states: Subtle pulse animation
- No excessive animation - content first

---

## 3. Layout & Structure

### Main Application Layout (Three-Column)
```
┌────────────────────────────────────────────────────────────────────┐
│  Header (56px) - Logo, Search, User Menu                          │
├──────────┬─────────────────────────────────┬───────────────────────┤
│ Sessions │         Chat Area               │    Right Panel        │
│ Sidebar  │                                 │                       │
│ (280px)  │  (Flexible)                     │  ┌─────────────────┐  │
│          │                                 │  │  iframe         │  │
│ ┌──────┐ │  ┌───────────────────────────┐  │  │  (Web View)     │  │
│ │ + New│ │  │     Messages Area         │  │  │                 │  │
│ └──────┘ │  │                           │  │  │                 │  │
│          │  │                           │  │  ├─────────────────┤  │
│ Session1 │  │                           │  │  │  URL Bar        │  │
│ Session2 │  │                           │  │  ├─────────────────┤  │
│ Session3 │  │                           │  │  │  Log Panel      │  │
│          │  └───────────────────────────┘  │  │  (Collapsible)  │  │
│          │  ┌───────────────────────────┐  │  └─────────────────┘  │
│          │  │     Input Area            │  │                       │
│          │  └───────────────────────────┘  │                       │
└──────────┴─────────────────────────────────┴───────────────────────┘
```

### Responsive Strategy
- Desktop (>1280px): Full three-column layout
- Tablet (768-1280px): Collapsible sidebar, stacked right panel
- Mobile (<768px): Single column with drawer navigation

---

## 4. Features & Interactions

### 4.1 Authentication System

#### Admin Setup
- Initial admin account created via CLI seed script
- Admin can create other admin or user accounts
- No public registration - all accounts admin-created

#### User Roles & Permissions
```
Admin:
- Full system access
- Can manage all users and sessions
- Can assign sessions to users
- Can create/delete any session

User:
- Can create sessions (if permitted)
- Can only access assigned sessions
- Cannot manage other users
```

#### Permission Fields (per user)
```javascript
{
  canCreateSession: boolean,  // Can create new sessions
  canDeleteSession: boolean,  // Can delete own sessions
  canManageUsers: boolean,    // Admin only - can manage users
  allowedSessions: string[],  // Empty array = all sessions (admin)
                              // Specific IDs = only those sessions
  assignedSessions: string[]  // Sessions this user can access
}
```

### 4.2 Session Management

#### Session List (Sidebar)
- Display all accessible sessions for current user
- Show session status indicator (online/offline/idle)
- Show last activity timestamp
- Click to select and open in chat area
- Right-click context menu: Rename, Delete, Settings

#### Session Status States
```
online:   Green dot (#22c55e) - Active and responsive
idle:     Yellow dot (#f59e0b) - Connected but inactive >5min
offline:  Gray dot (#71717a) - Disconnected
error:    Red dot (#ef4444) - Connection error
```

#### Create New Session
- Click "+ New Session" button
- Enter session name
- Session connects to OpenClaw gateway automatically
- New session appears in sidebar immediately

### 4.3 Chat Interface

#### Message Display
- Messages grouped by sender (user vs assistant)
- Timestamps shown on hover
- Code blocks with syntax highlighting (Prism.js)
- Markdown support (bold, italic, links, lists)
- Image/file attachments displayed inline

#### Message Input
- Multi-line text input with auto-resize
- Markdown shortcuts (**, __, `, ```)
- Send on Enter, Shift+Enter for new line
- Disabled state when session disconnected

#### Message Types
```
text:        Plain text message
code:        Code block with language tag
image:       Image attachment with preview
system:      System message (session joined, etc.)
```

### 4.4 iframe Web View

#### URL Bar
- Text input for URL entry
- "Go" button to navigate
- Quick bookmarks dropdown (saved URLs per session)
- Current URL displayed

#### iframe Behavior
- Sandboxed with limited permissions
- X-Frame-Options: Allows from same origin
- Communicates with parent via postMessage API
- Can receive commands like "navigate", "reload"
- Auto-height adjustment based on content

#### Bookmark Management
- Save current URL with title
- Display in dropdown for quick access
- Stored per-session in database

### 4.5 Log Panel

#### Log Sources
```
backend:   Server-side logs (Elysia)
frontend:  Client-side console logs
pm2:       Process manager logs (via PM2 API)
```

#### Log Display
- Collapsible panel (default collapsed)
- Filter by source and level
- Auto-scroll to latest
- Clear logs button
- Export logs as JSON

#### Log Entry Format
```
[timestamp] [source] [level] message
2024-01-15 10:30:45  backend  info  Session connected: sess_123
```

### 4.6 Admin Panel

#### Dashboard
- Total users count
- Total sessions count
- Active sessions
- Recent activity feed

#### User Management
- List all users with role/permissions
- Create new user (username, email, password, role)
- Edit user permissions
- Delete user (with confirmation)
- Assign/remove sessions to users

#### Session Management
- View all sessions across all users
- Force disconnect session
- Delete session
- View session logs

---

## 5. Component Inventory

### Layout Components

#### `AppShell`
- Three-column responsive layout
- Manages sidebar collapse state
- Provides context for active session

#### `Sidebar`
- Session list with search/filter
- New session button
- Collapse to icons on tablet
- States: expanded, collapsed, mobile-drawer

#### `Header`
- Logo and app name
- Global search (sessions, messages)
- User avatar dropdown (profile, logout)
- Notification bell (future)

### Session Components

#### `SessionItem`
- Session name (editable on double-click)
- Status indicator dot
- Last activity timestamp
- States: default, hover, selected, loading

#### `SessionList`
- Virtual scrolling for large lists
- Drag-to-reorder (future)
- Filter by status

### Chat Components

#### `ChatContainer`
- Messages scroll area
- Auto-scroll on new message
- Jump-to-bottom button when scrolled up

#### `ChatMessage`
- Avatar, name, timestamp
- Message content (markdown rendered)
- Code blocks with copy button
- States: sending, sent, error

#### `ChatInput`
- Auto-growing textarea
- Send button with loading state
- Markdown toolbar (optional)
- States: default, disabled, sending

### iframe Components

#### `WebView`
- iframe with URL bar
- Bookmark dropdown
- Refresh, back, forward buttons
- States: loading, loaded, error, blocked

#### `UrlBar`
- URL input with validation
- Go button
- Bookmark save/load

### Log Components

#### `LogPanel`
- Collapsible container
- Source/level filters
- Log stream (real-time via WebSocket)

#### `LogEntry`
- Timestamp, source badge, level badge
- Message content
- Expandable for long messages

### Admin Components

#### `UserTable`
- Sortable columns
- Row actions (edit, delete)
- Pagination

#### `UserForm`
- Create/Edit user
- Role selector
- Permission toggles
- Session assigner

#### `StatCard`
- Icon, value, label
- Optional trend indicator

---

## 6. Technical Approach

### Frontend Stack
```
Framework:       Next.js 14 (App Router)
UI Library:      shadcn/ui + Radix primitives
Styling:         Tailwind CSS
State:           Zustand (client state)
Data Fetching:  TanStack Query
Forms:           React Hook Form + Zod
Real-time:       Native WebSocket
Routing:         Next.js App Router
```

### Backend Stack
```
Runtime:         Bun
Framework:       Elysia.js
Database:        MongoDB with Mongoose
Auth:            JWT (access + refresh tokens)
WebSocket:       @elysiajs/websocket
Validation:      @sinclair/typebox
```

### Database Schema (MongoDB)

#### Users Collection
```javascript
{
  _id: ObjectId,
  username: String (unique, required),
  email: String (unique, required),
  passwordHash: String (required),
  role: "admin" | "user",
  permissions: {
    canCreateSession: Boolean,
    canDeleteSession: Boolean,
    canManageUsers: Boolean,
    allowedSessions: [ObjectId],
    assignedSessions: [ObjectId]
  },
  createdAt: Date,
  updatedAt: Date,
  lastLoginAt: Date
}
```

#### Sessions Collection
```javascript
{
  _id: ObjectId,
  name: String (required),
  sessionKey: String (unique, required),  // OpenClaw session identifier
  ownerId: ObjectId (ref: users),
  status: "online" | "idle" | "offline" | "error",
  metadata: {
    agentType: String,
    lastCommand: String
  },
  bookmarks: [{
    _id: ObjectId,
    title: String,
    url: String
  }],
  createdAt: Date,
  updatedAt: Date,
  lastActivityAt: Date
}
```

#### Messages Collection
```javascript
{
  _id: ObjectId,
  sessionId: ObjectId (ref: sessions),
  userId: ObjectId (ref: users),
  role: "user" | "assistant" | "system",
  content: String,
  attachments: [{
    type: "image" | "file",
    url: String,
    name: String
  }],
  createdAt: Date
}
```

#### Logs Collection
```javascript
{
  _id: ObjectId,
  sessionId: ObjectId (ref: sessions),
  source: "backend" | "frontend" | "pm2",
  level: "debug" | "info" | "warn" | "error",
  message: String,
  metadata: Object,
  createdAt: Date
}
```

### API Endpoints

#### Authentication
```
POST   /api/auth/login          - Login (returns JWT)
POST   /api/auth/logout         - Logout (clear cookies)
GET    /api/auth/me             - Get current user
POST   /api/auth/refresh        - Refresh access token
```

#### Users (Admin only)
```
GET    /api/users               - List all users
POST   /api/users               - Create user
GET    /api/users/:id           - Get user by ID
PUT    /api/users/:id           - Update user
DELETE /api/users/:id           - Delete user
POST   /api/users/:id/sessions  - Assign sessions to user
DELETE /api/users/:id/sessions/:sessionId - Remove session from user
```

#### Sessions
```
GET    /api/sessions            - List accessible sessions
POST   /api/sessions            - Create new session
GET    /api/sessions/:id        - Get session details
PUT    /api/sessions/:id        - Update session
DELETE /api/sessions/:id        - Delete session
POST   /api/sessions/:id/connect - Connect to OpenClaw gateway
WS     /ws/sessions/:id         - WebSocket for real-time messaging
```

#### Messages
```
GET    /api/sessions/:id/messages         - Get session messages
POST   /api/sessions/:id/messages          - Send message
DELETE /api/sessions/:id/messages/:msgId  - Delete message
```

#### iframe & Bookmarks
```
GET    /api/sessions/:id/bookmarks        - Get bookmarks
POST   /api/sessions/:id/bookmarks        - Add bookmark
DELETE /api/sessions/:id/bookmarks/:bookmarkId - Delete bookmark
```

#### Logs
```
GET    /api/sessions/:id/logs             - Get logs (paginated)
WS     /ws/logs/:sessionId                - Real-time log stream
GET    /api/sessions/:id/logs/pm2          - Get PM2 logs
POST   /api/logs                          - Write log entry
```

### OpenClaw Integration

#### Gateway Connection
- Backend maintains WebSocket connection to OpenClaw Gateway
- Each session maps to an OpenClaw sessionKey
- Messages forwarded via WebSocket bridge
- Status updates pushed to connected clients

#### Session Lifecycle
1. Client creates session via API
2. Backend registers session with OpenClaw Gateway
3. OpenClaw creates actual agent session
4. Backend stores sessionKey mapping
5. Chat messages flow through backend to OpenClaw
6. On disconnect, cleanup registered sessions

---

## 7. File Structure

```
openclaw-session-client/
├── prd.md
├── README.md
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── components.json
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── sessions/
│   │   │       ├── page.tsx
│   │   │       └── [id]/
│   │   │           └── page.tsx
│   │   ├── admin/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── users/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   └── sessions/
│   │   │       └── page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       ├── users/
│   │       ├── sessions/
│   │       └── logs/
│   │
│   ├── components/
│   │   ├── ui/                    # shadcn components
│   │   ├── layout/
│   │   │   ├── app-shell.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── header.tsx
│   │   ├── sessions/
│   │   ├── chat/
│   │   ├── iframe/
│   │   ├── logs/
│   │   └── admin/
│   │
│   ├── lib/
│   │   ├── db.ts                 # MongoDB connection
│   │   ├── auth.ts               # Auth utilities
│   │   ├── utils.ts              # General utilities
│   │   └── openclaw.ts          # OpenClaw gateway client
│   │
│   ├── stores/
│   │   ├── auth-store.ts
│   │   ├── session-store.ts
│   │   └── ui-store.ts
│   │
│   └── types/
│       └── index.ts
│
├── backend/
│   ├── src/
│   │   ├── index.ts              # Elysia entry
│   │   ├── app.ts                # Main app setup
│   │   ├── db/
│   │   │   ├── mongodb.ts
│   │   │   └── schemas/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── sessions.ts
│   │   │   └── logs.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── user.service.ts
│   │   │   ├── session.service.ts
│   │   │   └── log.service.ts
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts
│   │   └── websocket/
│   │       ├── handler.ts
│   │       └── sessions.ts
│   │
│   ├── package.json
│   └── tsconfig.json
│
└── scripts/
    └── seed-admin.ts             # Create initial admin
```

---

## 8. Security Considerations

### Authentication
- Passwords hashed with bcrypt (12 rounds)
- JWT with short expiry (15min) + refresh tokens
- HTTPOnly cookies for token storage
- CSRF protection via SameSite cookie

### Authorization
- Role-based access control (RBAC)
- Session ownership verification on every request
- Input validation with Zod schemas
- SQL/NoSQL injection prevention

### iframe Security
- sandbox attribute with limited permissions
- No script execution from iframe
- postMessage origin verification
- CSP headers configured

### General
- Rate limiting on auth endpoints
- Input sanitization everywhere
- Environment variables for secrets
- No sensitive data in client-side code
