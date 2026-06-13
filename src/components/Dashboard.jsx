import React, { useState, useEffect, useCallback } from 'react';
import './Dashboard.css';

const API = 'https://uscftakwimu-11.onrender.com/api/wedding-guests';

const genCode = (name) => {
  const n = name.replace(/\s/g, '').substring(0, 4).toUpperCase();
  const r = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${n}-${r}`;
};

function Dashboard({ guests, setGuests, onViewCard }) {
  const [showForm, setShowForm] = useState(false);
  const [name,     setName]     = useState('');
  const [status,   setStatus]   = useState('single');
  const [saving,   setSaving]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  /* ── derived stats ── */
  const total    = guests.length;
  const attended = guests.filter((g) => g.attended).length;
  const pending  = total - attended;
  const single   = guests.filter((g) => g.status === 'single').length;
  const double_  = guests.filter((g) => g.status === 'double').length;
  const pct      = total > 0 ? Math.round((attended / total) * 100) : 0;

  /* ── normalise Mongo _id vs local id ── */
  const gid = (g) => g._id || g.id;

  /* ── fetch all guests from server ── */
  const fetchGuests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(API);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Hitilafu ya seva');
      setGuests(json.data);
    } catch (e) {
      setError('Imeshindwa kupakia orodha: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [setGuests]);

  useEffect(() => { fetchGuests(); }, [fetchGuests]);

  /* ── add new guest ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { alert('Tafadhali ingiza jina.'); return; }

    setSaving(true);
    setError(null);

    const uniqueCode = genCode(name);
    const payload = {
      name:      name.trim(),
      status,
      qrCodeData: { uniqueCode, name: name.trim(), status },
    };

    try {
      const res  = await fetch(API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Hitilafu ya seva');

      setGuests((prev) => [json.data, ...prev]);
      setName('');
      setStatus('single');
      setShowForm(false);
    } catch (e) {
      setError('Imeshindwa kuongeza mgeni: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── delete guest (soft-delete via API) ── */
  const handleDelete = async (id) => {
    if (!window.confirm('Je, una uhakika unataka kufuta mwalikwa huyu?')) return;
    try {
      const res  = await fetch(`${API}/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      setGuests((prev) => prev.filter((g) => gid(g) !== id));
    } catch (e) {
      alert('Imeshindwa kufuta: ' + e.message);
    }
  };

  return (
    <div className="dashboard">

      {/* ── error banner ── */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ── stats ── */}
      <div className="stats-grid">
        <div className="metric-card accent-rose">
          <div className="metric-label">Wageni wote</div>
          <div className="metric-value">{loading ? '…' : total}</div>
          <div className="metric-sub">waliombwa</div>
        </div>
        <div className="metric-card accent-emerald">
          <div className="metric-label">Waliowasili</div>
          <div className="metric-value">{loading ? '…' : attended}</div>
          <div className="metric-sub">{pct}% ya wageni</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="metric-card accent-gold">
          <div className="metric-label">Wanasubiri</div>
          <div className="metric-value">{loading ? '…' : pending}</div>
          <div className="metric-sub">hawajafika bado</div>
        </div>
        <div className="metric-card accent-sky">
          <div className="metric-label">Single / Double</div>
          <div className="metric-value">{loading ? '…' : `${single} / ${double_}`}</div>
          <div className="metric-sub">aina za mwaliko</div>
        </div>
      </div>

      {/* ── table ── */}
      <div className="table-card">
        <div className="table-card-head">
          <span className="table-card-title">Orodha ya Wageni</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={fetchGuests} disabled={loading}>
              {loading ? '⏳' : '🔄'} Refresh
            </button>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              + Ongeza Mgeni
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <div className="empty-title">Inapakia orodha kutoka seva…</div>
          </div>
        ) : guests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💌</div>
            <div className="empty-title">Hakuna mgeni bado</div>
            <p className="empty-desc">Ongeza mgeni wa kwanza ili utoe kadi yake ya mwaliko.</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              + Ongeza Mgeni
            </button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="guest-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jina</th>
                  <th>Aina</th>
                  <th>Hali</th>
                  <th>Kadi</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g, i) => (
                  <tr key={gid(g)}>
                    <td><code>{i + 1}</code></td>
                    <td><strong>{g.name}</strong></td>
                    <td>
                      {g.status === 'single'
                        ? <span className="badge badge-single">Single</span>
                        : <span className="badge badge-double">Double</span>}
                    </td>
                    <td>
                      {g.attended
                        ? <span className="badge badge-attended">✓ Aliwasili</span>
                        : <span className="badge badge-pending">⏳ Anasubiri</span>}
                    </td>
                    <td>
                      <button className="btn-view" onClick={() => onViewCard(g)}>
                        👁 Tazama
                      </button>
                    </td>
                    <td>
                      <button className="btn-danger" onClick={() => handleDelete(gid(g))}>
                        🗑 Futa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── FAB ── */}
      <button className="fab" onClick={() => setShowForm(true)} aria-label="Ongeza mgeni">+</button>

      {/* ── modal ── */}
      {showForm && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
          role="dialog" aria-modal="true" aria-labelledby="modal-title"
        >
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title" id="modal-title">Ongeza Mgeni Mpya</span>
              <button className="close-btn" onClick={() => setShowForm(false)} aria-label="Funga">×</button>
            </div>

            <div className="modal-body">
              <div className="card-hint">
                <div className="card-hint-icon"></div>
                <div>
                  <div className="card-hint-heading">Kadi ya Mwaliko</div>
                  <div className="card-hint-sub">
                    Kadi itahifadhiwa kwenye seva na kutengenezwa moja kwa moja
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="f-name">Jina kamili *</label>
                  <input
                    id="f-name" type="text" value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="mf. Amina Juma Hassan"
                    required autoFocus disabled={saving}
                  />
                </div>

                <div className="field">
                  <label>Aina ya Mwaliko *</label>
                  <div className="status-toggle">
                    <button
                      type="button"
                      className={`toggle-opt${status === 'single' ? ' selected' : ''}`}
                      onClick={() => setStatus('single')}
                      disabled={saving}
                    >
                      <span className="toggle-icon">👤</span>
                      <span className="toggle-label">Single</span>
                      <span className="toggle-desc">Mtu 1</span>
                    </button>
                    <button
                      type="button"
                      className={`toggle-opt${status === 'double' ? ' selected' : ''}`}
                      onClick={() => setStatus('double')}
                      disabled={saving}
                    >
                      <span className="toggle-icon">👥</span>
                      <span className="toggle-label">Double</span>
                      <span className="toggle-desc">Watu 2</span>
                    </button>
                  </div>
                </div>

                <div className="modal-foot" style={{ padding: 0, marginTop: 8 }}>
                  <button
                    type="button" className="btn-ghost"
                    onClick={() => setShowForm(false)} disabled={saving}
                  >
                    Ghairi
                  </button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? '⏳ Inahifadhi…' : '💾 Hifadhi & Tengeneza Kadi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
