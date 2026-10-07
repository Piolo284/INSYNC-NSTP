import React, { useCallback, useState } from 'react';
import { UserCog, UserPlus, X, Crown, Shield, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApi, errorMessage } from '../hooks/useApi';
import { adminAccountsApi } from '../api/adminAccounts';
import { CONTACT_NUMBER_MAX_LENGTH, sanitizeContactNumber, contactNumberError } from '../utils/contactNumber';

/** The three positions, each held by one active account at a time. */
const POSITIONS = [
  { role: 'super_admin', label: 'NSTP Head', icon: Crown, note: 'Oversees both CWTS and ROTC.' },
  { role: 'admin_cwts', label: 'CWTS Admin', icon: Shield, note: 'Manages the CWTS program.' },
  { role: 'admin_rotc', label: 'ROTC Admin', icon: ShieldCheck, note: 'Manages the ROTC program.' },
];
const labelFor = (role) => POSITIONS.find((p) => p.role === role)?.label || role;

const STATUS_COLORS = {
  Active: { bg: '#ECFDF5', color: '#059669' },
  Inactive: { bg: '#F3F4F6', color: '#6B7280' },
};

const card = { background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' };
const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

export default function AdminAccounts() {
  const [assignRole, setAssignRole] = useState(null);
  const [notice, setNotice] = useState('');

  const fetcher = useCallback(async () => (await adminAccountsApi.list()).data || [], []);
  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const admins = data || [];
  const holderOf = (role) => admins.filter((a) => a.role === role && a.status === 'Active');

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Admin Accounts" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ ...card, padding: '22px 24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <UserCog size={22} color="var(--text-primary)" strokeWidth={2.2} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Admin Accounts</h2>
          </div>
          <p style={{ margin: '0 0 18px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Each position has one active admin. Assigning a new admin to a position deactivates the current one — they are logged out and can no longer sign in. Their account and history are kept.
          </p>

          {notice && (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <span>{notice}</span>
              <button onClick={() => setNotice('')} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'inherit' }}><X size={16} /></button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            {POSITIONS.map(({ role, label, icon: Icon, note }) => {
              const holders = holderOf(role);
              return (
                <div key={role} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FBF3F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={18} color="var(--maroon)" />
                    </div>
                    <div>
                      <strong style={{ fontSize: '14px' }}>{label}</strong>
                      <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)' }}>{note}</p>
                    </div>
                  </div>
                  <div style={{ fontSize: '12.5px', minHeight: '38px' }}>
                    {loading ? (
                      <span style={{ color: 'var(--text-secondary)' }}>Loading…</span>
                    ) : holders.length ? (
                      holders.map((h) => (
                        <div key={h._id}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{h.name}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>{h.email}</div>
                        </div>
                      ))
                    ) : (
                      <span style={{ color: '#B45309', fontWeight: 600 }}>Vacant — no active admin</span>
                    )}
                  </div>
                  <button
                    onClick={() => setAssignRole(role)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px 14px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <UserPlus size={15} /> {holders.length ? 'Assign New Admin' : 'Add Admin'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ ...card, padding: '20px 24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>All admin accounts</h3>
          <AsyncSection loading={loading} error={error} onRetry={refetch} isEmpty={!loading && !error && admins.length === 0} emptyMessage="No admin accounts yet. Add one above.">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Name', 'Email', 'Position', 'Status', 'Last updated'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => {
                    const sc = STATUS_COLORS[a.status] || STATUS_COLORS.Inactive;
                    return (
                      <tr key={a._id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600 }}>{a.name}</td>
                        <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>{a.email}</td>
                        <td style={{ padding: '10px 12px', fontSize: '13px' }}>{labelFor(a.role)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', background: sc.bg, color: sc.color }}>{a.status}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>{fmtDate(a.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AsyncSection>
        </section>
      </main>

      {assignRole && (
        <AssignAdminModal
          role={assignRole}
          currentHolders={holderOf(assignRole)}
          onClose={() => setAssignRole(null)}
          onDone={(message) => { setAssignRole(null); setNotice(message); refetch(); }}
        />
      )}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '7px', border: '1px solid var(--border)', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' };

/** Password input with a show/hide (eye) toggle — same pattern as Login.jsx. */
function PasswordInput({ value, onChange }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        required
        autoComplete="new-password"
        style={{ ...inputStyle, paddingRight: '38px' }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex' }}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

/** Same rule the backend enforces (utils/passwordStrength.js). */
const isStrongPassword = (p) => p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);

function AssignAdminModal({ role, currentHolders, onClose, onDone }) {
  const label = labelFor(role);
  const [form, setForm] = useState({ name: '', email: '', contactNumber: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(null); // holders that will be deactivated
  const setField = (f) => (e) => setForm((prev) => ({ ...prev, [f]: f === 'contactNumber' ? sanitizeContactNumber(e.target.value) : e.target.value }));

  const validate = () => {
    if (!form.name.trim()) return 'Full name is required.';
    if (!/^[^\s@]+@marsu\.edu\.ph$/i.test(form.email.trim())) return 'Enter an official MARSU email address (e.g. juandelacruz@marsu.edu.ph).';
    const contactError = contactNumberError(form.contactNumber);
    if (contactError) return contactError;
    if (!isStrongPassword(form.password)) return 'Password must be at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    return '';
  };

  const save = async (confirmReplace) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await adminAccountsApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        contactNumber: form.contactNumber,
        password: form.password,
        role,
        confirmReplace,
      });
      onDone(res.message);
    } catch (err) {
      // Someone took the position in the meantime — ask before replacing them.
      if (err.status === 409 && err.data?.requiresConfirmation) {
        setConfirm(err.data.data?.current || []);
      } else {
        setConfirm(null);
        setError(errorMessage(err, 'Unable to add the admin.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    if (currentHolders.length) setConfirm(currentHolders);
    else save(false);
  };

  return (
    <>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(480px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{currentHolders.length ? 'Assign New' : 'Add'} {label}</h3>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {currentHolders.length
            ? `Current ${label}: ${currentHolders.map((h) => h.name).join(', ')}. Their account will be deactivated once you confirm.`
            : `This position is vacant. The new ${label} can sign in to the admin panel right away.`}
        </p>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '14px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Full Name</label>
            <input value={form.name} onChange={setField('name')} required style={inputStyle} placeholder="e.g. Juan M. Dela Cruz" />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>MARSU Email</label>
            <input type="email" value={form.email} onChange={setField('email')} required style={inputStyle} placeholder="juandelacruz@marsu.edu.ph" />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Contact Number (optional)</label>
            <input value={form.contactNumber} onChange={setField('contactNumber')} inputMode="numeric" maxLength={CONTACT_NUMBER_MAX_LENGTH} style={inputStyle} placeholder="e.g. 09123456789" />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Temporary Password</label>
              <PasswordInput value={form.password} onChange={setField('password')} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Confirm Password</label>
              <PasswordInput value={form.confirmPassword} onChange={setField('confirmPassword')} />
            </div>
          </div>
          <p style={{ margin: '0 0 18px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            8+ characters with an uppercase letter, a lowercase letter, a number, and a special character. Give it to the new admin and ask them to change it after signing in.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving...' : currentHolders.length ? 'Assign Admin' : 'Add Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={`Deactivate the current ${label}?`}
        message={`${form.name.trim() || 'The new admin'} will become the ${label}. ${(confirm || []).map((h) => `${h.name} (${h.email})`).join(', ')} will be deactivated, logged out of every device, and will no longer be able to sign in. This cannot be undone from this page.`}
        confirmLabel="Deactivate & Assign"
        busy={submitting}
        onCancel={() => setConfirm(null)}
        onConfirm={() => save(true)}
      />
    </>
  );
}
