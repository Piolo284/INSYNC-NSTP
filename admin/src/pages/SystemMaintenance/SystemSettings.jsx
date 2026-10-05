import React, { useCallback, useEffect, useState } from 'react';
import { Settings2, AlertTriangle, GraduationCap } from 'lucide-react';
import TopBar from '../../components/TopBar';
import AsyncSection from '../../components/AsyncSection';
import { useApi, errorMessage } from '../../hooks/useApi';
import { systemConfigApi } from '../../api/systemConfig';

function toLocalInputValue(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SystemSettings() {
  const fetcher = useCallback(() => systemConfigApi.get(), []);
  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const config = data?.data;

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="System Maintenance" showBreadcrumb />
      <main style={{ padding: '24px', display: 'grid', gap: '24px', maxWidth: '640px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
          System Settings
        </h2>

        <AsyncSection loading={loading} error={error} onRetry={refetch} minHeight="140px">
          {config && (
            <>
              <GeneralSettingsForm config={config} onSaved={refetch} />
              <MaintenanceSettingsForm config={config} onSaved={refetch} />
              <GradingSettingsForm config={config} onSaved={refetch} />
            </>
          )}
        </AsyncSection>
      </main>
    </div>
  );
}

function GeneralSettingsForm({ config, onSaved }) {
  const [orgName, setOrgName] = useState(config.general?.orgName || '');
  const [supportEmail, setSupportEmail] = useState(config.general?.supportEmail || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await systemConfigApi.updateGeneral({ orgName, supportEmail });
      setSuccess('General settings saved.');
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save settings.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Section icon={Settings2} title="General">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
        {error && <Banner tone="error">{error}</Banner>}
        {success && <Banner tone="success">{success}</Banner>}
        <Field label="System Name"><input value={orgName} onChange={e => setOrgName(e.target.value)} /></Field>
        <Field label="Support Email"><input type="email" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} /></Field>
        <SaveButton submitting={submitting} />
      </form>
    </Section>
  );
}

function MaintenanceSettingsForm({ config, onSaved }) {
  const [enabled, setEnabled] = useState(Boolean(config.maintenance?.enabled));
  const [message, setMessage] = useState(config.maintenance?.message || '');
  const [scheduledStart, setScheduledStart] = useState(toLocalInputValue(config.maintenance?.scheduledStart));
  const [scheduledEnd, setScheduledEnd] = useState(toLocalInputValue(config.maintenance?.scheduledEnd));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setEnabled(Boolean(config.maintenance?.enabled));
    setMessage(config.maintenance?.message || '');
    setScheduledStart(toLocalInputValue(config.maintenance?.scheduledStart));
    setScheduledEnd(toLocalInputValue(config.maintenance?.scheduledEnd));
  }, [config]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await systemConfigApi.updateMaintenance({
        enabled,
        message,
        scheduledStart: scheduledStart || null,
        scheduledEnd: scheduledEnd || null,
      });
      setSuccess('Maintenance settings saved.');
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save maintenance settings.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Section icon={AlertTriangle} title="Maintenance Mode">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
        {error && <Banner tone="error">{error}</Banner>}
        {success && <Banner tone="success">{success}</Banner>}
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 700 }}>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={{ width: '16px', height: '16px' }} />
          Enable Maintenance Mode
        </label>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
          While enabled, every account except this one is blocked from the system and shown the message below.
        </p>
        <Field label="Maintenance Message">
          <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} />
        </Field>
        <Field label="Scheduled Start (optional)"><input type="datetime-local" value={scheduledStart} onChange={e => setScheduledStart(e.target.value)} /></Field>
        <Field label="Scheduled End (optional)"><input type="datetime-local" value={scheduledEnd} onChange={e => setScheduledEnd(e.target.value)} /></Field>
        <SaveButton submitting={submitting} />
      </form>
    </Section>
  );
}

function GradingSettingsForm({ config, onSaved }) {
  const [program, setProgram] = useState('CWTS');

  return (
    <Section icon={GraduationCap} title="Grade Computation Weights">
      <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        How much each component counts toward a trainee's final grade — modules, activities, and attendance must
        total exactly 100 for each program. Leave a program unset to keep the shared .env default.
      </p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['CWTS', 'ROTC'].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setProgram(p)}
            style={{
              padding: '6px 16px', borderRadius: '8px', border: '1.5px solid var(--maroon)',
              background: program === p ? 'var(--maroon)' : 'transparent',
              color: program === p ? '#fff' : 'var(--maroon)',
              fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {p}
          </button>
        ))}
      </div>
      <GradingProgramForm key={program} program={program} config={config} onSaved={onSaved} />
    </Section>
  );
}

function GradingProgramForm({ program, config, onSaved }) {
  const override = config.grading?.[program]?.weights;
  const hasOverride = Boolean(override && override.modules != null && override.activities != null && override.attendance != null);
  const [modules, setModules] = useState(hasOverride ? override.modules : 30);
  const [activities, setActivities] = useState(hasOverride ? override.activities : 40);
  const [attendance, setAttendance] = useState(hasOverride ? override.attendance : 30);
  const [usingDefault, setUsingDefault] = useState(!hasOverride);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const total = Number(modules) + Number(activities) + Number(attendance);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (total !== 100) {
      setError(`Weights must total 100 (currently ${total}).`);
      return;
    }
    setSubmitting(true);
    try {
      await systemConfigApi.updateGrading({
        program,
        weights: { modules: Number(modules), activities: Number(activities), attendance: Number(attendance) },
      });
      setUsingDefault(false);
      setSuccess(`${program} grading weights saved.`);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save grading weights.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetToDefault = async () => {
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await systemConfigApi.updateGrading({ program, weights: null });
      setUsingDefault(true);
      setSuccess(`${program} now uses the shared .env default.`);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Unable to reset grading weights.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
      {error && <Banner tone="error">{error}</Banner>}
      {success && <Banner tone="success">{success}</Banner>}
      {usingDefault && (
        <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          {program} currently uses the shared .env default. Saving below sets a {program}-specific override.
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <Field label="Modules %"><input type="number" min="0" max="100" value={modules} onChange={(e) => setModules(e.target.value)} /></Field>
        <Field label="Activities %"><input type="number" min="0" max="100" value={activities} onChange={(e) => setActivities(e.target.value)} /></Field>
        <Field label="Attendance %"><input type="number" min="0" max="100" value={attendance} onChange={(e) => setAttendance(e.target.value)} /></Field>
      </div>
      <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: total === 100 ? '#059669' : '#DC2626' }}>
        Total: {total}{total !== 100 ? ' (must equal 100)' : ''}
      </p>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <SaveButton submitting={submitting} />
        {!usingDefault && (
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={submitting}
            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Reset
          </button>
        )}
      </div>
    </form>
  );
}

function SaveButton({ submitting }) {
  return (
    <button type="submit" disabled={submitting} style={{ justifySelf: 'start', padding: '10px 22px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
      {submitting ? 'Saving...' : 'Save'}
    </button>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <Icon size={20} color="var(--maroon)" />
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{title}</h3>
      </div>
      {children}
    </section>
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
