import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: localStorage.getItem('token') || null,
    refreshToken: localStorage.getItem('refreshToken') || null,
    email: localStorage.getItem('email') || null,
    userId: localStorage.getItem('userId') || null,
  },
  reducers: {
    setCredentials(state, action) {
      state.token = action.payload.token;
      state.email = action.payload.email;
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('email', action.payload.email);
      if (action.payload.refresh_token) {
        state.refreshToken = action.payload.refresh_token;
        localStorage.setItem('refreshToken', action.payload.refresh_token);
      }
      if (action.payload.id) {
        state.userId = action.payload.id;
        localStorage.setItem('userId', action.payload.id);
      }
    },
    logout(state) {
      state.token = null;
      state.refreshToken = null;
      state.email = null;
      state.userId = null;
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('email');
      localStorage.removeItem('userId');
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
