import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default function handler() {
  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          fontSize: 60,
          color: 'white',
          background: 'black',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        },
        children: 'Hello vibestats',
      },
    },
    { width: 1200, height: 630 },
  );
}
