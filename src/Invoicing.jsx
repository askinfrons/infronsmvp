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
const invoiceTemplates = [
  { id: 'gst_standard', label: 'GST Standard', description: 'Formal tax-invoice layout with full compliance fields.' },
  { id: 'professional', label: 'Professional', description: 'Compact branded layout for client-facing invoices.' },
  { id: 'custom', label: 'Custom format', description: 'Use your own accent colour and footer text.' },
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
  const [practiceDetails, setPracticeDetails] = useState(null)
  const [invoiceTemplate, setInvoiceTemplate] = useState('gst_standard')
  const [customAccent, setCustomAccent] = useState('#4F46E5')
  const [customFooter, setCustomFooter] = useState('Thank you for your business.')
  const [customTerms, setCustomTerms] = useState('Payment due by the due date shown above.')
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
      supabase.from('practices').select('name, legal_name, email, gstin, state_code, address, logo_url').limit(1).maybeSingle()
    ])
    const queryError = clientsResult.error || taxResult.error || proformaResult.error || practiceResult.error
    if (queryError) setError(`Invoices could not be loaded. ${queryError.message}`)
    else {
      setClients(clientsResult.data || [])
      setInvoices(taxResult.data || [])
      setProformas(proformaResult.data || [])
      setSupplierState(practiceResult.data?.state_code || practiceResult.data?.gstin?.slice(0, 2) || '')
      setPracticeDetails(practiceResult.data || null)
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
      const { data: practice, error: practiceError } = await supabase.from('practices').select('name, legal_name, email, gstin, state_code, address, logo_url').limit(1).maybeSingle()
      if (practiceError) setError(`Invoice settings could not be loaded. ${practiceError.message}`)
      else {
        const { data: invoiceId, error: issueError } = await supabase.rpc('issue_tax_invoice', { p_client_id: selectedClient, p_supplier_gstin: practice?.gstin || '', p_recipient_gstin: client?.gstin || '', p_place_of_supply: client?.state_code || '', p_reverse_charge: false, p_invoice_date: invoiceDate, p_due_date: dueDate || null, p_notes: null, p_items: payloadItems })
        if (issueError) setError(issueError.message.includes('Not allowed') ? 'You do not have access to this client.' : `Invoice could not be issued. ${issueError.message}`)
        else { setNotice('Tax invoice issued successfully and the list was refreshed.'); await load(); if (invoiceId) printInvoice({ number: 'Issued invoice', client, supplier: practice || practiceDetails, items, totals, invoiceDate, dueDate, template: invoiceTemplate, accent: customAccent, footer: customFooter, terms: customTerms, documentLabel: 'TAX INVOICE' }) }
      }
    } else {
      const { data: proformaId, error: proformaError } = await supabase.rpc('create_proforma_invoice', { p_client_id: selectedClient, p_issue_date: invoiceDate, p_due_date: dueDate || null, p_items: payloadItems })
      if (proformaError) setError(`Proforma could not be created. ${proformaError.message}`)
      else { setNotice('Proforma created successfully and the list was refreshed.'); await load(); if (proformaId) printInvoice({ number: 'Proforma', client, supplier: practiceDetails, items, totals, invoiceDate, dueDate, template: invoiceTemplate, accent: customAccent, footer: customFooter, terms: customTerms, documentLabel: 'PROFORMA INVOICE' }) }
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

  return <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6FB' }}><Sidebar /><main style={{ marginLeft: 240, flex: 1, padding: 32 }}><div style={{ maxWidth: 1180, margin: '0 auto' }}><h1 style={heading}>Invoicing</h1><p style={subheading}>Raise proformas and GST tax invoices with India’s April–March financial year.</p>{error && <div style={errorStyle}>{error}</div>}{notice && <div style={successStyle}>{notice}</div>}<div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 20, marginTop: 24 }}><form onSubmit={issue} style={panel}><div style={{ display: 'flex', gap: 8, marginBottom: 18 }}><button type="button" onClick={() => setType('tax')} style={type === 'tax' ? primaryButton : secondaryButton}>Tax invoice</button><button type="button" onClick={() => setType('proforma')} style={type === 'proforma' ? primaryButton : secondaryButton}>Proforma</button></div><div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 180px', gap: 10, alignItems: 'end', marginBottom: 16 }}><label style={label}>Invoice format<select value={invoiceTemplate} onChange={event => setInvoiceTemplate(event.target.value)} style={inputStyle}>{invoiceTemplates.map(template => <option key={template.id} value={template.id}>{template.label}</option>)}</select><small style={{ color: '#6B7280', fontWeight: 400 }}>{invoiceTemplates.find(template => template.id === invoiceTemplate)?.description}</small></label><div style={{ color: '#6B7280', fontSize: 11, lineHeight: 1.45 }}>Print-ready GST layout<br />with SAC and tax breakup</div></div>{invoiceTemplate === 'custom' && <div style={{ display: 'grid', gap: 10, padding: 12, marginBottom: 16, border: '1px solid #E0E7FF', borderRadius: 8, background: '#F8FAFF' }}><strong style={{ color: '#1F2937', fontSize: 13 }}>Custom format options</strong><label style={label}>Accent colour<input type="color" value={customAccent} onChange={event => setCustomAccent(event.target.value)} style={{ width: 52, height: 34, padding: 2, border: '1px solid #D1D5DB', borderRadius: 6 }} /></label><label style={label}>Footer text<input value={customFooter} onChange={event => setCustomFooter(event.target.value)} style={inputStyle} /></label><label style={label}>Payment terms<input value={customTerms} onChange={event => setCustomTerms(event.target.value)} style={inputStyle} /></label></div>}<label style={label}>Client<select value={selectedClient} onChange={event => setSelectedClient(event.target.value)} style={inputStyle}><option value="">Select client</option>{clients.map(item => <option key={item.id} value={item.id}>{item.legal_name || item.name}</option>)}</select></label><div style={{ display: 'flex', gap: 10, marginTop: 12 }}><label style={{ ...label, flex: 1 }}>Invoice date<input type="date" value={invoiceDate} onChange={event => setInvoiceDate(event.target.value)} style={inputStyle} /></label><label style={{ ...label, flex: 1 }}>Due date<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} style={inputStyle} /></label></div><h2 style={{ ...heading, fontSize: 16, margin: '22px 0 10px' }}>Line items</h2>{items.map((item, index) => { const sac = sacCodes.find(entry => entry.code === item.sac_code); return <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 100px 80px', gap: 8, marginBottom: 8 }}><input placeholder="Service / reimbursement" value={item.description} onChange={event => updateItem(index, { description: event.target.value })} style={inputStyle} /><div><input list="sac-code-options" placeholder="SAC code" value={item.sac_code} onChange={event => updateItem(index, { sac_code: event.target.value })} style={inputStyle} />{sac && <small style={{ display: 'block', color: '#6B7280', marginTop: 4 }}>{sac.description}</small>}</div><input type="number" min="0" step="0.001" placeholder="Qty" value={item.quantity} onChange={event => updateItem(index, { quantity: event.target.value })} style={inputStyle} /><input type="number" min="0" step="0.01" placeholder="₹" value={item.rate_rupees} onChange={event => updateItem(index, { rate_rupees: event.target.value })} style={inputStyle} /><label style={{ gridColumn: '1 / span 2', color: '#6B7280', fontSize: 12 }}><input type="checkbox" checked={item.pure_agent} onChange={event => updateItem(index, { pure_agent: event.target.checked })} /> Government fee reimbursement / pure agent</label><input type="number" min="0" max="100" step="0.01" value={item.gst_rate} onChange={event => updateItem(index, { gst_rate: event.target.value })} style={inputStyle} disabled={item.pure_agent || !item.taxable} /></div> })}<datalist id="sac-code-options">{sacCodes.map(entry => <option key={entry.code} value={entry.code}>{entry.description}</option>)}</datalist><p style={{ ...muted, margin: '4px 0 10px' }}>Start typing a SAC code to search the common services list. Custom SAC codes are also accepted.</p><button type="button" onClick={() => setItems([...items, { ...blankItem }])} style={secondaryButton}>+ Add line</button><div style={{ textAlign: 'right', marginTop: 20, color: '#374151', lineHeight: 1.8 }}><div>Subtotal: {money(totals.subtotal)}</div><div>CGST: {money(totals.cgst)} · SGST: {money(totals.sgst)} · IGST: {money(totals.igst)}</div><strong style={{ color: '#111827', fontSize: 18 }}>Total: {money(totals.total)}</strong></div><button disabled={saving || loading} style={{ ...primaryButton, marginTop: 18 }}>{saving ? 'Saving…' : `Issue ${type === 'tax' ? 'tax invoice' : 'proforma'}`}</button></form><section style={panel}><h2 style={{ ...heading, fontSize: 18 }}>Recent documents</h2>{loading ? <p style={muted}>Loading…</p> : <>{proformas.map(proforma => <div key={proforma.id} style={{ borderBottom: '1px solid #F3F4F6', padding: '12px 0' }}><strong style={{ color: '#111827', fontSize: 13 }}>{proforma.number}</strong><p style={muted}>{clients.find(item => item.id === proforma.client_id)?.name || 'Client'} · {money(proforma.total_paise)} · {proforma.status}</p>{proforma.status !== 'converted' && <button type="button" disabled={saving} onClick={() => convertProforma(proforma)} style={secondaryButton}>Convert to tax invoice</button>}</div>)}{invoices.length === 0 && proformas.length === 0 && <p style={muted}>No invoices or proformas yet.</p>}{invoices.map(invoice => <div key={invoice.id} style={{ borderBottom: '1px solid #F3F4F6', padding: '12px 0' }}><strong style={{ color: '#111827', fontSize: 13 }}>{invoice.number}</strong><p style={muted}>{clients.find(item => item.id === invoice.client_id)?.name || 'Client'} · {money(invoice.total_paise)} · {invoice.status}</p><button type="button" onClick={() => setPaymentInvoice(invoice)} style={secondaryButton}>Record payment</button><button type="button" onClick={() => printInvoice({ number: invoice.number, client: clients.find(item => item.id === invoice.client_id), items: [], totals: { total: invoice.total_paise }, invoiceDate: invoice.invoice_date })} style={{ ...secondaryButton, marginLeft: 6 }}>Print PDF</button></div>)}</>}</section></div></div></main>{paymentInvoice && <div style={modal}><form onSubmit={recordPayment} style={modalCard}><h2 style={{ ...heading, fontSize: 18 }}>Record payment</h2><label style={label}>Amount received<input type="number" min="0" step="0.01" value={payment.amount} onChange={event => setPayment({ ...payment, amount: event.target.value })} style={inputStyle} /></label><label style={label}>TDS deducted<input type="number" min="0" step="0.01" value={payment.tds} onChange={event => setPayment({ ...payment, tds: event.target.value })} style={inputStyle} /></label><label style={label}>Received on<input type="date" value={payment.date} onChange={event => setPayment({ ...payment, date: event.target.value })} style={inputStyle} /></label><button style={primaryButton}>Save payment</button></form></div>}</div>
}

+function escapeInvoiceHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])) }
function numberToIndianWords(value) {
  const number = Math.round(Number(value || 0) / 100)
  if (!number) return 'Zero rupees only'
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const two = n => n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
  const parts = []
  let remaining = number
  if (remaining >= 10000000) { parts.push(two(Math.floor(remaining / 10000000)) + ' Crore'); remaining %= 10000000 }
  if (remaining >= 100000) { parts.push(two(Math.floor(remaining / 100000)) + ' Lakh'); remaining %= 100000 }
  if (remaining >= 1000) { parts.push(two(Math.floor(remaining / 1000)) + ' Thousand'); remaining %= 1000 }
  if (remaining >= 100) { parts.push(ones[Math.floor(remaining / 100)] + ' Hundred'); remaining %= 100 }
  if (remaining) parts.push(two(remaining))
  return parts.join(' ') + ' rupees only'
}
function printInvoice({ number, client, supplier, items, totals, invoiceDate, dueDate, template = 'gst_standard', accent = '#4F46E5', footer = 'Thank you for your business.', terms = 'Payment due by the due date shown above.', documentLabel = 'TAX INVOICE' }) {
  const popup = window.open('', '_blank')
  if (!popup) return
  const esc = escapeInvoiceHtml
  const brand = template === 'custom' ? accent : template === 'professional' ? '#111827' : '#4F46E5'
  const supplierName = supplier?.legal_name || supplier?.name || 'Supplier'
  const clientName = client?.legal_name || client?.name || 'Client'
  const itemRows = (items || []).map(item => '<tr><td>' + esc(item.sac_code || '-') + '</td><td><strong>' + esc(item.description) + '</strong></td><td class="num">' + (item.quantity || 0) + '</td><td class="num">' + money(Math.round(Number(item.rate_rupees || 0) * 100)) + '</td><td class="num">' + money(Math.round(Number(item.quantity || 0) * Number(item.rate_rupees || 0) * 100)) + '</td></tr>').join('')
  const supplierAddress = [supplier?.address, supplier?.state_code ? 'State code: ' + supplier.state_code : ''].filter(Boolean).join('<br>')
  const clientAddress = [client?.address, client?.state_code ? 'State code: ' + client.state_code : ''].filter(Boolean).join('<br>')
  const logo = supplier?.logo_url ? '<img class="logo" src="' + esc(supplier.logo_url) + '" alt="' + esc(supplierName) + '" />' : ''
  const style = ':root{--brand:' + esc(brand) + '}*{box-sizing:border-box}body{margin:0;background:#eef1f7;color:#172033;font-family:Arial,Helvetica,sans-serif;font-size:12px}.sheet{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:34px 38px;box-shadow:0 8px 30px rgba(15,23,42,.14)}.top{display:flex;justify-content:space-between;gap:30px;border-bottom:3px solid var(--brand);padding-bottom:18px}.brand{display:flex;gap:12px;align-items:flex-start}.logo{max-width:120px;max-height:52px;object-fit:contain}.supplier h1{margin:0 0 7px;font-size:22px;color:var(--brand)}.supplier p,.meta p,.box p{margin:3px 0;line-height:1.45}.meta{text-align:right}.meta h2{margin:0 0 8px;font-size:20px;letter-spacing:.06em;color:var(--brand)}.meta strong{display:inline-block;min-width:88px}.parties{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:20px 0}.box{border:1px solid #d9deea;padding:12px;min-height:96px}.box h3{margin:0 0 8px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--brand)}table{width:100%;border-collapse:collapse;margin-top:10px}th{background:var(--brand);color:white;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em}td,th{border:1px solid #d9deea;padding:9px 8px;vertical-align:top}.num{text-align:right;white-space:nowrap}.totals{width:320px;margin:14px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:4px 0}.totals .grand{border-top:2px solid var(--brand);font-size:15px;font-weight:700;padding-top:9px}.words{margin-top:20px;padding:11px;background:#f5f7fb;border-left:4px solid var(--brand)}.bottom{display:grid;grid-template-columns:1fr 220px;gap:30px;margin-top:28px}.signature{text-align:center;border-top:1px solid #aab3c4;padding-top:9px;margin-top:50px}.footer{border-top:1px solid #d9deea;margin-top:35px;padding-top:11px;color:#596579;font-size:10px;white-space:pre-wrap}.small{color:#596579;font-size:10px}.professional .top{border-bottom-width:1px}.professional th{background:#172033}.professional .sheet{padding:30px 34px}@media print{body{background:#fff}.sheet{width:auto;min-height:0;margin:0;box-shadow:none;padding:0}@page{size:A4;margin:12mm}}'
  const body = '<div class="sheet ' + (template === 'professional' ? 'professional' : '') + '"><div class="top"><div class="brand">' + logo + '<div class="supplier"><h1>' + esc(supplierName) + '</h1><p>' + (supplierAddress || 'Supplier address not configured') + '</p><p>' + (supplier?.email ? esc(supplier.email) : '') + (supplier?.gstin ? (supplier?.email ? ' · ' : '') + 'GSTIN: ' + esc(supplier.gstin) : '') + '</p></div></div><div class="meta"><h2>' + esc(documentLabel) + '</h2><p><strong>Invoice no.</strong> ' + esc(number || 'Draft') + '</p><p><strong>Issue date</strong> ' + esc(invoiceDate || '') + '</p><p><strong>Due date</strong> ' + esc(dueDate || 'On receipt') + '</p><p><strong>Place of supply</strong> ' + esc(client?.state_code || supplier?.state_code || 'Not specified') + '</p></div></div><div class="parties"><div class="box"><h3>Bill from</h3><p><strong>' + esc(supplierName) + '</strong></p><p>' + (supplierAddress || 'Address not configured') + '</p><p>GSTIN: ' + esc(supplier?.gstin || 'Not configured') + '</p></div><div class="box"><h3>Bill to</h3><p><strong>' + esc(clientName) + '</strong></p><p>' + (clientAddress || 'Address not configured') + '</p><p>GSTIN: ' + esc(client?.gstin || 'Unregistered') + '</p></div></div><table><thead><tr><th>SAC</th><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Taxable amount</th></tr></thead><tbody>' + (itemRows || '<tr><td colspan="5">Line-item detail is available in the invoice record.</td></tr>') + '</tbody></table><div class="totals"><div><span>Taxable value</span><strong>' + money(totals?.subtotal) + '</strong></div><div><span>CGST</span><strong>' + money(totals?.cgst) + '</strong></div><div><span>SGST</span><strong>' + money(totals?.sgst) + '</strong></div><div><span>IGST</span><strong>' + money(totals?.igst) + '</strong></div><div class="grand"><span>Total invoice value</span><strong>' + money(totals?.total) + '</strong></div></div><div class="words"><strong>Amount in words:</strong> ' + numberToIndianWords(totals?.total) + '</div><div class="bottom"><div><p><strong>Reverse charge:</strong> No</p><p class="small">' + esc(terms) + '</p><p class="small">This document is issued for services supplied under the applicable GST provisions. Please retain it for your records.</p></div><div class="signature">For ' + esc(supplierName) + '<br /><br /><strong>Authorised signatory</strong></div></div><div class="footer">' + esc(footer) + '</div></div>'
  popup.document.write('<html><head><title>' + esc(number || documentLabel) + '</title><style>' + style + '</style></head><body>' + body + '<script>window.onload=function(){window.print()}</script></body></html>')
  popup.document.close()
}

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
