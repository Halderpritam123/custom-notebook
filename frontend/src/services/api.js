import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { clearSession } from '../store/chatSlice.js';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// ─── Tree helpers ────────────────────────────────────────────────────────────

// Recursively find a node (folder or topic) by id and call fn(node)
function patchTopicInTree(draft, id, fn) {
  const sid = String(id);
  function walk(nodes) {
    for (const node of nodes ?? []) {
      if (String(node.id) === sid) { fn(node); return true; }
      if (node.is_folder && walk(node.children ?? [])) return true;
    }
    return false;
  }
  walk(draft.nodes);
}

// Recursively collect all leaf topic ids under a folder (for clearSession on delete)
function collectTopicIds(node) {
  if (!node.is_folder) return [node.id];
  return (node.children ?? []).flatMap(collectTopicIds);
}

// Remove a node by id from the tree
function removeNodeFromTree(draft, id) {
  const sid = String(id);
  function removeFrom(nodes) {
    const idx = nodes.findIndex((n) => String(n.id) === sid);
    if (idx !== -1) { nodes.splice(idx, 1); return true; }
    for (const node of nodes) {
      if (node.is_folder && removeFrom(node.children ?? [])) return true;
    }
    return false;
  }
  removeFrom(draft.nodes);
}

// Find a folder node by id
function findFolder(nodes, id) {
  const sid = String(id);
  for (const node of nodes ?? []) {
    if (String(node.id) === sid && node.is_folder) return node;
    if (node.is_folder) {
      const found = findFolder(node.children ?? [], id);
      if (found) return found;
    }
  }
  return null;
}

// ─── API slice ────────────────────────────────────────────────────────────────

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
    // Full tree — single fetch, kept fresh via in-place patches + ETag
    getTopicTree: builder.query({ query: () => '/topic-tree', providesTags: ['TopicTree'] }),

    // Create folder (supports nested: pass parent_id for subcategory)
    createMainTopic: builder.mutation({
      query: ({ name, parent_id } = {}) => ({
        url: '/main-topics', method: 'POST',
        body: parent_id ? { name, parent_id } : { name },
      }),
      async onQueryStarted({ parent_id } = {}, { dispatch, queryFulfilled }) {
        try {
          const { data: folder } = await queryFulfilled;
          dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
            if (parent_id) {
              const parent = findFolder(draft.nodes, parent_id);
              if (parent) { parent.children = parent.children ?? []; parent.children.push(folder); }
            } else {
              draft.nodes.push(folder);
            }
          }));
        } catch {}
      },
    }),

    // Delete folder
    deleteMainTopic: builder.mutation({
      query: (id) => ({ url: `/main-topics/${id}`, method: 'DELETE' }),
      async onQueryStarted(id, { dispatch, queryFulfilled, getState }) {
        const tree = apiSlice.endpoints.getTopicTree.select(undefined)(getState()).data;
        const node = findFolder(tree?.nodes ?? [], id);
        const topicIds = node ? collectTopicIds(node) : [];

        const p = dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
          removeNodeFromTree(draft, id);
        }));
        try {
          await queryFulfilled;
          for (const tid of topicIds) dispatch(clearSession(tid));
        } catch { p.undo(); }
      },
    }),

    // Rename folder — optimistic
    renameMainTopic: builder.mutation({
      query: ({ id, name }) => ({ url: `/main-topics/${id}/name`, method: 'PATCH', body: { name } }),
      async onQueryStarted({ id, name }, { dispatch, queryFulfilled }) {
        const p = dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
          patchTopicInTree(draft, id, (n) => { n.name = name; });
        }));
        try { await queryFulfilled; } catch { p.undo(); }
      },
    }),

    // Create topic leaf
    createTopic: builder.mutation({
      query: ({ name, parent_id } = {}) => ({
        url: '/topics', method: 'POST',
        body: parent_id ? { name, parent_id } : { name },
      }),
      invalidatesTags: (result) => result ? ['Topics', { type: 'Topic', id: result.id }] : ['Topics'],
      async onQueryStarted({ parent_id } = {}, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const item = { id: data.id, name: data.name, is_folder: false, status: data.status, created_at: data.created_at };
          dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
            if (parent_id) {
              const parent = findFolder(draft.nodes, parent_id);
              if (parent) { parent.children = parent.children ?? []; parent.children.push(item); }
            } else {
              draft.nodes.push(item);
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

    // Update status
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

    // Delete topic leaf
    deleteTopic: builder.mutation({
      query: (id) => ({ url: `/topics/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Topics'],
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const p = dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
          removeNodeFromTree(draft, id);
        }));
        try {
          await queryFulfilled;
          dispatch(clearSession(id));
        } catch { p.undo(); }
      },
    }),

    // Retry research
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

    // Chat & notes
    sendChatMessage: builder.mutation({
      query: ({ topicId, message, history }) => ({
        url: `/topics/${topicId}/chat`, method: 'POST', body: { message, history },
      }),
    }),
    updateNote: builder.mutation({
      query: ({ topicId, noteId, content }) => ({
        url: `/topics/${topicId}/notes/${noteId}`, method: 'PATCH', body: { content },
      }),
      async onQueryStarted({ topicId, noteId, content }, { dispatch, queryFulfilled }) {
        const p = dispatch(apiSlice.util.updateQueryData('getTopic', topicId, (draft) => {
          if (draft) {
            const note = draft.notes.find((n) => String(n.id) === String(noteId));
            if (note) note.content = content;
          }
        }));
        try { await queryFulfilled; } catch { p.undo(); }
      },
    }),
    saveNote: builder.mutation({
      query: ({ topicId, content }) => ({ url: `/topics/${topicId}/notes`, method: 'POST', body: { content } }),
      async onQueryStarted({ topicId }, { dispatch, queryFulfilled }) {
        try {
          const { data: note } = await queryFulfilled;
          dispatch(apiSlice.util.updateQueryData('getTopic', topicId, (draft) => {
            if (draft) draft.notes.push(note);
          }));
        } catch {}
      },
    }),
    deleteNote: builder.mutation({
      query: ({ topicId, noteId }) => ({ url: `/topics/${topicId}/notes/${noteId}`, method: 'DELETE' }),
      async onQueryStarted({ topicId, noteId }, { dispatch, queryFulfilled }) {
        const p = dispatch(apiSlice.util.updateQueryData('getTopic', topicId, (draft) => {
          if (draft) draft.notes = draft.notes.filter((n) => String(n.id) !== String(noteId));
        }));
        try { await queryFulfilled; } catch { p.undo(); }
      },
    }),

    // Research edit
    updateResearch: builder.mutation({
      query: ({ topicId, ...fields }) => ({
        url: `/topics/${topicId}/research`, method: 'PATCH', body: fields,
      }),
      async onQueryStarted({ topicId }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(apiSlice.util.updateQueryData('getTopic', topicId, (draft) => {
            if (draft) draft.research = data;
          }));
        } catch {}
      },
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
  useUpdateNoteMutation,
  useSaveNoteMutation,
  useDeleteNoteMutation,
  useRetryResearchMutation,
  useUpdateResearchMutation,
} = apiSlice;
