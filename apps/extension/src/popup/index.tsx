import React from 'react';
import { createRoot } from 'react-dom/client';

const Popup: React.FC = () => {
  return (
    <div style={{ padding: '16px', width: '300px', fontFamily: 'sans-serif' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#2563eb' }}>PULSO CRM</h2>
      <p style={{ margin: 0, fontSize: '14px', color: '#4b5563' }}>
        Versión 8.0.0 — SaaS Extension
      </p>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
