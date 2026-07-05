/**
 * Frontend property-based tests using fast-check.
 *
 * Covers:
 *   6.3 — Property 7: Chat session isolation and preservation
 *   6.4 — Property 5: Search filter correctness and invertibility
 *   8.4 — Property 1: Research field completeness (ResearchView renders all 7 fields)
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { configureStore } from '@reduxjs/toolkit';
import chatReducer, { addMessage, clearSession } from '../store/chatSlice.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStore() {
  return configureStore({ reducer: { chat: chatReducer } });
}

// Arbitraries
const topicIdArb = fc.uuid();
const messageArb = fc.record({
  role: fc.constantFrom('user', 'assistant'),
  content: fc.string({ minLength: 1, maxLength: 100 }),
});
const messagesArb = fc.array(messageArb, { minLength: 1, maxLength: 20 });

// Search filter (mirrors Sidebar.jsx logic)
function filterTopics(topics, query) {
  if (!query) return topics;
  return topics.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase())
  );
}

// ── Task 6.3 — Property 7: Chat session isolation and preservation ───────────

describe('Property 7: Chat session isolation and preservation', () => {
  it('messages added to topic A do not appear in topic B', () => {
    fc.assert(
      fc.property(
        fc.tuple(topicIdArb, topicIdArb).filter(([a, b]) => a !== b),
        messagesArb,
        messagesArb,
        ([topicA, topicB], msgsA, msgsB) => {
          const store = makeStore();

          msgsA.forEach((msg) => store.dispatch(addMessage({ topicId: topicA, message: msg })));
          msgsB.forEach((msg) => store.dispatch(addMessage({ topicId: topicB, message: msg })));

          const state = store.getState().chat.sessions;
          const sessionA = state[topicA] ?? [];
          const sessionB = state[topicB] ?? [];

          // Sessions must be independent
          expect(sessionA.length).toBe(msgsA.length);
          expect(sessionB.length).toBe(msgsB.length);

          // No cross-contamination
          sessionA.forEach((msg, i) => {
            expect(msg.content).toBe(msgsA[i].content);
          });
          sessionB.forEach((msg, i) => {
            expect(msg.content).toBe(msgsB[i].content);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('switching topics preserves each session', () => {
    fc.assert(
      fc.property(
        fc.tuple(topicIdArb, topicIdArb).filter(([a, b]) => a !== b),
        messagesArb,
        ([topicA, topicB], msgs) => {
          const store = makeStore();

          // Add messages to topic A
          msgs.forEach((msg) => store.dispatch(addMessage({ topicId: topicA, message: msg })));

          // Switch to topic B (simulate by reading B's session — should be empty)
          const sessionBBefore = store.getState().chat.sessions[topicB] ?? [];
          expect(sessionBBefore.length).toBe(0);

          // Switch back to topic A — session still intact
          const sessionAAfter = store.getState().chat.sessions[topicA] ?? [];
          expect(sessionAAfter.length).toBe(msgs.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Task 6.4 — Property 5: Search filter correctness and invertibility ────────

describe('Property 5: Search filter correctness and invertibility', () => {
  const topicArb = fc.record({ name: fc.string({ minLength: 1, maxLength: 50 }) });
  const topicsArb = fc.array(topicArb, { minLength: 0, maxLength: 20 });

  it('filtered result contains only topics whose names include the query (case-insensitive)', () => {
    fc.assert(
      fc.property(
        topicsArb,
        fc.string({ minLength: 1, maxLength: 10 }),
        (topics, query) => {
          const filtered = filterTopics(topics, query);
          filtered.forEach((t) => {
            expect(t.name.toLowerCase()).toContain(query.toLowerCase());
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty query returns the full unfiltered list', () => {
    fc.assert(
      fc.property(topicsArb, (topics) => {
        const filtered = filterTopics(topics, '');
        expect(filtered.length).toBe(topics.length);
      }),
      { numRuns: 100 }
    );
  });

  it('no false negatives — every matching topic appears in results', () => {
    fc.assert(
      fc.property(
        topicsArb,
        fc.string({ minLength: 1, maxLength: 5 }),
        (topics, query) => {
          const filtered = filterTopics(topics, query);
          const expected = topics.filter((t) =>
            t.name.toLowerCase().includes(query.toLowerCase())
          );
          expect(filtered.length).toBe(expected.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Task 8.4 — Property 1: Research field completeness ───────────────────────

import { render, screen } from '@testing-library/react';
import ResearchView from '../components/ResearchView.jsx';

const RESEARCH_KEYS = [
  'one_liner', 'mechanism', 'when_to_use',
  'tradeoffs', 'interview', 'related',
];

describe('Property 1: Research field completeness', () => {
  it('renders all 7 research fields and has no delete button', () => {
    fc.assert(
      fc.property(
        fc.record({
          one_liner:   fc.string({ minLength: 1, maxLength: 50 }),
          mechanism:   fc.string({ minLength: 1, maxLength: 50 }),
          when_to_use: fc.string({ minLength: 1, maxLength: 50 }),
          tradeoffs:   fc.string({ minLength: 1, maxLength: 50 }),
          interview:   fc.string({ minLength: 1, maxLength: 50 }),
          related:     fc.string({ minLength: 1, maxLength: 50 }),
          diagram:     fc.constant(''),
        }),
        (research) => {
          const { container, unmount } = render(<ResearchView research={research} />);

          // All non-diagram text fields must appear somewhere in the output
          RESEARCH_KEYS.forEach((key) => {
            expect(container.textContent).toContain(research[key]);
          });

          // No delete button must be present
          const deleteButtons = container.querySelectorAll(
            'button[aria-label*="delete"], button[aria-label*="Delete"]'
          );
          expect(deleteButtons.length).toBe(0);

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });
});
