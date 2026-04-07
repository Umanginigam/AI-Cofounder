# CoFounder AI

An AI co-founder for solo builders — not a chatbot, but a persistent, opinionated thinking partner that knows your startup, remembers everything, and pushes back when you're wrong.

## Setup

1. **Python 3.11+** required.

2. Clone and install:
   ```bash
   cd cofounder
   python -m venv .venv
   source .venv/bin/activate
   pip install -e .
   ```

3. Create your `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Add your **GitHub Personal Access Token** to `.env`:
   - Generate one at https://github.com/settings/tokens
   - No special scopes needed — the base token works for GitHub Models.

## Usage

```bash
# First time — onboard your startup
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
```

## How It Works

- **Persistent memory**: Every session is summarized and stored. Facts, decisions, and commitments are extracted and tracked.
- **Pushback engine**: Before each response, the AI checks for contradictions with past statements, unvalidated claims, and missing perspectives.
- **Not a yes-machine**: It challenges your thinking like a real co-founder would — direct, caring, but honest.

## Web App (Phase 2)

```bash
# Start the FastAPI backend
pip install -e ".[api]"
uvicorn src.api.main:app --reload

# In another terminal — start the Next.js frontend
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with your GitHub OAuth credentials
npm run dev
```

**Auth setup** (optional — for multi-user deployment):
1. Go to https://github.com/settings/developers
2. Create a new OAuth App
3. Set callback URL to `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID and Client Secret into `frontend/.env.local`

## Architecture

- **LLM**: GitHub Models (GPT-4o for reasoning, GPT-4o-mini for background processing)
- **Database**: SQLite (local, zero cost)
- **Vector search**: ChromaDB (local, embedded)
- **Auth**: NextAuth.js with GitHub OAuth (no external services)
- **CLI**: Typer + Rich
# AI-Cofounder
