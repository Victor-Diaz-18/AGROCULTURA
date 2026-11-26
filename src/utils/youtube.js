/** The 11 letters that name a YouTube video, from any of its usual addresses; null when it is not one. Same rule as the server. */
export function youtubeId(url) {
  const match = /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})(?:[?&#].*)?$/.exec(
    String(url ?? '').trim(),
  )
  return match ? match[1] : null
}

/** The player of a video, from YouTube's privacy-enhanced address (no cookies until the person presses play). */
export const youtubeEmbed = (id) => `https://www.youtube-nocookie.com/embed/${id}`
