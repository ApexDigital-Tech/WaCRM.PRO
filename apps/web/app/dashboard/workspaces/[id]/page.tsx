import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function WorkspaceDetail({ params }: { params: { id: string } }) {
  const supabase = createClient()
  
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user

  if (!user) {
    return notFound()
  }

  // Verificar que el usuario pertenece al workspace
  const { data: memberData } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!memberData) {
    return notFound()
  }

  // Obtener detalles del workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', params.id)
    .single()

  // Obtener miembros
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role, created_at')
    .eq('workspace_id', params.id)

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard/workspaces" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          &larr; Volver a Workspaces
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {workspace.name} 
            <span style={{ 
              fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '4px',
              background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', textTransform: 'uppercase'
            }}>
              Tu Rol: {memberData.role}
            </span>
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>ID: {workspace.id}</p>
        </div>
        
        {memberData.role === 'owner' && (
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-secondary">Editar</button>
            <button className="btn btn-primary">Invitar Usuario</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* Lista de Miembros */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
            Miembros del Equipo ({members?.length || 0})
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {members?.map(m => (
              <div key={m.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--border-radius-sm)' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>Usuario ID: {m.user_id.substring(0, 8)}...</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Agregado el {new Date(m.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', background: 'rgba(255,255,255,0.1)', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {m.role}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resumen de Licencia */}
        <div className="glass-panel" style={{ padding: '1.5rem', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
            Suscripción y Licencia
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Plan Actual</span>
              <span style={{ fontWeight: 600 }}>Pro</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Estado</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>Activa</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Límite de Agentes</span>
              <span style={{ fontWeight: 600 }}>5</span>
            </div>
          </div>
          
          <div style={{ marginTop: '2rem' }}>
            <Link href="/dashboard/licenses" className="btn btn-secondary" style={{ width: '100%' }}>
              Gestionar Licencias
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
