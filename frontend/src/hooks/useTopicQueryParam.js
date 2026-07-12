import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setActiveTopicId } from '../store/topicsSlice.js';

/**
 * Syncs activeTopicId with the ?topic= query param.
 * - On mount: reads ?topic= from URL and sets it as the active topic
 * - On change: updates the URL whenever activeTopicId changes
 */
export function useTopicQueryParam() {
  const dispatch = useDispatch();
  const activeTopicId = useSelector((state) => state.topics.activeTopicId);

  // On mount: read topic from URL and hydrate Redux
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topicId = params.get('topic');
    if (topicId) dispatch(setActiveTopicId(topicId));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // On change: keep URL in sync
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activeTopicId) {
      params.set('topic', activeTopicId);
    } else {
      params.delete('topic');
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [activeTopicId]);
}
