import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
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

/* ── image pre-processing filters for better detection ── */
function applyGrayscale(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 0.299 * d.data[i] + 0.587 * d.data[i+1] + 0.114 * d.data[i+2];
    d.data[i] = d.data[i+1] = d.data[i+2] = v;
  }
  ctx.putImageData(d, 0, 0);
  return ctx.getImageData(0, 0, w, h);
}

function applyHighContrast(ctx, w, h, threshold = 128) {
  const d = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 0.299 * d.data[i] + 0.587 * d.data[i+1] + 0.114 * d.data[i+2];
    const bw = v > threshold ? 255 : 0;
    d.data[i] = d.data[i+1] = d.data[i+2] = bw;
  }
  ctx.putImageData(d, 0, 0);
  return ctx.getImageData(0, 0, w, h);
}

/* ── try jsQR on multiple processed versions of the same frame ── */
function detectQRMultiPass(video, canvas) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const opts = { inversionAttempts: 'both' }; // try normal + inverted

  /* Pass 1: raw color frame */
  ctx.drawImage(video, 0, 0, w, h);
  const raw = ctx.getImageData(0, 0, w, h);
  let result = jsQR(raw.data, w, h, opts);
  if (result?.data) return result;

  /* Pass 2: center crop (QR code often in center) */
  const cx = Math.floor(w * 0.15), cy = Math.floor(h * 0.15);
  const cw = Math.floor(w * 0.7),  ch = Math.floor(h * 0.7);
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width  = cw;
  cropCanvas.height = ch;
  const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
  cropCtx.drawImage(video, cx, cy, cw, ch, 0, 0, cw, ch);
  const cropped = cropCtx.getImageData(0, 0, cw, ch);
  result = jsQR(cropped.data, cw, ch, opts);
  if (result?.data) return result;

  /* Pass 3: grayscale */
  ctx.drawImage(video, 0, 0, w, h);
  const gray = applyGrayscale(ctx, w, h);
  result = jsQR(gray.data, w, h, opts);
  if (result?.data) return result;

  /* Pass 4: high-contrast binarize (threshold 128) */
  ctx.drawImage(video, 0, 0, w, h);
  const hc = applyHighContrast(ctx, w, h, 128);
  result = jsQR(hc.data, w, h, opts);
  if (result?.data) return result;

  /* Pass 5: high-contrast lower threshold (dim environments) */
  ctx.drawImage(video, 0, 0, w, h);
  const hc2 = applyHighContrast(ctx, w, h, 100);
  result = jsQR(hc2.data, w, h, opts);
  if (result?.data) return result;

  /* Pass 6: upscaled crop for small/far QR codes */
  const scaleCanvas = document.createElement('canvas');
  scaleCanvas.width  = cw * 2;
  scaleCanvas.height = ch * 2;
  const scaleCtx = scaleCanvas.getContext('2d', { willReadFrequently: true });
  scaleCtx.imageSmoothingEnabled = true;
  scaleCtx.imageSmoothingQuality = 'high';
  scaleCtx.drawImage(video, cx, cy, cw, ch, 0, 0, cw * 2, ch * 2);
  const scaled = scaleCtx.getImageData(0, 0, cw * 2, ch * 2);
  result = jsQR(scaled.data, cw * 2, ch * 2, opts);
  if (result?.data) return result;

  return null;
}

function QRScanner({ guests, setGuests }) {
  const [phase,        setPhase]       = useState(PHASE.IDLE);
  const [guestData,    setGuestData]   = useState(null);
  const [camError,     setCamError]    = useState(null);
  const [approving,    setApproving]   = useState(false);
  const [manualInput,  setManualInput] = useState('');
  const [sessionLog,   setSessionLog]  = useState([]);
  const [fps,          setFps]         = useState(0);   // debug indicator

  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const rafRef      = useRef(null);
  const scanningRef = useRef(false);
  const lastCodeRef = useRef('');
  const frameCount  = useRef(0);
  const lastFpsTime = useRef(Date.now());

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (rafRef.current)  { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current)  videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  /* ── API lookup ── */
  const handleCodeFound = useCallback(async (rawCode) => {
    stopCamera();
    setPhase(PHASE.LOADING);

    let uniqueCode = rawCode;
    try { uniqueCode = JSON.parse(rawCode).uniqueCode ?? rawCode; } catch {}

    try {
      const res  = await fetch(`${API}/scan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uniqueCode, dryRun: true }),
      });
      const json = await res.json();
      if (res.status === 404 || (!json.success && !json.data)) { setPhase(PHASE.NOT_FOUND); return; }
      setGuestData(json.data);
      setPhase(json.data.attended ? PHASE.ALREADY : PHASE.FOUND);
    } catch (e) {
      setCamError('Hitilafu ya mtandao: ' + e.message);
      setPhase(PHASE.IDLE);
    }
  }, [stopCamera]);

  /* ── HIGH-PERFORMANCE scan loop ── */
  const startScanLoop = useCallback(() => {
    scanningRef.current = true;
    lastCodeRef.current = '';
    frameCount.current  = 0;
    lastFpsTime.current = Date.now();

    const tick = () => {
      if (!scanningRef.current) return;

      const video  = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas ||
          video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA ||
          video.videoWidth  === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      /* FPS counter for debug */
      frameCount.current++;
      const now = Date.now();
      if (now - lastFpsTime.current >= 1000) {
        setFps(frameCount.current);
        frameCount.current  = 0;
        lastFpsTime.current = now;
      }

      /* multi-pass detection */
      const result = detectQRMultiPass(video, canvas);

      if (result?.data && result.data !== lastCodeRef.current) {
        lastCodeRef.current = result.data;
        // vibrate on mobile for tactile feedback
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        handleCodeFound(result.data);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [handleCodeFound]);

  /* ── start camera with optimal constraints ── */
  const startCamera = useCallback(async () => {
    stopCamera();
    setCamError(null);
    setGuestData(null);
    lastCodeRef.current = '';
    setPhase(PHASE.REQUESTING);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Kivinjari chako hakisaidii kamera. Tumia Chrome au Safari ya kisasa kwenye HTTPS.');
      setPhase(PHASE.IDLE); return;
    }

    let stream = null;

    /* try constraints in order from best to fallback */
    const constraintSets = [
      /* best: back camera, high resolution for small QR codes */
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 }, focusMode: 'continuous' }, audio: false },
      /* good: back camera, medium res */
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false },
      /* ok: back camera, any resolution */
      { video: { facingMode: 'environment' }, audio: false },
      /* fallback: any camera */
      { video: true, audio: false },
    ];

    for (const constraints of constraintSets) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (e) {
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setCamError(
            'Ruhusa ya kamera ilikataliwa.\n\n' +
            '• Chrome/Android: Bonyeza 🔒 address bar → Camera → Ruhusu\n' +
            '• Safari/iPhone: Mipangilio → Safari → Kamera → Ruhusu\n' +
            '• Firefox: Bonyeza 🔒 → Ruhusa'
          );
          setPhase(PHASE.IDLE); return;
        }
        /* try next constraint set */
      }
    }

    if (!stream) {
      setCamError('Kamera haikupatikana kwenye kifaa hiki.');
      setPhase(PHASE.IDLE); return;
    }

    /* enable torch/flash if available (helps in dark venues) */
    try {
      const track = stream.getVideoTracks()[0];
      const caps  = track.getCapabilities?.() ?? {};
      if (caps.torch) await track.applyConstraints({ advanced: [{ torch: false }] });
    } catch {}

    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) { stream.getTracks().forEach((t) => t.stop()); setPhase(PHASE.IDLE); return; }

    video.srcObject = stream;

    const onReady = () => {
      video.removeEventListener('canplay', onReady);
      video.play()
        .then(() => { setPhase(PHASE.SCANNING); startScanLoop(); })
        .catch((e) => { setCamError('Video haikuweza kuanza: ' + e.message); setPhase(PHASE.IDLE); });
    };
    video.addEventListener('canplay', onReady);

    /* safety fallback */
    setTimeout(() => {
      if (!scanningRef.current && streamRef.current && videoRef.current?.readyState >= 3) {
        video.removeEventListener('canplay', onReady);
        video.play().then(() => { setPhase(PHASE.SCANNING); startScanLoop(); }).catch(() => {});
      }
    }, 3000);
  }, [stopCamera, startScanLoop]);

  /* ── approve attendance ── */
  const handleApprove = async () => {
    if (!guestData || approving) return;
    setApproving(true);
    const uniqueCode = guestData.qrCodeData?.uniqueCode;
    try {
      const res  = await fetch(`${API}/scan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uniqueCode }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const updated = { ...guestData, attended: true, attendanceTime: new Date().toISOString() };
        setGuestData(updated);
        setGuests((prev) => prev.map((g) =>
          (g.qrCodeData?.uniqueCode === uniqueCode || g._id === guestData._id) ? updated : g
        ));
        setSessionLog((prev) => [updated, ...prev]);
        setPhase(PHASE.CONFIRMED);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
      } else {
        setGuestData((prev) => ({ ...prev, ...json.data }));
        setPhase(PHASE.ALREADY);
      }
    } catch (e) { setCamError('Hitilafu: ' + e.message); }
    finally { setApproving(false); }
  };

  const handleManual = (e) => {
    e.preventDefault();
    const val = manualInput.trim();
    if (!val) return;
    setManualInput('');
    handleCodeFound(val);
  };

  const reset = () => { stopCamera(); setGuestData(null); setCamError(null); lastCodeRef.current = ''; setPhase(PHASE.IDLE); };

  const recentAttendees = guests
    .filter((g) => g.attended)
    .sort((a, b) => new Date(b.attendanceTime) - new Date(a.attendanceTime))
    .slice(0, 6);

  const isCameraActive = phase === PHASE.SCANNING || phase === PHASE.REQUESTING;

  return (
    <div className="qs-wrap">
      {/* ── CAMERA CARD ── */}
      <div className="qs-card">
        <div className="qs-card-head">
          <span className="qs-card-title">📷 Scan QR Code ya Mwalikwa</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {phase === PHASE.SCANNING   && <span className="qs-fps-badge">{fps} fps</span>}
            {phase === PHASE.SCANNING   && <span className="qs-live-badge">● LIVE</span>}
            {phase === PHASE.REQUESTING && <span className="qs-live-badge pending">⏳ Inaomba…</span>}
          </div>
        </div>

        <div className={`qs-viewport ${isCameraActive ? 'active' : ''}`}>
          <video
            ref={videoRef} className="qs-video" playsInline muted
            style={{ display: isCameraActive ? 'block' : 'none' }}
          />
          <canvas ref={canvasRef} className="qs-canvas" />

          {phase === PHASE.SCANNING && (
            <div className="qs-corners" aria-hidden="true">
              <div className="qs-corner tl" /><div className="qs-corner tr" />
              <div className="qs-corner bl" /><div className="qs-corner br" />
              <div className="qs-scan-line" />
              {/* additional inner guide box */}
              <div className="qs-guide-box" />
            </div>
          )}

          {phase === PHASE.IDLE && (
            <div className="qs-placeholder">
              <div className="qs-placeholder-icon">📷</div>
              <p>Bonyeza "Washa Camera" kuanza ku-scan</p>
              <p style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Inatumia multi-pass detection kwa usahihi wa juu</p>
            </div>
          )}
          {phase === PHASE.REQUESTING && (
            <div className="qs-placeholder"><div className="qs-spinner" /><p>Inaomba ruhusa ya kamera…</p></div>
          )}
          {phase === PHASE.LOADING && (
            <div className="qs-placeholder" style={{ background: '#120810' }}>
              <div className="qs-spinner" /><p>QR imepatikana! Inathibitisha…</p>
            </div>
          )}
        </div>

        {camError && (
          <div className="qs-error-box">
            <span className="qs-error-icon">⚠️</span>
            <pre className="qs-error-msg">{camError}</pre>
          </div>
        )}

        <div className="qs-controls">
          {phase === PHASE.SCANNING
            ? <button className="qs-btn-ghost" onClick={reset}>✕ Zima Camera</button>
            : phase !== PHASE.REQUESTING && phase !== PHASE.LOADING
              ? <button className="qs-btn-primary" onClick={startCamera}>📷 Washa Camera</button>
              : null}
        </div>

        <form className="qs-manual" onSubmit={handleManual}>
          <input
            type="text" value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Au ingiza code kwa mkono hapa…"
          />
          <button type="submit">🔍</button>
        </form>
      </div>

      {/* ── RESULTS ── */}
      {phase === PHASE.FOUND && guestData && (
        <div className="qs-card qs-result-card">
          <div className="qs-result-header found">
            <span className="qs-result-icon">✅</span>
            <div><div className="qs-result-title">Mwalikwa Amepatikana</div><div className="qs-result-sub">Taarifa zake zipo — thibitisha uwepo wake hapa chini</div></div>
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

      {phase === PHASE.CONFIRMED && guestData && (
        <div className="qs-card qs-result-card">
          <div className="qs-result-header confirmed">
            <span className="qs-result-icon big">🎉</span>
            <div><div className="qs-result-title">Umekubaliwa!</div><div className="qs-result-sub">Uwepo umethibitishwa na kuhifadhiwa kwenye mfumo</div></div>
          </div>
          <GuestInfoBlock guest={guestData} showTime />
          <div className="qs-approve-row">
            <button className="qs-btn-primary" onClick={startCamera}>📷 Scan Mwingine</button>
          </div>
        </div>
      )}

      {phase === PHASE.ALREADY && guestData && (
        <div className="qs-card qs-result-card">
          <div className="qs-result-header already">
            <span className="qs-result-icon">⚠️</span>
            <div><div className="qs-result-title">Tayari Amewasili</div><div className="qs-result-sub">Mwalikwa huyu ameshasajiliwa awali</div></div>
          </div>
          <GuestInfoBlock guest={guestData} showTime />
          <div className="qs-approve-row">
            <button className="qs-btn-primary" onClick={startCamera}>📷 Scan Mwingine</button>
          </div>
        </div>
      )}

      {phase === PHASE.NOT_FOUND && (
        <div className="qs-card qs-result-card">
          <div className="qs-result-header notfound">
            <span className="qs-result-icon">❌</span>
            <div><div className="qs-result-title">Haipatikani</div><div className="qs-result-sub">QR code hii haipo kwenye mfumo wa harusi</div></div>
          </div>
          <p className="qs-notfound-hint">Hakikisha kadi ni halisi. Ikiwa tatizo linaendelea wasiliana na msimamizi.</p>
          <div className="qs-approve-row">
            <button className="qs-btn-primary" onClick={startCamera}>📷 Jaribu Tena</button>
          </div>
        </div>
      )}

      {sessionLog.length > 0 && (
        <div className="qs-card">
          <div className="qs-card-head"><span className="qs-card-title">✅ Waliothibitishwa Sasa ({sessionLog.length})</span></div>
          <div className="qs-recent-list">
            {sessionLog.map((g) => <RecentItem key={g._id ?? g.qrCodeData?.uniqueCode} guest={g} />)}
          </div>
        </div>
      )}

      <div className="qs-card">
        <div className="qs-card-head"><span className="qs-card-title">📋 Waliowasili ({recentAttendees.length})</span></div>
        {recentAttendees.length > 0
          ? <div className="qs-recent-list">{recentAttendees.map((g) => <RecentItem key={g._id ?? g.id} guest={g} />)}</div>
          : <p className="qs-no-data">Hakuna mgeni aliyewasili bado.</p>
        }
      </div>
    </div>
  );
}

function GuestInfoBlock({ guest, showTime }) {
  return (
    <div className="qs-guest-info">
      <div className={`qs-guest-avatar ${guest.attended ? 'confirmed' : ''}`}>{guest.name.charAt(0).toUpperCase()}</div>
      <div className="qs-guest-details">
        <InfoRow label="Jina"           value={<strong className="qs-name-val">{guest.name}</strong>} />
        <InfoRow label="Aina ya Mwaliko" value={<span className={`qs-badge ${guest.status === 'double' ? 'double' : 'single'}`}>{guest.status === 'double' ? '👥 Double' : '👤 Single'}</span>} />
        <InfoRow label="Nambari ya QR"  value={<code className="qs-code">{guest.qrCodeData?.uniqueCode}</code>} />
        <InfoRow label="Ukumbi"         value={guest.venue} />
        <InfoRow label="Tarehe / Muda"  value={`${guest.date} · ${guest.time}`} />
        {showTime && guest.attendanceTime
          ? <InfoRow label="Aliwasili Saa" value={<span className="qs-badge attended">✓ {new Date(guest.attendanceTime).toLocaleTimeString('sw-TZ')}</span>} />
          : !showTime ? <InfoRow label="Hali" value={<span className="qs-badge pending">⏳ Hajahudhuria bado</span>} /> : null
        }
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
      <span className={`qs-badge ${guest.status === 'double' ? 'double' : 'single'}`} style={{ fontSize: 10 }}>{guest.status === 'double' ? 'Double' : 'Single'}</span>
      <span className="qs-recent-time">{guest.attendanceTime ? new Date(guest.attendanceTime).toLocaleTimeString('sw-TZ') : ''}</span>
    </div>
  );
}

export default QRScanner;
