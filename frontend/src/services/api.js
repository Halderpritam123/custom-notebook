import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers, { getState }) => {
      const token = getState().auth.token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Topics', 'Topic'],
  endpoints: (builder) => ({
    // Auth endpoints
    register: builder.mutation({
      query: ({ email, password }) => ({
        url: '/auth/register',
        method: 'POST',
        body: { email, password },
      }),
    }),
    login: builder.mutation({
      query: ({ email, password }) => ({
        url: '/auth/login',
        method: 'POST',
        body: { email, password },
      }),
    }),

    // GET /topics — returns list of all topics
    getTopics: builder.query({
      query: () => '/topics',
      providesTags: ['Topics'],
    }),

    // GET /topics/{id} — returns single topic with research + notes
    getTopic: builder.query({
      query: (id) => `/topics/${id}`,
      providesTags: (result, error, id) => [{ type: 'Topic', id }],
    }),

    // POST /topics — create topic and trigger research
    createTopic: builder.mutation({
      query: (name) => ({
        url: '/topics',
        method: 'POST',
        body: { name },
      }),
      invalidatesTags: (result) =>
        result
          ? ['Topics', { type: 'Topic', id: result.id }]
          : ['Topics'],
    }),

    // PATCH /topics/{id}/status — update topic status
    updateTopicStatus: builder.mutation({
      query: ({ id, status }) => ({
        url: `/topics/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: (result, error, { id }) => [
        'Topics',
        { type: 'Topic', id },
      ],
    }),

    // DELETE /topics/{id} — delete topic (cascades research + notes)
    deleteTopic: builder.mutation({
      query: (id) => ({
        url: `/topics/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Topics'],
    }),

    // POST /topics/{id}/chat — send chat message, get reply
    sendChatMessage: builder.mutation({
      query: ({ topicId, message, history }) => ({
        url: `/topics/${topicId}/chat`,
        method: 'POST',
        body: { message, history },
      }),
      // No cache tag — chat is ephemeral, managed in chatSlice
    }),

    // POST /topics/{id}/notes — save a chat message as a note
    saveNote: builder.mutation({
      query: ({ topicId, content }) => ({
        url: `/topics/${topicId}/notes`,
        method: 'POST',
        body: { content },
      }),
      invalidatesTags: (result, error, { topicId }) => [
        { type: 'Topic', id: topicId },
      ],
    }),

    // POST /topics/{id}/retry — retry research generation for a stuck topic
    retryResearch: builder.mutation({
      query: (id) => ({
        url: `/topics/${id}/retry`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [
        'Topics',
        { type: 'Topic', id },
      ],
    }),

    // DELETE /topics/{id}/notes/{note_id} — remove a saved note
    deleteNote: builder.mutation({
      query: ({ topicId, noteId }) => ({
        url: `/topics/${topicId}/notes/${noteId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { topicId }) => [
        { type: 'Topic', id: topicId },
      ],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useGetTopicsQuery,
  useGetTopicQuery,
  useCreateTopicMutation,
  useUpdateTopicStatusMutation,
  useDeleteTopicMutation,
  useSendChatMessageMutation,
  useSaveNoteMutation,
  useDeleteNoteMutation,
  useRetryResearchMutation,
} = apiSlice;
