// operator_images.js — GitHub RAW operátor-képek

const BASE =
  'https://raw.githubusercontent.com/kmart93-creator/r6-operator-images/main';

/** "ash", "jäger" -> "ash", "jager" stb. */
function slugify(name = '') {
  return String(name)
    .toLowerCase()
    .normalize('NFD')                // ékezetek bontása
    .replace(/[\u0300-\u036f]/g, '') // ékezetek törlése
    .replace(/[^a-z0-9]+/g, '');     // minden nem a-z,0-9 törlése
}

/**
 * Visszaadja az operátor képe (ikon/figure) URL-jét a GitHub RAW-ból.
 * Jelenleg ugyanazt a PNG-t használjuk thumb + nagy képnek is.
 */
export function getOperatorImage(opName) {
  const slug = slugify(opName);
  if (!slug) return null;

  const url = `${BASE}/${slug}.png`;
  return {
    icon: url,
    figure: url
  };
}
