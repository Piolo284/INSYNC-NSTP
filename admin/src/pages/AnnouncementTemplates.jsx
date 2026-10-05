import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Megaphone, UploadCloud, Trash2, Plus, Image as ImageIcon } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApi, errorMessage } from '../hooks/useApi';
import { announcementTemplatesApi } from '../api/announcementTemplates';
import { ANNOUNCEMENT_FIELDS, resolveTemplateImageUrl } from '../utils/announcementGenerator';

export default function AnnouncementTemplates() {
  const [program, setProgram] = useState('CWTS');

  const fetcher = useCallback(async () => {
    const res = await announcementTemplatesApi.get(program);
    return res.data || null;
  }, [program]);

  const { data: template, loading, error, refetch } = useApi(fetcher, [fetcher]);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Announcement Templates" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '560px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <Megaphone size={22} color="var(--text-primary)" strokeWidth={2.2} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Announcement Templates</h2>
          </div>
          <p style={{ margin: '6px 0 18px', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '70ch' }}>
            Upload a branded background per program and mark where each announcement's details go. When an admin
            posts a new announcement, the system generates a poster image from this layout automatically.
          </p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {['CWTS', 'ROTC'].map((p) => (
              <button
                key={p}
                onClick={() => setProgram(p)}
                style={{
                  padding: '8px 20px', borderRadius: '8px', border: '1.5px solid var(--maroon)',
                  background: program === p ? 'var(--maroon)' : 'transparent',
                  color: program === p ? '#fff' : 'var(--maroon)',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {p}
              </button>
            ))}
          </div>

          <AsyncSection loading={loading} error={error} onRetry={refetch} minHeight="300px">
            {template ? (
              <TemplateDesigner key={program} program={program} template={template} onChanged={refetch} />
            ) : (
              <TemplateUploader program={program} onUploaded={refetch} />
            )}
          </AsyncSection>
        </section>
      </main>
    </div>
  );
}

function TemplateUploader({ program, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const dims = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('That file could not be read as an image.'));
        img.src = URL.createObjectURL(file);
      });
      await announcementTemplatesApi.upload(program, file, dims.width, dims.height);
      onUploaded();
    } catch (err) {
      setError(errorMessage(err, 'Unable to upload that image.'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '16px' }}>{error}</div>}
      <label
        onClick={() => inputRef.current?.click()}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
          padding: '60px 20px', border: '1.5px dashed var(--border)', borderRadius: '12px',
          cursor: 'pointer', background: '#FAFAFA',
        }}
      >
        <UploadCloud size={28} color="var(--text-secondary)" />
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {uploading ? 'Uploading...' : `Upload the ${program} announcement background`}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>PNG or JPG, ideally the same size you'd post</span>
        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          onChange={(e) => handleFile(e.target.files[0] || null)}
          style={{ display: 'none' }}
          disabled={uploading}
        />
      </label>
    </div>
  );
}

function TemplateDesigner({ program, template, onChanged }) {
  const [fields, setFields] = useState(template.fields || []);
  const [selectedKey, setSelectedKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const containerRef = useRef(null);
  const dragKeyRef = useRef(null);
  const replaceInputRef = useRef(null);

  const imageSrc = resolveTemplateImageUrl(template.imageUrl);
  const availableFields = ANNOUNCEMENT_FIELDS.filter((f) => !fields.some((placed) => placed.key === f.key));
  const selected = fields.find((f) => f.key === selectedKey) || null;

  const updateField = (key, patch) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
    setDirty(true);
  };

  const addField = (key) => {
    setFields((prev) => [...prev, { key, x: 50, y: 50, fontSize: 24, color: '#000000', fontWeight: 'normal', align: 'center' }]);
    setSelectedKey(key);
    setDirty(true);
  };

  const removeField = (key) => {
    setFields((prev) => prev.filter((f) => f.key !== key));
    if (selectedKey === key) setSelectedKey(null);
    setDirty(true);
  };

  const onMarkerMouseDown = (key) => (e) => {
    e.preventDefault();
    dragKeyRef.current = key;
    setSelectedKey(key);
  };

  useEffect(() => {
    const onMove = (e) => {
      const key = dragKeyRef.current;
      if (!key || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
      updateField(key, { x, y });
    };
    const onUp = () => { dragKeyRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await announcementTemplatesApi.updateFields(program, fields);
      setDirty(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save the layout.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReplace = async (file) => {
    if (!file) return;
    setError('');
    try {
      const dims = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('That file could not be read as an image.'));
        img.src = URL.createObjectURL(file);
      });
      await announcementTemplatesApi.upload(program, file, dims.width, dims.height);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, 'Unable to upload that image.'));
    }
  };

  const handleRemoveTemplate = async () => {
    setRemoving(true);
    try {
      await announcementTemplatesApi.remove(program);
      setRemoveConfirm(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, 'Unable to remove the template.'));
      setRemoving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px', alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Drag a field onto the poster to position it.</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => replaceInputRef.current?.click()} style={secondaryBtnStyle}>
              <ImageIcon size={14} /> Replace Image
            </button>
            <input ref={replaceInputRef} type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(e) => handleReplace(e.target.files[0] || null)} style={{ display: 'none' }} />
            <button onClick={() => setRemoveConfirm(true)} style={{ ...secondaryBtnStyle, borderColor: '#DC2626', color: '#DC2626' }}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '14px' }}>{error}</div>}

        <div
          ref={containerRef}
          style={{ position: 'relative', width: '100%', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', userSelect: 'none' }}
        >
          <img src={imageSrc} alt={`${program} announcement template`} style={{ width: '100%', display: 'block' }} draggable={false} />
          {fields.map((f) => {
            const meta = ANNOUNCEMENT_FIELDS.find((c) => c.key === f.key);
            const isSelected = f.key === selectedKey;
            return (
              <div
                key={f.key}
                onMouseDown={onMarkerMouseDown(f.key)}
                style={{
                  position: 'absolute', left: `${f.x}%`, top: `${f.y}%`, transform: 'translate(-50%, -50%)',
                  padding: '4px 8px', borderRadius: '6px', cursor: 'grab', whiteSpace: 'nowrap',
                  background: isSelected ? 'rgba(155,28,67,0.15)' : 'rgba(255,255,255,0.75)',
                  border: isSelected ? '1.5px dashed var(--maroon)' : '1.5px dashed rgba(0,0,0,0.25)',
                  fontSize: `${Math.max(10, Math.min(f.fontSize, 28))}px`,
                  fontWeight: f.fontWeight === 'bold' ? 700 : 500,
                  color: f.color,
                  textAlign: f.align,
                }}
                title="Drag to reposition"
              >
                {meta?.label || f.key}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <AddFieldMenu options={availableFields} onAdd={addField} />
          </div>
          <button onClick={handleSave} disabled={saving || !dirty} style={{
            padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff',
            fontSize: '13px', fontWeight: 700, cursor: (saving || !dirty) ? 'default' : 'pointer', fontFamily: 'inherit',
            opacity: (saving || !dirty) ? 0.5 : 1,
          }}>
            {saving ? 'Saving...' : dirty ? 'Save Layout' : 'Saved'}
          </button>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', position: 'sticky', top: '16px' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700 }}>Field Style</h4>
        {!selected ? (
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Select a field on the poster to edit its style, or remove it.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700 }}>{ANNOUNCEMENT_FIELDS.find((c) => c.key === selected.key)?.label}</p>
            <label style={{ display: 'grid', gap: '4px', fontSize: '11.5px', fontWeight: 600 }}>
              Font size
              <input type="number" min={8} max={96} value={selected.fontSize} onChange={(e) => updateField(selected.key, { fontSize: Number(e.target.value) || 24 })} style={fieldInputStyle} />
            </label>
            <label style={{ display: 'grid', gap: '4px', fontSize: '11.5px', fontWeight: 600 }}>
              Color
              <input type="color" value={selected.color} onChange={(e) => updateField(selected.key, { color: e.target.value })} style={{ ...fieldInputStyle, padding: '2px', height: '32px' }} />
            </label>
            <label style={{ display: 'grid', gap: '4px', fontSize: '11.5px', fontWeight: 600 }}>
              Weight
              <select value={selected.fontWeight} onChange={(e) => updateField(selected.key, { fontWeight: e.target.value })} style={fieldInputStyle}>
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: '4px', fontSize: '11.5px', fontWeight: 600 }}>
              Align
              <select value={selected.align} onChange={(e) => updateField(selected.key, { align: e.target.value })} style={fieldInputStyle}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
            <button onClick={() => removeField(selected.key)} style={{ ...secondaryBtnStyle, borderColor: '#DC2626', color: '#DC2626', justifyContent: 'center' }}>
              <Trash2 size={14} /> Remove Field
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={removeConfirm}
        title="Remove this template?"
        message={`The ${program} announcement template and its field layout will be deleted. New announcements will no longer auto-generate a poster for this program.`}
        confirmLabel="Remove"
        busy={removing}
        onConfirm={handleRemoveTemplate}
        onCancel={() => setRemoveConfirm(false)}
      />
    </div>
  );
}

function AddFieldMenu({ options, onAdd }) {
  const [open, setOpen] = useState(false);
  if (options.length === 0) {
    return <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>All available fields are placed.</span>;
  }
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} style={secondaryBtnStyle}>
        <Plus size={14} /> Add Field
      </button>
      {open && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow-lg)', zIndex: 10, minWidth: '200px', overflow: 'hidden' }}>
          {options.map((f) => (
            <button
              key={f.key}
              onClick={() => { onAdd(f.key); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 0, background: 'none', cursor: 'pointer', fontSize: '12.5px', fontFamily: 'inherit' }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const secondaryBtnStyle = {
  display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px',
  border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text-primary)',
  fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};

const fieldInputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)',
  fontSize: '12.5px', fontFamily: 'inherit', outline: 'none',
};
