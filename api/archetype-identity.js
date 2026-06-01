import { ARCHETYPE_KEYS, archetypeMap } from '../lib/archetype-identity.js';
import { methodNotAllowed } from './_lib/http.js';

const CLIENT_IDENTITY_HEADERS = Object.freeze({
  'Cache-Control': 'public, max-age=300, s-maxage=300',
  'Content-Type': 'text/javascript; charset=utf-8',
});

function titleName(short) {
  return `The ${short || 'Builder'}`;
}

function clientPayload() {
  const archetypes = archetypeMap();
  const colors = {};
  const plurals = {};
  const shortNames = {};
  const profiles = {};

  for (const key of ARCHETYPE_KEYS) {
    const identity = archetypes[key];
    colors[key] = identity.color;
    plurals[key] = identity.plural;
    shortNames[key] = identity.short;
    profiles[key] = {
      name: titleName(identity.short),
      tagline: identity.tagline,
      desc: identity.description,
      gradient: identity.gradient,
      glyph: identity.glyph,
    };
  }

  return {
    keys: ARCHETYPE_KEYS,
    archetypes,
    colors,
    plurals,
    shortNames,
    profiles,
  };
}

function assignment(name, value) {
  return `window.${name} = Object.freeze(${JSON.stringify(value, null, 2)});`;
}

export function clientIdentityScript() {
  const payload = clientPayload();
  return [
    '(() => {',
    '  window.VIBESTATS_ARCHETYPE_IDENTITY_VERSION = "vibestats.archetype_identity.v1";',
    `  ${assignment('VIBESTATS_ARCHETYPE_KEYS', payload.keys)}`,
    `  ${assignment('VIBESTATS_ARCHETYPES', payload.archetypes)}`,
    `  ${assignment('VIBESTATS_ARCHETYPE_COLORS', payload.colors)}`,
    `  ${assignment('VIBESTATS_ARCHETYPE_PLURALS', payload.plurals)}`,
    `  ${assignment('VIBESTATS_ARCHETYPE_SHORT_NAMES', payload.shortNames)}`,
    `  ${assignment('VIBESTATS_ARCHETYPE_PROFILES', payload.profiles)}`,
    '})();',
    '',
  ].join('\n');
}

export default function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], CLIENT_IDENTITY_HEADERS);
  for (const [key, value] of Object.entries(CLIENT_IDENTITY_HEADERS)) res.setHeader(key, value);
  return res.status(200).send(clientIdentityScript());
}
