/** "Ana Beltrán" → "AB", "jeison" → "J": what the round badge next to a person's name shows. */
export default function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}
