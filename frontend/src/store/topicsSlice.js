import { createSlice } from '@reduxjs/toolkit';

const topicsSlice = createSlice({
  name: 'topics',
  initialState: {
    searchQuery: '',
    activeTopicId: null,
    expandedFolderIds: [],
    isReadOnly: false,
  },
  reducers: {
    setSearchQuery(state, action) {
      state.searchQuery = action.payload;
    },
    setActiveTopicId(state, action) {
      state.activeTopicId = action.payload;
      // Selecting a topic from your own tree always clears read-only mode.
      // SharedWithMeSection explicitly calls setReadOnly(true) after this.
      state.isReadOnly = false;
    },
    setReadOnly(state, action) {
      state.isReadOnly = action.payload;
    },
    toggleFolder(state, action) {
      const id = action.payload;
      const index = state.expandedFolderIds.indexOf(id);
      if (index !== -1) {
        state.expandedFolderIds.splice(index, 1);
      } else {
        state.expandedFolderIds.push(id);
      }
    },
    expandFolder(state, action) {
      const id = action.payload;
      if (!state.expandedFolderIds.includes(id)) {
        state.expandedFolderIds.push(id);
      }
    },
  },
});

export const { setSearchQuery, setActiveTopicId, setReadOnly, toggleFolder, expandFolder } = topicsSlice.actions;
export default topicsSlice.reducer;
