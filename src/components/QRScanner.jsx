import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';                 // npm install jsqr
import './QRScanner.css';

const API = 'https://uscftakwimu-11.onrender.com/api/wedding-guests';

const PHASE = {
  IDLE:       'idle',
  REQUESTING: 'requesting',
  SCANNING:   'scanning',
  LOADING:    'loading',
  FOUND:      'found',
  ALREADY:    'already',
  NOT_FOUND:  'not_found',
  CONFIRMED:  'confirmed',
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
  const scanningRef = useRef(false);
  const lastCodeRef = useRef('');

  /* ══ STOP CAMERA ═════════════════════════════════ */
  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  /* ══ LOOKUP CODE IN API ══════════════════════════ */
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

  /* ══ SCAN LOOP ═══════════════════════════════════ */
  const startScanLoop = useCallback(() => {
    scanningRef.current = true;
    lastCodeRef.current = '';

    const tick = () => {
      if (!scanningRef.current) return;

      const video  = videoRef.current;
      const canvas = canvasRef.current;

      if (
        !video || !canvas ||
        video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA ||
        video.videoWidth === 0
      ) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result    = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (result?.data && result.data !== lastCodeRef.current) {
        lastCodeRef.current = result.data;
        handleCodeFound(result.data);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [handleCodeFound]);

  /* ══ START CAMERA ════════════════════════════════ */
  const startCamera = useCallback(async () => {
    stopCamera();
    setCamError(null);
    setGuestData(null);
    lastCodeRef.current = '';
    setPhase(PHASE.REQUESTING);

    /* check API availability */
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError(
        'Kivinjari chako hakisaidii kamera.\n' +
        'Tumia Chrome au Safari ya kisasa, na hakikisha\n' +
        'programu inafunguka kwa HTTPS.'
      );
      setPhase(PHASE.IDLE);
      return;
    }

    /* request stream — back camera ideal, fallback any */
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCamError(
          'Ruhusa ya kamera ilikataliwa.\n\n' +
          'Jinsi ya kuruhusu:\n' +
          '• Chrome/Android: Bonyeza 🔒 address bar → Camera → Ruhusu\n' +
          '• Safari/iPhone: Mipangilio → Safari → Kamera → Ruhusu\n' +
          '• Firefox: Bonyeza 🔒 → Maelezo zaidi → Ruhusa'
        );
        setPhase(PHASE.IDLE);
        return;
      }
      /* try any camera */
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (err2) {
        setCamError('Kamera haikupatikana: ' + err2.message);
        setPhase(PHASE.IDLE);
        return;
      }
    }

    streamRef.current = stream;

    /* attach to video element */
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      setCamError('Hitilafu ya ndani. Jaribu upya.');
      setPhase(PHASE.IDLE);
      return;
    }

    video.srcObject = stream;

    /* wait for canplay then start loop */
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

    /* fallback if canplay fires slowly */
    setTimeout(() => {
      if (!scanningRef.current && videoRef.current?.readyState >= 3) {
        video.removeEventListener('canplay', onCanPlay);
        video.play()
          .then(() => { setPhase(PHASE.SCANNING); startScanLoop(); })
          .catch(() => {});
      }
    }, 3000);
  }, [stopCamera, startScanLoop]);

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
        setGuestData((prev) => ({ ...prev, ...json.data }));
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

  const isCameraActive = phase === PHASE.SCANNING || phase === PHASE.REQUESTING;

  /* ══ RENDER ══════════════════════════════════════ */
  return (
    <div className="qs-wrap">

      {/* ── CAMERA CARD ── */}
      <div className="qs-card">
        <div className="qs-card-head">
          <span className="qs-card-title">📷 Scan QR Code ya Mwalikwa</span>
          {phase === PHASE.SCANNING   && <span className="qs-live-badge">● LIVE</span>}
          {phase === PHASE.REQUESTING && <span className="qs-live-badge pending">⏳ Inaomba…</span>}
        </div>

        {/* viewport — video always in DOM so ref stays attached */}
        <div className={`qs-viewport ${isCameraActive ? 'active' : ''}`}>
          <video
            ref={videoRef}
            className="qs-video"
            playsInline
            muted
            style={{ display: isCameraActive ? 'block' : 'none' }}
          />
          <canvas ref={canvasRef} className="qs-canvas" />

          {phase === PHASE.SCANNING && (
            <div className="qs-corners" aria-hidden="true">
              <div className="qs-corner tl" /><div className="qs-corner tr" />
              <div className="qs-corner bl" /><div className="qs-corner br" />
              <div className="qs-scan-line" />
            </div>
          )}

          {phase === PHASE.IDLE && (
            <div className="qs-placeholder">
              <div className="qs-placeholder-icon">📷</div>
              <p>Bonyeza "Washa Camera" kuanza ku-scan</p>
            </div>
          )}
          {phase === PHASE.REQUESTING && (
            <div className="qs-placeholder">
              <div className="qs-spinner" />
              <p>Inaomba ruhusa ya kamera…</p>
            </div>
          )}
          {phase === PHASE.LOADING && (
            <div className="qs-placeholder" style={{ background: '#120810' }}>
              <div className="qs-spinner" />
              <p>QR imepatikana! Inathibitisha…</p>
            </div>
          )}
        </div>

        {/* error */}
        {camError && (
          <div className="qs-error-box">
            <span className="qs-error-icon">⚠️</span>
            <pre className="qs-error-msg">{camError}</pre>
          </div>
        )}

        {/* controls */}
        <div className="qs-controls">
          {phase === PHASE.SCANNING ? (
            <button className="qs-btn-ghost" onClick={reset}>✕ Zima Camera</button>
          ) : phase !== PHASE.REQUESTING && phase !== PHASE.LOADING ? (
            <button className="qs-btn-primary" onClick={startCamera}>📷 Washa Camera</button>
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

      {/* ── GUEST FOUND ── */}
      {phase === PHASE.FOUND && guestData && (
        <div className="qs-card qs-result-card">
          <div className="qs-result-header found">
            <span className="qs-result-icon">✅</span>
            <div>
              <div className="qs-result-title">Mwalikwa Amepatikana</div>
              <div className="qs-result-sub">Taarifa zake zipo — thibitisha uwepo wake hapa chini</div>
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

      {/* ── CONFIRMED ── */}
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

      {/* ── ALREADY ATTENDED ── */}
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

      {/* ── NOT FOUND ── */}
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
            Hakikisha kadi ni halisi. Ikiwa tatizo linaendelea wasiliana na msimamizi.
          </p>
          <div className="qs-approve-row">
            <button className="qs-btn-primary" onClick={startCamera}>📷 Jaribu Tena</button>
          </div>
        </div>
      )}

      {/* ── SESSION LOG ── */}
      {sessionLog.length > 0 && (
        <div className="qs-card">
          <div className="qs-card-head">
            <span className="qs-card-title">✅ Waliothibitishwa Sasa ({sessionLog.length})</span>
          </div>
          <div className="qs-recent-list">
            {sessionLog.map((g) => <RecentItem key={g._id ?? g.qrCodeData?.uniqueCode} guest={g} />)}
          </div>
        </div>
      )}

      {/* ── ALL-TIME RECENT ── */}
      <div className="qs-card">
        <div className="qs-card-head">
          <span className="qs-card-title">Waliowasili ({recentAttendees.length})</span>
        </div>
        {recentAttendees.length > 0 ? (
          <div className="qs-recent-list">
            {recentAttendees.map((g) => <RecentItem key={g._id ?? g.id} guest={g} />)}
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
        <InfoRow label="Jina"           value={<strong className="qs-name-val">{guest.name}</strong>} />
        <InfoRow label="Aina ya Mwaliko" value={
          <span className={`qs-badge ${guest.status === 'double' ? 'double' : 'single'}`}>
            {guest.status === 'double' ? '👥 Double' : '👤 Single'}
          </span>
        } />
        <InfoRow label="Nambari ya QR"  value={<code className="qs-code">{guest.qrCodeData?.uniqueCode}</code>} />
        <InfoRow label="Ukumbi"         value={guest.venue} />
        <InfoRow label="Tarehe / Muda"  value={`${guest.date} · ${guest.time}`} />
        {showTime && guest.attendanceTime ? (
          <InfoRow label="Aliwasili Saa" value={
            <span className="qs-badge attended">
              ✓ {new Date(guest.attendanceTime).toLocaleTimeString('sw-TZ')}
            </span>
          } />
        ) : !showTime ? (
          <InfoRow label="Hali" value={<span className="qs-badge pending">⏳ Hajahudhuria bado</span>} />
        ) : null}
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
