# CoFounder AI

An AI co-founder for solo builders — not a chatbot, but a persistent, opinionated thinking partner that knows your startup, remembers everything, and pushes back when you're wrong.

## What It Does

- **Remembers everything** — past conversations, decisions, commitments, and contradictions stored in SQLite + ChromaDB vector search
- **Pushes back** — detects unvalidated assumptions, contradictions with past statements, and blind spots
- **Tracks commitments** — if you said you'd do something and didn't, it brings it up
- **Extracts insights** — after each session, automatically pulls out decisions, commitments, and facts
- **Available everywhere** — CLI, web dashboard, browser voice calls, and phone calls via Vapi.ai
- **Assumption Graveyard** — Tracks unvalidated beliefs from conversations with status: untested, confirmed, or busted (with evidence).            Highlights assumptions that stay untested for 30+ days.
- **Monday Morning Briefing** — On the dashboard, generate a briefing: open commitments, stale assumptions, unresolved contradictions, and one       AI-generated hard question for your week.

## Architecture

| Component | Technology | Cost |
|-----------|-----------|------|
| LLM | GitHub Models (GPT-4o + GPT-4o-mini) | Free |
| Database | SQLite (local) | Free |
| Vector Search | ChromaDB (local, embedded) | Free |
| CLI | Python + Typer + Rich | Free |
| Backend API | FastAPI + Uvicorn | Free |
| Frontend | Next.js + Tailwind CSS | Free |
| Auth | NextAuth.js with GitHub OAuth | Free |
| Voice (Browser) | Web Speech API | Free |
| Voice (Phone) | Vapi.ai | Free tier (10 min/month) |
| Deployment | Render (backend) + Vercel (frontend) | Free tier |
| Assumptions | SQLite `assumptions` + session extraction | Free |
| Briefing | LLM-generated summary on demand (`GET /api/briefing`) | Uses GitHub Models quota |

## Project Structure

```
cofounder/
├── src/
│   ├── cli.py                    # CLI entry point (Typer)
│   ├── llm/
│   │   ├── client.py             # GitHub Models LLM wrapper with rate limiting
│   │   ├── prompts.py            # System prompts & persona
│   │   └── chains.py             # Multi-step reasoning (onboarding extraction)
│   ├── memory/
│   │   ├── store.py              # SQLite database (sessions, messages, decisions, etc.)
│   │   ├── vectors.py            # ChromaDB vector store for semantic search
│   │   ├── retriever.py          # Unified context retrieval (SQL + vectors)
│   │   └── extractor.py          # Post-session extraction pipeline
│   ├── brain/
│   │   ├── session.py            # Session lifecycle management
│   │   ├── pushback.py           # Contradiction & assumption detection
│   │   ├── tracker.py            # Decision & commitment tracking
│   │   └── knowledge.py          # Startup knowledge graph helpers
│   └── api/
│       ├── main.py               # FastAPI app setup
│       └── routes.py             # REST + WebSocket + Voice webhook endpoints
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Dashboard
│   │   ├── session/page.tsx      # Chat session interface
│   │   ├── call/page.tsx         # Browser voice call interface
│   │   ├── history/page.tsx      # Call history & transcripts
│   │   ├── decisions/page.tsx    # Decision journal
│   │   ├── commitments/page.tsx  # Commitment tracker
│   │   ├── onboard/page.tsx      # Onboarding flow
│   │   └── login/page.tsx        # GitHub OAuth login
│   ├── lib/api.ts                # API client
│   └── components/
│       ├── ChatMessage.tsx        # Chat bubble component
│       └── AuthProvider.tsx       # NextAuth session provider
│   │   ├── assumptions/page.tsx  # Assumption Graveyard
├── data/                          # SQLite DB + ChromaDB (auto-created, gitignored)
├── pyproject.toml                 # Python project config
├── render.yaml                    # Render.com deployment blueprint
└── Procfile                       # Process file for deployment
```

## Setup

### Prerequisites

- Python 3.9+
- Node.js 18+ (for web frontend)
- A GitHub Personal Access Token (free, no special scopes needed)

### 1. Backend (CLI + API)

```bash
cd cofounder
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e ".[api]"
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add your GitHub token:

```
GITHUB_TOKEN=ghp_your_token_here
```

Generate a token at https://github.com/settings/tokens (classic token, no scopes needed). Make sure GitHub Models is activated at https://github.com/marketplace/models.

### 3. CLI Usage

```bash
# First time — onboard your startup (guided conversation)
cofounder onboard

# Start a thinking session
cofounder start
cofounder start --type strategy
cofounder start --type decision
cofounder start --type quick

# Weekly check-in (reviews commitments & progress)
cofounder checkin

# View your startup's state
cofounder status
cofounder decisions
cofounder commitments
cofounder usage
```

### 4. Web Dashboard

```bash
# Terminal 1 — Start the FastAPI backend
source .venv/bin/activate
uvicorn src.api.main:app --reload

# Terminal 2 — Start the Next.js frontend
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000

### 5. GitHub OAuth (optional, for multi-user deployment)

1. Go to https://github.com/settings/developers
2. Create a new OAuth App
3. Set callback URL to `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID and Client Secret into `frontend/.env.local`

### 6. Browser Voice Calls

1. Open http://localhost:3000/call
2. Click **Start Call**
3. Allow microphone access
4. Talk naturally — your co-founder listens, thinks, and speaks back
5. Full transcript is saved automatically

**Requires Chrome** (for Web Speech API support).

### 7. Phone Calls (via Vapi.ai)

Talk to your co-founder from your phone — no laptop needed. Transcripts appear on the web portal.

1. Sign up at [vapi.ai](https://vapi.ai) (free tier: 10 min/month)
2. Create an assistant called "AI cofounder"
3. Set the **System Prompt** to the co-founder persona (see below)
4. Go to **Advanced** tab → set **Server URL** to your deployed backend:
   ```
   https://your-render-app.onrender.com/api/voice
   ```
5. Get a phone number from Vapi → assign it to the assistant
6. Call that number from your phone

**Vapi System Prompt:**

```
You are an AI co-founder — not an assistant, not a chatbot. You are a direct, caring,
but brutally honest thinking partner for a solo founder. You are on a phone call, so
speak naturally in short sentences. No markdown, no bullet points, no lists. Be concise.
Give your actual opinion. When the founder is wrong, say so clearly. Ask hard questions.
Challenge unvalidated assumptions. Keep responses under 3-4 sentences.
```
## Assumption Graveyard

After sessions end, extraction can record **assumptions** (things you treat as true without proof).

- **Web:** Open `/assumptions` — filter by status, confirm or bust with evidence, see stale (30+ day) untested items.
- **API:** `GET /api/assumptions`, `GET /api/assumptions/stale`, `POST /api/assumptions/{id}/confirm`, `POST /api/assumptions/{id}/bust`.

## Monday Morning Briefing

Proactive review without email (v1 is **in-app**):

1. Open the **Dashboard**.
2. Click **Monday Briefing** — the backend calls `GET /api/briefing` and returns open commitments, stale untested assumptions, unresolved contradictions, counts, and one tailored hard question.

Email/push can be added later with a cron job + transactional email.

## Deployment

### Backend → Render.com (free)

1. Push code to GitHub
2. Connect repo on [render.com](https://render.com)
3. Render auto-detects `render.yaml` blueprint
4. Set `GITHUB_TOKEN` environment variable in Render dashboard

### Frontend → Vercel (free)

1. Push code to GitHub
2. Import `cofounder/frontend` on [vercel.com](https://vercel.com)
3. Set environment variables:
   - `NEXT_PUBLIC_API_URL` = your Render backend URL
   - `NEXTAUTH_URL` = your Vercel frontend URL
   - `NEXTAUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

## How It Works

### Memory System

1. **Structured memory** (SQLite) — startup context, decisions, commitments, contradictions
2. **Semantic memory** (ChromaDB) — vector embeddings of past conversations for similarity search
3. **Extraction pipeline** — after each session, GPT-4o-mini extracts facts, decisions, commitments, and contradictions automatically

### Pushback Engine

Before every response, the AI analyzes your message for:

- **Contradictions** — "Last week you said X, now you're saying Y. What changed?"
- **Unvalidated claims** — "What data backs that up?"
- **Missing perspectives** — "Have you considered the customer's side of this?"
- **Overdue commitments** — "You said you'd ship that 2 weeks ago. What happened?"
- **Blind spots** — surfaces questions you might be avoiding

### Rate Limiting

GitHub Models has daily limits. The system auto-manages this:

- **GPT-4o**: 45 calls/day (used for main reasoning)
- **GPT-4o-mini**: 140 calls/day (used for extraction, analysis)
- Auto-falls back to GPT-4o-mini when GPT-4o limit is near

Check usage anytime: `cofounder usage` or the web dashboard.

## Tech Stack

- **Python 3.9+** — Backend, CLI, AI logic
- **FastAPI** — REST API + WebSocket
- **Next.js 14** — Frontend (React + Tailwind CSS)
- **SQLite** — Persistent structured storage
- **ChromaDB** — Vector embeddings for semantic search
- **GitHub Models** — Free LLM access (GPT-4o, GPT-4o-mini)
- **Web Speech API** — Browser-based voice calls
- **Vapi.ai** — Phone call integration
- **NextAuth.js** — GitHub OAuth authentication

## License

MIT
