export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  return <button className={`ca-button ca-button-${variant} ca-button-${size} ${className}`} {...props}>{children}</button>
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return <header className="ca-page-header"><div>{eyebrow && <div className="ca-eyebrow">{eyebrow}</div>}<h1 className="ca-page-title">{title}</h1>{description && <p className="ca-page-description">{description}</p>}</div>{actions && <div className="ca-page-actions">{actions}</div>}</header>
}

export function KpiChip({ icon, label, value, onClick, active = false }) {
  return <button className={`ca-kpi-chip${active ? ' ca-kpi-chip-active' : ''}`} onClick={onClick} aria-label={`${label}: ${value}`}><span className="ca-kpi-icon">{icon}</span><span>{label}</span><strong>{value}</strong></button>
}

export function FilterTabs({ items, value, onChange }) {
  return <div className="ca-filter-tabs" role="tablist">{items.map(item => <button key={item.label} role="tab" aria-selected={value === item.value} className={value === item.value ? 'ca-filter-tab ca-filter-tab-active' : 'ca-filter-tab'} onClick={() => onChange(item.value)}>{item.label}<span>{item.count}</span></button>)}</div>
}

export function Panel({ children, className = '' }) {
  return <section className={`ca-panel ${className}`}>{children}</section>
}

export function DetailCard({ children, className = '' }) {
  return <aside className={`ca-detail-card ${className}`}>{children}</aside>
}

export function ProgressRing({ value = 0, label, size = 56 }) {
  const radius = 21
  const circumference = 2 * Math.PI * radius
  return <div className="ca-progress-ring" style={{ width: size, height: size }}><svg viewBox="0 0 52 52" aria-label={`${value}% ${label || ''}`}><circle className="ca-progress-track" cx="26" cy="26" r={radius} /><circle className="ca-progress-value" cx="26" cy="26" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference - (circumference * Math.max(0, Math.min(100, value))) / 100} /></svg><strong>{value}%</strong></div>
}

export function DataTable({ columns, rows, rowKey = row => row.id, renderRow }) {
  return <table className="ca-table"><thead><tr>{columns.map(column => <th key={column.key} className={column.numeric ? 'numeric' : ''}>{column.label}</th>)}</tr></thead><tbody>{rows.map(row => renderRow(row, rowKey(row)))}</tbody></table>
}

export function Chip({ children, tone = 'neutral' }) {
  return <span className={`ca-chip ${tone === 'neutral' ? '' : `ca-chip-${tone}`}`}>{children}</span>
}

export function Tabs({ items, value, onChange }) {
  return <div className="ca-tabs" role="tablist">{items.map(item => <button key={item} role="tab" aria-selected={value === item} className={value === item ? 'ca-tab ca-tab-active' : 'ca-tab'} onClick={() => onChange(item)}>{item}</button>)}</div>
}

export function EmptyState({ title, description, action }) {
  return <div className="ca-empty"><strong>{title}</strong>{description && <p>{description}</p>}{action}</div>
}

export function Modal({ open, title, children, onClose }) {
  if (!open) return null
  return <div className="ca-modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose?.()}><div className="ca-modal" role="dialog" aria-modal="true" aria-label={title}><div className="ca-modal-header"><h2>{title}</h2><button className="ca-icon-button" onClick={onClose} aria-label="Close">×</button></div>{children}</div></div>
}

export function Toast({ message, tone = 'neutral', onClose }) {
  if (!message) return null
  return <div className={`ca-toast ca-toast-${tone}`} role="status">{message}<button className="ca-toast-close" onClick={onClose} aria-label="Dismiss">×</button></div>
}
