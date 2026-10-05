// Every new older-player game must have a younger-player activity or a reviewed reason here.
export const KINDER_COUNTERPARTS = {
  mix: ['mix'],
  sums: ['addobjects', 'subtract'],
  skip: ['line', 'pattern'],
  cookies: ['cookies'],
  balance: ['balance-k'],
};
export const KINDER_EXEMPTIONS = {
  multiply: 'Formal times tables are outside the pre-reader curriculum.',
  // Finding an unknown factor requires the multiplication notation introduced in the older track.
  factor: 'Symbolic missing factors await multiplication readiness.',
  // Two-digit place value is outside the current 1–10 concrete block activity.
  place: 'Tens and ones await a dedicated concrete kindergarten activity.',
};
