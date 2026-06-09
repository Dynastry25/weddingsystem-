import React, { useState, useEffect, useRef } from 'react';
import './QRScanner.css';

function QRScanner({ guests, onUpdateAttendance }) {
  const [scanInput, setScanInput] = useState('');
  const [result, setResult] = useState(null);   // { type: 'success'|'error', message }
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const getCode = (guest) => {
    if (guest.qrCodeData?.uniqueCode) return guest.qrCodeData.uniqueCode;
    try { return JSON.parse(guest.qrCode)?.uniqueCode ?? null; } catch { return null; }
  };

  const handleScan = () => {
    const raw = scanInput.trim();
    if (!raw) {
      alert('Please enter or scan a QR code.');
      return;
    }

    let code = raw;
    try { code = JSON.parse(raw).uniqueCode; } catch { /* raw string, use as-is */ }

    const guest = guests.find((g) => getCode(g) === code);

    if (!guest) {
      setResult({ type: 'error', message: 'QR code not recognised. Please check with the host.' });
    } else if (guest.attended) {
      const t = guest.attendanceTime
        ? new Date(guest.attendanceTime).toLocaleTimeString()
        : 'earlier';
      setResult({ type: 'error', message: `${guest.name} already checked in at ${t}.` });
    } else {
      onUpdateAttendance(guest.id);
      setResult({
        type: 'success',
        message: `Welcome, ${guest.name}! Check-in confirmed at ${new Date().toLocaleTimeString()}.`,
      });
    }

    setScanInput('');
    inputRef.current?.focus();
  };

  const recentAttendees = guests.filter((g) => g.attended).slice(0, 8);

  return (
    <div className="qr-scanner">
      {/* ── Input area ── */}
      <div className="scan-card">
        <span className="scan-section-label">Enter or scan QR code</span>
        <div className="scan-input-row">
          <input
            ref={inputRef}
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleScan(); }}
            placeholder="Paste QR data or scan with a device scanner…"
          />
          <button className="btn-primary" onClick={handleScan}>
            <i className="ti ti-scan" aria-hidden="true" /> Verify
          </button>
        </div>
      </div>

      {/* ── Result banner ── */}
      {result && (
        <div className={`result-banner ${result.type}`}>
          <i
            className={`ti ${result.type === 'success' ? 'ti-circle-check' : 'ti-x-circle'} result-icon`}
            aria-hidden="true"
          />
          <span className="result-msg">{result.message}</span>
        </div>
      )}

      {/* ── Recent arrivals ── */}
      <div className="scan-card">
        <span className="scan-section-label">Recent arrivals</span>
        {recentAttendees.length > 0 ? (
          <div className="recent-list">
            {recentAttendees.map((g) => (
              <div key={g.id} className="recent-item">
                <div className="avatar">{g.name.charAt(0).toUpperCase()}</div>
                <span className="recent-name">{g.name}</span>
                <span className="recent-time">
                  {g.attendanceTime ? new Date(g.attendanceTime).toLocaleTimeString() : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-data">No arrivals yet.</p>
        )}
      </div>

      {/* ── Instructions ── */}
      <div className="scan-card">
        <span className="scan-section-label">How to use</span>
        <ul className="instr-list">
          <li>
            <i className="ti ti-scan" aria-hidden="true" />
            Scan the QR code printed on the guest's invitation card
          </li>
          <li>
            <i className="ti ti-check" aria-hidden="true" />
            Each code can only be used once — duplicates are flagged automatically
          </li>
          <li>
            <i className="ti ti-alert-circle" aria-hidden="true" />
            If a scan fails, ask the guest to show their physical card and enter the code manually
          </li>
          <li>
            <i className="ti ti-id" aria-hidden="true" />
            Contact the host if a guest's code cannot be found in the system
          </li>
        </ul>
      </div>
    </div>
  );
}

export default QRScanner;
