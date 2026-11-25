import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Sidebar from './Sidebar'
import { supabase } from './supabaseClient'
import { PageHeader, Tabs, Chip } from './designSystem'

const tabs = ['Overview', 'Registrations', 'Compliance', 'Documents', 'Billing', 'Chat', 'Notes', 'Activity log']
const registrationTypes = ['PAN', 'GSTIN', 'TAN', 'CIN', 'LLPIN', 'Udyam', 'IEC', 'PF', 'ESI', 'Professional Tax']
const serviceTypes = ['GST', 'TDS', 'ITR', 'ROC', 'Audit', 'Bookkeeping', 'Payroll', 'Other']
const money = paise => `₹${((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function Client360() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [contacts, setContacts] = useState([])
  const [addresses, setAddresses] = useState([])
  const [services, setServices] = useState([])
  const [compliance, setCompliance] = useState([])
  const [checklist, setChecklist] = useState([])
  const [documents, setDocuments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [activity, setActivity] = useState([])
  const [tab, setTab] = useState('Overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [registration, setRegistration] = useState({ registration_type: 'GSTIN', registration_number: '', state_code: '', filing_frequency: 'annual', gst_scheme: 'regular' })
  const [contact, setContact] = useState({ name: '', designation: '', phone: '', email: '', is_primary: false })
  const [address, setAddress] = useState({ address_type: 'registered', label: '', address: '', state_code: '', pincode: '', is_primary: false })
  const [service, setService] = useState({ service_key: 'GST', service_name: 'GST', default_fee_paise: '', sac_code: '', gst_rate: '18', billing_frequency: 'monthly' })

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (!id) return undefined
    const channel = supabase.channel(`client-360:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_registrations', filter: `client_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_contacts', filter: `client_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_addresses', filter: `client_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_services', filter: `client_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_compliance_instances', filter: `client_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_document_checklists', filter: `client_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_activity_log', filter: `client_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoice_payments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tax_invoices', filter: `client_id=eq.${id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  const load = async () => {
    setLoading(true); setError('')
    const [clientResult, registrationResult, contactResult, addressResult, serviceResult, complianceResult, checklistResult, documentResult, invoiceResult, activityResult] = await Promise.all([
      supabase.from('clients').select('id, name, legal_name, trade_name, constitution_type, pan, gstin, state_code, address, email, phone, client_status, source, onboarded_date, tags, assigned_to, verification_status, last_activity_at, portal_last_opened').eq('id', id).single(),
      supabase.from('client_registrations').select('*').eq('client_id', id).order('created_at'),
      supabase.from('client_contacts').select('*').eq('client_id', id).order('is_primary', { ascending: false }).order('created_at'),
      supabase.from('client_addresses').select('*').eq('client_id', id).order('is_primary', { ascending: false }).order('created_at'),
      supabase.from('client_services').select('*').eq('client_id', id).order('created_at'),
      supabase.from('client_compliance_instances').select('*, compliance_due_dates(filing_name, filing_key)').eq('client_id', id).order('due_date'),
      supabase.from('client_document_checklists').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('client_documents').select('id, file_name, created_at').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('invoice_register').select('*').eq('client_id', id).order('invoice_date', { ascending: false }).range(0, 99),
      supabase.from('client_activity_log').select('*').eq('client_id', id).order('created_at', { ascending: false }).range(0, 49)
    ])
    const failed = [clientResult, registrationResult, contactResult, addressResult, serviceResult, complianceResult, checklistResult, documentResult, invoiceResult, activityResult].find(result => result.error)
    if (failed) setError(failed.error.message)
    else { setClient(clientResult.data); setRegistrations(registrationResult.data || []); setContacts(contactResult.data || []); setAddresses(addressResult.data || []); setServices(serviceResult.data || []); setCompliance(complianceResult.data || []); setChecklist(checklistResult.data || []); setDocuments(documentResult.data || []); setInvoices(invoiceResult.data || []); setActivity(activityResult.data || []) }
    setLoading(false)
  }

  const saveRegistration = async event => {
    event.preventDefault(); if (!registration.registration_number.trim()) return
    setSaving(true); setError('')
    const { error: saveError } = await supabase.from('client_registrations').insert({ ...registration, client_id: id, registration_number: registration.registration_number.trim().toUpperCase() })
    if (saveError) setError(saveError.message); else { setRegistration({ ...registration, registration_number: '' }); await load() }
    setSaving(false)
  }

  const saveContact = async event => {
    event.preventDefault(); if (!contact.name.trim()) return
    setSaving(true); setError('')
    const { error: saveError } = await supabase.from('client_contacts').insert({ ...contact, client_id: id, name: contact.name.trim() })
    if (saveError) setError(saveError.message); else { setContact({ name: '', designation: '', phone: '', email: '', is_primary: false }); await load() }
    setSaving(false)
  }

  const saveAddress = async event => {
    event.preventDefault(); if (!address.address.trim()) return
    setSaving(true); setError('')
    const { error: saveError } = await supabase.from('client_addresses').insert({ ...address, client_id: id, address: address.address.trim() })
    if (saveError) setError(saveError.message); else { setAddress({ ...address, label: '', address: '', state_code: '', pincode: '', is_primary: false }); await load() }
    setSaving(false)
  }

  const saveService = async event => {
    event.preventDefault(); setSaving(true); setError('')
    const { error: saveError } = await supabase.from('client_services').insert({ ...service, client_id: id, default_fee_paise: service.default_fee_paise ? Math.round(Number(service.default_fee_paise) * 100) : null, gst_rate: Number(service.gst_rate || 0) })
    if (saveError) setError(saveError.message); else { setService({ ...service, default_fee_paise: '' }); await load() }
    setSaving(false)
  }

  const generateCompliance = async () => {
    setSaving(true); setError('')
    const { error: generateError } = await supabase.rpc('generate_client_compliance', { p_client_id: id, p_period_label: new Date().getFullYear().toString() })
    if (generateError) setError(generateError.message)
    else await load()
    setSaving(false)
  }

  const overdue = useMemo(() => compliance.filter(item => item.status !== 'Filed' && item.due_date < new Date().toISOString().slice(0, 10)).length, [compliance])
  const pendingDocs = checklist.filter(item => !item.received).length
  const outstanding = invoices.reduce((sum, item) => sum + (item.balance_paise || 0), 0)

  if (loading) return <Page><p style={muted}>Loading client workspace…</p></Page>
  if (!client) return <Page><div style={errorStyle}>{error || 'Client not found.'}</div></Page>

  return <Page><button onClick={() => navigate('/client-master')} style={backButton}>← Client Master</button><PageHeader eyebrow="Client 360" title={client.legal_name || client.name} description={`${client.trade_name || 'Client workspace'} · ${client.pan || 'PAN not added'}`} actions={<><Chip tone={client.client_status === 'Active' ? 'success' : 'neutral'}>{client.client_status || 'Active'}</Chip><button onClick={() => navigate(`/client/${id}/messages`)} style={secondaryButton}>Open chat</button><button onClick={() => navigate(`/client/${id}/documents`)} style={primaryButton}>Documents</button></>} /><Tabs items={tabs} value={tab} onChange={setTab} />{error && <div style={errorStyle}>{error}</div>}{tab === 'Overview' && <Overview client={client} services={services} service={service} setService={setService} saveService={saveService} overdue={overdue} pendingDocs={pendingDocs} outstanding={outstanding} navigate={navigate} id={id} />}{tab === 'Registrations' && <section style={panel}><h2 style={sectionHeading}>Registrations</h2><form onSubmit={saveRegistration} style={inlineForm}><select value={registration.registration_type} onChange={event => setRegistration({ ...registration, registration_type: event.target.value })} style={inputStyle}>{registrationTypes.map(item => <option key={item}>{item}</option>)}</select><input placeholder="Registration number" value={registration.registration_number} onChange={event => setRegistration({ ...registration, registration_number: event.target.value })} style={inputStyle} /><input placeholder="State code" value={registration.state_code} onChange={event => setRegistration({ ...registration, state_code: event.target.value })} style={inputStyle} /><select value={registration.filing_frequency} onChange={event => setRegistration({ ...registration, filing_frequency: event.target.value })} style={inputStyle}><option>monthly</option><option>quarterly</option><option>annual</option><option>per filing</option></select><button disabled={saving} style={primaryButton}>Add</button></form><List rows={registrations} empty="No registrations added yet." render={item => <><strong>{item.registration_type}: {item.registration_number}</strong><span>{item.state_code || 'All India'} · {item.filing_frequency || 'No frequency'}</span></>} /><h2 style={{ ...sectionHeading, marginTop: 26 }}>Contacts</h2><form onSubmit={saveContact} style={inlineForm}><input placeholder="Name" value={contact.name} onChange={event => setContact({ ...contact, name: event.target.value })} style={inputStyle} /><input placeholder="Role" value={contact.designation} onChange={event => setContact({ ...contact, designation: event.target.value })} style={inputStyle} /><input placeholder="Phone" value={contact.phone} onChange={event => setContact({ ...contact, phone: event.target.value })} style={inputStyle} /><input placeholder="Email" type="email" value={contact.email} onChange={event => setContact({ ...contact, email: event.target.value })} style={inputStyle} /><button disabled={saving} style={primaryButton}>Add</button></form><List rows={contacts} empty="No contact persons added yet." render={item => <><strong>{item.name}{item.is_primary ? ' · Primary' : ''}</strong><span>{item.designation || 'Contact'} · {item.phone || item.email || 'No details'}</span></>} /><h2 style={{ ...sectionHeading, marginTop: 26 }}>Addresses</h2><form onSubmit={saveAddress} style={inlineForm}><select value={address.address_type} onChange={event => setAddress({ ...address, address_type: event.target.value })} style={inputStyle}><option>registered</option><option>billing</option><option>branch</option></select><input placeholder="Label" value={address.label} onChange={event => setAddress({ ...address, label: event.target.value })} style={inputStyle} /><input placeholder="Address" value={address.address} onChange={event => setAddress({ ...address, address: event.target.value })} style={inputStyle} /><input placeholder="State / PIN" value={address.state_code} onChange={event => setAddress({ ...address, state_code: event.target.value })} style={inputStyle} /><button disabled={saving} style={primaryButton}>Add</button></form><List rows={addresses} empty="No addresses added yet." render={item => <><strong>{item.address_type}{item.label ? ` · ${item.label}` : ''}</strong><span>{item.address} {item.pincode || ''}</span></>} /></section>}{tab === 'Compliance' && <Compliance rows={compliance} overdue={overdue} onGenerate={generateCompliance} saving={saving} />}{tab === 'Documents' && <DocumentsTab checklist={checklist} documents={documents} navigate={navigate} id={id} />}{tab === 'Billing' && <Billing invoices={invoices} outstanding={outstanding} navigate={navigate} />}{tab === 'Chat' && <ActionPanel title="Client conversation" action={() => navigate(`/client/${id}/messages`)} label="Open messages" />}{tab === 'Notes' && <ActionPanel title="Private notes" action={() => navigate(`/client/${id}/notes`)} label="Open notes" />}{tab === 'Activity log' && <List rows={activity} empty="No changes recorded yet." render={item => <><strong>{item.action}</strong><span>{item.description} · {new Date(item.created_at).toLocaleString()}</span></>} />}</Page>
}

function Overview({ client, services, service, setService, saveService, overdue, pendingDocs, outstanding, navigate, id }) { return <><div style={metricGrid}><Metric label="Overdue filings" value={overdue} tone={overdue ? '#B91C1C' : '#047857'} /><Metric label="Pending documents" value={pendingDocs} tone={pendingDocs ? '#B45309' : '#047857'} /><Metric label="Outstanding" value={money(outstanding)} tone="#111827" /><Metric label="Verification" value={client.verification_status || 'Unverified'} tone="#4F46E5" /></div><section style={panel}><h2 style={sectionHeading}>Client profile</h2><div style={detailGrid}><Detail label="Legal name" value={client.legal_name || client.name} /><Detail label="Trade name" value={client.trade_name} /><Detail label="Constitution" value={client.constitution_type} /><Detail label="GSTIN" value={client.gstin} /><Detail label="Phone" value={client.phone} /><Detail label="Email" value={client.email} /><Detail label="Last activity" value={client.last_activity_at ? new Date(client.last_activity_at).toLocaleString() : 'No activity recorded'} /><Detail label="Source" value={client.source} /></div><div style={{ display: 'flex', gap: 8, marginTop: 18 }}><button onClick={() => navigate(`/client/${id}/messages`)} style={secondaryButton}>Chat</button><button onClick={() => navigate(`/client/${id}/notes`)} style={secondaryButton}>Notes</button><button onClick={() => navigate(`/client/${id}/documents`)} style={secondaryButton}>Documents</button></div></section><section style={panel}><h2 style={sectionHeading}>Services and fee defaults</h2><form onSubmit={saveService} style={inlineForm}><select value={service.service_key} onChange={event => setService({ ...service, service_key: event.target.value, service_name: event.target.value })} style={inputStyle}>{serviceTypes.map(item => <option key={item}>{item}</option>)}</select><input placeholder="Fee (rupees)" value={service.default_fee_paise} onChange={event => setService({ ...service, default_fee_paise: event.target.value })} style={inputStyle} /><input placeholder="SAC code" value={service.sac_code} onChange={event => setService({ ...service, sac_code: event.target.value })} style={inputStyle} /><select value={service.billing_frequency} onChange={event => setService({ ...service, billing_frequency: event.target.value })} style={inputStyle}><option>monthly</option><option>quarterly</option><option>annual</option><option>per filing</option></select><button style={primaryButton}>Add</button></form><List rows={services} empty="No services engaged yet." render={item => <><strong>{item.service_name}</strong><span>{money(item.default_fee_paise)} · {item.billing_frequency} · {item.sac_code || 'No SAC'}</span></>} /></section></> }
function Compliance({ rows, overdue, onGenerate, saving }) { return <section style={panel}><div style={rowBetween}><h2 style={sectionHeading}>Compliance tracker <span style={badge}>{overdue} overdue</span></h2><button onClick={onGenerate} disabled={saving} style={secondaryButton}>Generate current period</button></div><List rows={rows} empty="No filing instances generated yet. Add due-date rules in Supabase, then generate client periods." render={item => <><strong>{item.compliance_due_dates?.filing_name || 'Filing'} · {item.period_label}</strong><span style={{ color: item.status === 'Filed' ? '#047857' : item.due_date < new Date().toISOString().slice(0, 10) ? '#B91C1C' : '#6B7280' }}>{item.status} · Due {item.due_date}</span></>} /></section> }
function DocumentsTab({ checklist, documents, navigate, id }) { return <section style={panel}><div style={rowBetween}><h2 style={sectionHeading}>Documents and checklist</h2><button onClick={() => navigate(`/client/${id}/documents`)} style={secondaryButton}>Open Docs</button></div><List rows={checklist} empty="No document checklist items yet." render={item => <><strong>{item.document_name}</strong><span>{item.received ? 'Received' : 'Pending'}{item.period_label ? ` · ${item.period_label}` : ''}</span></>} /><p style={muted}>{documents.length} uploaded document{documents.length === 1 ? '' : 's'} linked to this client.</p></section> }
function Billing({ invoices, outstanding, navigate }) { return <section style={panel}><div style={rowBetween}><h2 style={sectionHeading}>Billing</h2><button onClick={() => navigate('/invoice-log')} style={secondaryButton}>Open invoice log</button></div><p style={muted}>Outstanding: <strong style={{ color: '#111827' }}>{money(outstanding)}</strong></p><List rows={invoices} empty="No invoices yet." render={item => <><strong>{item.invoice_number}</strong><span>{money(item.total_paise)} · Received {money(item.received_paise)} · Balance {money(item.balance_paise)} · {item.status} · {item.invoice_date}</span></>} /></section> }
function ActionPanel({ title, label, action }) { return <section style={panel}><h2 style={sectionHeading}>{title}</h2><p style={muted}>This workspace remains in the existing client-specific view.</p><button onClick={action} style={primaryButton}>{label} →</button></section> }
function List({ rows, empty, render }) { return rows.length ? <div style={{ display: 'grid', gap: 0 }}>{rows.map(row => <div key={row.id} style={listRow}>{render(row)}</div>)}</div> : <p style={muted}>{empty}</p> }
function Metric({ label, value, tone }) { return <div style={metric}><span style={muted}>{label}</span><strong style={{ color: tone, fontSize: 22, marginTop: 8 }}>{value}</strong></div> }
function Detail({ label, value }) { return <div><span style={muted}>{label}</span><strong style={{ display: 'block', color: '#111827', marginTop: 4 }}>{value || 'Not added'}</strong></div> }
function Page({ children }) { return <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6FB' }}><Sidebar /><main style={{ marginLeft: 240, flex: 1, padding: 32 }}><div style={{ maxWidth: 1180, margin: '0 auto' }}>{children}</div></main></div> }

const heading = { color: '#111827', fontSize: 24, fontWeight: 800, margin: 0 }
const sectionHeading = { color: '#111827', fontSize: 18, fontWeight: 800, margin: 0 }
const subheading = { color: '#6B7280', fontSize: 14, marginTop: 6 }
const muted = { color: '#6B7280', fontSize: 13, lineHeight: 1.5 }
const panel = { background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginTop: 18 }
const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', font: 'inherit', color: '#111827', background: '#FFF' }
const primaryButton = { border: 0, borderRadius: 8, padding: '10px 14px', background: '#6366F1', color: '#FFF', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const secondaryButton = { border: '1px solid #E5E7EB', borderRadius: 8, padding: '9px 12px', background: '#FFF', color: '#374151', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const backButton = { ...secondaryButton, marginBottom: 20 }
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }
const tabBar = { display: 'flex', gap: 4, overflowX: 'auto', borderBottom: '1px solid #E5E7EB', marginTop: 24 }
const tabButton = { border: 0, borderBottom: '2px solid transparent', background: 'transparent', padding: '12px 10px', color: '#6B7280', whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit' }
const activeTab = { ...tabButton, borderBottomColor: '#6366F1', color: '#4F46E5', fontWeight: 700 }
const metricGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 18 }
const metric = { background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, display: 'grid' }
const detailGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20, marginTop: 18 }
const listRow = { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderBottom: '1px solid #F3F4F6', color: '#111827' }
const listRowSpan = { color: '#6B7280', fontSize: 13 }
const inlineForm = { display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr auto', gap: 8, marginTop: 18, alignItems: 'start' }
const rowBetween = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }
const badge = { display: 'inline-block', marginLeft: 8, padding: '4px 8px', borderRadius: 999, background: '#FEF2F2', color: '#B91C1C', fontSize: 11, verticalAlign: 'middle' }
const errorStyle = { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', marginTop: 16, fontSize: 13 }
