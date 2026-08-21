import React, { useState } from 'react';
import { KeyRound, ShieldPlus } from 'lucide-react';
import TopBar from '../components/TopBar';
import { authApi } from '../api/auth';
import { usersApi } from '../api/users';
import { errorMessage } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { currentUser, isSuperAdmin } = useAuth();

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Settings" showBreadcrumb={true} />
      <main style={{ padding: '24px', display: 'grid', gap: '24px', maxWidth: '640px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <KeyRound size={20} color="var(--maroon)" />
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Change Password</h2>
          </div>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Signed in as {currentUser?.name} ({currentUser?.email})
          </p>
          <ChangePasswordForm />
        </section>

        {isSuperAdmin && (
          <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <ShieldPlus size={20} color="var(--maroon)" />
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Create Admin Account</h2>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Create a new admin_cwts, admin_rotc, or super_admin account. This action is restricted to super admins.
            </p>
            <CreateAdminForm />
          </section>
        )}
      </main>
    </div>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!currentPassword || !newPassword) {
      setError('Please fill in both fields.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(errorMessage(err, 'Unable to change password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
      {error && <Banner tone="error">{error}</Banner>}
      {success && <Banner tone="success">{success}</Banner>}
      <Field label="Current Password"><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></Field>
      <Field label="New Password"><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 8 characters" /></Field>
      <Field label="Confirm New Password"><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></Field>
      <button type="submit" disabled={submitting} style={{ justifySelf: 'start', padding: '10px 22px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
        {submitting ? 'Updating...' : 'Update Password'}
      </button>
    </form>
  );
}

function CreateAdminForm() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin_cwts', program: 'CWTS' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Enter a valid email address.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters long.'); return; }

    setSubmitting(true);
    try {
      const payload = { name: form.name, email: form.email, password: form.password, role: form.role };
      if (form.role !== 'super_admin') payload.program = form.program;
      await usersApi.create(payload);
      setSuccess(`Account created for ${form.email}.`);
      setForm({ name: '', email: '', password: '', role: 'admin_cwts', program: 'CWTS' });
    } catch (err) {
      setError(errorMessage(err, 'Unable to create account.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
      {error && <Banner tone="error">{error}</Banner>}
      {success && <Banner tone="success">{success}</Banner>}
      <Field label="Full Name"><input value={form.name} onChange={e => update('name', e.target.value)} /></Field>
      <Field label="Email"><input type="email" value={form.email} onChange={e => update('email', e.target.value)} /></Field>
      <Field label="Password"><input type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="Min. 8 characters" /></Field>
      <Field label="Role">
        <select value={form.role} onChange={e => update('role', e.target.value)}>
          <option value="admin_cwts">CWTS Administrator</option>
          <option value="admin_rotc">ROTC Administrator</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </Field>
      {form.role !== 'super_admin' && (
        <Field label="Program"><select value={form.program} onChange={e => update('program', e.target.value)}><option value="CWTS">CWTS</option><option value="ROTC">ROTC</option></select></Field>
      )}
      <button type="submit" disabled={submitting} style={{ justifySelf: 'start', padding: '10px 22px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
        {submitting ? 'Creating...' : 'Create Account'}
      </button>
    </form>
  );
}

function Banner({ tone, children }) {
  const styles = tone === 'error'
    ? { background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C' }
    : { background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857' };
  return <div style={{ ...styles, borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px' }}>{children}</div>;
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: '6px', fontSize: '12.5px', fontWeight: 700 }}>
      {label}
      {React.cloneElement(children, { style: { width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '7px', fontFamily: 'inherit', fontSize: '13px', outline: 'none', color: 'var(--text-primary)' } })}
    </label>
  );
}
