import { useEffect, useMemo, useState } from 'react'
import Sidebar from './Sidebar'
import { supabase } from './supabaseClient'

const money = paise => `₹${((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const blankItem = { description: '', sac_code: '', quantity: 1, rate_rupees: '', taxable: true, pure_agent: false, gst_rate: 18 }
const sacCodes = [
  { code: '998231', description: 'Accounting and bookkeeping services' },
  { code: '998232', description: 'Tax consultancy and preparation services' },
  { code: '998233', description: 'Financial auditing services' },
  { code: '998234', description: 'Review of financial statements' },
  { code: '998235', description: 'Other accounting services' },
  { code: '998311', description: 'Management consulting services' },
  { code: '998312', description: 'Business consulting services' }
]

export default function Invoicing() {
  const [clients, setClients] = useState([])
  const [invoices, setInvoices] = useState([])
  const [proformas, setProformas] = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [type, setType] = useState('tax')
  const [items, setItems] = useState([{ ...blankItem }])
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [supplierState, setSupplierState] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [paymentInvoice, setPaymentInvoice] = useState(null)
  const [payment, setPayment] = useState({ amount: '', tds: '', date: new Date().toISOString().slice(0, 10) })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    const [clientsResult, taxResult, proformaResult, practiceResult] = await Promise.all([
      supabase.from('clients').select('id, name, legal_name, gstin, state_code, default_fee_paise, default_sac_code, default_gst_rate').order('name').range(0, 299),
      supabase.from('tax_invoices').select('id, client_id, number, invoice_date, total_paise, status').order('created_at', { ascending: false }).range(0, 99),
      supabase.from('proforma_invoices').select('id, client_id, number, issue_date, total_paise, status, converted_invoice_id').order('created_at', { ascending: false }).range(0, 99),
      supabase.from('practices').select('gstin, state_code').limit(1).maybeSingle()
    ])
    const queryError = clientsResult.error || taxResult.error || proformaResult.error || practiceResult.error
    if (queryError) setError(`Invoices could not be loaded. ${queryError.message}`)
    else {
      setClients(clientsResult.data || [])
      setInvoices(taxResult.data || [])
      setProformas(proformaResult.data || [])
      setSupplierState(practiceResult.data?.state_code || practiceResult.data?.gstin?.slice(0, 2) || '')
    }
    setLoading(false)
  }

  const client = clients.find(item => item.id === selectedClient)
  const totals = useMemo(() => {
    let subtotal = 0; let cgst = 0; let sgst = 0; let igst = 0
    items.forEach(item => {
      const amount = Math.round(Number(item.quantity || 0) * Number(item.rate_rupees || 0) * 100)
      subtotal += amount
      if (item.taxable && !item.pure_agent) {
        const tax = Math.round(amount * Number(item.gst_rate || 0) / 100)
        if (supplierState && client?.state_code && client.state_code === supplierState) { cgst += Math.round(tax / 2); sgst += tax - Math.round(tax / 2) }
        else igst += tax
      }
    })
    return { subtotal, cgst, sgst, igst, total: subtotal + cgst + sgst + igst }
  }, [items, client, supplierState])

  const updateItem = (index, patch) => setItems(current => current.map((item, i) => i === index ? { ...item, ...patch } : item))

  const issue = async event => {
    event.preventDefault(); setError(''); setNotice('')
    if (!selectedClient || items.some(item => !item.description || !item.rate_rupees)) { setError('Choose a client and complete every line item.'); return }
    setSaving(true)
    const payloadItems = items.map(item => ({ description: item.description, sac_code: item.sac_code || null, quantity: Number(item.quantity), rate_paise: Math.round(Number(item.rate_rupees) * 100), taxable: !!item.taxable, pure_agent: !!item.pure_agent, gst_rate: Number(item.gst_rate || 0) }))
    if (type === 'tax') {
      const { data: practice, error: practiceError } = await supabase.from('practices').select('gstin, state_code').limit(1).maybeSingle()
      if (practiceError) setError(`Invoice settings could not be loaded. ${practiceError.message}`)
      else {
        const { data: invoiceId, error: issueError } = await supabase.rpc('issue_tax_invoice', { p_client_id: selectedClient, p_supplier_gstin: practice?.gstin || '', p_recipient_gstin: client?.gstin || '', p_place_of_supply: client?.state_code || '', p_reverse_charge: false, p_invoice_date: invoiceDate, p_due_date: dueDate || null, p_notes: null, p_items: payloadItems })
        if (issueError) setError(issueError.message.includes('Not allowed') ? 'You do not have access to this client.' : `Invoice could not be issued. ${issueError.message}`)
        else { setNotice('Tax invoice issued successfully and the list was refreshed.'); await load(); if (invoiceId) printInvoice({ number: 'Issued invoice', client, items, totals, invoiceDate }) }
      }
    } else {
      const { data: proformaId, error: proformaError } = await supabase.rpc('create_proforma_invoice', { p_client_id: selectedClient, p_issue_date: invoiceDate, p_due_date: dueDate || null, p_items: payloadItems })
      if (proformaError) setError(`Proforma could not be created. ${proformaError.message}`)
      else { setNotice('Proforma created successfully and the list was refreshed.'); await load(); if (proformaId) printInvoice({ number: 'Proforma', client, items, totals, invoiceDate }) }
    }
    setSaving(false)
  }

  const convertProforma = async proforma => {
    setError(''); setNotice(''); setSaving(true)
    const { error: conversionError } = await supabase.rpc('convert_proforma_to_tax', { p_proforma_id: proforma.id })
    if (conversionError) setError(`Proforma could not be converted. ${conversionError.message}`)
    else { setNotice(`${proforma.number} converted to a tax invoice.`); await load() }
    setSaving(false)
  }

  const recordPayment = async event => {
    event.preventDefault(); if (!paymentInvoice || !payment.amount) return
    const { error: paymentError } = await supabase.rpc('record_invoice_payment', { p_tax_invoice_id: paymentInvoice.id, p_amount_received_paise: Math.round(Number(payment.amount) * 100), p_received_on: payment.date, p_payment_mode: 'bank_transfer', p_reference_number: null, p_tds_paise: Math.round(Number(payment.tds || 0) * 100), p_note: null })
    if (paymentError) setError(`Payment could not be recorded. ${paymentError.message}`)
    else { setPaymentInvoice(null); setNotice('Payment recorded and the list was refreshed.'); await load() }
  }

  return <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6FB' }}><Sidebar /><main style={{ marginLeft: 240, flex: 1, padding: 32 }}><div style={{ maxWidth: 1180, margin: '0 auto' }}><h1 style={heading}>Invoicing</h1><p style={subheading}>Raise proformas and GST tax invoices with India’s April–March financial year.</p>{error && <div style={errorStyle}>{error}</div>}{notice && <div style={successStyle}>{notice}</div>}<div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 20, marginTop: 24 }}><form onSubmit={issue} style={panel}><div style={{ display: 'flex', gap: 8, marginBottom: 18 }}><button type="button" onClick={() => setType('tax')} style={type === 'tax' ? primaryButton : secondaryButton}>Tax invoice</button><button type="button" onClick={() => setType('proforma')} style={type === 'proforma' ? primaryButton : secondaryButton}>Proforma</button></div><label style={label}>Client<select value={selectedClient} onChange={event => setSelectedClient(event.target.value)} style={inputStyle}><option value="">Select client</option>{clients.map(item => <option key={item.id} value={item.id}>{item.legal_name || item.name}</option>)}</select></label><div style={{ display: 'flex', gap: 10, marginTop: 12 }}><label style={{ ...label, flex: 1 }}>Invoice date<input type="date" value={invoiceDate} onChange={event => setInvoiceDate(event.target.value)} style={inputStyle} /></label><label style={{ ...label, flex: 1 }}>Due date<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} style={inputStyle} /></label></div><h2 style={{ ...heading, fontSize: 16, margin: '22px 0 10px' }}>Line items</h2>{items.map((item, index) => { const sac = sacCodes.find(entry => entry.code === item.sac_code); return <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 100px 80px', gap: 8, marginBottom: 8 }}><input placeholder="Service / reimbursement" value={item.description} onChange={event => updateItem(index, { description: event.target.value })} style={inputStyle} /><div><input list="sac-code-options" placeholder="SAC code" value={item.sac_code} onChange={event => updateItem(index, { sac_code: event.target.value })} style={inputStyle} />{sac && <small style={{ display: 'block', color: '#6B7280', marginTop: 4 }}>{sac.description}</small>}</div><input type="number" min="0" step="0.001" placeholder="Qty" value={item.quantity} onChange={event => updateItem(index, { quantity: event.target.value })} style={inputStyle} /><input type="number" min="0" step="0.01" placeholder="₹" value={item.rate_rupees} onChange={event => updateItem(index, { rate_rupees: event.target.value })} style={inputStyle} /><label style={{ gridColumn: '1 / span 2', color: '#6B7280', fontSize: 12 }}><input type="checkbox" checked={item.pure_agent} onChange={event => updateItem(index, { pure_agent: event.target.checked })} /> Government fee reimbursement / pure agent</label><input type="number" min="0" max="100" step="0.01" value={item.gst_rate} onChange={event => updateItem(index, { gst_rate: event.target.value })} style={inputStyle} disabled={item.pure_agent || !item.taxable} /></div> })}<datalist id="sac-code-options">{sacCodes.map(entry => <option key={entry.code} value={entry.code}>{entry.description}</option>)}</datalist><p style={{ ...muted, margin: '4px 0 10px' }}>Start typing a SAC code to search the common services list. Custom SAC codes are also accepted.</p><button type="button" onClick={() => setItems([...items, { ...blankItem }])} style={secondaryButton}>+ Add line</button><div style={{ textAlign: 'right', marginTop: 20, color: '#374151', lineHeight: 1.8 }}><div>Subtotal: {money(totals.subtotal)}</div><div>CGST: {money(totals.cgst)} · SGST: {money(totals.sgst)} · IGST: {money(totals.igst)}</div><strong style={{ color: '#111827', fontSize: 18 }}>Total: {money(totals.total)}</strong></div><button disabled={saving || loading} style={{ ...primaryButton, marginTop: 18 }}>{saving ? 'Saving…' : `Issue ${type === 'tax' ? 'tax invoice' : 'proforma'}`}</button></form><section style={panel}><h2 style={{ ...heading, fontSize: 18 }}>Recent documents</h2>{loading ? <p style={muted}>Loading…</p> : <>{proformas.map(proforma => <div key={proforma.id} style={{ borderBottom: '1px solid #F3F4F6', padding: '12px 0' }}><strong style={{ color: '#111827', fontSize: 13 }}>{proforma.number}</strong><p style={muted}>{clients.find(item => item.id === proforma.client_id)?.name || 'Client'} · {money(proforma.total_paise)} · {proforma.status}</p>{proforma.status !== 'converted' && <button type="button" disabled={saving} onClick={() => convertProforma(proforma)} style={secondaryButton}>Convert to tax invoice</button>}</div>)}{invoices.length === 0 && proformas.length === 0 && <p style={muted}>No invoices or proformas yet.</p>}{invoices.map(invoice => <div key={invoice.id} style={{ borderBottom: '1px solid #F3F4F6', padding: '12px 0' }}><strong style={{ color: '#111827', fontSize: 13 }}>{invoice.number}</strong><p style={muted}>{clients.find(item => item.id === invoice.client_id)?.name || 'Client'} · {money(invoice.total_paise)} · {invoice.status}</p><button type="button" onClick={() => setPaymentInvoice(invoice)} style={secondaryButton}>Record payment</button><button type="button" onClick={() => printInvoice({ number: invoice.number, client: clients.find(item => item.id === invoice.client_id), items: [], totals: { total: invoice.total_paise }, invoiceDate: invoice.invoice_date })} style={{ ...secondaryButton, marginLeft: 6 }}>Print PDF</button></div>)}</>}</section></div></div></main>{paymentInvoice && <div style={modal}><form onSubmit={recordPayment} style={modalCard}><h2 style={{ ...heading, fontSize: 18 }}>Record payment</h2><label style={label}>Amount received<input type="number" min="0" step="0.01" value={payment.amount} onChange={event => setPayment({ ...payment, amount: event.target.value })} style={inputStyle} /></label><label style={label}>TDS deducted<input type="number" min="0" step="0.01" value={payment.tds} onChange={event => setPayment({ ...payment, tds: event.target.value })} style={inputStyle} /></label><label style={label}>Received on<input type="date" value={payment.date} onChange={event => setPayment({ ...payment, date: event.target.value })} style={inputStyle} /></label><button style={primaryButton}>Save payment</button></form></div>}</div>
}

function printInvoice({ number, client, items, totals, invoiceDate }) { const popup = window.open('', '_blank'); if (!popup) return; popup.document.write(`<html><head><title>${number}</title><style>body{font-family:Arial;padding:40px;color:#111}table{width:100%;border-collapse:collapse;margin-top:30px}td,th{border:1px solid #ddd;padding:9px;text-align:left}.right{text-align:right}</style></head><body><h1>INFRONS</h1><h2>${number}</h2><p>Date: ${invoiceDate || ''}</p><p>Bill to: ${client?.legal_name || client?.name || 'Client'}</p><table><tr><th>Description</th><th>Amount</th></tr>${(items || []).map(item => `<tr><td>${item.description}</td><td>${item.rate_rupees || ''}</td></tr>`).join('')}<tr><th class="right">Total</th><th>${money(totals?.total)}</th></tr></table><script>window.print()</script></body></html>`); popup.document.close() }

const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', font: 'inherit', color: '#111827', background: '#FFF' }
const label = { display: 'grid', gap: 5, color: '#6B7280', fontSize: 12, fontWeight: 600 }
const panel = { background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }
const primaryButton = { border: 0, borderRadius: 8, padding: '10px 14px', background: '#6366F1', color: '#FFF', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const secondaryButton = { border: '1px solid #E5E7EB', borderRadius: 8, padding: '9px 12px', background: '#FFF', color: '#374151', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const heading = { color: '#111827', fontSize: 24, fontWeight: 800, margin: 0 }
const subheading = { color: '#6B7280', fontSize: 14, marginTop: 6 }
const muted = { color: '#6B7280', fontSize: 13, lineHeight: 1.5 }
const errorStyle = { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', marginTop: 16, fontSize: 13 }
const successStyle = { background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', borderRadius: 8, padding: '10px 12px', marginTop: 16, fontSize: 13 }
const modal = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }
const modalCard = { ...panel, width: '100%', maxWidth: 400, display: 'grid', gap: 14 }
