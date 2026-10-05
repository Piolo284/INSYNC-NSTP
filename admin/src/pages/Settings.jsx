import React, { useRef, useState } from 'react';
import { ImagePlus, KeyRound } from 'lucide-react';
import TopBar from '../components/TopBar';
import ConfirmDialog from '../components/ConfirmDialog';
import { authApi } from '../api/auth';
import { usersApi } from '../api/users';
import { resolveFileUrl } from '../api/client';
import { errorMessage } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { currentUser } = useAuth();

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Settings" showBreadcrumb={true} />
      <main style={{ padding: '24px', display: 'grid', gap: '24px', maxWidth: '640px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <ImagePlus size={20} color="var(--maroon)" />
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Profile Picture</h2>
          </div>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            This photo appears next to your name in the sidebar.
          </p>
          <ProfilePictureForm />
        </section>

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
      </main>
    </div>
  );
}

function ProfilePictureForm() {
  const { currentUser, updateCurrentUser } = useAuth();
  const inputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const initials = (currentUser?.name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  const avatarSrc = currentUser?.profileImage ? resolveFileUrl(currentUser.profileImage) : '';

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setSuccess('');
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setError('Please choose a PNG, JPG, or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5MB or smaller.');
      return;
    }

    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  };

  const cancelPending = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
  };

  const confirmUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const res = await usersApi.uploadAvatar(pendingFile);
      updateCurrentUser(res.data);
      setSuccess('Profile picture updated.');
      cancelPending();
    } catch (err) {
      setError(errorMessage(err, 'Unable to upload profile picture.'));
      cancelPending();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      {error && <Banner tone="error">{error}</Banner>}
      {success && <Banner tone="success">{success}</Banner>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div style={{
          width: '84px', height: '84px', borderRadius: '50%', overflow: 'hidden',
          background: 'var(--maroon)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border)',
        }}>
          {avatarSrc ? (
            <img src={avatarSrc} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '26px', fontWeight: 700, color: '#fff' }}>{initials || '?'}</span>
          )}
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: uploading ? 0.7 : 1 }}
          >
            Change Photo
          </button>
          <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            PNG, JPG, or WEBP. Max 5MB.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingFile}
        danger={false}
        title="Update profile picture?"
        message={
          <span style={{ display: 'grid', gap: '12px' }}>
            <span>This will replace your current profile picture everywhere it's shown, including the sidebar.</span>
            {pendingPreview && (
              <img
                src={pendingPreview}
                alt="New profile preview"
                style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
              />
            )}
          </span>
        }
        confirmLabel="Update Photo"
        busy={uploading}
        onConfirm={confirmUpload}
        onCancel={cancelPending}
      />
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
