import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ActivityLogPage() {
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLog() {
      const { data } = await supabase
        .from('admin_actions')
        .select('*, admin:profiles!admin_actions_admin_id_fkey(username)')
        .order('created_at', { ascending: false })
        .limit(50)
      setActions(data || [])
      setLoading(false)
    }
    fetchLog()
  }, [])

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Activity log</h1>
        <p className="week-label">All admin actions are logged here for transparency.</p>
      </div>

      {actions.length === 0 && (
        <div className="empty-state">
          <p>No admin actions taken yet.</p>
        </div>
      )}

      {actions.map(action => (
        <div key={action.id} className="log-entry">
          <div className="log-header">
            <span className={`log-type ${action.action_type}`}>
              {action.action_type.replace(/_/g, ' ')}
            </span>
            <span className="log-date">
              {new Date(action.created_at).toLocaleDateString('en-NG', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
          <p className="log-detail">{action.details}</p>
          <p className="log-admin">by {action.admin?.username}</p>
        </div>
      ))}
    </div>
  )
}
