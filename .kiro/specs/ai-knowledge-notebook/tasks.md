# Implementation Plan: AI Knowledge Notebook

## Overview

Incremental implementation starting with the backend data layer, then the LLM integration, then the FastAPI routes, then the React frontend shell, and finally wiring everything together. Each task builds on the previous ones with no orphaned code.

## Tasks

- [x] 1. Set up backend project structure and database layer
  - [x] 1.1 Create `backend/` directory with `requirements.txt` listing fastapi, uvicorn, sqlalchemy, psycopg2-binary, openai, python-dotenv, and hypothesis
    - _Requirements: 10.1_
  - [x] 1.2 Implement `backend/database.py` with SQLAlchemy `Base`, engine from `DATABASE_URL` env var, and the three ORM models: `Topic`, `Research`, `SavedNote` with all columns, relationships, and `ON DELETE CASCADE`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [x] 1.3 Add `create_all_tables()` function in `database.py` that calls `Base.metadata.create_all(engine)` and a `get_db()` session dependency
    - _Requirements: 10.5_
  - [ ]* 1.4 Write unit test: start against a SQLite in-memory DB, call `create_all_tables()`, assert all three tables exist
    - _Requirements: 10.5_

- [x] 2. Implement LLM layer
  - [x] 2.1 Implement `backend/llm.py` with `generate_research(topic_name: str) -> dict` that calls the OpenAI chat completions API using the strict JSON schema research prompt and returns a parsed dict with all seven keys
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 Implement `build_chat_messages(topic_name: str, history: list) -> list` in `llm.py` that prepends the system prompt and trims history to the last 10 messages
    - _Requirements: 4.2, 4.3_
  - [x] 2.3 Implement `generate_chat_reply(topic_name: str, history: list) -> str` in `llm.py` that calls `build_chat_messages` and sends to OpenAI, returning the assistant reply string
    - _Requirements: 4.2, 4.3_
  - [ ]* 2.4 Write property test for research JSON parse round-trip: use Hypothesis to generate random dicts with the seven required string keys, serialize to JSON, call the parsing logic, assert equality
    - Tag: `# Feature: ai-knowledge-notebook, Property 8: Research JSON parse round-trip`
    - _Requirements: 2.2_
  - [ ]* 2.5 Write property test for chat context window enforcement: generate chat histories of random length (0–50 messages), call `build_chat_messages`, assert the messages list (excluding system prompt) has at most 10 entries
    - Tag: `# Feature: ai-knowledge-notebook, Property 9: Chat context window enforcement`
    - _Requirements: 4.2, 4.3_

- [x] 3. Implement FastAPI routes
  - [x] 3.1 Create `backend/main.py` with FastAPI app, CORS middleware allowing all origins, call `create_all_tables()` on startup, and stub out all eight route functions with correct paths and HTTP methods
    - _Requirements: 9.1–9.8, 9.10_
  - [x] 3.2 Implement `POST /topics`: validate name is non-whitespace (raise 422 otherwise), insert `Topic`, call `generate_research`, insert `Research`, update topic status to `reading`, return full topic with research
    - _Requirements: 1.1, 1.3, 1.4, 1.6, 2.1, 3.2_
  - [x] 3.3 Implement `GET /topics`: return list of all topics with `id`, `name`, `status`, `created_at`
    - _Requirements: 9.2_
  - [x] 3.4 Implement `GET /topics/{id}`: return full topic with nested research object and notes list sorted by `created_at` asc; raise 404 if not found
    - _Requirements: 6.4, 9.3, 9.9_
  - [x] 3.5 Implement `PATCH /topics/{id}/status`: accept `{"status": "..."}` body, validate status is one of the three allowed values (raise 422 otherwise), update and return topic; raise 404 if not found
    - _Requirements: 3.1, 3.4, 9.4, 9.9_
  - [x] 3.6 Implement `DELETE /topics/{id}`: delete topic (cascade handles research and notes), raise 404 if not found, return 204
    - _Requirements: 8.3, 9.5, 9.9_
  - [x] 3.7 Implement `POST /topics/{id}/chat`: accept `{"message": "...", "history": [...]}`, call `generate_chat_reply`, return `{"reply": "..."}`, raise 404 if topic not found
    - _Requirements: 4.2, 9.6, 9.9_
  - [x] 3.8 Implement `POST /topics/{id}/notes`: save note with `content` and `created_at`, return note object; raise 404 if topic not found
    - _Requirements: 5.2, 9.7, 9.9_
  - [x] 3.9 Implement `DELETE /topics/{id}/notes/{note_id}`: delete specific note, raise 404 if either topic or note not found, return 204
    - _Requirements: 5.3, 9.8, 9.9_
  - [ ]* 3.10 Write property test for empty topic name rejection: use Hypothesis `text` strategy filtered to whitespace-only strings, POST each to `/topics`, assert HTTP 422 and zero new rows in DB
    - Tag: `# Feature: ai-knowledge-notebook, Property 6: Empty topic name rejection`
    - _Requirements: 1.4_
  - [ ]* 3.11 Write property test for missing resource returns 404: generate random UUIDs not present in test DB, call GET/PATCH/DELETE /topics/{id} and GET /topics/{id}/notes, assert all return 404
    - Tag: `# Feature: ai-knowledge-notebook, Property 11: Missing resource returns 404`
    - _Requirements: 9.9_
  - [ ]* 3.12 Write property test for status lifecycle monotonicity: for any topic, assert status starts as `researching`; assert PATCH to `reviewed` from `reading` succeeds; assert PATCH with invalid status returns 422
    - Tag: `# Feature: ai-knowledge-notebook, Property 2: Status lifecycle monotonicity`
    - _Requirements: 3.1, 3.2, 3.4_
  - [ ]* 3.13 Write property test for cascade delete completeness: use Hypothesis to generate 0–10 notes per topic, insert into test DB, DELETE topic, query research and saved_notes tables, assert zero rows
    - Tag: `# Feature: ai-knowledge-notebook, Property 3: Cascade delete completeness`
    - _Requirements: 8.3, 10.3, 10.4_
  - [ ]* 3.14 Write property test for note save and delete round-trip: generate random note content strings, POST to notes endpoint, GET topic, assert content present; DELETE note, GET topic, assert content absent
    - Tag: `# Feature: ai-knowledge-notebook, Property 4: Note save and delete round-trip`
    - _Requirements: 5.2, 5.3, 6.1, 6.3_
  - [ ]* 3.15 Write property test for saved notes ordering invariant: insert notes with varying timestamps, GET topic, assert notes array is sorted by `created_at` ascending
    - Tag: `# Feature: ai-knowledge-notebook, Property 10: Saved notes ordering invariant`
    - _Requirements: 6.4_

- [x] 4. Checkpoint — backend complete
  - Ensure all tests pass and the FastAPI server starts with `uvicorn backend.main:app --reload`. Ask the user if any questions arise.

- [x] 5. Set up frontend project structure
  - [x] 5.1 Scaffold Vite + React project in `frontend/`, install dependencies: `react-redux`, `@reduxjs/toolkit`, `tailwindcss`, `react-markdown`
    - _Requirements: (all frontend requirements)_
  - [x] 5.2 Configure Tailwind CSS (`tailwind.config.js`, import in `index.css`)
  - [x] 5.3 Create `frontend/src/store/index.js` combining `topicsSlice`, `chatSlice`, and the RTK Query `apiSlice`
  - [x] 5.4 Create `frontend/src/services/api.js` defining the RTK Query `apiSlice` with all eight endpoints and cache invalidation tags as specified in the design
    - _Requirements: 9.1–9.8_

- [x] 6. Implement Redux slices
  - [x] 6.1 Create `frontend/src/store/topicsSlice.js` with `searchQuery` (string) and `activeTopicId` (string|null) state, and reducers `setSearchQuery`, `setActiveTopicId`
    - _Requirements: 1.2, 7.2_
  - [x] 6.2 Create `frontend/src/store/chatSlice.js` with `sessions: {}` state and reducers `addMessage(topicId, message)` and `clearSession(topicId)`; sessions are keyed by topicId and each holds an array of `{role, content}` objects
    - _Requirements: 4.1, 4.4, 4.5_
  - [ ]* 6.3 Write property test for chat session isolation and preservation using fast-check: generate random pairs of topic IDs and message arrays, dispatch addMessage for each, assert sessions are independent and message arrays match after topic switches
    - Tag: `# Feature: ai-knowledge-notebook, Property 7: Chat session isolation and preservation`
    - _Requirements: 4.1, 4.4_
  - [ ]* 6.4 Write property test for search filter correctness using fast-check: generate random topic name arrays and query strings, apply the `searchQuery` selector/filter, assert result matches case-insensitive substring predicate and that empty query returns full list
    - Tag: `# Feature: ai-knowledge-notebook, Property 5: Search filter correctness and invertibility`
    - _Requirements: 7.2, 7.3_

- [x] 7. Implement Sidebar component
  - [x] 7.1 Create `frontend/src/components/Sidebar.jsx` with a search input at top (dispatches `setSearchQuery`), a `TopicList`, and an `AddTopicInput` at bottom
    - _Requirements: 7.1, 7.4_
  - [x] 7.2 Implement `TopicList` inside `Sidebar.jsx`: reads topics from `useGetTopicsQuery`, filters by `searchQuery`, renders each as a row with topic name, status badge, delete icon; clicking a row dispatches `setActiveTopicId`
    - _Requirements: 3.5, 7.2, 8.1_
  - [x] 7.3 Implement `AddTopicInput`: controlled input, on submit dispatches `createTopic` mutation, trims whitespace, disables the button if input is empty or whitespace, then dispatches `setActiveTopicId` with the returned topic id
    - _Requirements: 1.1, 1.2, 1.4_
  - [x] 7.4 Implement delete icon per topic: clicking shows `window.confirm()` dialog; on confirm dispatches `deleteTopic` mutation; if deleted topic was active, dispatch `setActiveTopicId(null)`
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [x] 8. Implement TopicPanel and ResearchView
  - [x] 8.1 Create `frontend/src/components/TopicPanel.jsx`: reads `activeTopicId`, calls `useGetTopicQuery`, renders `PanelHeader`, `ResearchView`, `SavedNotes`, `ChatThread`, `ChatInput`
    - _Requirements: 1.2, 2.3_
  - [x] 8.2 Implement `PanelHeader`: displays topic name, status badge, and "Mark as Reviewed" button (only visible when status is `reading`); clicking the button dispatches `updateTopicStatus` mutation with `reviewed`
    - _Requirements: 3.4, 3.5_
  - [x] 8.3 Create `frontend/src/components/ResearchView.jsx`: renders all seven research fields as labeled sections; renders the `diagram` field inside a `<ReactMarkdown>` block using a code block for ASCII art; no delete button
    - _Requirements: 2.3, 2.4, 6.5_
  - [ ]* 8.4 Write property test for research field completeness at the component level using fast-check: generate random research objects with all 7 keys, render `ResearchView`, assert all 7 field values appear in the output and no delete button is present
    - Tag: `# Feature: ai-knowledge-notebook, Property 1: Research field completeness`
    - _Requirements: 2.1, 2.4_

- [x] 9. Implement SavedNotes component
  - [x] 9.1 Create `frontend/src/components/SavedNotes.jsx`: renders list of notes from topic data (already ordered ascending); each note has its content and a delete icon
    - _Requirements: 6.1, 6.2, 6.4_
  - [x] 9.2 Implement per-note delete: clicking delete icon dispatches `deleteNote` mutation with `{topicId, noteId}`, which invalidates `getTopic` cache
    - _Requirements: 6.3_

- [x] 10. Implement ChatThread and ChatInput
  - [x] 10.1 Create `frontend/src/components/ChatThread.jsx`: reads session messages from `chatSlice` for the active topic; renders user messages and assistant messages differently; assistant messages have a bookmark icon
    - _Requirements: 5.1, 4.1_
  - [x] 10.2 Implement bookmark icon logic: each assistant message tracks a `savedNoteId` (null if unsaved); clicking unsaved icon dispatches `saveNote` mutation and stores returned `note_id` in local state; clicking saved icon dispatches `deleteNote` mutation and clears `savedNoteId`
    - _Requirements: 5.2, 5.3, 5.4_
  - [x] 10.3 Create `frontend/src/components/ChatInput.jsx`: controlled textarea, on submit dispatches `sendChatMessage` mutation with `{topicId, message, history: last10}` then appends both user message and assistant reply to `chatSlice` via `addMessage`; shows loading state during request; shows inline error on failure
    - _Requirements: 4.2, 4.6_
  - [x] 10.4 Add status transition to `reading` after research loads: in `TopicPanel`, after `createTopic` resolves and topic is auto-focused, if topic status is `researching` dispatch `updateTopicStatus` mutation with `reading`
    - _Requirements: 3.3_

- [x] 11. Checkpoint — frontend complete
  - Ensure all tests pass. Run the frontend dev server and verify the app loads. Ask the user if any questions arise.

- [x] 12. Integration and final wiring
  - [x] 12.1 Set `VITE_API_BASE_URL` environment variable in `frontend/.env` pointing to the local backend URL; configure `api.js` base URL from this env var
  - [x] 12.2 Verify `POST /topics` triggers research synchronously and the frontend auto-focuses the new topic with `researching` badge, then transitions to `reading` when research data loads
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 3.2, 3.3_
  - [x] 12.3 Verify topic deletion removes topic from sidebar list and clears right panel if it was active
    - _Requirements: 8.3, 8.4_
  - [x] 12.4 Verify bookmark save/delete round-trip: save a note from chat, confirm it appears in SavedNotes; delete it from SavedNotes, confirm it disappears
    - _Requirements: 5.2, 5.3, 6.1, 6.3_
  - [x] 12.5 Verify chat sessions are preserved when switching between topics (switch away, switch back, old messages still visible)
    - _Requirements: 4.4_

- [x] 13. Final checkpoint — all tests pass
  - Run `pytest backend/` and frontend test suite. Ensure all tests pass. Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests require minimum 100 iterations each (`@settings(max_examples=100)` for Hypothesis, `{numRuns: 100}` for fast-check)
- Each property test references its design document property via the tag comment
- The backend uses SQLite in-memory for tests (via `DATABASE_URL=sqlite:///:memory:`) to avoid needing a live Postgres instance during CI
- Chat sessions are intentionally ephemeral — no migration or persistence work needed for chat
