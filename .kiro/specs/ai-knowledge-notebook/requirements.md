# Requirements Document

## Introduction

An AI-powered personal knowledge notebook that allows users to add any topic or concept, receive automatically generated structured research via an LLM, and engage in follow-up conversations with selective note saving. The UI follows an email-app style layout with a topic sidebar and a detail panel.

## Glossary

- **Topic**: A user-defined subject or concept to be researched and tracked.
- **Research**: A structured, LLM-generated document for a topic following a fixed seven-field template.
- **Note**: A saved chat assistant message that is persisted to the database and associated with a topic.
- **Chat Session**: An in-memory, session-scoped conversation thread tied to a single topic.
- **Status**: A lifecycle state assigned to a topic: `researching`, `reading`, or `reviewed`.
- **System**: The AI Knowledge Notebook application, comprising the React frontend and FastAPI backend.
- **LLM**: The OpenAI language model service used to generate research and chat responses.
- **RTK**: Redux Toolkit, used for client-side state management.
- **RTK Query**: The data-fetching and caching layer built into Redux Toolkit.

---

## Requirements

### Requirement 1: Add Topic and Trigger Research

**User Story:** As a user, I want to add a new topic by typing a name and pressing add, so that the system automatically generates structured research without any extra steps.

#### Acceptance Criteria

1. WHEN a user submits a non-empty topic name, THE System SHALL create a new topic record with status `researching` and immediately trigger LLM research generation.
2. WHEN a topic is created, THE System SHALL auto-focus that topic in the right panel without requiring a manual selection.
3. WHEN a topic is created, THE System SHALL assign it a UUID as its primary key and record a `created_at` timestamp.
4. IF a user attempts to submit an empty or whitespace-only topic name, THEN THE System SHALL prevent topic creation and maintain the current state.
5. WHILE the LLM is generating research, THE System SHALL display the topic status as `researching` in both the sidebar and the right panel.
6. WHEN research generation completes, THE System SHALL store all seven research fields and update the topic status to `reading`.

---

### Requirement 2: Structured Research Output

**User Story:** As a user, I want every topic to display a consistently structured research document, so that I can quickly learn about any concept in a predictable format.

#### Acceptance Criteria

1. WHEN research is generated for a topic, THE System SHALL produce and store exactly seven fields: `one_liner`, `mechanism`, `when_to_use`, `tradeoffs`, `interview`, `related`, and `diagram`.
2. WHEN the LLM is called for research, THE System SHALL use a strict JSON schema prompt so that the response can be parsed field by field.
3. WHEN research is displayed, THE System SHALL render the `diagram` field using a markdown-capable renderer that supports ASCII art.
4. THE System SHALL display the research block without a delete option, making it a permanent fixture of the topic view.
5. IF the LLM returns a response that cannot be parsed into the required JSON schema, THEN THE System SHALL record an error state and surface a user-visible error message in the right panel.

---

### Requirement 3: Topic Status Tracking

**User Story:** As a user, I want to track my progress through each topic with a visible status badge, so that I know what I have read and what I have reviewed.

#### Acceptance Criteria

1. THE System SHALL support exactly three status values for a topic: `researching`, `reading`, and `reviewed`.
2. WHEN a topic is first created, THE System SHALL set its status to `researching`.
3. WHEN research generation completes and the topic is focused in the right panel, THE System SHALL automatically transition the topic status from `researching` to `reading`.
4. WHEN a user clicks the "Mark as Reviewed" button, THE System SHALL update the topic status to `reviewed` via a PATCH request to the backend.
5. THE System SHALL display the current status as a visible badge in both the sidebar topic list and the right panel header.

---

### Requirement 4: Follow-up Chat (Session Only)

**User Story:** As a user, I want to have a follow-up conversation about any topic, so that I can deepen my understanding through Q&A without cluttering the persistent database.

#### Acceptance Criteria

1. THE System SHALL maintain a separate, isolated chat session for each topic in RTK client-side state only.
2. WHEN a user sends a message in the chat input, THE System SHALL POST the message along with the last 10 messages of that topic's session to the `/topics/{id}/chat` endpoint and display the assistant reply.
3. WHEN the LLM is called for chat, THE System SHALL include a system prompt identifying the topic name and instruct the LLM to answer concisely, keeping the total context within approximately 4000 tokens.
4. WHEN a user switches between topics, THE System SHALL preserve each topic's in-memory chat history in RTK state without clearing it.
5. WHEN the page is refreshed or the application is reloaded, THE System SHALL discard all chat session data by design, with no persistence to the database.
6. IF the LLM chat call fails, THEN THE System SHALL display an error message in the chat thread without crashing the application.

---

### Requirement 5: Save Chat Messages as Notes

**User Story:** As a user, I want to bookmark any assistant chat reply as a saved note, so that I can preserve valuable responses without any extra steps.

#### Acceptance Criteria

1. WHEN an assistant message is displayed in the chat thread, THE System SHALL render a bookmark icon alongside it.
2. WHEN a user clicks an unsaved bookmark icon, THE System SHALL POST the message content to `/topics/{id}/notes` and persist it as a note in the database, then toggle the icon to a "saved" state.
3. WHEN a user clicks a saved bookmark icon, THE System SHALL send a DELETE request to `/topics/{id}/notes/{note_id}` to remove the note from the database and toggle the icon back to the unsaved state.
4. THE System SHALL perform note save and delete without displaying any modal or requiring any additional confirmation step.

---

### Requirement 6: Saved Notes Display

**User Story:** As a user, I want saved notes to appear persistently below the research block, so that I can review my curated insights on return visits.

#### Acceptance Criteria

1. WHEN a topic is loaded, THE System SHALL retrieve all saved notes for that topic from the database and display them below the research block.
2. THE System SHALL display each saved note as an independent block with its own delete icon.
3. WHEN a user clicks the delete icon on a saved note, THE System SHALL remove the note from the database and from the displayed list.
4. THE System SHALL display saved notes in the order they were created (`created_at` ascending).
5. THE System SHALL NOT provide a delete option on the initial research block; only saved notes have individual delete icons.

---

### Requirement 7: Topic Search

**User Story:** As a user, I want to search topics by name in the sidebar, so that I can quickly navigate to a specific topic among many.

#### Acceptance Criteria

1. THE System SHALL display a search bar at the top of the sidebar.
2. WHEN a user types in the search bar, THE System SHALL filter the displayed topic list to show only topics whose names contain the search string, using case-insensitive client-side matching.
3. WHEN the search bar is cleared, THE System SHALL restore the full topic list.
4. THE System SHALL perform search filtering without any network requests.

---

### Requirement 8: Delete Topic

**User Story:** As a user, I want to delete a topic and all its associated data from the sidebar, so that I can remove concepts I no longer need.

#### Acceptance Criteria

1. THE System SHALL display a delete icon on each topic entry in the sidebar.
2. WHEN a user clicks the delete icon, THE System SHALL display a confirmation prompt before performing any deletion.
3. WHEN a user confirms deletion, THE System SHALL send a DELETE request to `/topics/{id}`, which removes the topic record, its associated research record, and all associated saved notes from the database in a single operation.
4. WHEN deletion completes, THE System SHALL remove the topic from the sidebar list and, if the deleted topic was focused, clear the right panel.
5. IF a user cancels the confirmation prompt, THEN THE System SHALL take no action and leave all data intact.

---

### Requirement 9: API Endpoints

**User Story:** As a developer, I want a well-defined REST API, so that the frontend and backend communicate with clear contracts.

#### Acceptance Criteria

1. THE System SHALL expose `POST /topics` to create a topic and trigger research.
2. THE System SHALL expose `GET /topics` to return a list of all topics with `id`, `name`, and `status` fields.
3. THE System SHALL expose `GET /topics/{id}` to return a single topic with its full research object and all saved notes.
4. THE System SHALL expose `PATCH /topics/{id}/status` to update a topic's status field.
5. THE System SHALL expose `DELETE /topics/{id}` to delete a topic and cascade-delete its research and saved notes.
6. THE System SHALL expose `POST /topics/{id}/chat` to accept a message and chat history, call the LLM, and return the assistant reply.
7. THE System SHALL expose `POST /topics/{id}/notes` to save a chat message as a note.
8. THE System SHALL expose `DELETE /topics/{id}/notes/{note_id}` to delete a specific saved note.
9. IF a request references a topic `id` that does not exist, THEN THE System SHALL return HTTP 404.
10. THE System SHALL include CORS headers permitting the frontend origin to call all API endpoints.

---

### Requirement 10: Data Persistence

**User Story:** As a user, I want my topics, research, and saved notes to be durably stored, so that my knowledge base is available across sessions.

#### Acceptance Criteria

1. THE System SHALL store all topics, research records, and saved notes in a PostgreSQL database.
2. THE System SHALL use UUIDs as primary keys for all three tables: `topics`, `research`, and `saved_notes`.
3. THE System SHALL enforce a foreign key from `research.topic_id` to `topics.id`.
4. THE System SHALL enforce a foreign key from `saved_notes.topic_id` to `topics.id`.
5. WHEN the backend application starts, THE System SHALL create all required database tables if they do not already exist.
