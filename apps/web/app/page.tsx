'use client';

import React, { useEffect, useState } from 'react';
import ResetPasswordPage from './reset-password/page';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [hasAuthHash, setHasAuthHash] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && (window.location.hash.includes('access_token') || window.location.hash.includes('type='))) {
      setHasAuthHash(true);
    }
  }, []);

  if (!mounted) {
    return <main style={{ minHeight: '100vh', backgroundColor: '#0f1117' }} />;
  }

  if (hasAuthHash) {
    return <ResetPasswordPage />;
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#0f1117', color: '#f1f5f9', padding: '3rem', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg, #6c63ff, #9333ea)', borderRadius: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 'bold', color: '#fff', marginBottom: '20px' }}>W</div>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>WA-CRM SaaS v8.0.0</h1>
        <p style={{ color: '#94a3b8', fontSize: '15px' }}>Panel de administración y centro de control web (Next.js App Router).</p>
      </div>
    </main>
  );
}
