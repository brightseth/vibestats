import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const ARCHETYPES = {
  orchestrator: { name: 'THE ORCHESTRATOR', tagline: "You don't code — you conduct.", color: '#6B8FFF' },
  shipper:      { name: 'THE SHIPPER',      tagline: 'Done is better than perfect. You live this.', color: '#22c55e' },
  architect:    { name: 'THE ARCHITECT',     tagline: 'You read before you write. You plan before you build.', color: '#6B8FFF' },
  debugger:     { name: 'THE DEBUGGER',      tagline: "You don't guess. You investigate.", color: '#f59e0b' },
  polyglot:     { name: 'THE POLYGLOT',      tagline: 'One language is never enough.', color: '#ff79c6' },
  sprinter:     { name: 'THE SPRINTER',      tagline: 'Fast, focused, ferocious.', color: '#ef4444' },
  deepdiver:    { name: 'THE DEEP DIVER',    tagline: 'You go deep, not wide.', color: '#3b82f6' },
  builder:      { name: 'THE BUILDER',       tagline: "You build things that didn't exist before.", color: '#22c55e' },
};

const COMPAT_SOURCE = readFileSync(new URL('../lib/compat.js', import.meta.url), 'utf8');
const compatContext = { window: {} };
runInNewContext(COMPAT_SOURCE, compatContext);
const VibeCompat = compatContext.window.VibeCompat;

let fontCache = null;

async function loadFont() {
  if (fontCache) return fontCache;
  const res = await fetch(
    'https://fonts.gstatic.com/l/font?kit=UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYMZs&skey=c491285d6722e4fa&v=v20'
  );
  fontCache = await res.arrayBuffer();
  return fontCache;
}

function firstParam(value) {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function labelParam(value, fallback) {
  const label = firstParam(value).slice(0, 42);
  return label || fallback;
}

function shortName(key) {
  return (ARCHETYPES[key]?.name || 'VIBECODER').replace(/^THE /, '');
}

export default async function handler(req, res) {
  try {
    const mode = firstParam(req.query.mode);
    const key = firstParam(req.query.a);
    const arch = ARCHETYPES[key] || ARCHETYPES.builder;
    const name = labelParam(req.query.n, 'Vibecoder');
    const days = firstParam(req.query.d) || '?';
    const commits = firstParam(req.query.c) || '?';
    const langs = firstParam(req.query.l) || '?';
    const sessions = firstParam(req.query.s) || '?';

    const fontData = await loadFont();
    const card = mode === 'pair'
      ? pairCard(req.query)
      : archetypeCard({ arch, name, days, commits, langs, sessions });

    const svg = await satori(
      card,
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: 'Inter', data: fontData, weight: 900, style: 'normal' },
        ],
      },
    );

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1200 },
    });
    const png = resvg.render().asPng();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).send(Buffer.from(png));
  } catch (e) {
    res.status(500).send(`OG Error: ${e.message}\n${e.stack}`);
  }
}

function page(children) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: '#06060a',
        padding: '60px 80px',
        fontFamily: 'Inter',
      },
      children,
    },
  };
}

function archetypeCard({ arch, name, days, commits, langs, sessions }) {
  return page([
    {
      type: 'div',
      props: {
        style: {
          fontSize: '14px',
          color: '#555568',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          marginBottom: '20px',
        },
        children: 'VIBECODING PERSONALITY',
      },
    },
    {
      type: 'div',
      props: {
        style: {
          fontSize: '72px',
          fontWeight: 900,
          color: arch.color,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          marginBottom: '16px',
        },
        children: arch.name,
      },
    },
    {
      type: 'div',
      props: {
        style: {
          fontSize: '20px',
          color: '#8888a0',
          fontStyle: 'italic',
          marginBottom: '48px',
          textAlign: 'center',
        },
        children: `"${arch.tagline}"`,
      },
    },
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          gap: '24px',
          marginBottom: '40px',
        },
        children: [
          sb(sessions, 'SESSIONS'),
          sb(`${commits}/day`, 'COMMITS'),
          sb(langs, 'LANGUAGES'),
          sb(`${days}d`, 'VIBECODING'),
        ],
      },
    },
    brandBlock(name),
  ]);
}

function pairCard(query = {}) {
  const aKey = ARCHETYPES[firstParam(query.a)] ? firstParam(query.a) : 'builder';
  const bKey = ARCHETYPES[firstParam(query.b)] ? firstParam(query.b) : 'shipper';
  const a = ARCHETYPES[aKey];
  const b = ARCHETYPES[bKey];
  const pairing = VibeCompat.getPairing(aKey, bKey);
  const aLabel = labelParam(query.an, shortName(aKey));
  const bLabel = labelParam(query.bn, shortName(bKey));

  return page([
    {
      type: 'div',
      props: {
        style: {
          fontSize: '14px',
          color: '#555568',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          marginBottom: '26px',
        },
        children: 'CLAUDE CODE PAIRING',
      },
    },
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '22px',
          marginBottom: '28px',
        },
        children: [
          pairPerson(aLabel, shortName(aKey), a.color),
          {
            type: 'div',
            props: {
              style: { fontSize: '26px', color: '#555568', fontWeight: 900 },
              children: '+',
            },
          },
          pairPerson(bLabel, shortName(bKey), b.color),
        ],
      },
    },
    {
      type: 'div',
      props: {
        style: {
          fontSize: '70px',
          fontWeight: 900,
          color: '#ffffff',
          textAlign: 'center',
          lineHeight: 1.05,
          marginBottom: '18px',
        },
        children: pairing.name,
      },
    },
    {
      type: 'div',
      props: {
        style: {
          fontSize: '22px',
          color: '#8888a0',
          textAlign: 'center',
          lineHeight: 1.4,
          maxWidth: '860px',
          marginBottom: '34px',
        },
        children: pairing.vibe,
      },
    },
    {
      type: 'div',
      props: {
        style: { display: 'flex', gap: '20px', marginBottom: '34px' },
        children: [
          sb(`${pairing.chemistry}/5`, 'CHEMISTRY'),
          sb('CLAIM YOURS', 'NEXT MOVE'),
        ],
      },
    },
    brandBlock('See how you pair'),
  ]);
}

function pairPerson(label, type, color) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '320px',
        padding: '22px 26px',
        backgroundColor: '#111118',
        borderRadius: '18px',
        border: `2px solid ${color}`,
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: '30px', fontWeight: 900, color, textAlign: 'center' },
            children: label,
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '12px', color: '#8888a0', letterSpacing: '0.12em', marginTop: '10px' },
            children: type,
          },
        },
      ],
    },
  };
}

function brandBlock(name) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: '22px', fontWeight: 900, color: '#ffffff' },
            children: name,
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '14px', color: '#6B8FFF', letterSpacing: '0.1em', marginTop: '12px' },
            children: 'vibestats.io',
          },
        },
      ],
    },
  };
}

function sb(value, label) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 28px',
        backgroundColor: '#111118',
        borderRadius: '12px',
        border: '1px solid #252535',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: '28px', fontWeight: 900, color: '#ffffff' },
            children: String(value),
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '11px', color: '#555568', letterSpacing: '0.1em', marginTop: '4px' },
            children: label,
          },
        },
      ],
    },
  };
}
