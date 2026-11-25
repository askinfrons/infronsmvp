import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { supabase } from './supabaseClient'

const PAGE_SIZE = 50
const today = () => new Date().toISOString().slice(0, 10)
const money = paise => `₹${((Number(paise) || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const dateLabel = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const statusOptions = ['Draft', 'Issued', 'Part-paid', 'Paid', 'Overdue', 'Cancelled']

const emptyPayment = { amount: '', date: today(), mode: 'bank_transfer', reference: '', tds: '', note: '' }

export default function InvoiceLog() {
  const navigate = useNavigate()
  const tableRef = useRef(null)
  const [rows, setRows] = useState([])
  const [clients, setClients] = useState([])
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '', clientId: '', type: '', from: '', to: '', financialYear: '', overdueOnly: false, hasBalance: false })
  const [sort, setSort] = useState({ key: 'invoice_date', direction: 'desc' })
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [totals, setTotals] = useState({ billed_paise: 0, received_paise: 0, tds_paise: 0, outstanding_paise: 0 })
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [paymentInvoice, setPaymentInvoice] = useState(null)
  const [payment, setPayment] = useState(emptyPayment)
  const [reversalPayment, setReversalPayment] = useState(null)
  const [reversalReason, setReversalReason] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulk, setBulk] = useState({ date: today(), mode: 'bank_transfer' })

  const params = useMemo(() => ({
    p_limit: PAGE_SIZE,
    p_offset: page * PAGE_SIZE,
    p_status: filters.status || null,
    p_client_id: filters.clientId || null,
    p_document_type: filters.type || null,
    p_from_date: filters.from || null,
    p_to_date: filters.to || null,
    p_financial_year: filters.financialYear || null,
    p_overdue_only: filters.overdueOnly,
    p_has_balance: filters.hasBalance,
    p_search: filters.search.trim() || null,
  }), [filters, page])

  const load = async () => {
    setLoading(true); setError('')
    const { p_limit, p_offset, ...totalParams } = params
    const [registerResult, totalsResult] = await Promise.all([
      supabase.rpc('get_invoice_register', params),
      supabase.rpc('invoice_log_totals', totalParams),
    ])
    if (registerResult.error || totalsResult.error) {
      setError(`Invoice log could not be loaded. ${(registerResult.error || totalsResult.error).message}`)
    } else {
      setRows(registerResult.data || [])
      setTotalCount(Number(totalsResult.data?.[0]?.invoice_count || 0))
      setTotals(totalsResult.data?.[0] || { billed_paise: 0, received_paise: 0, tds_paise: 0, outstanding_paise: 0 })
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.from('clients').select('id, name, legal_name').order('name').range(0, 999).then(({ data, error: clientError }) => {
      if (clientError) setError(`Clients could not be loaded. ${clientError.message}`)
      setClients(data || [])
    })
  }, [])

  useEffect(() => {
    load()
    const channel = supabase.channel('invoice-log-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoice_payments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tax_invoices' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proforma_invoices' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [page, filters.status, filters.clientId, filters.type, filters.from, filters.to, filters.financialYear, filters.overdueOnly, filters.hasBalance, filters.search])

  useEffect(() => {
    if (!selected) return
    setHistoryLoading(true)
    supabase.from('invoice_payments').select('*').eq('tax_invoice_id', selected.id).order('received_on', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data, error: paymentError }) => { if (paymentError) setError(`Payment history could not be loaded. ${paymentError.message}`); setHistory(data || []); setHistoryLoading(false) })
  }, [selected])

  const sortedRows = useMemo(() => [...rows].sort((a, b) => {
    const left = a[sort.key] ?? ''
    const right = b[sort.key] ?? ''
    const comparison = typeof left === 'number' || typeof right === 'number' ? Number(left) - Number(right) : String(left).localeCompare(String(right))
    return sort.direction === 'asc' ? comparison : -comparison
  }), [rows, sort])

  const selectRow = row => { setSelected(row); setSelectedIds(current => current.includes(row.id) ? current : current) }
  const openPayment = invoice => { setPaymentInvoice(invoice); setPayment({ ...emptyPayment, amount: (invoice.balance_paise / 100).toFixed(2) }) }
  const updateFilter = (key, value) => { setPage(0); setFilters(current => ({ ...current, [key]: value })) }
  const toggleSort = key => setSort(current => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })
  const toggleSelected = id => setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  const selectableRows = rows.filter(row => row.document_type === 'tax' && row.status !== 'Cancelled' && row.balance_paise > 0)

  const recordPayment = async event => {
    event.preventDefault(); if (!paymentInvoice) return
    setSaving(true); setError(''); setNotice('')
    const amount = Math.round(Number(payment.amount || 0) * 100)
    const tds = Math.round(Number(payment.tds || 0) * 100)
    if (amount <= 0 || amount + tds > paymentInvoice.balance_paise) { setError(`Payment cannot exceed the remaining balance of ${money(paymentInvoice.balance_paise)}.`); setSaving(false); return }
    const { error: paymentError } = await supabase.rpc('record_invoice_payment', { p_tax_invoice_id: paymentInvoice.id, p_amount_received_paise: amount, p_received_on: payment.date || today(), p_payment_mode: payment.mode, p_reference_number: payment.reference, p_tds_paise: tds, p_note: payment.note })
    if (paymentError) setError(paymentError.message)
    else { setPaymentInvoice(null); setNotice('Payment recorded. Invoice balances and client totals were updated.'); await load(); if (selected?.id === paymentInvoice.id) setSelected({ ...paymentInvoice, received_paise: paymentInvoice.received_paise + amount, balance_paise: paymentInvoice.balance_paise - amount - tds }) }
    setSaving(false)
  }

  const recordBulk = async event => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    const selectedRows = rows.filter(row => selectedIds.includes(row.id) && row.document_type === 'tax' && row.balance_paise > 0)
    const payload = selectedRows.map(row => ({ tax_invoice_id: row.id, amount_received_paise: row.balance_paise, tds_paise: 0 }))
    const { error: bulkError } = await supabase.rpc('record_invoice_payments_bulk', { p_payments: payload, p_received_on: bulk.date || today(), p_payment_mode: bulk.mode })
    if (bulkError) setError(bulkError.message)
    else { setBulkOpen(false); setSelectedIds([]); setNotice(`${selectedRows.length} payment${selectedRows.length === 1 ? '' : 's'} recorded.`); await load() }
    setSaving(false)
  }

  const markFullyPaid = async invoice => {
    setSaving(true); setError(''); setNotice('')
    const { error: paymentError } = await supabase.rpc('record_invoice_payment', { p_tax_invoice_id: invoice.id, p_amount_received_paise: invoice.balance_paise, p_received_on: today(), p_payment_mode: 'other', p_reference_number: null, p_tds_paise: 0, p_note: 'Marked fully paid from Invoice Log' })
    if (paymentError) setError(paymentError.message)
    else { setNotice(`${invoice.invoice_number} marked fully paid.`); await load() }
    setSaving(false)
  }

  const reversePayment = async event => {
    event.preventDefault(); if (!reversalPayment) return
    setSaving(true); setError('')
    const { error: reversalError } = await supabase.rpc('reverse_invoice_payment', { p_payment_id: reversalPayment.id, p_reason: reversalReason })
    if (reversalError) setError(reversalError.message)
    else { setReversalPayment(null); setReversalReason(''); setNotice('Payment reversed and the invoice status was recalculated.'); await load(); if (selected) setSelected({ ...selected }) }
    setSaving(false)
  }

  const exportCsv = async () => {
    const { data, error: exportError } = await supabase.rpc('get_invoice_register', { ...params, p_limit: 10000, p_offset: 0 })
    if (exportError) { setError(`CSV export failed. ${exportError.message}`); return }
    const headers = ['Invoice no.', 'Date', 'Client', 'Type', 'Taxable value', 'GST', 'Total', 'TDS', 'Received', 'Balance', 'Due date', 'Status']
    const csv = [headers, ...(data || []).map(row => [row.invoice_number, row.invoice_date, row.client_name, row.document_type, money(row.taxable_value_paise), money(row.gst_paise), money(row.total_paise), money(row.tds_paise), money(row.received_paise), money(row.balance_paise), row.due_date || '', row.status])]
      .map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'infrons-invoice-log.csv'; link.click(); URL.revokeObjectURL(url)
  }

  useEffect(() => {
    const onKeyDown = event => {
      if (!tableRef.current || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
      const index = selected ? sortedRows.findIndex(row => row.id === selected.id) : -1
      if (event.key === 'ArrowDown') { event.preventDefault(); selectRow(sortedRows[Math.min(index + 1, sortedRows.length - 1)]) }
      if (event.key === 'ArrowUp') { event.preventDefault(); selectRow(sortedRows[Math.max(index - 1, 0)]) }
      if (event.key === 'Enter' && selected) { event.preventDefault(); selectRow(selected) }
      if (event.key.toLowerCase() === 'p' && selected?.document_type === 'tax' && selected.balance_paise > 0) { event.preventDefault(); openPayment(selected) }
    }
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected, sortedRows])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  return <div className="invoice-log-page"><Sidebar /><main className="invoice-log-main"><div className="invoice-log-container">
    <header className="invoice-log-header"><div><p className="ca-eyebrow">Billing / Register</p><h1 className="ca-page-title">Invoice Log</h1><p className="ca-page-description">Every tax invoice and proforma, with balances derived from payment history.</p></div><div className="invoice-log-header-actions"><button className="ca-button ca-button-secondary" onClick={exportCsv}>Export CSV</button><button className="ca-button ca-button-primary" onClick={() => navigate('/invoices')}>Create invoice</button></div></header>
    {error && <div className="invoice-log-alert invoice-log-alert-error">{error}</div>}{notice && <div className="invoice-log-alert invoice-log-alert-success">{notice}</div>}
    <section className="invoice-log-filters"><input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Search invoice number or client" /><select value={filters.status} onChange={event => updateFilter('status', event.target.value)}><option value="">All statuses</option>{statusOptions.map(option => <option key={option}>{option}</option>)}</select><select value={filters.clientId} onChange={event => updateFilter('clientId', event.target.value)}><option value="">All clients</option>{clients.map(client => <option key={client.id} value={client.id}>{client.legal_name || client.name}</option>)}</select><select value={filters.type} onChange={event => updateFilter('type', event.target.value)}><option value="">All types</option><option value="tax">Tax invoice</option><option value="proforma">Proforma</option></select><input type="date" value={filters.from} onChange={event => updateFilter('from', event.target.value)} aria-label="From date" /><input type="date" value={filters.to} onChange={event => updateFilter('to', event.target.value)} aria-label="To date" /><label><input type="checkbox" checked={filters.overdueOnly} onChange={event => updateFilter('overdueOnly', event.target.checked)} /> Overdue</label><label><input type="checkbox" checked={filters.hasBalance} onChange={event => updateFilter('hasBalance', event.target.checked)} /> Has balance</label></section>
    <section className="invoice-log-totals"><div><span>Filtered invoices</span><strong>{totalCount}</strong></div><div><span>Billed</span><strong>{money(totals.billed_paise)}</strong></div><div><span>Received</span><strong>{money(totals.received_paise)}</strong></div><div><span>TDS</span><strong>{money(totals.tds_paise)}</strong></div><div><span>Outstanding</span><strong>{money(totals.outstanding_paise)}</strong></div></section>
    {selectedIds.length > 0 && <div className="invoice-log-bulk-bar"><strong>{selectedIds.length} invoice{selectedIds.length === 1 ? '' : 's'} selected</strong><button className="ca-button ca-button-primary ca-button-sm" onClick={() => setBulkOpen(true)}>Record payments</button><button className="ca-button ca-button-quiet ca-button-sm" onClick={() => setSelectedIds([])}>Clear</button></div>}
    <section className="invoice-log-table-wrap" ref={tableRef} tabIndex="0"><table className="invoice-log-table"><thead><tr><th><input type="checkbox" checked={selectableRows.length > 0 && selectableRows.every(row => selectedIds.includes(row.id))} onChange={event => setSelectedIds(event.target.checked ? selectableRows.map(row => row.id) : [])} aria-label="Select payable invoices" /></th>{[['invoice_number', 'Invoice no.'], ['invoice_date', 'Date'], ['client_name', 'Client'], ['document_type', 'Type'], ['taxable_value_paise', 'Taxable value'], ['gst_paise', 'GST'], ['total_paise', 'Total'], ['tds_paise', 'TDS'], ['received_paise', 'Received'], ['balance_paise', 'Balance'], ['due_date', 'Due date'], ['status', 'Status']].map(([key, label]) => <th key={key} onClick={() => toggleSort(key)}>{label}<span>{sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}</span></th>)}<th>Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan="14" className="invoice-log-state">Loading invoice register…</td></tr> : sortedRows.length === 0 ? <tr><td colSpan="14" className="invoice-log-state">No invoices match these filters.</td></tr> : sortedRows.map(row => <tr key={`${row.document_type}-${row.id}`} className={selected?.id === row.id ? 'invoice-log-row-selected' : ''} onClick={() => selectRow(row)}><td onClick={event => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(row.id)} disabled={row.document_type !== 'tax' || row.balance_paise <= 0} onChange={() => toggleSelected(row.id)} aria-label={`Select ${row.invoice_number}`} /></td><td className="invoice-log-code">{row.invoice_number || 'Unnumbered'}</td><td>{dateLabel(row.invoice_date)}</td><td><strong>{row.client_name}</strong></td><td><span className="invoice-log-type">{row.document_type === 'tax' ? 'Tax' : 'Proforma'}</span></td><td className="invoice-log-money">{money(row.taxable_value_paise)}</td><td className="invoice-log-money">{money(row.gst_paise)}</td><td className="invoice-log-money">{money(row.total_paise)}</td><td className="invoice-log-money">{money(row.tds_paise)}</td><td className="invoice-log-money">{money(row.received_paise)}</td><td className={`invoice-log-money ${row.balance_paise > 0 ? 'invoice-log-balance' : ''}`}>{money(row.balance_paise)}</td><td>{dateLabel(row.due_date)}</td><td><span className={`invoice-status invoice-status-${row.status.toLowerCase().replace('-', '')}`}>{row.status}</span></td><td><div className="invoice-log-row-actions">{row.document_type === 'tax' && row.balance_paise > 0 && <><button className="ca-button ca-button-secondary ca-button-sm" onClick={event => { event.stopPropagation(); openPayment(row) }}>Record payment</button><button className="ca-button ca-button-primary ca-button-sm" disabled={saving} onClick={event => { event.stopPropagation(); markFullyPaid(row) }}>Mark paid</button></>}<button className="ca-button ca-button-quiet ca-button-sm" onClick={event => { event.stopPropagation(); selectRow(row) }}>View</button></div></td></tr>)}</tbody></table></section>
    <footer className="invoice-log-pagination"><span>Page {page + 1} of {totalPages}</span><button className="ca-button ca-button-secondary ca-button-sm" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><button className="ca-button ca-button-secondary ca-button-sm" disabled={page >= totalPages - 1} onClick={() => setPage(value => value + 1)}>Next</button></footer>
    </div></main>
    {selected && <InvoiceDetail invoice={selected} history={history} historyLoading={historyLoading} onClose={() => setSelected(null)} onRecord={() => openPayment(selected)} onReverse={paymentRow => { setReversalPayment(paymentRow); setReversalReason('') }} />}
    {paymentInvoice && <PaymentModal invoice={paymentInvoice} payment={payment} setPayment={setPayment} saving={saving} onClose={() => setPaymentInvoice(null)} onSubmit={recordPayment} />}
    {bulkOpen && <BulkModal rows={rows.filter(row => selectedIds.includes(row.id))} bulk={bulk} setBulk={setBulk} saving={saving} onClose={() => setBulkOpen(false)} onSubmit={recordBulk} />}
    {reversalPayment && <ReversalModal reason={reversalReason} setReason={setReversalReason} saving={saving} onClose={() => setReversalPayment(null)} onSubmit={reversePayment} />}
  </div>
}

function InvoiceDetail({ invoice, history, historyLoading, onClose, onRecord, onReverse }) {
  return <aside className="invoice-log-detail"><div className="invoice-log-detail-header"><div><p className="ca-eyebrow">Invoice detail</p><h2>{invoice.invoice_number || 'Unnumbered invoice'}</h2><p>{invoice.client_name} · {invoice.document_type === 'tax' ? 'Tax invoice' : 'Proforma'}</p></div><button className="ca-icon-button" onClick={onClose} aria-label="Close invoice detail">×</button></div><div className="invoice-log-detail-stats"><div><span>Total</span><strong>{money(invoice.total_paise)}</strong></div><div><span>Balance</span><strong>{money(invoice.balance_paise)}</strong></div><div><span>Status</span><strong>{invoice.status}</strong></div></div>{invoice.document_type === 'tax' && invoice.balance_paise > 0 && <button className="ca-button ca-button-primary" onClick={onRecord}>Record payment</button>}<h3>Payment history</h3>{historyLoading ? <p className="invoice-log-muted">Loading payment history…</p> : history.length === 0 ? <p className="invoice-log-muted">No payments recorded.</p> : <div className="invoice-log-history">{history.map(payment => <div key={payment.id} className={payment.is_reversal ? 'invoice-history-reversal' : ''}><div><strong>{payment.is_reversal ? 'Reversal' : 'Payment'} · {money(payment.amount_received_paise)}</strong><span>{dateLabel(payment.received_on)} · {payment.payment_mode || 'other'}{payment.reference_number ? ` · ${payment.reference_number}` : ''}</span></div>{payment.tds_paise > 0 && <small>TDS {money(payment.tds_paise)}</small>}{payment.is_reversal ? <small>{payment.reversal_reason}</small> : <button className="ca-button ca-button-quiet ca-button-sm" onClick={() => onReverse(payment)}>Reverse</button>}</div>)}</div>}<div className="invoice-log-timeline"><div><b>Issued</b><span>{dateLabel(invoice.invoice_date)}</span></div><div><b>Due</b><span>{dateLabel(invoice.due_date)}</span></div></div></aside>
}

function PaymentModal({ invoice, payment, setPayment, saving, onClose, onSubmit }) {
  return <div className="invoice-log-modal-backdrop"><form className="invoice-log-modal" onSubmit={onSubmit}><div className="invoice-log-modal-header"><div><p className="ca-eyebrow">Record payment</p><h2>{invoice.invoice_number}</h2><p>Balance available: {money(invoice.balance_paise)}</p></div><button type="button" className="ca-icon-button" onClick={onClose}>×</button></div><label>Amount received<input required type="number" min="0.01" step="0.01" max={(invoice.balance_paise / 100).toFixed(2)} value={payment.amount} onChange={event => setPayment({ ...payment, amount: event.target.value })} /></label><label>Payment date<input required type="date" value={payment.date} onChange={event => setPayment({ ...payment, date: event.target.value })} /></label><label>Mode<select value={payment.mode} onChange={event => setPayment({ ...payment, mode: event.target.value })}><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="cash">Cash</option><option value="other">Other</option></select></label><label>Reference number<input value={payment.reference} onChange={event => setPayment({ ...payment, reference: event.target.value })} /></label><label>TDS deducted<input type="number" min="0" step="0.01" value={payment.tds} onChange={event => setPayment({ ...payment, tds: event.target.value })} /></label><label>Note<textarea rows="2" value={payment.note} onChange={event => setPayment({ ...payment, note: event.target.value })} /></label><div className="invoice-log-modal-actions"><button type="button" className="ca-button ca-button-secondary" onClick={onClose}>Cancel</button><button disabled={saving} className="ca-button ca-button-primary">{saving ? 'Saving…' : 'Save payment'}</button></div></form></div>
}

function BulkModal({ rows, bulk, setBulk, saving, onClose, onSubmit }) {
  return <div className="invoice-log-modal-backdrop"><form className="invoice-log-modal" onSubmit={onSubmit}><div className="invoice-log-modal-header"><div><p className="ca-eyebrow">Bulk payment preview</p><h2>{rows.length} invoices</h2><p>Each selected invoice will receive its current balance in full.</p></div><button type="button" className="ca-icon-button" onClick={onClose}>×</button></div><div className="invoice-log-bulk-preview">{rows.map(row => <div key={row.id}><span>{row.invoice_number} · {row.client_name}</span><strong>{money(row.balance_paise)}</strong></div>)}</div><label>Payment date<input required type="date" value={bulk.date} onChange={event => setBulk({ ...bulk, date: event.target.value })} /></label><label>Mode<select value={bulk.mode} onChange={event => setBulk({ ...bulk, mode: event.target.value })}><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="cash">Cash</option><option value="other">Other</option></select></label><div className="invoice-log-modal-actions"><button type="button" className="ca-button ca-button-secondary" onClick={onClose}>Cancel</button><button disabled={saving || rows.length === 0} className="ca-button ca-button-primary">{saving ? 'Saving…' : 'Confirm payments'}</button></div></form></div>
}

function ReversalModal({ reason, setReason, saving, onClose, onSubmit }) {
  return <div className="invoice-log-modal-backdrop"><form className="invoice-log-modal" onSubmit={onSubmit}><div className="invoice-log-modal-header"><div><p className="ca-eyebrow">Reverse payment</p><h2>Keep the history intact</h2><p>The original payment will remain visible and a reversal entry will be added.</p></div><button type="button" className="ca-icon-button" onClick={onClose}>×</button></div><label>Reason<textarea required rows="3" value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain why this payment is being reversed" /></label><div className="invoice-log-modal-actions"><button type="button" className="ca-button ca-button-secondary" onClick={onClose}>Cancel</button><button disabled={saving} className="ca-button ca-button-danger">{saving ? 'Saving…' : 'Reverse payment'}</button></div></form></div>
}
