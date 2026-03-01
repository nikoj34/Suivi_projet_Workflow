import { useState } from 'react';
import { fs } from '../lib/storage';

export default function StartupScreen({ onLoad, onFresh, onBackToLogin, onSignOut }) {
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    setLoading(true);
    const ok = await fs.open();
    setLoading(false);
    if (ok) onLoad();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(135deg,#f0fdf4 0%,#f8fafc 60%,#fdf4ff 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div style={{ maxWidth: 480, width: '90%', textAlign: 'center' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: '#007A78',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 32px rgba(34,161,38,0.25)',
          }}
        >
          <span style={{ fontSize: 32, color: 'white', fontWeight: 900, fontStyle: 'italic' }}>C</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1e293b', marginBottom: 4, letterSpacing: '-0.5px' }}>
          DITAM Travaux Manager
        </h1>
        <p style={{ fontSize: 11, color: '#dd007e', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 32 }}>
          Gestion Travaux
        </p>
        <div
          style={{
            background: 'white',
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 4px 40px rgba(0,0,0,0.08)',
            border: '1px solid rgba(255,255,255,0.9)',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
            Charger votre fichier de sauvegarde
          </p>
          <button
            onClick={handleOpen}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: loading ? '#94a3b8' : '#007A78',
              color: 'white',
              border: 'none',
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              cursor: loading ? 'wait' : 'pointer',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading ? '⏳ Chargement…' : '📂 Ouvrir mon fichier JSON'}
          </button>
          <button
            onClick={onFresh}
            style={{
              width: '100%',
              padding: '11px 24px',
              background: 'transparent',
              color: '#94a3b8',
              border: '2px solid #e2e8f0',
              borderRadius: 14,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              marginBottom: (onBackToLogin || onSignOut) ? 12 : 0,
            }}
          >
            Commencer sans fichier
          </button>
          {onBackToLogin && (
            <button
              type="button"
              onClick={onBackToLogin}
              style={{
                width: '100%',
                padding: '10px 24px',
                background: 'transparent',
                color: '#64748b',
                border: 'none',
                borderRadius: 14,
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: 'pointer',
                marginTop: 8,
              }}
            >
              Revenir à l'écran de connexion
            </button>
          )}
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              style={{
                width: '100%',
                padding: '10px 24px',
                background: 'transparent',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: 'pointer',
                marginTop: 8,
              }}
            >
              Se déconnecter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
