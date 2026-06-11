import React, { useState, useEffect, useRef, useCallback } from 'react';
import './QRScanner.css';

const API = 'https://uscftakwimu-11.onrender.com/api/wedding-guests';

/* ── load jsQR from CDN once ── */
const loadJsQR = () =>
  new Promise((resolve, reject) => {
    if (window.jsQR) { resolve(window.jsQR); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.min.js';
    s.onload  = () => { if (window.jsQR) resolve(window.jsQR); else reject(new Error('jsQR haijapakia')); };
    s.onerror = () => reject(new Error('Imeshindwa kupakia jsQR'));
    document.head.appendChild(s);
  });

const PHASE = {
  IDLE:      'idle',
  REQUESTING:'requesting',  // asking browser for camera permission
  SCANNING:  'scanning',    // camera live + scanning
  LOADING:   'loading',     // QR found, querying API
  FOUND:     'found',       // guest exists, not yet attended
  ALREADY:   'already',     // guest already attended
  NOT_FOUND: 'not_found',   // QR not in DB
  CONFIRMED: 'confirmed',   // just approved
};

function QRScanner({ guests, setGuests }) {
  const [phase,       setPhase]      = useState(PHASE.IDLE);
  const [guestData,   setGuestData]  = useState(null);
  const [camError,    setCamError]   = useState(null);
  const [approving,   setApproving]  = useState(false);
  const [manualInput, setManualInput]= useState('');
  const [sessionLog,  setSessionLog] = useState([]);

  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const rafRef      = useRef(null);
  const jsQRFnRef   = useRef(null);
  const scanningRef = useRef(false);  // guard: is scan loop running?
  const lastCodeRef = useRef('');     // debounce

  /* ══ STOP CAMERA ════════════════════════════════ */
  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  /* cleanup on unmount */
  useEffect(() => () => stopCamera(), [stopCamera]);

  /* ══ SCAN LOOP — reads every frame ══════════════ */
  const startScanLoop = useCallback(() => {
    scanningRef.current = true;
    lastCodeRef.current = '';

    const tick = () => {
      if (!scanningRef.current) return;

      const video  = videoRef.current;
      const canvas = canvasRef.current;

      /* wait until video is playing and has real dimensions */
      if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA
          || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result    = jsQRFnRef.current(
        imageData.data, imageData.width, imageData.height,
        { inversionAttempts: 'dontInvert' }
      );

      if (result?.data && result.data !== lastCodeRef.current) {
        lastCodeRef.current = result.data;
        handleCodeFound(result.data);
        return; // stop loop — result handled
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ══ START CAMERA ════════════════════════════════ */
  const startCamera = useCallback(async () => {
    stopCamera();
    setCamError(null);
    setGuestData(null);
    setPhase(PHASE.REQUESTING);

    /* 1. load jsQR */
    try {
      jsQRFnRef.current = await loadJsQR();
    } catch (e) {
      setCamError('Imeshindwa kupakia maktaba ya QR: ' + e.message);
      setPhase(PHASE.IDLE);
      return;
    }

    /* 2. check mediaDevices API available */
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Kivinjari chako hakisaidii kamera. Tumia Chrome au Safari ya kisasa.');
      setPhase(PHASE.IDLE);
      return;
    }

    /* 3. request camera — try back camera first, fallback to any */
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (firstErr) {
      if (firstErr.name === 'NotAllowedError' || firstErr.name === 'PermissionDeniedError') {
        setCamError(
          'Ruhusa ya kamera ilikataliwa.\n\n' +
          'Jinsi ya kuruhusu:\n' +
          '• Chrome: Bonyeza kitufe cha kufuli 🔒 kwenye address bar → Camera → Allow\n' +
          '• Safari: Settings → Safari → Camera → Allow\n' +
          '• Firefox: Bonyeza 🔒 → Connection Secure → More info → Permissions'
        );
        setPhase(PHASE.IDLE);
        return;
      }
      /* try any camera as fallback */
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (secondErr) {
        setCamError('Kamera haikupatikana: ' + secondErr.message);
        setPhase(PHASE.IDLE);
        return;
      }
    }

    streamRef.current = stream;

    /* 4. attach stream to video element */
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      setCamError('Video element haikupatikana. Jaribu tena.');
      setPhase(PHASE.IDLE);
      return;
    }

    video.srcObject = stream;

    /* 5. wait for video to be ready, then start scan loop */
    const onCanPlay = () => {
      video.removeEventListener('canplay', onCanPlay);
      video.play()
        .then(() => {
          setPhase(PHASE.SCANNING);
          startScanLoop();
        })
        .catch((e) => {
          setCamError('Video haikuweza kuanza: ' + e.message);
          setPhase(PHASE.IDLE);
        });
    };

    video.addEventListener('canplay', onCanPlay);

    /* safety timeout — if canplay never fires */
    setTimeout(() => {
      if (scanningRef.current === false && streamRef.current) {
        video.removeEventListener('canplay', onCanPlay);
        if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
          video.play().then(() => { setPhase(PHASE.SCANNING); startScanLoop(); }).catch(() => {});
        }
      }
    }, 3000);

  }, [stopCamera, startScanLoop]);

  /* ══ QR CODE FOUND — lookup in DB ═══════════════ */
  const handleCodeFound = useCallback(async (rawCode) => {
    stopCamera();
    setPhase(PHASE.LOADING);

    let uniqueCode = rawCode;
    try { uniqueCode = JSON.parse(rawCode).uniqueCode ?? rawCode; } catch { /* raw string */ }

    try {
      const res  = await fetch(`${API}/scan`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uniqueCode, dryRun: true }),
      });
      const json = await res.json();

      if (res.status === 404 || (!json.success && !json.data)) {
        setPhase(PHASE.NOT_FOUND);
        return;
      }

      setGuestData(json.data);
      setPhase(json.data.attended ? PHASE.ALREADY : PHASE.FOUND);
    } catch (e) {
      setCamError('Hitilafu ya mtandao: ' + e.message);
      setPhase(PHASE.IDLE);
    }
  }, [stopCamera]);

  /* ══ APPROVE ATTENDANCE ══════════════════════════ */
  const handleApprove = async () => {
    if (!guestData || approving) return;
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
        setGuests((prev) =>
          prev.map((g) =>
            (g.qrCodeData?.uniqueCode === uniqueCode || g._id === guestData._id) ? updated : g
          )
        );
        setSessionLog((prev) => [updated, ...prev]);
        setPhase(PHASE.CONFIRMED);
      } else {
        setPhase(PHASE.ALREADY);
      }
    } catch (e) {
      setCamError('Hitilafu: ' + e.message);
    } finally {
      setApproving(false);
    }
  };

  /* ══ MANUAL INPUT ════════════════════════════════ */
  const handleManual = (e) => {
    e.preventDefault();
    const val = manualInput.trim();
    if (!val) return;
    setManualInput('');
    handleCodeFound(val);
  };

  /* ══ RESET ═══════════════════════════════════════ */
  const reset = () => {
    stopCamera();
    setGuestData(null);
    setCamError(null);
    lastCodeRef.current = '';
    setPhase(PHASE.IDLE);
  };

  const recentAttendees = guests
    .filter((g) => g.attended)
    .sort((a, b) => new Date(b.attendanceTime) - new Date(a.attendanceTime))
    .slice(0, 6);

  const isCameraPhase = phase === PHASE.SCANNING || phase === PHASE.REQUESTING;

  /* ══════════════════════════════ RENDER */
  return (
    <div className="qs-wrap">

      {/* ══ CAMERA CARD ══════════════════════════════ */}
      <div className="qs-card">
        <div className="qs-card-head">
          <span className="qs-card-title">📷 Scan QR Code ya Mwalikwa</span>
          {phase === PHASE.SCANNING && <span className="qs-live-badge">● LIVE</span>}
          {phase === PHASE.REQUESTING && <span className="qs-live-badge pending">⏳ Inaomba ruhusa…</span>}
        </div>

        {/* viewport */}
        <div className={`qs-viewport ${isCameraPhase ? 'active' : ''}`}>

          {/* video — always in DOM so ref is always attached */}
          <video
            ref={videoRef}
            className="qs-video"
            playsInline
            muted
            autoPlay
            style={{ display: isCameraPhase ? 'block' : 'none' }}
          />

          {/* hidden canvas for pixel reading */}
          <canvas ref={canvasRef} className="qs-canvas" />

          {/* scan corners + line */}
          {phase === PHASE.SCANNING && (
            <div className="qs-corners" aria-hidden="true">
              <div className="qs-corner tl" />
              <div className="qs-corner tr" />
              <div className="qs-corner bl" />
              <div className="qs-corner br" />
              <div className="qs-scan-line" />
            </div>
          )}

          {/* idle placeholder */}
          {phase === PHASE.IDLE && (
            <div className="qs-placeholder">
              <div className="qs-placeholder-icon">📷</div>
              <p>Bonyeza kitufe hapa chini kuanza ku-scan</p>
            </div>
          )}

          {/* requesting permission */}
          {phase === PHASE.REQUESTING && (
            <div className="qs-placeholder">
              <div className="qs-spinner" />
              <p>Inaomba ruhusa ya kamera…</p>
            </div>
          )}

          {/* loading after QR found */}
          {phase === PHASE.LOADING && (
            <div className="qs-placeholder">
              <div className="qs-spinner" />
              <p>QR imepatikana! Inathibitisha kwenye seva…</p>
            </div>
          )}
        </div>

        {/* camera error */}
        {camError && (
          <div className="qs-error-box">
            <div className="qs-error-icon">⚠️</div>
            <pre className="qs-error-msg">{camError}</pre>
          </div>
        )}

        {/* action buttons */}
        <div className="qs-controls">
          {!isCameraPhase && phase !== PHASE.LOADING ? (
            <button className="qs-btn-primary" onClick={startCamera}>
              📷 Washa Camera
            </button>
          ) : phase === PHASE.SCANNING ? (
            <button className="qs-btn-ghost" onClick={reset}>
              ✕ Zima Camera
            </button>
          ) : null}
        </div>

        {/* manual fallback */}
        <form className="qs-manual" onSubmit={handleManual}>
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Au ingiza code kwa mkono hapa…"
          />
          <button type="submit">🔍</button>
        </form>
      </div>

      {/* ══ RESULT: GUEST FOUND — show info + approve ═ */}
      {phase === PHASE.FOUND && guestData && (
        <div className="qs-card qs-result-card">
          <div className="qs-result-header found">
            <span className="qs-result-icon">✅</span>
            <div>
              <div className="qs-result-title">Mwalikwa Amepatikana</div>
              <div className="qs-result-sub">Taarifa zake zipo kwenye mfumo — thibitisha uwepo wake</div>
            </div>
          </div>

          <GuestInfoBlock guest={guestData} />

          <div className="qs-approve-row">
            <button className="qs-btn-ghost" onClick={reset}>✕ Ghairi</button>
            <button className="qs-btn-approve" onClick={handleApprove} disabled={approving}>
              {approving ? '⏳ Inathibitisha…' : '✅ Thibitisha Uwepo'}
            </button>
          </div>
        </div>
      )}

      {/* ══ RESULT: CONFIRMED ═══════════════════════ */}
      {phase === PHASE.CONFIRMED && guestData && (
        <div className="qs-card qs-result-card">
          <div className="qs-result-header confirmed">
            <span className="qs-result-icon big">🎉</span>
            <div>
              <div className="qs-result-title">Umekubaliwa!</div>
              <div className="qs-result-sub">Uwepo umethibitishwa na kuhifadhiwa kwenye mfumo</div>
            </div>
          </div>

          <GuestInfoBlock guest={guestData} showTime />

          <div className="qs-approve-row">
            <button className="qs-btn-primary" onClick={startCamera}>📷 Scan Mwingine</button>
          </div>
        </div>
      )}

      {/* ══ RESULT: ALREADY ATTENDED ════════════════ */}
      {phase === PHASE.ALREADY && guestData && (
        <div className="qs-card qs-result-card">
          <div className="qs-result-header already">
            <span className="qs-result-icon">⚠️</span>
            <div>
              <div className="qs-result-title">Tayari Amewasili</div>
              <div className="qs-result-sub">Mwalikwa huyu ameshasajiliwa awali</div>
            </div>
          </div>

          <GuestInfoBlock guest={guestData} showTime />

          <div className="qs-approve-row">
            <button className="qs-btn-primary" onClick={startCamera}>📷 Scan Mwingine</button>
          </div>
        </div>
      )}

      {/* ══ RESULT: NOT FOUND ═══════════════════════ */}
      {phase === PHASE.NOT_FOUND && (
        <div className="qs-card qs-result-card">
          <div className="qs-result-header notfound">
            <span className="qs-result-icon">❌</span>
            <div>
              <div className="qs-result-title">Haipatikani</div>
              <div className="qs-result-sub">QR code hii haipo kwenye mfumo wa harusi</div>
            </div>
          </div>
          <p className="qs-notfound-hint">
            Hakikisha kadi ni halisi. Ikiwa tatizo linaendelea wasiliana na msimamizi wa harusi.
          </p>
          <div className="qs-approve-row">
            <button className="qs-btn-primary" onClick={startCamera}>📷 Jaribu Tena</button>
          </div>
        </div>
      )}

      {/* ══ SESSION LOG ═════════════════════════════ */}
      {sessionLog.length > 0 && (
        <div className="qs-card">
          <div className="qs-card-head">
            <span className="qs-card-title">✅ Waliothibitishwa Sasa ({sessionLog.length})</span>
          </div>
          <div className="qs-recent-list">
            {sessionLog.map((g) => (
              <RecentItem key={g._id ?? g.qrCodeData?.uniqueCode} guest={g} />
            ))}
          </div>
        </div>
      )}

      {/* ══ ALL-TIME RECENT ═════════════════════════ */}
      <div className="qs-card">
        <div className="qs-card-head">
          <span className="qs-card-title">📋 Waliowasili ({recentAttendees.length})</span>
        </div>
        {recentAttendees.length > 0 ? (
          <div className="qs-recent-list">
            {recentAttendees.map((g) => (
              <RecentItem key={g._id ?? g.id} guest={g} />
            ))}
          </div>
        ) : (
          <p className="qs-no-data">Hakuna mgeni aliyewasili bado.</p>
        )}
      </div>

    </div>
  );
}

/* ── sub-components ── */
function GuestInfoBlock({ guest, showTime }) {
  return (
    <div className="qs-guest-info">
      <div className={`qs-guest-avatar ${guest.attended ? 'confirmed' : ''}`}>
        {guest.name.charAt(0).toUpperCase()}
      </div>
      <div className="qs-guest-details">
        <InfoRow label="Jina"          value={<strong className="qs-name-val">{guest.name}</strong>} />
        <InfoRow label="Aina ya Mwaliko" value={
          <span className={`qs-badge ${guest.status === 'double' ? 'double' : 'single'}`}>
            {guest.status === 'double' ? '👥 Double' : '👤 Single'}
          </span>
        } />
        <InfoRow label="Nambari ya QR"  value={<code className="qs-code">{guest.qrCodeData?.uniqueCode}</code>} />
        <InfoRow label="Ukumbi"         value={guest.venue} />
        <InfoRow label="Tarehe / Muda"  value={`${guest.date} · ${guest.time}`} />
        {showTime && guest.attendanceTime && (
          <InfoRow label="Aliwasili Saa" value={
            <span className="qs-badge attended">
              ✓ {new Date(guest.attendanceTime).toLocaleTimeString('sw-TZ')}
            </span>
          } />
        )}
        {!showTime && (
          <InfoRow label="Hali" value={<span className="qs-badge pending">⏳ Hajahudhuria bado</span>} />
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="qs-info-row">
      <span className="qs-info-label">{label}</span>
      <span className="qs-info-value">{value}</span>
    </div>
  );
}

function RecentItem({ guest }) {
  return (
    <div className="qs-recent-item">
      <div className="qs-recent-avatar">{guest.name.charAt(0).toUpperCase()}</div>
      <span className="qs-recent-name">{guest.name}</span>
      <span className={`qs-badge ${guest.status === 'double' ? 'double' : 'single'}`} style={{ fontSize: 10 }}>
        {guest.status === 'double' ? 'Double' : 'Single'}
      </span>
      <span className="qs-recent-time">
        {guest.attendanceTime ? new Date(guest.attendanceTime).toLocaleTimeString('sw-TZ') : ''}
      </span>
    </div>
  );
}

export default QRScanner;
