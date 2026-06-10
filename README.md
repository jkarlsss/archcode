# ArchCode

A powerful AI coding assistant with a terminal-based UI (TUI) built with React and OpenTUI, backed by a Hono server with multiple LLM provider support.

## Architecture

ArchCode is a monorepo with four workspaces:

```
archcode/
├── packages/
│   ├── cli/          # Terminal-based React UI (OpenTUI + React Router)
│   ├── server/       # Hono API server with AI streaming
│   ├── database/     # Prisma ORM with PostgreSQL
│   └── shared/       # Shared types, schemas, and model configs
├── package.json      # Root workspace config
└── vercel.json       # Vercel deployment config
```

### Package Overview

| Package | Description | Key Technologies |
|---------|-------------|------------------|
| `@archcode/cli` | Terminal UI with React components | OpenTUI, React 19, React Router 7, AI SDK React |
| `@archcode/server` | REST API with streaming chat | Hono, AI SDK, Zod, Sentry, Clerk |
| `@archcode/database` | Database layer | Prisma, PostgreSQL |
| `@archcode/shared` | Shared types & tool schemas | Zod, AI SDK |

---

## Features

- **Terminal-Native UI**: Built with OpenTUI for a true terminal experience
- **Dual Modes**: PLAN (read-only) and BUILD (read-write) modes
- **Multi-Provider LLM Support**: Anthropic, OpenAI, Google, OpenRouter
- **Session Management**: Persistent chat sessions with history
- **Tool Integration**: File operations, search, bash execution
- **Streaming Responses**: Real-time token streaming via AI SDK
- **Authentication**: Clerk-based auth with token persistence
- **Error Tracking**: Sentry integration

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.x
- PostgreSQL database (local or hosted)
- Clerk account for authentication
- API keys for LLM providers (Anthropic, OpenAI, Google, OpenRouter)

### Installation

```bash
# Clone and install dependencies
git clone <repository-url>
cd archcode
bun install

# Set up environment variables
cp .env.example .env  # Create and configure
```

### Environment Variables

Create `.env` in the root directory:

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/archcode"

# Clerk Authentication
CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."

# LLM Providers (at least one required)
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."
GOOGLE_GENERATIVE_AI_API_KEY="..."
OPENROUTER_API_KEY="..."

# Sentry (optional)
SENTRY_DSN="https://..."
```

### Database Setup

```bash
# Generate Prisma client and push schema
bun run --cwd packages/database db:generate
bun run --cwd packages/database db:push

# Optional: Open Prisma Studio
bun run --cwd packages/database db:studio
```

---

## Development

### Run All Services

```bash
# Terminal 1: Start the API server
bun run dev:server

# Terminal 2: Start the CLI
bun run dev:cli
```

### Individual Package Commands

```bash
# CLI
bun run --filter @archcode/cli dev      # Watch mode
bun run --filter @archcode/cli build    # Production build

# Server
bun run --filter @archcode/server dev   # Hot reload
bun run --filter @archcode/server build # Production build

# Database
bun run --cwd packages/database db:generate
bun run --cwd packages/database db:push
bun run --cwd packages/database db:studio
```

---

## Usage

### CLI Interface

Launch the CLI:

```bash
bun run dev:cli
```

Or after building:

```bash
bun run build:cli && bun link
archcode  # Run globally
```

### Navigation

| Screen | Route | Description |
|--------|-------|-------------|
| Home | `/` | Start new coding session |
| New Session | `/sessions/new` | Creating session with initial prompt |
| Session | `/sessions/:id` | Active coding session |

### Modes

- **PLAN** (default): Read-only analysis and planning
- **BUILD**: Full implementation with file read/write/execute

Switch modes with `Tab` key in the session view.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Open agents/model selection |
| `Esc` | Interrupt streaming response |
| `Enter` | Submit prompt |
| `Ctrl+C` | Exit application |

---

## API Reference

### Base URL

```
Development: http://localhost:3000
Production:  https://your-domain.vercel.app
```

### Authentication

All endpoints (except `/auth/*`) require Bearer token:

```
Authorization: Bearer <clerk-jwt-token>
```

### Endpoints

#### Sessions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/sessions` | List user sessions |
| `GET` | `/sessions/:id` | Get session with messages |
| `POST` | `/sessions` | Create new session |

#### Chat

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat` | Stream chat response |

**Request Body:**
```json
{
  "id": "session-id",
  "messages": [...],
  "mode": "BUILD" | "PLAN",
  "model": "claude-sonnet-4-6"
}
```

**Response:** Streaming UI message format (AI SDK)

#### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/callback` | Clerk webhook handler |

---

## Supported Models

| Provider | Models |
|----------|--------|
| Anthropic | claude-sonnet-4-6, claude-haiku-4-5, claude-opus-4-6 |
| OpenAI | gpt-5.4, gpt-5.4-mini, gpt-5.4-nano |
| Google | gemini-3.5-flash, gemini-3-flash-preview, gemini-3.1-flash-lite |
| OpenRouter | nvidia/nemotron-3-ultra-550b-a55b:free |

Default: `gemini-3.5-flash`

---

## Project Structure Details

### CLI (`packages/cli/src`)

```
src/
├── components/       # React components (messages, dialogs, inputs)
├── hooks/            # Custom hooks (useChat)
├── layouts/          # Layout components
├── lib/              # API client, auth, HTTP errors
├── providers/        # React context providers (theme, toast, dialog)
├── screens/          # Route screens (Home, NewSessions, Session)
└── index.tsx         # Entry point
```

### Server (`packages/server/src`)

```
src/
├── routes/           # API route handlers (auth, chat, sessions)
├── middleware/       # Auth middleware
├── lib/              # Model resolution
├── system-prompt.ts  # System prompt builder
└── index.ts          # Hono app entry
```

### Shared (`packages/shared/src`)

```
src/
├── models.ts         # LLM model definitions & pricing
├── schemas.ts        # Tool schemas (read, write, edit, bash, glob, grep)
└── index.ts          # Barrel exports
```

### Database (`packages/database`)

```
prisma/
└── schema.prisma     # Session model with JSON messages
src/
├── index.ts          # Prisma client exports
└── client.ts         # Configured client instance
```

---

## Deployment

### Vercel (Server)

The server is configured for Vercel deployment via `vercel.json`:

```bash
# Deploy server
vercel --cwd packages/server
```

### CLI Distribution

```bash
# Build and link locally
bun run build:cli
bun run link:cli

# Or publish to npm
cd packages/cli && npm publish
```

---

## Tech Stack

| Category | Technologies |
|----------|--------------|
| **Runtime** | Bun |
| **Language** | TypeScript |
| **UI Framework** | React 19, OpenTUI, React Router 7 |
| **API Framework** | Hono |
| **AI/Streaming** | Vercel AI SDK 5 |
| **Database** | Prisma, PostgreSQL |
| **Validation** | Zod 4 |
| **Auth** | Clerk |
| **Observability** | Sentry |
| **Build** | Bun build |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run linting: `bun run lint` (if configured)
5. Submit a PR

---

## License

MIT License - see LICENSE file for details.