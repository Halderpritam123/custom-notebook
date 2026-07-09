# Frontend Documentation

> React 18 · Vite · Redux Toolkit · RTK Query · Tailwind CSS

---

## Architecture Overview

```mermaid
graph TD
    subgraph App["App.jsx"]
        Auth["AuthPage\n(unauthenticated)"]
        Main["Main Layout\n(authenticated)"]
    end

    subgraph Layout["Main Layout"]
        Sidebar["Sidebar"]
        Panel["TopicPanel"]
    end

    subgraph SidebarTree["Sidebar Components"]
        TopicTree["TopicTree"]
        FolderRow["FolderRow\n(category)"]
        FileRow["FileRow\n(topic)"]
        AddInput["InlineAddInput"]
        SubInput["AddSubTopicInput"]
    end

    subgraph PanelComponents["TopicPanel Components"]
        Research["ResearchView"]
        Notes["SavedNotes"]
        Chat["ChatThread"]
        ChatIn["ChatInput"]
    end

    subgraph State["Redux Store"]
        AuthSlice["authSlice\ntoken, email"]
        TopicsSlice["topicsSlice\nactiveTopicId\nexpandedFolderIds\nsearchQuery"]
        ChatSlice["chatSlice\nsessions map"]
        API["apiSlice\nRTK Query cache"]
    end

    Sidebar --> TopicTree
    TopicTree --> FolderRow
    TopicTree --> FileRow
    TopicTree --> AddInput
    FolderRow --> SubInput
    Main --> Panel
    Panel --> Research
    Panel --> Notes
    Panel --> Chat
    Panel --> ChatIn

    TopicTree --> API
    Panel --> API
    ChatIn --> API
    Notes --> API
    AuthPage --> API

    TopicTree --> TopicsSlice
    FolderRow --> TopicsSlice
    FileRow --> TopicsSlice
    Panel --> TopicsSlice
    ChatIn --> ChatSlice
```

---

## Project Structure

```
frontend/src/
├── App.jsx                      # Root — auth gate, layout split
├── main.jsx                     # React + Redux provider mount
├── index.css                    # Tailwind directives
├── setupTests.js
│
├── components/
│   ├── AuthPage.jsx             # Login / register / OAuth
│   ├── AuthCallback.jsx         # OAuth redirect handler
│   ├── Sidebar.jsx              # Left panel shell + header actions
│   ├── TopicTree.jsx            # Tree list (categories + root topics)
│   ├── FolderRow.jsx            # Category row (expand/collapse/rename/delete)
│   ├── FileRow.jsx              # Topic row (select/rename/delete/retry)
│   ├── AddSubTopicInput.jsx     # Inline input inside an expanded category
│   ├── TopicPanel.jsx           # Right panel — research + notes + chat
│   ├── ResearchView.jsx         # Renders the 7-field LLM research
│   ├── SavedNotes.jsx           # Saved note cards
│   ├── ChatThread.jsx           # Message list
│   ├── ChatInput.jsx            # Textarea + send button
│   └── shared/
│       ├── StatusBadge.jsx      # researching / reading / reviewed pill
│       └── ConfirmDialog.jsx    # Themed modal replacing window.confirm
│
├── hooks/
│   └── useTheme.js              # Dark/light mode — reads/writes localStorage + system pref
│
├── services/
│   └── api.js                   # RTK Query API slice + all endpoints
│
├── store/
│   ├── index.js                 # Redux store setup
│   ├── authSlice.js             # Auth state + localStorage persistence
│   ├── topicsSlice.js           # UI state: active topic, expanded folders, search
│   └── chatSlice.js             # Per-topic chat message sessions
│
└── tests/
    └── properties.test.js
```

---

## State Management

```mermaid
graph LR
    subgraph Redux["Redux Store"]
        Auth["authSlice\ntoken · email"]
        Topics["topicsSlice\nactiveTopicId\nexpandedFolderIds[]\nsearchQuery"]
        Chat["chatSlice\nsessions{topicId: msg[]}"]
        Cache["RTK Query cache\ngetTopicTree\ngetTopic\ngetTopics"]
    end

    subgraph Actions
        Login["setCredentials"]
        Logout["logout"]
        Select["setActiveTopicId"]
        Toggle["toggleFolder"]
        Expand["expandFolder"]
        Search["setSearchQuery"]
        AddMsg["addMessage"]
    end

    Login --> Auth
    Logout --> Auth
    Select --> Topics
    Toggle --> Topics
    Expand --> Topics
    Search --> Topics
    AddMsg --> Chat
```

### Cache strategy

The `getTopicTree` result is the single source of truth for the sidebar. Every mutation patches the cache in-place via `updateQueryData` instead of refetching the full tree:

| Mutation | Cache operation |
|----------|----------------|
| `createTopic` | Append item to `root_topics` or folder's `sub_topics` |
| `createMainTopic` | Append folder to `main_topics` |
| `renameTopic` | Find + mutate name in tree + individual topic cache |
| `renameMainTopic` | Find + mutate folder name in tree |
| `updateTopicStatus` | Find + mutate status in tree + individual topic cache |
| `deleteTopic` | Filter out from `root_topics` and all `sub_topics` |
| `deleteMainTopic` | Filter out from `main_topics` |
| `retryResearch` | Set status to `researching` in tree |

`GET /topic-tree` is called **once** on load. The only time it's called again is on hard refresh or session start.

---

## Component Interactions

```mermaid
sequenceDiagram
    participant User
    participant Sidebar
    participant TopicTree
    participant FolderRow
    participant RTK as RTK Query Cache
    participant API as Backend API

    User->>Sidebar: Click "New Category" icon
    Sidebar->>TopicTree: addMode="folder"
    TopicTree->>TopicTree: Show InlineAddInput
    User->>TopicTree: Type name, press Enter
    TopicTree->>API: POST /main-topics { name }
    API-->>TopicTree: 201 { id, name, sub_topics: [] }
    TopicTree->>RTK: updateQueryData → push to main_topics
    RTK-->>FolderRow: Re-render with new folder

    User->>FolderRow: Click folder row
    FolderRow->>Redux: dispatch(toggleFolder(id))
    Redux-->>TopicTree: expandedFolderIds updated
    TopicTree-->>FolderRow: isExpanded=true → show sub_topics

    User->>FolderRow: Click "+" button
    FolderRow->>FolderRow: showInput=true
    User->>FolderRow: Type sub-topic name, Enter
    FolderRow->>API: POST /topics { name, parent_id }
    API-->>FolderRow: 201 { id, name, status: "researching" }
    FolderRow->>RTK: updateQueryData → push to folder.sub_topics
    FolderRow->>Redux: dispatch(setActiveTopicId(id))
```

---

## Polling Strategy

Research generation is async on the backend. The frontend polls `GET /topics/:id` to detect when it completes:

```mermaid
stateDiagram-v2
    [*] --> Created: POST /topics
    Created --> Researching: status=researching\npoll every 3s
    Researching --> Reading: LLM job done\nbackend patches status
    Reading --> Reviewed: User clicks\n"Mark as Reviewed"
    Reviewed --> [*]
```

- `TopicPanel` polls `GET /topics/:id` every 3 seconds **only** when `topic.status === 'researching'`
- `TopicTree` polls `GET /topic-tree` every 3 seconds when any topic in the tree has `status === 'researching'`, stops when all are done
- When status transitions from `researching` → `reading`, the panel patches the tree cache directly so the sidebar badge updates without a tree refetch

---

## Theme System

Uses Tailwind's `darkMode: 'class'` strategy. `useTheme` hook adds/removes the `dark` class on `<html>`:

```mermaid
graph LR
    useTheme -->|add/remove .dark| HTML
    HTML -->|cascades| AllComponents
    localStorage -->|persists preference| useTheme
    SystemPreference -->|fallback| useTheme
```

All components use paired Tailwind classes: `bg-white dark:bg-gray-900`, `text-gray-900 dark:text-gray-100`, etc.

---

## Brand Color System

Custom `brand` palette defined in `tailwind.config.js` — warm violet-purple, not the default Tailwind blue:

| Token | Hex | Used for |
|-------|-----|----------|
| `brand-500` | `#8b5cf6` | Buttons, active border, user chat bubble, send button |
| `brand-600` | `#7c3aed` | Hover state |
| `brand-50` | `#f5f3ff` | Active item background (light mode) |
| `brand-900/20` | — | Active item background (dark mode) |
| `brand-400` | `#a78bfa` | Focus rings |

---

## Key Files Reference

### `api.js` — all backend communication

Every API call goes through the RTK Query `apiSlice`. Mutations use `onQueryStarted` + `updateQueryData` for immediate optimistic updates with automatic rollback on failure.

### `topicsSlice.js` — sidebar UI state

```js
{
  searchQuery: '',        // live search filter
  activeTopicId: null,    // which topic is open in the panel
  expandedFolderIds: [],  // which categories are expanded
}
```

`expandedFolderIds` is converted to a `Set` in `TopicTree` for O(1) lookups.

### `chatSlice.js` — ephemeral chat sessions

Chat messages are stored in Redux only — they are **not persisted** to the backend. Refreshing the page clears the chat. Saved notes are persisted via `POST /topics/:id/notes`.

---

## Local Setup

```bash
cd frontend
npm install
cp .env.example .env        # set VITE_API_BASE_URL=http://localhost:8000
npm run dev                 # http://localhost:5173
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend base URL (default: `http://localhost:8000`) |

### Build

```bash
npm run build    # outputs to dist/
npm run preview  # preview the production build locally
```

---
