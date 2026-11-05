/**
 * The feature codes of the approved design (F1, F2, ...) are notes for the team that reviews the screens against it:
 * the people who use the platform should not see them. They are OFF unless `VITE_SHOW_CODES=true` is set when the app
 * is built (in `.env` for local work, or in Vercel's variables for a preview).
 */
export const SHOW_CODES = import.meta.env.VITE_SHOW_CODES === 'true'

/** " (F6)" when the codes are shown and nothing when they are not: for a code written inside a sentence. */
export const codeNote = (code) => (SHOW_CODES ? ` (${code})` : '')
