import React, { useState } from 'react';
import { DEMO_MODE } from '../config';

const DemoBanner = () => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!DEMO_MODE) return null;

  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
          color: 'white',
          padding: '10px 14px',
          borderRadius: '50px',
          fontSize: '20px',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(139, 92, 246, 0.5)',
          transition: 'all 0.3s ease',
          border: 'none',
        }}
        title="Click to expand demo info"
      >
        🚀
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        color: '#e2e8f0',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '1px solid #8b5cf6',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontSize: '13px',
        maxWidth: '320px',
        backdropFilter: 'blur(12px)',
        transition: 'all 0.3s ease',
      }}
    >
      <button
        onClick={() => setIsMinimized(true)}
        style={{
          position: 'absolute',
          top: '6px',
          right: '10px',
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          fontSize: '16px',
          cursor: 'pointer',
          padding: '0 4px',
        }}
        title="Minimize"
      >
        ✕
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '10px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
            }}
          >
            🚀 Demo Mode
          </span>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            Read-only
          </span>
        </div>

        <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.4' }}>
          View-only demonstration of the University ERP System
        </div>

        <div
          style={{
            fontSize: '11px',
            color: '#94a3b8',
            background: 'rgba(148, 163, 184, 0.08)',
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid rgba(148, 163, 184, 0.1)',
          }}
        >
          <strong>Login:</strong> admin@csuniversity.com / universityadmin
        </div>
      </div>
    </div>
  );
};

export default DemoBanner;