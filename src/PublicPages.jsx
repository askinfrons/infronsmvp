import { Link, useNavigate } from 'react-router-dom'

const brand = {
  ink: '#0f172a',
  muted: '#64748b',
  soft: '#f8fafc',
  line: '#e2e8f0',
  accent: '#6366f1',
  accentDark: '#4f46e5',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
}

function Wordmark({ light = false }) {
  return (
    <Link to="/" style={{ display: 'inline-flex', alignItems: 'baseline', gap: '2px', textDecoration: 'none' }}>
      <span style={{
        fontSize: '21px',
        fontWeight: 800,
        letterSpacing: '-0.04em',
        color: light ? '#FFFFFF' : brand.ink,
      }}>
        infrons
      </span>
      <span style={{ fontSize: '21px', fontWeight: 800, color: light ? '#a5b4fc' : brand.accent, lineHeight: 1 }}>.</span>
    </Link>
  )
}

function PublicNav() {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 20,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(14px)',
      borderBottom: `1px solid ${brand.line}`,
    }}>
      <div style={{
        maxWidth: '1120px',
        margin: '0 auto',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '18px',
      }}>
        <Wordmark />
        <nav style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {[
            ['Privacy', '/privacy'],
            ['Terms', '/terms'],
            ['Data usage', '/data-usage'],
            ['Support', '/support'],
          ].map(([label, href]) => (
            <Link key={href} to={href} style={{ color: brand.muted, textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
              {label}
            </Link>
          ))}
          <Link to="/login" style={{ color: brand.ink, textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  )
}

function PublicFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${brand.line}`, background: '#FFFFFF' }}>
      <div style={{
        maxWidth: '1120px',
        margin: '0 auto',
        padding: '28px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        gap: '20px',
        flexWrap: 'wrap',
      }}>
        <div>
          <Wordmark />
          <p style={{ marginTop: '8px', color: brand.muted, fontSize: '13px' }}>
            Client communication workspace for CA practices in India.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            ['Privacy', '/privacy'],
            ['Terms', '/terms'],
            ['Data usage', '/data-usage'],
            ['Support', '/support'],
          ].map(([label, href]) => (
            <Link key={href} to={href} style={{ color: brand.muted, textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}

function AppPreview() {
  const rows = [
    ['Agarwal Textiles', 'GST return documents', brand.red],
    ['Mehta Foods LLP', 'Client replied today', brand.green],
    ['Rao Exports', 'Follow-up due', brand.amber],
  ]

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid rgba(255,255,255,0.36)',
      borderRadius: '22px',
      boxShadow: '0 28px 80px rgba(15,23,42,0.28)',
      overflow: 'hidden',
      width: '100%',
      maxWidth: '520px',
    }}>
      <div style={{ height: '44px', background: '#111827', display: 'flex', alignItems: 'center', gap: '7px', padding: '0 16px' }}>
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ef4444' }} />
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#f59e0b' }} />
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10b981' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', minHeight: '310px' }}>
        <aside style={{ background: '#f8fafc', borderRight: `1px solid ${brand.line}`, padding: '18px' }}>
          <Wordmark />
          <div style={{ marginTop: '26px', display: 'grid', gap: '8px' }}>
            {['Clients', 'Messages', 'Notes', 'Team'].map((item, index) => (
              <div key={item} style={{
                padding: '8px 10px',
                borderRadius: '8px',
                background: index === 0 ? '#eef2ff' : 'transparent',
                color: index === 0 ? brand.accentDark : brand.muted,
                fontSize: '12px',
                fontWeight: 700,
              }}>
                {item}
              </div>
            ))}
          </div>
        </aside>
        <main style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <p style={{ color: brand.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Today</p>
              <h3 style={{ color: brand.ink, fontSize: '18px', marginTop: '2px' }}>Client desk</h3>
            </div>
            <span style={{ background: '#eef2ff', color: brand.accentDark, padding: '6px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
              3 need action
            </span>
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {rows.map(([name, detail, color]) => (
              <div key={name} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                border: `1px solid ${brand.line}`,
                borderRadius: '12px',
                background: '#FFFFFF',
              }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ color: brand.ink, fontSize: '13px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                  <p style={{ color: brand.muted, fontSize: '12px', marginTop: '2px' }}>{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {['Portal links', 'Private notes'].map(item => (
              <div key={item} style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', border: `1px solid ${brand.line}` }}>
                <p style={{ color: brand.ink, fontSize: '13px', fontWeight: 800 }}>{item}</p>
                <p style={{ color: brand.muted, fontSize: '12px', marginTop: '4px' }}>Organised per client</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

export function MarketingHome() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', fontFamily: 'Inter, sans-serif' }}>
      <PublicNav />
      <section style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #312e81 58%, #4f46e5 100%)',
        color: '#FFFFFF',
        overflow: 'hidden',
      }}>
        <div style={{
          maxWidth: '1120px',
          margin: '0 auto',
          minHeight: 'calc(100vh - 72px)',
          padding: '64px 24px 40px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: '46px',
          alignItems: 'center',
        }}>
          <div>
            <p style={{
              display: 'inline-flex',
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#c7d2fe',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '22px',
            }}>
              Built for CA practices
            </p>
            <h1 style={{ fontSize: 'clamp(38px, 7vw, 72px)', lineHeight: 0.98, letterSpacing: '-0.04em', fontWeight: 850, maxWidth: '760px' }}>
              Infrons keeps client work from slipping through chats.
            </h1>
            <p style={{ marginTop: '22px', color: 'rgba(255,255,255,0.78)', fontSize: '17px', lineHeight: 1.75, maxWidth: '620px' }}>
              A focused client communication workspace for Indian CA firms: conversations, notes, follow-ups, staff assignment, and client portal links in one place.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '32px' }}>
              <button
                onClick={() => navigate('/signup')}
                style={{
                  background: '#FFFFFF',
                  color: '#312e81',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '13px 22px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Create account
              </button>
              <button
                onClick={() => navigate('/login')}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.28)',
                  borderRadius: '10px',
                  padding: '13px 22px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Sign in
              </button>
            </div>
          </div>
          <AppPreview />
        </div>
      </section>

      <section style={{ padding: '72px 24px', background: '#FFFFFF' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <div style={{ maxWidth: '680px', marginBottom: '28px' }}>
            <h2 style={{ fontSize: '32px', lineHeight: 1.15, letterSpacing: '-0.035em', color: brand.ink }}>One workspace for the client conversation layer.</h2>
            <p style={{ marginTop: '12px', color: brand.muted, fontSize: '15px', lineHeight: 1.7 }}>
              INFRONS is not accounting software. It sits around your practice operations so you can see who replied, who needs attention, and what was promised.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
            {[
              ['Client status', 'Spot inactive clients with reply-age indicators and follow-up dates.'],
              ['Secure portal links', 'Give each client a simple link to message and share files without installing an app.'],
              ['Private notes', 'Keep internal context beside every client conversation.'],
              ['Staff assignment', 'Assign clients to team members while principals retain oversight.'],
            ].map(([title, body]) => (
              <div key={title} style={{ border: `1px solid ${brand.line}`, borderRadius: '12px', padding: '22px', background: brand.soft }}>
                <h3 style={{ color: brand.ink, fontSize: '16px', marginBottom: '8px' }}>{title}</h3>
                <p style={{ color: brand.muted, fontSize: '14px', lineHeight: 1.65 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '64px 24px', background: '#f8fafc', borderTop: `1px solid ${brand.line}` }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
          {[
            ['Privacy-first by design', 'Your practice and client records are protected through Supabase authentication, row-level security, and scoped portal tokens.'],
            ['Made for repeated work', 'The interface is intentionally calm: client list, communication thread, notes, reminders, and team assignment.'],
            ['Clear policies', 'Privacy, terms, data usage, and support pages are public so clients and practices can understand how INFRONS works.'],
          ].map(([title, body]) => (
            <div key={title} style={{ background: '#FFFFFF', border: `1px solid ${brand.line}`, borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ color: brand.ink, fontSize: '17px', marginBottom: '8px' }}>{title}</h3>
              <p style={{ color: brand.muted, fontSize: '14px', lineHeight: 1.7 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>
      <PublicFooter />
    </div>
  )
}

const pageContent = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This policy explains how INFRONS handles account, practice, client, communication, and support information.',
    sections: [
      ['Information we collect', 'We collect account details, practice profile details, client records added by a practice, messages, notes, file metadata, portal activity, and support messages.'],
      ['How we use information', 'We use information to provide the workspace, authenticate users, route clients to their portal, support staff assignment, display reminders, send service emails, and maintain security.'],
      ['Client data ownership', 'Client information entered by a practice remains practice-controlled data. INFRONS provides the communication workspace and does not sell client data.'],
      ['Security', 'The app uses Supabase authentication, database row-level security, scoped client portal tokens, and storage controls. Practices should invite only trusted staff and keep account credentials secure.'],
      ['Retention', 'Practice data remains available while the workspace is active unless deleted by authorised users or removed as part of account closure.'],
      ['Contact', 'For privacy questions, contact askinfrons@gmail.com.'],
    ],
  },
  terms: {
    title: 'Terms and Conditions',
    intro: 'These terms govern use of INFRONS by practices, staff users, and clients accessing portal links.',
    sections: [
      ['Purpose', 'INFRONS is a client communication workspace for CA practices. It is not accounting software, tax filing software, legal advice, or a replacement for professional judgment.'],
      ['Accounts', 'Practice owners are responsible for user access, staff invitations, client records, and activity performed through their workspace.'],
      ['Acceptable use', 'Users must not upload unlawful content, misuse portal links, attempt unauthorised access, disrupt service operation, or use INFRONS to send abusive or misleading communications.'],
      ['Client portals', 'Portal links are intended for the invited client. Practices are responsible for sharing links carefully and revoking or rotating access when needed.'],
      ['Availability', 'We aim to keep INFRONS reliable, but service interruptions may occur due to maintenance, third-party providers, or incidents outside our control.'],
      ['Limitation', 'INFRONS provides communication tooling. Practices remain responsible for compliance, client advice, filings, and record verification.'],
    ],
  },
  dataUsage: {
    title: 'Data Usage',
    intro: 'This page summarises what data INFRONS uses and why.',
    sections: [
      ['Practice workspace data', 'Practice names, emails, team roles, and staff membership are used to identify and secure each workspace.'],
      ['Client records', 'Client names, companies, phone numbers, portal tokens, reply timestamps, and follow-up dates are used to organise communication and prioritise work.'],
      ['Messages and files', 'Messages, attachments, file names, and timestamps are used to display conversation history in the practice app and public client portal.'],
      ['Internal notes', 'Notes are private to the practice workspace and are not shown in the client portal.'],
      ['Operational data', 'Authentication state, API responses, and limited error information may be used to keep the product reliable and troubleshoot issues.'],
      ['Email data', 'When invitations or notifications are sent, recipient addresses and email content are processed by the configured email provider, currently Resend.'],
    ],
  },
  support: {
    title: 'Support',
    intro: 'Need help with INFRONS? Start here.',
    sections: [
      ['Email support', 'Send questions, bug reports, and setup requests to askinfrons@gmail.com. Include your practice email and a short description of the issue.'],
      ['Invite issues', 'Check that the invited email is correct, confirm email sending is configured in production, and use the copy-link fallback if delivery is delayed.'],
      ['Portal issues', 'If a client cannot open a portal link, confirm the client record still exists and the full link was shared.'],
      ['Data questions', 'For privacy, deletion, or export questions, contact support from the practice owner email where possible.'],
      ['Urgent access', 'If a staff member should no longer access the workspace, remove or change their access in Supabase until in-app staff removal is added.'],
    ],
  },
}

export function InfoPage({ type }) {
  const content = pageContent[type] || pageContent.support

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', fontFamily: 'Inter, sans-serif' }}>
      <PublicNav />
      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '56px 24px 72px' }}>
        <p style={{ color: brand.accentDark, fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
          INFRONS
        </p>
        <h1 style={{ fontSize: '40px', lineHeight: 1.08, letterSpacing: '-0.04em', color: brand.ink, marginBottom: '14px' }}>
          {content.title}
        </h1>
        <p style={{ color: brand.muted, fontSize: '16px', lineHeight: 1.75, maxWidth: '720px', marginBottom: '34px' }}>
          {content.intro}
        </p>
        <div style={{ display: 'grid', gap: '14px' }}>
          {content.sections.map(([title, body]) => (
            <section key={title} style={{ border: `1px solid ${brand.line}`, borderRadius: '12px', padding: '22px', background: brand.soft }}>
              <h2 style={{ color: brand.ink, fontSize: '17px', marginBottom: '8px' }}>{title}</h2>
              <p style={{ color: brand.muted, fontSize: '14px', lineHeight: 1.75 }}>{body}</p>
            </section>
          ))}
        </div>
        {type === 'support' && (
          <a
            href="mailto:askinfrons@gmail.com"
            style={{
              display: 'inline-flex',
              marginTop: '24px',
              background: brand.accent,
              color: '#FFFFFF',
              borderRadius: '10px',
              padding: '12px 18px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 800,
            }}
          >
            Email support
          </a>
        )}
      </main>
      <PublicFooter />
    </div>
  )
}
