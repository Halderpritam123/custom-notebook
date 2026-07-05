import { configureStore } from '@reduxjs/toolkit';
import { apiSlice } from '../services/api.js';
import topicsReducer from './topicsSlice.js';
import chatReducer from './chatSlice.js';
import authReducer from './authSlice.js';

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    topics: topicsReducer,
    chat: chatReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});
