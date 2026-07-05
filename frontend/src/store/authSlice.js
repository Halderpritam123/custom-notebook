import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: localStorage.getItem('token') || null,
    email: localStorage.getItem('email') || null,
  },
  reducers: {
    setCredentials(state, action) {
      state.token = action.payload.token;
      state.email = action.payload.email;
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('email', action.payload.email);
    },
    logout(state) {
      state.token = null;
      state.email = null;
      localStorage.removeItem('token');
      localStorage.removeItem('email');
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
