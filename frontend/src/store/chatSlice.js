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
  },
});

export const { addMessage, clearSession } = chatSlice.actions;
export default chatSlice.reducer;
