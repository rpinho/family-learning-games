import { LESSONS } from './curriculum.mjs';

export function pathProgress(profile) {
  // Older versions allowed out-of-order play: keep every reached lesson available.
  const completed = profile.completed || {};
  const reached = Math.max(-1, ...LESSONS.map((l, i) => completed[l.id] ? i : -1));
  const active = profile.session?.phase !== 'summary' ? profile.session?.lesson : null;
  const next = LESSONS[reached + 1];
  return LESSONS.map((lesson, index) => ({
    ...lesson,
    complete: completed[lesson.id],
    current: lesson.id === next?.id,
    locked: index > reached + 1 && lesson.id !== active,
    active: lesson.id === active,
  }));
}
