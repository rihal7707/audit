import { ImageResponse } from 'next/og';

export const alt = 'AMARKETING – Free AI Business Audit';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(160deg, #070F1E 0%, #12233F 100%)',
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              background: '#10B981',
            }}
          />
          <span
            style={{
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: '#FFFFFF',
            }}
          >
            AMARKETING
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              padding: '8px 18px',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.16)',
              border: '1px solid rgba(52, 211, 153, 0.45)',
              color: '#34D399',
              fontSize: '20px',
              fontWeight: 600,
            }}
          >
            Free · Evidence-Based · No Obligation
          </div>
          <div style={{ fontSize: '58px', fontWeight: 700, lineHeight: 1.12 }}>
            Discover Where AI Can Transform Your Business
          </div>
          <div style={{ fontSize: '26px', color: '#CBD5E1', lineHeight: 1.4 }}>
            Personalised website inspection, AI agent workflows, and a 30/60/90-day automation roadmap.
          </div>
        </div>

        <div style={{ fontSize: '20px', color: '#94A3B8' }}>
          Free AI Business Audit by Amarketing Advertising
        </div>
      </div>
    ),
    size,
  );
}
