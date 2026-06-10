import React, { useState, useEffect, useRef, useCallback } from 'react';
import './QRScanner.css';

const API = 'https://uscftakwimu-11.onrender.com/api/wedding-guests';

/* ─── tiny jsQR loader from CDN (no npm needed) ─── */
const loadJsQR = () =>
  new Promise((resolve) => {
    if (window.jsQR) { resolve(window.jsQR); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.min.js';
    s.onload = () => resolve(window.jsQR);
    document.head.appendChild(s);
  });

/* ─── flow states ─── */
const PHASE = {
  IDLE:     'idle',      // camera off, waiting to start
  SCANNING: 'scanning',  // camera live, hunting for QR
  LOADING:  'loading',   // found code, querying API
  FOUND:    'found',     // guest data returned, show info + approve
  NOT_FOUND:'not_found', // code not in DB
  ALREADY:  'already',   // already attended
  CONFIRMED:'confirmed', // just confirmed attendance
};

function QRScanner({ guests, setGuests }) {
  const [phase,        setPhase]        = useState(PHASE.IDLE);
  const [guestData,    setGuestData]    = useState(null);
  const [lastCode,     setLastCode]     = useState('');
  const [approving,    setApproving]    = useState(false);
  const [camError,     setCamError]     = useState(null);
  const [manualInput,  setManualInput]  = useState('');
  const [sessionLog,   setSessionLog]   = useState([]); // confirmed this session

  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const rafRef      = useRef(null);
  const jsQRRef     = useRef(null);
  const lastScanRef = useRef('');   // debounce same code

  /* ── stop camera ── */
  const stopCamera = useCallback(() => {
    if (rafRef.current)  { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  /* ── lookup uniqueCode against API ── */
  const lookupCode = useCallback(async (rawCode) => {
    if (lastScanRef.current === rawCode) return; // debounce same code
    lastScanRef.current = rawCode;

    stopCamera();
    setPhase(PHASE.LOADING);
    setLastCode(rawCode);

    let uniqueCode = rawCode;
    try { uniqueCode = JSON.parse(rawCode).uniqueCode; } catch { /* raw */ }

    try {
      /* We call GET all and find locally, OR you can add GET /api/wedding-guests/lookup/:code */
      /* Using the scan endpoint (POST) which returns guest data regardless of attended status */
      const res  = await fetch(`${API}/scan`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uniqueCode, dryRun: true }), // dryRun flag — server can ignore
      });
      const json = await res.json();

      if (res.status === 404 || (!json.success && !json.data)) {
        setPhase(PHASE.NOT_FOUND);
        return;
      }

      /* guest returned (whether attended or not) */
      const guest = json.data;
      setGuestData(guest);

      if (guest.attended) {
        setPhase(PHASE.ALREADY);
      } else {
        setPhase(PHASE.FOUND);
      }
    } catch (e) {
      setCamError('Hitilafu ya mtandao: ' + e.message);
      setPhase(PHASE.IDLE);
    }
  }, [stopCamera]);

  /* ── QR scan loop ── */
  const startScanLoop = useCallback(() => {
    const tick = () => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return; }

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code    = jsQRRef.current?.(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code?.data) {
        lookupCode(code.data);
        return; // stop loop after find
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [lookupCode]);

  /* ── start camera ── */
  const startCamera = useCallback(async () => {
    setCamError(null);
    lastScanRef.current = '';
    setGuestData(null);
    setPhase(PHASE.SCANNING);

    try {
      jsQRRef.current = await loadJsQR();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      startScanLoop();
    } catch (e) {
      setCamError(
        e.name === 'NotAllowedError'
          ? 'Ruhusa ya kamera ilikataliwa. Tafadhali ruhusu kamera kwenye kivinjari.'
          : 'Kamera haikupatikana: ' + e.message
      );
      setPhase(PHASE.IDLE);
    }
  }, [startScanLoop]);

  /* ── approve / confirm attendance ── */
  const handleApprove = async () => {
    if (!guestData) return;
    setApproving(true);

    const uniqueCode = guestData.qrCodeData?.uniqueCode;

    try {
      const res  = await fetch(`${API}/scan`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uniqueCode }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        const updated = { ...guestData, attended: true, attendanceTime: new Date().toISOString() };
        setGuestData(updated);

        /* update parent guest list */
        setGuests((prev) =>
          prev.map((g) =>
            (g.qrCodeData?.uniqueCode === uniqueCode || g._id === guestData._id)
              ? updated : g
          )
        );

        /* add to session log */
        setSessionLog((prev) => [updated, ...prev]);
        setPhase(PHASE.CONFIRMED);
      } else {
        /* might have been confirmed by another device in the meantime */
        setPhase(PHASE.ALREADY);
      }
    } catch (e) {
      setCamError('Hitilafu ya mtandao: ' + e.message);
    } finally {
      setApproving(false);
    }
  };

  /* ── manual code submit ── */
  const handleManual = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    lookupCode(manualInput.trim());
    setManualInput('');
  };

  /* ── reset back to idle/scan ── */
  const reset = () => {
    lastScanRef.current = '';
    setGuestData(null);
    setPhase(PHASE.IDLE);
    setCamError(null);
  };

  /* ── recent arrivals ── */
  const recentAttendees = guests
    .filter((g) => g.attended)
    .sort((a, b) => new Date(b.attendanceTime) - new Date(a.attendanceTime))
    .slice(0, 6);

  /* ══════════════════════════════════════════════ RENDER */
  return (
    <div className="qs-wrap">

      {/* ── CAMERA / SCANNER CARD ── */}
      <div className="qs-card">
        <div className="qs-card-head">
          <span className="qs-card-title">📷 Scan QR Code ya Mwalikwa</span>
          {phase === PHASE.SCANNING && (
            <span className="qs-pulse-dot" aria-label="Camera inafanya kazi" />
          )}
        </div>

        {/* video viewport */}
        <div className={`qs-viewport ${phase === PHASE.SCANNING ? 'active' : ''}`}>
          <video ref={videoRef} className="qs-video" playsInline muted autoPlay />
          <canvas ref={canvasRef} className="qs-canvas" />

          {/* overlay corners */}
          {phase === PHASE.SCANNING && (
            <div className="qs-corners" aria-hidden="true">
              <div className="qs-corner tl" /><div className="qs-corner tr" />
              <div className="qs-corner bl" /><div className="qs-corner br" />
              <div className="qs-scan-line" />
            </div>
          )}

          {/* idle placeholder */}
          {phase === PHASE.IDLE && (
            <div className="qs-placeholder">
              <div className="qs-placeholder-icon">📷</div>
              <p>Bonyeza "Washa Camera" kuanza ku-scan</p>
            </div>
          )}

          {/* loading spinner */}
          {phase === PHASE.LOADING && (
            <div className="qs-placeholder">
              <div className="qs-spinner" />
              <p>Inathibitisha QR code…</p>
            </div>
          )}
        </div>

        {/* camera error */}
        {camError && (
          <div className="qs-banner qs-err">
            <span>⚠️</span><span>{camError}</span>
          </div>
        )}

        {/* camera controls */}
        <div className="qs-controls">
          {phase === PHASE.IDLE || phase === PHASE.NOT_FOUND || phase === PHASE.ALREADY || phase === PHASE.CONFIRMED ? (
            <button className="qs-btn-primary" onClick={startCamera}>
              📷 Washa Camera
            </button>
          ) : phase === PHASE.SCANNING ? (
            <button className="qs-btn-ghost" onClick={() => { stopCamera(); setPhase(PHASE.IDLE); }}>
              ✕ Zima Camera
            </button>
          ) : null}
        </div>

        {/* manual input fallback */}
        <form className="qs-manual" onSubmit={handleManual}>
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Au ingiza code kwa mkono…"
          />
          <button type="submit">🔍</button>
        </form>
      </div>

      {/* ══ PHASE: GUEST FOUND — show info + approve ══ */}
      {phase === PHASE.FOUND && guestData && (
        <div className="qs-card qs-result-card qs-found">
          <div className="qs-result-header found">
            <span className="qs-result-icon">✅</span>
            <div>
              <div className="qs-result-title">Mwalikwa Amepatikana</div>
              <div className="qs-result-sub">Taarifa zake ziko kwenye mfumo</div>
            </div>
          </div>

          <div className="qs-guest-info">
            <div className="qs-guest-avatar">{guestData.name.charAt(0).toUpperCase()}</div>
            <div className="qs-guest-details">
              <div className="qs-info-row">
                <span className="qs-info-label">Jina</span>
                <span className="qs-info-value name">{guestData.name}</span>
              </div>
              <div className="qs-info-row">
                <span className="qs-info-label">Aina ya Mwaliko</span>
                <span className={`qs-badge ${guestData.status === 'double' ? 'double' : 'single'}`}>
                  {guestData.status === 'double' ? '👥 Double' : '👤 Single'}
                </span>
              </div>
              <div className="qs-info-row">
                <span className="qs-info-label">Nambari ya QR</span>
                <span className="qs-info-value code">{guestData.qrCodeData?.uniqueCode}</span>
              </div>
              <div className="qs-info-row">
                <span className="qs-info-label">Ukumbi</span>
                <span className="qs-info-value">{guestData.venue}</span>
              </div>
              <div className="qs-info-row">
                <span className="qs-info-label">Tarehe</span>
                <span className="qs-info-value">{guestData.date} · {guestData.time}</span>
              </div>
              <div className="qs-info-row">
                <span className="qs-info-label">Hali ya Uwepo</span>
                <span className="qs-badge pending">⏳ Hajahudhuria bado</span>
              </div>
            </div>
          </div>

          <div className="qs-approve-row">
            <button className="qs-btn-ghost" onClick={reset}>
              ✕ Ghairi
            </button>
            <button
              className="qs-btn-approve"
              onClick={handleApprove}
              disabled={approving}
            >
              {approving ? '⏳ Inathibitisha…' : '✅ Thibitisha Uwepo'}
            </button>
          </div>
        </div>
      )}

      {/* ══ PHASE: CONFIRMED ══ */}
      {phase === PHASE.CONFIRMED && guestData && (
        <div className="qs-card qs-result-card qs-confirmed">
          <div className="qs-result-header confirmed">
            <span className="qs-result-icon big">🎉</span>
            <div>
              <div className="qs-result-title">Umekubaliwa!</div>
              <div className="qs-result-sub">Uwepo umethibitishwa na kuhifadhiwa</div>
            </div>
          </div>

          <div className="qs-guest-info">
            <div className="qs-guest-avatar confirmed">{guestData.name.charAt(0).toUpperCase()}</div>
            <div className="qs-guest-details">
              <div className="qs-info-row">
                <span className="qs-info-label">Jina</span>
                <span className="qs-info-value name">{guestData.name}</span>
              </div>
              <div className="qs-info-row">
                <span className="qs-info-label">Aina</span>
                <span className={`qs-badge ${guestData.status === 'double' ? 'double' : 'single'}`}>
                  {guestData.status === 'double' ? '👥 Double' : '👤 Single'}
                </span>
              </div>
              <div className="qs-info-row">
                <span className="qs-info-label">Wakati wa Kuwasili</span>
                <span className="qs-info-value">
                  {new Date(guestData.attendanceTime).toLocaleTimeString('sw-TZ')}
                </span>
              </div>
              <div className="qs-info-row">
                <span className="qs-info-label">Hali</span>
                <span className="qs-badge attended">✓ Amewasili</span>
              </div>
            </div>
          </div>

          <div className="qs-approve-row">
            <button className="qs-btn-primary" onClick={startCamera}>
              📷 Scan Mwingine
            </button>
          </div>
        </div>
      )}

      {/* ══ PHASE: ALREADY ATTENDED ══ */}
      {phase === PHASE.ALREADY && guestData && (
        <div className="qs-card qs-result-card qs-already">
          <div className="qs-result-header already">
            <span className="qs-result-icon">⚠️</span>
            <div>
              <div className="qs-result-title">Tayari Amewasili</div>
              <div className="qs-result-sub">Mwalikwa huyu ameshasajiliwa</div>
            </div>
          </div>

          <div className="qs-guest-info">
            <div className="qs-guest-avatar already">{guestData.name.charAt(0).toUpperCase()}</div>
            <div className="qs-guest-details">
              <div className="qs-info-row">
                <span className="qs-info-label">Jina</span>
                <span className="qs-info-value name">{guestData.name}</span>
              </div>
              <div className="qs-info-row">
                <span className="qs-info-label">Aina</span>
                <span className={`qs-badge ${guestData.status === 'double' ? 'double' : 'single'}`}>
                  {guestData.status === 'double' ? '👥 Double' : '👤 Single'}
                </span>
              </div>
              <div className="qs-info-row">
                <span className="qs-info-label">Aliwasili Saa</span>
                <span className="qs-info-value">
                  {guestData.attendanceTime
                    ? new Date(guestData.attendanceTime).toLocaleTimeString('sw-TZ')
                    : '—'}
                </span>
              </div>
              <div className="qs-info-row">
                <span className="qs-info-label">Hali</span>
                <span className="qs-badge attended">✓ Amewasili</span>
              </div>
            </div>
          </div>

          <div className="qs-approve-row">
            <button className="qs-btn-primary" onClick={startCamera}>
              📷 Scan Mwingine
            </button>
          </div>
        </div>
      )}

      {/* ══ PHASE: NOT FOUND ══ */}
      {phase === PHASE.NOT_FOUND && (
        <div className="qs-card qs-result-card qs-notfound">
          <div className="qs-result-header notfound">
            <span className="qs-result-icon">❌</span>
            <div>
              <div className="qs-result-title">Haipatikani</div>
              <div className="qs-result-sub">QR code hii haipo kwenye mfumo</div>
            </div>
          </div>
          <p className="qs-notfound-hint">
            Hakikisha kadi ni halisi. Ikiwa tatizo linaendelea wasiliana na msimamizi wa harusi.
          </p>
          <div className="qs-approve-row">
            <button className="qs-btn-primary" onClick={startCamera}>
              📷 Jaribu Tena
            </button>
          </div>
        </div>
      )}

      {/* ── session log ── */}
      {sessionLog.length > 0 && (
        <div className="qs-card">
          <span className="qs-card-title" style={{ marginBottom: 12, display: 'block' }}>
            ✅ Waliothibitishwa Leo ({sessionLog.length})
          </span>
          <div className="qs-recent-list">
            {sessionLog.map((g) => (
              <div key={g._id || g.qrCodeData?.uniqueCode} className="qs-recent-item">
                <div className="qs-recent-avatar">{g.name.charAt(0).toUpperCase()}</div>
                <span className="qs-recent-name">{g.name}</span>
                <span className={`qs-badge ${g.status === 'double' ? 'double' : 'single'}`} style={{ fontSize: 10 }}>
                  {g.status === 'double' ? 'Double' : 'Single'}
                </span>
                <span className="qs-recent-time">
                  {g.attendanceTime ? new Date(g.attendanceTime).toLocaleTimeString('sw-TZ') : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── all-time recent arrivals ── */}
      <div className="qs-card">
        <span className="qs-card-title" style={{ marginBottom: 12, display: 'block' }}>
          📋 Waliowasili ({recentAttendees.length})
        </span>
        {recentAttendees.length > 0 ? (
          <div className="qs-recent-list">
            {recentAttendees.map((g) => (
              <div key={g._id || g.id} className="qs-recent-item">
                <div className="qs-recent-avatar">{g.name.charAt(0).toUpperCase()}</div>
                <span className="qs-recent-name">{g.name}</span>
                <span className="qs-recent-time">
                  {g.attendanceTime
                    ? new Date(g.attendanceTime).toLocaleTimeString('sw-TZ')
                    : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="qs-no-data">Hakuna mgeni aliyewasili bado.</p>
        )}
      </div>

    </div>
  );
}

export default QRScanner;
