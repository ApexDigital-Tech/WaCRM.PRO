import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function WorkspacesPage() {
  const supabase = createClient()
  
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user

  let workspaces: any[] = []
  
  if (user) {
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
      workspaces = data.map((item: any) => ({
        ...item.workspaces,
        role: item.role
      }))
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Mis Workspaces</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Selecciona un espacio de trabajo para administrar</p>
        </div>
        <button className="btn btn-primary">+ Nuevo Workspace</button>
      </div>

      {workspaces.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢</div>
          <h3>No tienes Workspaces</h3>
          <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>Aún no perteneces a ningún espacio de trabajo.</p>
          <button className="btn btn-primary">Crear mi primer Workspace</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {workspaces.map((ws) => (
            <Link key={ws.id} href={`/dashboard/workspaces/${ws.id}`}>
              <div className="glass-card" style={{ padding: '1.5rem', cursor: 'pointer', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.25rem' }}>{ws.name}</h3>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '20px',
                    background: ws.role === 'owner' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.1)',
                    color: ws.role === 'owner' ? '#60a5fa' : 'var(--text-secondary)',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}>
                    {ws.role}
                  </span>
                </div>
                
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Creado el:</span>
                    <span>{new Date(ws.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Estado:</span>
                    <span style={{ color: 'var(--success)' }}>Activo</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
