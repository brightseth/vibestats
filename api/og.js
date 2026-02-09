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
  try {
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

    // Build stat boxes HTML-style for satori
    const statItems = [
      { val: sessions, label: 'sessions' },
      { val: commits + '/day', label: 'commits' },
      { val: langs, label: 'languages' },
      { val: sat ? sat + '%' : '—', label: sat ? 'satisfaction' : '' },
    ];

    return new ImageResponse(
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
            padding: '40px 60px',
            fontFamily: 'Inter, sans-serif',
          },
          children: [
            // Label
            {
              type: 'div',
              props: {
                style: {
                  fontSize: 14,
                  color: '#555568',
                  letterSpacing: '0.2em',
                  marginBottom: 24,
                },
                children: 'YOUR VIBECODING PERSONALITY',
              },
            },
            // Archetype name
            {
              type: 'div',
              props: {
                style: {
                  fontSize: 72,
                  fontWeight: 900,
                  color: a.color,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  marginBottom: 8,
                },
                children: a.name,
              },
            },
            // Tagline
            {
              type: 'div',
              props: {
                style: {
                  fontSize: 22,
                  color: '#8888a0',
                  fontStyle: 'italic',
                  marginBottom: 36,
                },
                children: '"' + a.tagline + '"',
              },
            },
            // Stats row
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  gap: 20,
                  marginBottom: 36,
                },
                children: statItems.map(item => ({
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '14px 28px',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.06)',
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: { fontSize: 28, fontWeight: 700, color: '#ffffff' },
                          children: String(item.val),
                        },
                      },
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: 11,
                            color: '#666680',
                            marginTop: 4,
                            letterSpacing: '0.06em',
                          },
                          children: item.label.toUpperCase(),
                        },
                      },
                    ],
                  },
                })),
              },
            },
            // User name
            {
              type: 'div',
              props: {
                style: { fontSize: 22, fontWeight: 600, color: '#ffffff' },
                children: name,
              },
            },
            // Days
            {
              type: 'div',
              props: {
                style: { fontSize: 14, color: '#555568', marginTop: 4 },
                children: days + ' days of vibecoding',
              },
            },
            // Percentile (if available)
            ...(pct ? [{
              type: 'div',
              props: {
                style: {
                  fontSize: 14,
                  color: a.color,
                  marginTop: 16,
                  padding: '6px 20px',
                  border: '1px solid ' + a.color + '40',
                  borderRadius: 20,
                  display: 'flex',
                },
                children: 'top ' + pct + '%',
              },
            }] : []),
            // Brand
            {
              type: 'div',
              props: {
                style: {
                  fontSize: 13,
                  color: '#444458',
                  letterSpacing: '0.12em',
                  marginTop: 20,
                },
                children: 'vibestats.io',
              },
            },
          ],
        },
      },
      { width: 1200, height: 630 },
    );
  } catch (e) {
    return new Response('OG generation failed: ' + e.message, { status: 500 });
  }
}
