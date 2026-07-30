import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export default async function LicensesPage() {
  const supabase = createClient()
  
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user

  let licenses: any[] = []
  
  if (user) {
    // Para las licencias, cruzamos workspace_members con el workspace
    const { data } = await supabase
      .from('workspace_members')
      .select(`
        role,
        workspaces (
          id,
          name,
          settings,
          created_at
        )
      `)
      .eq('user_id', user.id)

    if (data) {
      licenses = data.map((item: any) => ({
        workspace_id: item.workspaces.id,
        workspace_name: item.workspaces.name,
        role: item.role,
        // Mock data de licencia basados en el schema
        plan: 'Pro',
        status: 'Active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        agent_limit: 5
      }))
    }
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Módulo de Licencias</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Auditoría y control de suscripciones de la Extensión v7 Pro</p>
        </div>
        <button className="btn btn-primary">Adquirir Licencia</button>
      </div>

      {licenses.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔑</div>
          <h3>Sin Licencias Activas</h3>
          <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>Aún no tienes licencias vinculadas a tus Workspaces.</p>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-glass)' }}>
              <tr>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Workspace</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Plan</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Límites (Agentes)</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Expiración</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Estado</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((lic, index) => (
                <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 500 }}>{lic.workspace_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rol: {lic.role}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      padding: '0.2rem 0.5rem', borderRadius: '4px',
                      background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', fontWeight: 600, fontSize: '0.85rem'
                    }}>{lic.plan}</span>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{lic.agent_limit}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{new Date(lic.expires_at).toLocaleDateString()}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></div>
                      {lic.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    {lic.role === 'owner' ? (
                      <button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                        Revocar Acceso
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin permisos</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
