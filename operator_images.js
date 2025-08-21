// operator_images.js — minden név -> GitHub RAW PNG
const BASE = 'https://raw.githubusercontent.com/kmart93-creator/r6-operator-images/main/';

// mappoljuk a különleges írásmódokat is
const MAP = {
  ace:'ace', alibi:'alibi', amaru:'amaru', aruni:'aruni', ash:'ash', azami:'azami',
  bandit:'bandit', blackbeard:'blackbeard', blitz:'blitz', brava:'brava',
  buck:'buck', capitao:'capitao', castle:'castle', caveira:'caveira', clash:'clash',
  deimos:'deimos', denari:'denari', doc:'doc', dokkaebi:'dokkaebi', echo:'echo',
  ela:'ela', fenrir:'fenrir', finka:'finka', flores:'flores', frost:'frost',
  fuze:'fuze', glaz:'glaz', goyo:'goyo', gridlock:'gridlock', grim:'grim',
  hibana:'hibana', iana:'iana', iq:'iq', jackal:'jackal', jager:'jager', // jäger alias lent
  kali:'kali', kapkan:'kapkan', kaid:'kaid', lesion:'lesion', lion:'lion',
  maestro:'maestro', maverick:'maverick', melusi:'melusi', mira:'mira', montagne:'montagne',
  mozzie:'mozzie', mute:'mute', nokk:'nokk', // nøkk alias lent
  osa:'osa', oryx:'oryx', pulse:'pulse', ram:'ram', rook:'rook',
  sens:'sens', sentry:'sentry', sledge:'sledge', smoke:'smoke', solis:'solis',
  striker:'striker', tachanka:'tachanka', thermite:'thermite', thorn:'thorn', thunderbird:'thunderbird',
  tubarao:'tubarao', twitch:'twitch', valkyrie:'valkyrie', vigil:'vigil', wamai:'wamai',
  warden:'warden', ying:'ying', zero:'zero', zofia:'zofia',

  // aliasok ékezetekre / más írásmódra
  'jäger':'jager', 'jaeger':'jager', 'nøkk':'nokk', 'nokk':'nokk'
};

function norm(s='') {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .replaceAll('ä','a').replaceAll('á','a').replaceAll('à','a').replaceAll('â','a')
    .replaceAll('ö','o').replaceAll('ó','o').replaceAll('ø','o')
    .replaceAll('é','e').replaceAll('ë','e')
    .replaceAll('í','i').replaceAll('ï','i')
    .replaceAll('ű','u').replaceAll('ü','u').replaceAll('ú','u')
    .replaceAll('ß','ss')
    .replaceAll(/[^a-z0-9]/g,''); // csak egyszerű betű-szám
}

export function getOperatorImage(name) {
  const key = norm(name);
  const file = MAP[key];
  if (!file) return null;
  return `${BASE}${file}.png`;
} 
