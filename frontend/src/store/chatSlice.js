import { createSlice } from '@reduxjs/toolkit';

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    sessions: {},
  },
  reducers: {
    addMessage(state, action) {
      const { topicId, message } = action.payload;
      if (!state.sessions[topicId]) {
        state.sessions[topicId] = [];
      }
      state.sessions[topicId].push(message);
    },
    clearSession(state, action) {
      const topicId = action.payload;
      delete state.sessions[topicId];
    },
    // Called after a note is saved — attach noteId to the matching assistant message
    markSaved(state, action) {
      const { topicId, content, noteId } = action.payload;
      const session = state.sessions[topicId];
      if (!session) return;
      const msg = [...session].reverse().find((m) => m.role === 'assistant' && m.content === content);
      if (msg) msg.noteId = noteId;
    },
    // Called after a note is deleted — remove noteId from the matching assistant message
    markUnsaved(state, action) {
      const { topicId, noteId } = action.payload;
      const session = state.sessions[topicId];
      if (!session) return;
      const msg = session.find((m) => m.noteId === noteId);
      if (msg) delete msg.noteId;
    },
  },
});

export const { addMessage, clearSession, markSaved, markUnsaved } = chatSlice.actions;
export default chatSlice.reducer;
