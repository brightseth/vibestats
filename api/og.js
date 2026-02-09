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

  const el = {
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
        padding: 60,
        fontFamily: 'sans-serif',
      },
      children: [
        {
          type: 'span',
          props: {
            style: { fontSize: 14, color: '#555568', letterSpacing: 4, marginBottom: 24 },
            children: 'YOUR VIBECODING PERSONALITY',
          },
        },
        {
          type: 'span',
          props: {
            style: { fontSize: 72, fontWeight: 900, color: a.color, marginBottom: 8 },
            children: a.name,
          },
        },
        {
          type: 'span',
          props: {
            style: { fontSize: 22, color: '#8888a0', marginBottom: 36 },
            children: '"' + a.tagline + '"',
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', gap: 20, marginBottom: 36 },
            children: [
              { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, backgroundColor: '#111118', borderRadius: 12 }, children: [
                { type: 'span', props: { style: { fontSize: 28, fontWeight: 700, color: 'white' }, children: String(sessions) } },
                { type: 'span', props: { style: { fontSize: 11, color: '#666680', marginTop: 4 }, children: 'SESSIONS' } },
              ]}},
              { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, backgroundColor: '#111118', borderRadius: 12 }, children: [
                { type: 'span', props: { style: { fontSize: 28, fontWeight: 700, color: 'white' }, children: commits + '/day' } },
                { type: 'span', props: { style: { fontSize: 11, color: '#666680', marginTop: 4 }, children: 'COMMITS' } },
              ]}},
              { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, backgroundColor: '#111118', borderRadius: 12 }, children: [
                { type: 'span', props: { style: { fontSize: 28, fontWeight: 700, color: 'white' }, children: String(langs) } },
                { type: 'span', props: { style: { fontSize: 11, color: '#666680', marginTop: 4 }, children: 'LANGUAGES' } },
              ]}},
              { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, backgroundColor: '#111118', borderRadius: 12 }, children: [
                { type: 'span', props: { style: { fontSize: 28, fontWeight: 700, color: 'white' }, children: sat ? sat + '%' : '—' } },
                { type: 'span', props: { style: { fontSize: 11, color: '#666680', marginTop: 4 }, children: sat ? 'SATISFACTION' : '' } },
              ]}},
            ],
          },
        },
        {
          type: 'span',
          props: {
            style: { fontSize: 22, fontWeight: 600, color: 'white' },
            children: name,
          },
        },
        {
          type: 'span',
          props: {
            style: { fontSize: 14, color: '#555568', marginTop: 4 },
            children: days + ' days of vibecoding',
          },
        },
        {
          type: 'span',
          props: {
            style: { fontSize: 13, color: '#444458', letterSpacing: 2, marginTop: 24 },
            children: 'vibestats.io',
          },
        },
      ],
    },
  };

  return new ImageResponse(el, { width: 1200, height: 630 });
}
