# OpenClaw Session Manager

A powerful web-based client for managing multiple OpenClaw agent sessions. The interface combines Discord's familiar sidebar navigation with a modern chat-first experience.

## Features

- 🔐 **Role-based Access Control** - Admin and user roles with granular permissions
- 💬 **Multi-Session Chat** - Manage and interact with multiple OpenClaw sessions
- 🌐 **Integrated Web View** - Browse websites within an iframe panel
- 📊 **Real-time Logs** - Monitor backend, frontend, and PM2 logs
- 🔖 **URL Bookmarks** - Save and manage URLs per session
- 👥 **User Management** - Admin panel for user and session management

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **shadcn/ui** - High-quality Radix UI components
- **Tailwind CSS** - Utility-first styling
- **Zustand** - Client-side state management
- **TanStack Query** - Data fetching and caching

### Backend
- **Elysia** - Fast Bun web framework
- **MongoDB** - Document database
- **JWT** - Authentication with access/refresh tokens

## Getting Started

### Prerequisites

- Node.js 18+
- Bun runtime (for backend)
- MongoDB instance

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/openclaw-session-client.git
cd openclaw-session-client
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd backend
bun install
cd ..
```

4. Copy environment variables:
```bash
cp .env.example .env
```

5. Start MongoDB (if not running):
```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or use your existing MongoDB connection string in .env
```

6. Seed the admin user:
```bash
cd backend
bun run scripts/seed-admin.ts
cd ..
```

7. Start the development servers:

**Backend (in one terminal):**
```bash
cd backend
bun run dev
```

**Frontend (in another terminal):**
```bash
npm run dev
```

8. Open http://localhost:3000 and login with:
- Username: `admin`
- Password: `admin123change`

## Project Structure

```
openclaw-session-client/
├── src/                    # Next.js frontend
│   ├── app/               # App router pages
│   ├── components/        # React components
│   ├── lib/               # Utilities
│   ├── stores/            # Zustand stores
│   └── types/             # TypeScript types
├── backend/               # Elysia backend
│   └── src/
│       ├── routes/        # API routes
│       ├── services/      # Business logic
│       ├── middleware/    # Auth middleware
│       └── db/            # Database connection & schemas
├── scripts/               # Utility scripts
├── prd.md                 # Product requirements document
└── README.md
```

## API Documentation

When the backend is running, visit:
- Swagger UI: http://localhost:4000/swagger

## Environment Variables

See `.env.example` for all configuration options.

## License

MIT
