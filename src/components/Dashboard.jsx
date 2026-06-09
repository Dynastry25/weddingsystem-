import React, { useState } from 'react';
import QRCode from 'qrcode';
import './Dashboard.css';

function Dashboard({ guests, onAddGuest, onDeleteGuest, onViewCard }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    status: 'single',
    venue: 'Ukumbi wa Harusi - Jitegemee Hall',
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
  });

  /* ── Derived stats ── */
  const total = guests.length;
  const attended = guests.filter((g) => g.attended).length;
  const pending = total - attended;
  const single = guests.filter((g) => g.status === 'single').length;
  const double_ = guests.filter((g) => g.status === 'double').length;
  const pct = total > 0 ? Math.round((attended / total) * 100) : 0;

  /* ── Helpers ── */
  const genCode = (name, phone) => {
    const n = name.substring(0, 3).toUpperCase();
    const p = phone.replace(/\D/g, '').substring(0, 4);
    const r = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${n}${p}${r}`;
  };

  const generateQRImage = async (data, code) => {
    try {
      return await QRCode.toDataURL(
        JSON.stringify({ uniqueCode: code, name: data.name, phone: data.phone, status: data.status }),
        { width: 200, margin: 2, color: { dark: '#3a1a2a', light: '#ffffff' } }
      );
    } catch {
      return null;
    }
  };

  const getCode = (guest) => {
    if (guest.qrCodeData?.uniqueCode) return guest.qrCodeData.uniqueCode;
    try { return JSON.parse(guest.qrCode)?.uniqueCode ?? 'N/A'; } catch { return 'N/A'; }
  };

  /* ── Form handlers ── */
  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      alert('Please enter name and phone number.');
      return;
    }
    const uniqueCode = genCode(formData.name, formData.phone);
    const qrImageUrl = await generateQRImage(formData, uniqueCode);
    onAddGuest({
      ...formData,
      qrCodeData: { uniqueCode, qrImageUrl, name: formData.name, phone: formData.phone, status: formData.status },
    });
    setFormData({
      name: '', phone: '', status: 'single',
      venue: 'Ukumbi wa Harusi - Jitegemee Hall',
      date: new Date().toISOString().split('T')[0],
      time: '14:00',
    });
    setShowForm(false);
  };

  const qrPreview =
    formData.name && formData.phone
      ? `${formData.name.substring(0, 3).toUpperCase()}${formData.phone.replace(/\D/g, '').substring(0, 4)}XXXX`
      : 'XXXX-XXXX-XXXX';

  return (
    <div className="dashboard">
      {/* ── Stats ── */}
      <div className="stats-grid">
        <div className="metric-card accent-rose">
          <div className="metric-label">Total guests</div>
          <div className="metric-value">{total}</div>
          <div className="metric-sub">invited</div>
        </div>

        <div className="metric-card accent-emerald">
          <div className="metric-label">Arrived</div>
          <div className="metric-value">{attended}</div>
          <div className="metric-sub">{pct}% attendance rate</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="metric-card accent-gold">
          <div className="metric-label">Pending</div>
          <div className="metric-value">{pending}</div>
          <div className="metric-sub">not yet arrived</div>
        </div>

        <div className="metric-card accent-sky">
          <div className="metric-label">Single / Double</div>
          <div className="metric-value">{single} / {double_}</div>
          <div className="metric-sub">invitation types</div>
        </div>
      </div>

      {/* ── Guest table ── */}
      <div className="table-card">
        <div className="table-card-head">
          <span className="table-card-title">Guest list</span>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <i className="ti ti-user-plus" aria-hidden="true" /> Add guest
          </button>
        </div>

        {guests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <i className="ti ti-confetti" aria-hidden="true" />
            </div>
            <div className="empty-title">No guests yet</div>
            <p className="empty-desc">Add your first guest to generate their invitation card.</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              <i className="ti ti-user-plus" aria-hidden="true" /> Add guest
            </button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="guest-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Card</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {guests.map((guest) => (
                  <tr key={guest.id}>
                    <td><code>{getCode(guest).substring(0, 12)}</code></td>
                    <td><strong>{guest.name}</strong></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{guest.phone}</td>
                    <td>
                      {guest.status === 'single'
                        ? <span className="badge badge-single">Single</span>
                        : <span className="badge badge-double">Double</span>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {guest.date || '—'}
                    </td>
                    <td>
                      {guest.attended
                        ? <span className="badge badge-attended">
                            <i className="ti ti-check" style={{ fontSize: 10 }} aria-hidden="true" /> Arrived
                          </span>
                        : <span className="badge badge-pending">
                            <i className="ti ti-clock" style={{ fontSize: 10 }} aria-hidden="true" /> Pending
                          </span>}
                    </td>
                    <td>
                      <button className="btn-view" onClick={() => onViewCard(guest)}>
                        <i className="ti ti-eye" style={{ fontSize: 12 }} aria-hidden="true" /> View
                      </button>
                    </td>
                    <td>
                      <button className="btn-danger" onClick={() => onDeleteGuest(guest.id)}>
                        <i className="ti ti-trash" style={{ fontSize: 12 }} aria-hidden="true" /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Floating action button ── */}
      <button className="fab" onClick={() => setShowForm(true)} aria-label="Add new guest">
        <i className="ti ti-plus" aria-hidden="true" />
      </button>

      {/* ── Add guest modal ── */}
      {showForm && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-guest-title"
        >
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title" id="add-guest-title">Add new guest</span>
              <button className="close-btn" onClick={() => setShowForm(false)} aria-label="Close">×</button>
            </div>

            <div className="modal-body">
              {/* QR preview */}
              <div className="qr-hint">
                <i className="ti ti-qrcode qr-hint-icon" aria-hidden="true" />
                <div>
                  <div className="qr-hint-code">{qrPreview}</div>
                  <div className="qr-hint-note">QR code generated automatically on save</div>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="f-name">Full name *</label>
                  <input
                    id="f-name" name="name" type="text"
                    value={formData.name} onChange={handleChange}
                    placeholder="e.g. Fatma Hassan" required autoFocus
                  />
                </div>

                <div className="field">
                  <label htmlFor="f-phone">Phone number *</label>
                  <input
                    id="f-phone" name="phone" type="tel"
                    value={formData.phone} onChange={handleChange}
                    placeholder="e.g. 0712345678" required
                  />
                </div>

                <div className="field">
                  <label htmlFor="f-status">Invitation type</label>
                  <select id="f-status" name="status" value={formData.status} onChange={handleChange}>
                    <option value="single">Single — 1 person</option>
                    <option value="double">Double — 2 people</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="f-venue">Venue</label>
                  <input
                    id="f-venue" name="venue" type="text"
                    value={formData.venue} onChange={handleChange}
                  />
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="f-date">Date</label>
                    <input id="f-date" name="date" type="date" value={formData.date} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="f-time">Time</label>
                    <input id="f-time" name="time" type="time" value={formData.time} onChange={handleChange} />
                  </div>
                </div>

                <div className="modal-foot" style={{ padding: 0, marginTop: 4 }}>
                  <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    <i className="ti ti-device-floppy" aria-hidden="true" /> Save & generate QR
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
