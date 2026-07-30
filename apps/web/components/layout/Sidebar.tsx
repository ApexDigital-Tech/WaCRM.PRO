'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

export function Sidebar() {
  const pathname = usePathname()

  const links = [
    { name: 'Workspaces', path: '/dashboard/workspaces', icon: '🏢' },
    { name: 'Licencias', path: '/dashboard/licenses', icon: '🔑' },
    // { name: 'Métricas', path: '/dashboard/metrics', icon: '📊' },
  ]

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      borderRight: '1px solid var(--border-glass)',
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'var(--blur-glass)',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem'
    }}>
      <div style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'var(--brand-gradient)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
        }}>
          W
        </div>
        <span style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.025em' }}>WA-CRM</span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {links.map((link) => {
          const isActive = pathname.startsWith(link.path)
          return (
            <Link 
              key={link.path} 
              href={link.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--border-radius-sm)',
                textDecoration: 'none',
                color: isActive ? 'white' : 'var(--text-secondary)',
                background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                border: isActive ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                transition: 'all 0.2s ease',
                fontWeight: isActive ? 500 : 400
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  e.currentTarget.style.color = 'white'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{link.icon}</span>
              {link.name}
            </Link>
          )
        })}
      </nav>

      <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, marginBottom: '0.25rem' }}>Sistema Activo</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Versión 8.0.0 (Pro)</div>
      </div>
    </aside>
  )
}
