import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { clearSession } from '../store/chatSlice.js';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// Find a topic in the tree and call fn(topic) — used by all cache patchers
function patchTopicInTree(draft, id, fn) {
  const sid = String(id);
  for (const folder of draft.main_topics ?? []) {
    for (const sub of folder.sub_topics ?? []) {
      if (String(sub.id) === sid) { fn(sub); return; }
    }
  }
  for (const t of draft.root_topics ?? []) {
    if (String(t.id) === sid) { fn(t); return; }
  }
}

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers, { getState, endpoint }) => {
      const token = getState().auth.token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      if (endpoint === 'getTopicTree') {
        const etag = sessionStorage.getItem('etag:topic-tree');
        if (etag) headers.set('If-None-Match', etag);
      }
      return headers;
    },
    responseHandler: async (response) => {
      const etag = response.headers.get('etag');
      if (etag && response.url?.includes('/topic-tree')) {
        sessionStorage.setItem('etag:topic-tree', etag);
      }
      if (response.status === 304) return undefined;
      const text = await response.text();
      return text ? JSON.parse(text) : undefined;
    },
  }),
  tagTypes: ['Topics', 'Topic', 'TopicTree'],
  endpoints: (builder) => ({

    // Auth
    register: builder.mutation({
      query: ({ email, password }) => ({ url: '/auth/register', method: 'POST', body: { email, password } }),
    }),
    login: builder.mutation({
      query: ({ email, password }) => ({ url: '/auth/login', method: 'POST', body: { email, password } }),
    }),
    forgotPassword: builder.mutation({
      query: ({ email }) => ({ url: '/auth/forgot-password', method: 'POST', body: { email } }),
    }),
    resetPassword: builder.mutation({
      query: ({ token, new_password }) => ({ url: '/auth/reset-password', method: 'POST', body: { token, new_password } }),
    }),

    // Queries
    getTopics: builder.query({ query: () => '/topics', providesTags: ['Topics'] }),
    getTopic: builder.query({
      query: (id) => `/topics/${id}`,
      providesTags: (result, error, id) => [{ type: 'Topic', id }],
    }),
    // Full tree fetched once on load, then kept fresh via in-place patches
    getTopicTree: builder.query({ query: () => '/topic-tree', providesTags: ['TopicTree'] }),

    // Create folder — append server result to preserve server-assigned order
    createMainTopic: builder.mutation({
      query: ({ name }) => ({ url: '/main-topics', method: 'POST', body: { name } }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data: folder } = await queryFulfilled;
          dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
            draft.main_topics.push(folder);
          }));
        } catch {}
      },
    }),

    // Delete folder — remove from cache immediately, rollback on error
    deleteMainTopic: builder.mutation({
      query: (id) => ({ url: `/main-topics/${id}`, method: 'DELETE' }),
      async onQueryStarted(id, { dispatch, queryFulfilled, getState }) {
        // Capture sub-topic ids before the optimistic removal wipes them from cache
        const tree = apiSlice.endpoints.getTopicTree.select(undefined)(getState()).data;
        const folder = (tree?.main_topics ?? []).find((f) => String(f.id) === String(id));
        const subTopicIds = (folder?.sub_topics ?? []).map((s) => s.id);

        const p = dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
          draft.main_topics = (draft.main_topics ?? []).filter((f) => String(f.id) !== String(id));
        }));
        try {
          await queryFulfilled;
          for (const subId of subTopicIds) {
            dispatch(clearSession(subId));
          }
        } catch { p.undo(); }
      },
    }),

    // Rename folder — optimistic, rollback on error
    renameMainTopic: builder.mutation({
      query: ({ id, name }) => ({ url: `/main-topics/${id}/name`, method: 'PATCH', body: { name } }),
      async onQueryStarted({ id, name }, { dispatch, queryFulfilled }) {
        const p = dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
          const f = (draft.main_topics ?? []).find((f) => String(f.id) === String(id));
          if (f) f.name = name;
        }));
        try { await queryFulfilled; } catch { p.undo(); }
      },
    }),

    // Create topic — append server result to keep insertion order
    createTopic: builder.mutation({
      query: ({ name, parent_id } = {}) => ({
        url: '/topics', method: 'POST',
        body: parent_id ? { name, parent_id } : { name },
      }),
      invalidatesTags: (result) => result ? ['Topics', { type: 'Topic', id: result.id }] : ['Topics'],
      async onQueryStarted({ parent_id } = {}, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const item = { id: data.id, name: data.name, status: data.status, created_at: data.created_at };
          dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
            if (parent_id) {
              const folder = (draft.main_topics ?? []).find((f) => String(f.id) === String(parent_id));
              if (folder) folder.sub_topics.push(item);
            } else {
              draft.root_topics.push(item);
            }
          }));
        } catch {}
      },
    }),

    // Rename topic — optimistic patch in tree + individual topic cache
    renameTopic: builder.mutation({
      query: ({ id, name }) => ({ url: `/topics/${id}/name`, method: 'PATCH', body: { name } }),
      async onQueryStarted({ id, name }, { dispatch, queryFulfilled }) {
        const p1 = dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
          patchTopicInTree(draft, id, (t) => { t.name = name; });
        }));
        const p2 = dispatch(apiSlice.util.updateQueryData('getTopic', id, (draft) => {
          if (draft) draft.name = name;
        }));
        try { await queryFulfilled; } catch { p1.undo(); p2.undo(); }
      },
    }),

    // Update status — patch tree + individual topic, NO tree refetch
    updateTopicStatus: builder.mutation({
      query: ({ id, status }) => ({ url: `/topics/${id}/status`, method: 'PATCH', body: { status } }),
      async onQueryStarted({ id, status }, { dispatch, queryFulfilled }) {
        const p1 = dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
          patchTopicInTree(draft, id, (t) => { t.status = status; });
        }));
        const p2 = dispatch(apiSlice.util.updateQueryData('getTopic', id, (draft) => {
          if (draft) draft.status = status;
        }));
        try { await queryFulfilled; } catch { p1.undo(); p2.undo(); }
      },
    }),

    // Delete topic — remove from cache immediately
    deleteTopic: builder.mutation({
      query: (id) => ({ url: `/topics/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Topics'],
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const p = dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
          draft.root_topics = (draft.root_topics ?? []).filter((t) => String(t.id) !== String(id));
          for (const folder of draft.main_topics ?? []) {
            folder.sub_topics = (folder.sub_topics ?? []).filter((s) => String(s.id) !== String(id));
          }
        }));
        try {
          await queryFulfilled;
          dispatch(clearSession(id));
        } catch { p.undo(); }
      },
    }),

    // Retry research — patch status to researching immediately
    retryResearch: builder.mutation({
      query: (id) => ({ url: `/topics/${id}/retry`, method: 'POST' }),
      invalidatesTags: (result, error, id) => ['Topics', { type: 'Topic', id }],
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const p = dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
          patchTopicInTree(draft, id, (t) => { t.status = 'researching'; });
        }));
        try { await queryFulfilled; } catch { p.undo(); }
      },
    }),

    // Chat & notes — no tree involvement
    sendChatMessage: builder.mutation({
      query: ({ topicId, message, history }) => ({
        url: `/topics/${topicId}/chat`, method: 'POST', body: { message, history },
      }),
    }),
    saveNote: builder.mutation({
      query: ({ topicId, content }) => ({ url: `/topics/${topicId}/notes`, method: 'POST', body: { content } }),
      invalidatesTags: (result, error, { topicId }) => [{ type: 'Topic', id: topicId }],
    }),
    deleteNote: builder.mutation({
      query: ({ topicId, noteId }) => ({ url: `/topics/${topicId}/notes/${noteId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { topicId }) => [{ type: 'Topic', id: topicId }],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGetTopicsQuery,
  useGetTopicQuery,
  useGetTopicTreeQuery,
  useCreateTopicMutation,
  useCreateMainTopicMutation,
  useDeleteMainTopicMutation,
  useRenameTopicMutation,
  useRenameMainTopicMutation,
  useUpdateTopicStatusMutation,
  useDeleteTopicMutation,
  useSendChatMessageMutation,
  useSaveNoteMutation,
  useDeleteNoteMutation,
  useRetryResearchMutation,
} = apiSlice;
