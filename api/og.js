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

let fontCache = null;

async function loadFont() {
  if (fontCache) return fontCache;
  const res = await fetch(
    'https://fonts.gstatic.com/l/font?kit=UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYMZs&skey=c491285d6722e4fa&v=v20'
  );
  fontCache = await res.arrayBuffer();
  return fontCache;
}

export default async function handler(req, res) {
  try {
    const { a: key, n, d, c, l, s } = req.query;
    const arch = ARCHETYPES[key] || ARCHETYPES.builder;
    const name = n || 'Vibecoder';
    const days = d || '?';
    const commits = c || '?';
    const langs = l || '?';
    const sessions = s || '?';

    const fontData = await loadFont();

    const svg = await satori(
      {
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
          children: [
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
            {
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
            },
          ],
        },
      },
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
