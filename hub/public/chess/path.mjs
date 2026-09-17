import { lessonsForBand } from './curriculum.mjs';

export function pathProgress(profile) {
  // Older versions allowed out-of-order play: keep every reached lesson available.
  const LESSONS=lessonsForBand(profile.settings?.band);
  const completed = profile.completed || {};
  const active = profile.session?.phase !== 'summary' ? profile.session?.lesson : null;
  // A deliberate Small steps placement also leaves the earlier, easier lessons open.
  const placement = profile.settings?.band==='steps' ? LESSONS.findIndex(l=>l.id===active)-1 : -1;
  const reached = Math.max(-1, placement, ...LESSONS.map((l, i) => completed[l.id] ? i : -1));
  const next = LESSONS[reached + 1];
  return LESSONS.map((lesson, index) => ({
    ...lesson,
    complete: completed[lesson.id],
    current: lesson.id === next?.id,
    locked: index > reached + 1 && lesson.id !== active,
    active: lesson.id === active,
  }));
}
