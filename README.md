# OpenClaw Session Manager

A powerful web-based client for managing multiple OpenClaw agent sessions through a direct gateway connection.

## Features

- 🔐 **Role-based Access Control** - Admin and user roles with granular permissions
- 💬 **Multi-Session Chat** - Manage and interact with multiple OpenClaw sessions
- 🔗 **Direct Gateway Connection** - Connects directly to your OpenClaw Gateway (ws://127.0.0.1:18789)
- 📁 **File & Image Support** - Send images and documents directly to sessions
- 🌐 **Integrated Web View** - Browse websites within an iframe panel
- 📊 **Real-time Logs** - Monitor backend, frontend, and PM2 logs
- 🔖 **URL Bookmarks** - Save and manage URLs per session
- 👥 **User Management** - Admin panel for user and session management

## Architecture

```
┌──────────────┐      HTTP       ┌──────────────┐      WebSocket      ┌─────────────────┐
│   Frontend   │ ◀──────────────▶│   Backend    │ ◀─────────────────▶│ OpenClaw Gateway│
│  (Next.js)   │   /api/*       │  (Elysia)    │    ws://:18789     │   (Port 18789)   │
└──────────────┘                └──────────────┘                     └─────────────────┘
                                                                              │
         ┌────────────────────────────────────────────────────────────────┘
         ▼
   ┌───────────┐
   │ OpenClaw  │
   │  Agent    │
   └───────────┘
```

## Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **shadcn/ui** - High-quality Radix UI components
- **Tailwind CSS** - Utility-first styling
- **Zustand** - Client-side state management

### Backend
- **Elysia** - Fast Bun web framework
- **MongoDB** - Document database
- **JWT** - Authentication with access/refresh tokens

## Prerequisites

- Node.js 18+
- Bun runtime (for backend)
- MongoDB instance
- **OpenClaw Gateway running on port 18789**

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/raksix/openclaw-session-client.git
cd openclaw-session-client
```

### 2. Install dependencies

```bash
# Frontend dependencies
npm install

# Backend dependencies
cd backend && bun install && cd ..
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# Backend URL (for CORS)
BACKEND_URL=http://localhost:4000

# OpenClaw Gateway
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_PASSWORD=your-gateway-password
```

### 4. Start OpenClaw Gateway

Your Gateway must be running before starting the backend:

```bash
# Start the gateway (default port: 18789)
openclaw gateway

# Or with custom port
openclaw gateway --port 18789
```

The gateway password is set during initial setup. Default is usually `Fe277353` unless changed.

### 5. Seed the admin user

```bash
cd backend
bun run scripts/seed-admin.ts
cd ..
```

### 6. Start the servers

**Backend (in one terminal):**
```bash
cd backend
bun run dev
```

**Frontend (in another terminal):**
```bash
npm run dev
```

### 7. Open the app

Navigate to http://localhost:3001 and login with:

| Username | Password |
|----------|----------|
| `admin` | `admin123change` |

---

## Connecting to a Remote Gateway

If your OpenClaw Gateway is on a different machine, update the environment:

```env
OPENCLAW_GATEWAY_URL=ws://192.168.1.100:18789
OPENCLAW_GATEWAY_PASSWORD=your-remote-gateway-password
```

## Gateway Connection Protocol

The backend connects to OpenClaw Gateway using a WebSocket protocol:

1. **Connect**: Establish WebSocket connection to `ws://127.0.0.1:18789`
2. **Challenge**: Gateway sends `connect.challenge` event with a nonce
3. **Authenticate**: Send `connect` request with `client.id: "cli"` and `auth.password`
4. **Ready**: Once authenticated, you receive events and can send requests

### Example Gateway Connection (for debugging)

```typescript
import { WebSocket } from "ws";

const ws = new WebSocket("ws://127.0.0.1:18789");
const PASSWORD = "Fe277353";

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.event === "connect.challenge") {
    const nonce = msg.payload.nonce;
    
    // Send connect request
    ws.send(JSON.stringify({
      type: "req",
      id: "auth-1",
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "cli",
          displayName: "My App",
          version: "1.0.0",
          platform: "linux",
          mode: "backend"
        },
        auth: { password: PASSWORD },
        role: "operator"
      }
    }));
  }
  
  if (msg.type === "res" && msg.id === "auth-1") {
    if (msg.ok) {
      console.log("✅ Connected to Gateway!");
    } else {
      console.error("❌ Auth failed:", msg.error);
    }
  }
});
```

## API Routes

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout (invalidate tokens)

### Sessions (via Gateway)
- `GET /api/sessions` - List all sessions from Gateway
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id` - Get session details
- `DELETE /api/sessions/:id` - Delete session

### Messages
- `GET /api/sessions/:id/messages` - Get messages for a session
- `POST /api/sessions/:id/messages` - Send message to a session

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## Deployment

### Using PM2

```bash
# Backend
pm2 start backend/src/index.ts --name openclaw-backend -- Benzi

# Frontend
pm2 start npm --name openclaw-frontend -- run start
```

## Project Structure

```
openclaw-session-client/
├── src/
│   ├── app/               # Next.js App Router pages
│   │   ├── (auth)/        # Auth pages (login)
│   │   ├── (dashboard)/   # Main app pages
│   │   ├── admin/         # Admin panel pages
│   │   └── api/           # API proxy routes
│   ├── components/        # React components
│   │   └── ui/            # shadcn/ui components
│   └── lib/               # Utilities
├── backend/
│   └── src/
│       ├── routes/        # API endpoints
│       ├── services/      # Business logic (incl. gateway.service.ts)
│       ├── middleware/    # Auth middleware
│       └── db/            # MongoDB connection & schemas
└── README.md
```

## Troubleshooting

### Gateway Connection Failed
1. Ensure OpenClaw Gateway is running: `ps aux | grep openclaw-gateway`
2. Check firewall: `sudo ufw status`
3. Verify password is correct in `.env`

### "connect.challenge missing nonce"
The gateway received the connection request but rejected it. Verify:
- `client.id` must be one of: `cli`, `webchat`, `openclaw-control-ui`, etc.
- `auth.password` must match your gateway password

### Sessions Not Loading
- Check if Gateway is responding: `curl -s http://127.0.0.1:18789`
- Verify Gateway password hasn't changed
- Check backend logs: `pm2 logs openclaw-backend`

## License

MIT
