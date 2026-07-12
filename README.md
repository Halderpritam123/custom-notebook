# AI Knowledge Notebook

A full-stack AI-powered notebook. Add a topic anywhere in a nested folder hierarchy, get an instant structured research summary from an LLM, then chat with it, save notes, and track your learning status.

---

## How it works

```mermaid
graph LR
    User -->|adds topic| Frontend
    Frontend -->|POST /topics| Backend
    Backend -->|returns immediately| Frontend
    Backend -->|background job| LLM
    LLM -->|research JSON| Backend
    Backend -->|saves to DB, signals SSE| PostgreSQL
    Backend -->|SSE push: status=reading| Frontend
    Frontend -->|one GET /topics/:id| Backend
```

The backend responds instantly — research generation runs in the background. The frontend opens a single SSE connection and waits for a push notification instead of polling. When research completes the UI updates automatically.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Redux Toolkit, RTK Query, Tailwind CSS |
| Backend | Python, FastAPI, SQLAlchemy |
| Database | PostgreSQL |
| LLM | Any OpenAI-compatible API (Azure AI, OpenAI, Groq, Ollama) |
| Auth | JWT + Google OAuth + GitHub OAuth |

---

## Quick Start

**Prerequisites:** Python 3.10+, Node.js 18+, PostgreSQL

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # fill in DATABASE_URL, OPENAI_API_KEY, JWT_SECRET, etc.
uvicorn app.main:app --reload
```

Runs at `http://localhost:8000`. Interactive API docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
# create .env with: VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

Runs at `http://localhost:5173`.

### Docker

```bash
cd backend  && docker-compose up
cd frontend && docker-compose up
```

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py          # App setup + router registration
│   │   ├── config.py        # All env vars
│   │   ├── database.py      # Engine, session, Base
│   │   ├── models/          # ORM models
│   │   ├── schemas/         # Pydantic request bodies
│   │   ├── routers/         # auth, topics, categories
│   │   ├── services/        # LLM client
│   │   └── core/            # JWT + security + rate limiter
│   └── BACKEND.md           # ← Full backend documentation
│
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── services/        # RTK Query API slice
│   │   ├── store/           # Redux slices
│   │   └── hooks/           # useTheme, useTopicQueryParam, useResearchStream
│   └── FRONTEND.md          # ← Full frontend documentation
│
└── README.md
```

---

## Documentation

| Doc | Contents |
|-----|----------|
| [`backend/BACKEND.md`](backend/BACKEND.md) | DB schema, all API endpoints, auth flow, LLM integration, SSE, env vars, performance notes |
| [`frontend/FRONTEND.md`](frontend/FRONTEND.md) | Component tree, state management, cache strategy, SSE, theme system, feature checklist |

---

## Features

- **Unlimited nested folders** — organize topics into categories and subcategories at any depth (VS Code-style sidebar)
- **Context-aware AI research** — LLM receives the full folder path (e.g. `System Design > Scaling`) for domain-scoped answers
- **8-field research** — Summary, Key Concepts, Background & Context, How It Works, Real-World Applications, Common Misconceptions, Related Topics, Open Questions
- **Editable research** — edit or delete individual research sections inline
- **SSE push updates** — zero polling; backend pushes one event when research finishes
- **Chat** — follow-up Q&A scoped to topic + ancestor context
- **Saved notes** — bookmark any AI reply as a persistent note
- **Status tracking** — researching → reading → reviewed
- **Dark / light theme**
- **OAuth** — Google and GitHub sign-in
- **Rate limiting** — LLM routes protected per user (5/min topics, 3/min retry, 10/min chat)
