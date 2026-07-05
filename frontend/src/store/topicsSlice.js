import { createSlice } from '@reduxjs/toolkit';

const topicsSlice = createSlice({
  name: 'topics',
  initialState: {
    searchQuery: '',
    activeTopicId: null,
  },
  reducers: {
    setSearchQuery(state, action) {
      state.searchQuery = action.payload;
    },
    setActiveTopicId(state, action) {
      state.activeTopicId = action.payload;
    },
  },
});

export const { setSearchQuery, setActiveTopicId } = topicsSlice.actions;
export default topicsSlice.reducer;
