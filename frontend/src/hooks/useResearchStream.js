import { useEffect } from 'react';
import { useSelector } from 'react-redux';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

/**
 * Opens an SSE connection to /topics/{topicId}/status-stream when status is
 * 'researching'. Calls onComplete(newStatus) once and closes the connection.
 */
export function useResearchStream(topicId, status, onComplete) {
  const token = useSelector((state) => state.auth.token);

  useEffect(() => {
    if (!topicId || status !== 'researching' || !token) return;

    // EventSource doesn't support custom headers — pass token as query param
    const url = `${baseUrl}/topics/${topicId}/status-stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.onmessage = (e) => {
      if (e.data && e.data !== 'timeout') {
        onComplete(e.data);
      }
      es.close();
    };

    es.onerror = () => { es.close(); };

    return () => { es.close(); };
  }, [topicId, status, token]); // eslint-disable-line react-hooks/exhaustive-deps
}
