import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const ARCHETYPES = {
  orchestrator: { name: 'THE ORCHESTRATOR', tagline: "You don't code — you conduct.", color: '#8aa4ff' },
  shipper: { name: 'THE SHIPPER', tagline: "Done is better than perfect.", color: '#4ade80' },
  architect: { name: 'THE ARCHITECT', tagline: "You read before you write.", color: '#60a5fa' },
  debugger: { name: 'THE DEBUGGER', tagline: "You don't guess. You investigate.", color: '#fbbf24' },
  polyglot: { name: 'THE POLYGLOT', tagline: "One language is never enough.", color: '#f472b6' },
  sprinter: { name: 'THE SPRINTER', tagline: "Fast, focused, ferocious.", color: '#f87171' },
  deepdiver: { name: 'THE DEEP DIVER', tagline: "You go deep, not wide.", color: '#60a5fa' },
  builder: { name: 'THE BUILDER', tagline: "You build things that didn't exist before.", color: '#4ade80' },
};

function h(type, props, ...children) {
  return { type, props: { ...props, children: children.length === 1 ? children[0] : children } };
}

function statBox(value, label) {
  return h('div', {
    style: {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '14px 28px', background: 'rgba(255,255,255,0.04)',
      borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
    },
  },
    h('div', { style: { fontSize: 30, fontWeight: 700, color: '#fff' } }, String(value)),
    h('div', {
      style: {
        fontSize: 12, color: '#666680', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginTop: 4,
      },
    }, label),
  );
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('a') || 'builder';
  const name = searchParams.get('n') || 'Vibecoder';
  const days = searchParams.get('d') || '?';
  const commits = searchParams.get('c') || '?';
  const langs = searchParams.get('l') || '?';
  const sessions = searchParams.get('s') || '?';
  const sat = searchParams.get('sat');
  const pct = searchParams.get('p');

  const a = ARCHETYPES[key] || ARCHETYPES.builder;

  const statsRow = [
    statBox(sessions, 'sessions'),
    statBox(commits + '/day', 'commits'),
    statBox(langs, 'languages'),
    statBox(sat ? sat + '%' : '—', sat ? 'satisfaction' : ''),
  ];

  const children = [
    h('div', {
      style: {
        fontSize: 14, color: '#555568', letterSpacing: '0.2em',
        textTransform: 'uppercase', marginBottom: 24,
      },
    }, 'your vibecoding personality'),
    h('div', {
      style: {
        fontSize: 76, fontWeight: 900, color: a.color,
        letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 8,
      },
    }, a.name),
    h('div', {
      style: {
        fontSize: 22, color: '#8888a0', fontStyle: 'italic', marginBottom: 36,
      },
    }, `"${a.tagline}"`),
    h('div', { style: { display: 'flex', gap: 20, marginBottom: 36 } }, ...statsRow),
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
      h('div', { style: { fontSize: 22, color: '#fff', fontWeight: 600 } }, name),
      h('div', { style: { fontSize: 14, color: '#555568', marginTop: 4 } }, `${days} days of vibecoding`),
    ),
  ];

  if (pct) {
    children.push(
      h('div', {
        style: {
          fontSize: 14, color: a.color, marginTop: 16,
          padding: '6px 20px', border: `1px solid ${a.color}40`,
          borderRadius: 20, display: 'flex',
        },
      }, `top ${pct}%`)
    );
  }

  children.push(
    h('div', {
      style: {
        fontSize: 13, color: '#444458', letterSpacing: '0.12em',
        marginTop: 20,
      },
    }, 'vibestats.io')
  );

  return new ImageResponse(
    h('div', {
      style: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', width: '100%', height: '100%',
        background: '#06060a', padding: '40px 60px',
        fontFamily: 'Inter, sans-serif',
      },
    }, ...children),
    { width: 1200, height: 630 },
  );
}
