import { FiInbox } from 'react-icons/fi'

export default function EmptyState({ icon, title = 'موردی یافت نشد', description = 'هیچ داده‌ای برای نمایش وجود ندارد.', action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon || <FiInbox />}</div>
      <h4>{title}</h4>
      <p style={{ margin: 0, fontSize: 13 }}>{description}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}
