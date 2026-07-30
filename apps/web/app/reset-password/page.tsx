'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      console.log('[WA-CRM] Auth state change event:', event);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setMessage('¡Tu contraseña ha sido actualizada con éxito! Ya puedes iniciar sesión en la extensión de WA-CRM.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>W</div>
        <h1 style={styles.title}>WA-CRM</h1>
        <p style={styles.subtitle}>Establecer / Restablecer Contraseña</p>

        {message ? (
          <div style={styles.successBox}>
            <p style={{ margin: 0, fontWeight: 600 }}>{message}</p>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} style={styles.form}>
            <div style={styles.group}>
              <label style={styles.label}>Nueva Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={styles.input}
              />
            </div>

            <div style={styles.group}>
              <label style={styles.label}>Confirmar Contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={styles.input}
              />
            </div>

            {error && <p style={styles.errorText}>{error}</p>}

            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? 'Guardando...' : 'Actualizar Contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f1117',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    padding: '24px',
    color: '#f1f5f9',
  },
  card: {
    backgroundColor: '#1a1d27',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '32px',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  logo: {
    width: '56px',
    height: '56px',
    background: 'linear-gradient(135deg, #6c63ff, #9333ea)',
    borderRadius: '12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '16px',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    margin: '0 0 4px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    marginBottom: '24px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    textAlign: 'left',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  input: {
    padding: '10px 14px',
    backgroundColor: '#21253a',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  button: {
    padding: '12px',
    backgroundColor: '#6c63ff',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  errorText: {
    fontSize: '12px',
    color: '#ef4444',
    margin: 0,
  },
  successBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: '8px',
    padding: '16px',
    color: '#22c55e',
    fontSize: '14px',
  },
};
