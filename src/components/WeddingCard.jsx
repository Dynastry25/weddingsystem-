import React, { useRef, useEffect, useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import bgImage from '../assets/wedd.png';
import pete from '../assets/pete.png';
import lovers from '../assets/lovers.png';

/* ── QR generator ── */
async function buildQRDataUrl(text) {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(text, {
    width: 160, margin: 1,
    color: { dark: '#0a1628', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

/* ── Shell styles ── */
const SH = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: 12, backdropFilter: 'blur(6px)',
  },
  modal: {
    background: '#0a1628', borderRadius: 14, width: '100%', maxWidth: 480,
    maxHeight: '96vh', overflowY: 'auto',
    boxShadow: '0 28px 70px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.35)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 16px', borderBottom: '1px solid rgba(201,168,76,0.3)',
  },
  headerTitle: {
    fontSize: 13, fontWeight: 600, color: '#c9a84c', letterSpacing: 0.4,
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#c9a84c', fontSize: 22, lineHeight: 1, padding: 4,
  },
  actions: {
    display: 'flex', gap: 8, padding: '13px 14px', flexWrap: 'wrap',
    borderTop: '1px solid rgba(201,168,76,0.3)',
  },
  btnPdf: {
    flex: 1, minWidth: 120, padding: '10px 0',
    background: 'linear-gradient(135deg,#7a1515,#b03030)',
    color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
    fontSize: 12, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  btnPng: {
    flex: 1, minWidth: 120, padding: '10px 0',
    background: 'linear-gradient(135deg,#15502a,#1e7a40)',
    color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
    fontSize: 12, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  btnWa: {
    flex: 1, minWidth: 120, padding: '10px 0',
    background: 'linear-gradient(135deg,#075e30,#25d366)',
    color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
    fontSize: 12, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  /* WhatsApp modal */
  waOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10000, padding: 16,
  },
  waBox: {
    background: '#111b21', borderRadius: 14, width: '100%', maxWidth: 380,
    padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
    border: '1px solid rgba(37,211,102,0.25)',
  },
  waTitle: {
    fontSize: 16, fontWeight: 700, color: '#25d366',
    marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8,
  },
  waSubtitle: {
    fontSize: 12, color: '#8696a0', marginBottom: 16, lineHeight: 1.5,
  },
  waLabel: {
    fontSize: 11, fontWeight: 600, color: '#8696a0',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  waInput: {
    width: '100%', padding: '10px 14px',
    background: '#2a3942', border: '1px solid rgba(37,211,102,0.3)',
    borderRadius: 8, color: '#ffffff', fontSize: 15,
    outline: 'none', boxSizing: 'border-box', marginBottom: 8,
  },
  waHint: {
    fontSize: 11, color: '#8696a0', marginBottom: 16,
  },
  waActions: {
    display: 'flex', gap: 10, marginTop: 4,
  },
  waBtnSend: {
    flex: 1, padding: '11px 0',
    background: 'linear-gradient(135deg,#075e30,#25d366)',
    color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  waBtnCancel: {
    flex: 1, padding: '11px 0',
    background: 'rgba(255,255,255,0.08)',
    color: '#8696a0', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  progressBar: {
    height: 4, background: 'rgba(37,211,102,0.2)',
    borderRadius: 2, overflow: 'hidden', marginBottom: 14,
  },
  progressFill: {
    height: '100%', background: '#25d366',
    borderRadius: 2, transition: 'width 0.3s ease',
  },
};

/* ══════════════════════════════════════════════════════
   WhatsApp Send Modal
══════════════════════════════════════════════════════ */
function WhatsAppModal({ guest, onClose, captureCard }) {
  const [phone,    setPhone]    = useState('');
  const [step,     setStep]     = useState('input'); // input | generating | sending | done | error
  const [progress, setProgress] = useState(0);
  const [errMsg,   setErrMsg]   = useState('');

  /* pre-fill phone from guest record if available */
  useEffect(() => {
    if (guest?.phone) setPhone(guest.phone.replace(/\D/g, ''));
  }, [guest]);

  const handleSend = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 9) {
      setErrMsg('Ingiza nambari sahihi ya simu (angalau tarakimu 9).');
      return;
    }
    setErrMsg('');
    setStep('generating');
    setProgress(20);

    try {
      /* 1. capture card as canvas */
      const canvas = await captureCard();
      setProgress(55);

      /* 2. convert to blob */
      const blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => b ? res(b) : rej(new Error('Blob failed')), 'image/jpeg', 0.92)
      );
      setProgress(75);

      /* 3. build WhatsApp URL
         Strategy A — Web Share API (mobile native, best UX)
         Strategy B — wa.me deep link with text fallback      */

      const guestName = guest?.name ?? 'Mwalikwa';
      const message   =
        `💌 *Kadi ya Mwaliko — Harusi ya Mariam Franco Magira*\n\n` +
        `Karibu ${guestName}!\n` +
        `📅 Jumanne, 09 Juni 2026\n` +
        `🕛 Saa 12 Jioni\n` +
        `📍 Mawela Hall, Sinza Vatican — Dar es Salaam\n\n` +
        `Kadi yako ya mwaliko imezungumzwa hapa chini. ` +
        `Tafadhali ihifadhi na uilete siku ya harusi kwa usajili.`;

      setProgress(85);

      /* Try Web Share API first (works great on Android/iOS Chrome) */
      if (navigator.canShare && navigator.canShare({ files: [new File([blob], 'kadi.jpg', { type: 'image/jpeg' })] })) {
        setStep('sending');
        const file = new File([blob], `kadi_${guestName.replace(/\s/g,'_')}.jpg`, { type: 'image/jpeg' });
        await navigator.share({ files: [file], text: message, title: 'Kadi ya Mwaliko' });
        setProgress(100);
        setStep('done');
        return;
      }

      /* Fallback: open wa.me with text + prompt user to attach the downloaded image */
      /* Download image first so user has it */
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = `kadi_${guestName.replace(/\s/g,'_')}.jpg`;
      link.click();
      URL.revokeObjectURL(url);
      setProgress(95);

      /* Format phone: ensure it starts with country code */
      let waPhone = cleaned;
      if (waPhone.startsWith('0')) waPhone = '255' + waPhone.slice(1);
      if (!waPhone.startsWith('255') && waPhone.length <= 10) waPhone = '255' + waPhone;

      const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank', 'noopener');

      setProgress(100);
      setStep('done');
    } catch (e) {
      if (e?.name === 'AbortError') { setStep('input'); return; } // user cancelled share sheet
      setErrMsg('Hitilafu: ' + e.message);
      setStep('error');
    }
  };

  return (
    <div style={SH.waOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={SH.waBox}>

        {/* title */}
        <div style={SH.waTitle}>
          <span style={{ fontSize: 22 }}>📱</span>
          Tuma kwa WhatsApp
        </div>
        <div style={SH.waSubtitle}>
          Kadi ya mwaliko itatumwa moja kwa moja kwenye inbox ya mgeni kama picha.
        </div>

        {/* progress bar */}
        {step !== 'input' && step !== 'error' && (
          <div style={SH.progressBar}>
            <div style={{ ...SH.progressFill, width: `${progress}%` }} />
          </div>
        )}

        {step === 'input' && (
          <>
            <div style={SH.waLabel}>Nambari ya WhatsApp ya Mwalikwa</div>
            <input
              style={SH.waInput}
              type="tel"
              placeholder="mf. 0712345678 au 255712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              autoFocus
            />
            <div style={SH.waHint}>
              💡 Nambari ya Tanzania ianze na 0 au 255. Nchi nyingine ongeza code ya nchi.
            </div>
            {errMsg && (
              <div style={{ fontSize: 12, color: '#f87171', marginBottom: 12, padding: '8px 12px', background: 'rgba(248,113,113,0.1)', borderRadius: 6 }}>
                ⚠️ {errMsg}
              </div>
            )}
            <div style={SH.waActions}>
              <button style={SH.waBtnCancel} onClick={onClose}>Ghairi</button>
              <button style={SH.waBtnSend} onClick={handleSend}>
                <span style={{ fontSize: 16 }}>📤</span> Tuma Sasa
              </button>
            </div>
          </>
        )}

        {step === 'generating' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 13, color: '#8696a0', marginBottom: 8 }}>⏳ Inatengeneza kadi…</div>
            <div style={{ fontSize: 12, color: '#25d366' }}>{progress}%</div>
          </div>
        )}

        {step === 'sending' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 13, color: '#25d366' }}>📤 Inafungua WhatsApp…</div>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#25d366', marginBottom: 6 }}>
              Kadi imetumwa!
            </div>
            <div style={{ fontSize: 12, color: '#8696a0', marginBottom: 16, lineHeight: 1.6 }}>
              Ikiwa WhatsApp haikufunguka otomatiki, angalia picha iliyopakuliwa
              na uitume mwenyewe kwa nambari {phone}.
            </div>
            <button style={{ ...SH.waBtnSend, maxWidth: 160, margin: '0 auto' }} onClick={onClose}>
              Sawa ✓
            </button>
          </div>
        )}

        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 13, color: '#f87171', marginBottom: 12 }}>❌ {errMsg}</div>
            <div style={SH.waActions}>
              <button style={SH.waBtnCancel} onClick={onClose}>Funga</button>
              <button style={{ ...SH.waBtnSend, background: '#25d366' }} onClick={() => { setStep('input'); setErrMsg(''); }}>
                Jaribu Tena
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Main WeddingCard Component
══════════════════════════════════════════════════════ */
function WeddingCard({ guest, onClose }) {
  const cardRef             = useRef(null);
  const [busy, setBusy]     = useState(false);
  const [qrDataUrl, setQr]  = useState('');
  const [showWA,   setShowWA] = useState(false);

  if (!guest) return null;
  const isDouble = guest.status === 'double';

  useEffect(() => {
    setQr('');
    let cancelled = false;
    const code = guest.qrCodeData?.uniqueCode
      ?? String(guest._id ?? guest.id ?? 'UNKNOWN').substring(0, 8);
    buildQRDataUrl(JSON.stringify({ uniqueCode: code, name: guest.name, status: guest.status }))
      .then((url) => { if (!cancelled) setQr(url); })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [guest._id, guest.id, guest.name, guest.status, guest.qrCodeData?.uniqueCode]);

  const capture = useCallback(() =>
    html2canvas(cardRef.current, {
      scale: 3, useCORS: true, allowTaint: true,
      logging: false, imageTimeout: 8000,
    }), []);

  const downloadPNG = async () => {
    if (busy || !qrDataUrl) return;
    setBusy(true);
    try {
      const c = await capture();
      const a = document.createElement('a');
      a.download = `kadi_${guest.name.replace(/\s/g, '_')}.png`;
      a.href = c.toDataURL('image/png'); a.click();
    } catch { alert('PNG haikutengenezwa.'); }
    setBusy(false);
  };

  const downloadPDF = async () => {
    if (busy || !qrDataUrl) return;
    setBusy(true);
    try {
      const c = await capture();
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const w = 210, h = (c.height * w) / c.width;
      pdf.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, w, h);
      pdf.save(`kadi_${guest.name.replace(/\s/g, '_')}.pdf`);
    } catch { alert('PDF haikutengenezwa.'); }
    setBusy(false);
  };

  const f = (px) => `${px}px`;

  return (
    <>
      <div style={SH.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={SH.modal}>

          <div style={SH.header}>
            <span style={SH.headerTitle}>💌 Kadi ya Mwaliko — {guest.name}</span>
            <button style={SH.closeBtn} onClick={onClose} aria-label="Funga">×</button>
          </div>

          {/* ══ PRINTABLE CARD ══ */}
          <div ref={cardRef} style={{
            position: 'relative', width: '100%',
            aspectRatio: '820 / 1123', overflow: 'hidden',
            fontFamily: 'Montserrat, serif',
          }}>
            <img src={bgImage} alt="" crossOrigin="anonymous" style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'top center', display: 'block',
            }} />

            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', padding: '4% 9% 3%', boxSizing: 'border-box',
            }}>
              <div style={{ fontFamily: "'Dancing Script','Brush Script MT',cursive", fontSize: f(18), color: '#f5c518', marginBottom: '1%', marginTop: '1%', letterSpacing: 0.3 }}>Familia ya</div>
              <div style={{ textAlign: 'center', marginBottom: '1%' }}>
                <div style={{ fontWeight: 700, fontSize: f(11), color: '#ffffff', letterSpacing: 0.8, textTransform: 'uppercase', lineHeight: 1.55 }}>
                  BWANA &amp; BIBI JOSEPH RUTTA WA<br />
                  DAR ES SALAAM KWA UPENDO WA DHATI WANAYO<br />
                  FURAHA KUBWA KUKUALIKA/KUWAALIKA
                </div>
              </div>

              <div style={{ fontSize: f(16), fontWeight: 700, color: '#f5c518', lineHeight: 1.2 }}>{guest.name}</div>
              <div style={{ width: '80%', borderTop: '1px dashed #f5c518', margin: '1.5% 0' }} />

              <div style={{ fontFamily: "'Dancing Script','Brush Script MT',cursive", fontSize: f(28), color: '#ffffff', lineHeight: 1, marginBottom: '1%', textShadow: '1px 2px 6px rgba(0,0,0,0.5)' }}>Kwenye</div>
              <div style={{ fontWeight: 900, fontSize: f(32), color: '#f5c518', letterSpacing: 3, textTransform: 'uppercase', lineHeight: 1 }}>HARUSI</div>
              <div style={{ fontSize: f(10), color: '#c0c8d8', letterSpacing: 0.5, margin: '1% 0 1.5%' }}>ya vijana wao wapendwa</div>

              <div style={{ fontFamily: "'Dancing Script','Brush Script MT',cursive", fontSize: f(30), color: '#ffffff', lineHeight: 1.1, textShadow: '1px 2px 8px rgba(0,0,0,0.55)' }}>Jovin</div>
              <div style={{ fontSize: f(20), color: '#c9a84c', margin: '0.5% 0', opacity: '50%' }}>&</div>
              <img src={pete} alt="" crossOrigin="anonymous" style={{ position: 'absolute', top: '38%', left: '170px', opacity: '70%', width: '25%', height: 'auto', objectFit: 'cover', objectPosition: 'center', display: 'flex' }} />
              <div style={{ fontFamily: "'Dancing Script','Brush Script MT',cursive", fontSize: f(30), color: '#ffffff', lineHeight: 1.1, textShadow: '1px 2px 8px rgba(0,0,0,0.55)', marginBottom: '2%' }}>Christina</div>

              <div style={{ display: 'flex', width: '90%', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5%', borderTop: '2px solid #f5c518', borderBottom: '2px solid #f5c518', padding: '1.5% 0' }}>
                <div style={{ flex: 1, textAlign: 'center', paddingRight: 4 }}>
                  <div style={{ fontWeight: 900, fontSize: f(10), color: '#ffffff', textDecoration: 'underline', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>KANISANI</div>
                  <div style={{ fontWeight: 700, fontSize: f(9), color: '#c0c8d8', lineHeight: 1.6, textTransform: 'uppercase' }}>KKKT - KIJITONYAMA<br />SAA 8 MCHANA</div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 70 }}>
                  <div style={{ fontWeight: 900, fontSize: f(12), color: '#f5c518', letterSpacing: 2, textTransform: 'uppercase' }}>JUNI</div>
                  <div style={{ fontWeight: 800, fontSize: f(25), color: '#f5c518', lineHeight: 1 }}>14</div>
                  <div style={{ fontWeight: 900, fontSize: f(14), color: '#ffffff' }}>2026</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', paddingLeft: 4 }}>
                  <div style={{ fontWeight: 900, fontSize: f(10), color: '#ffffff', textDecoration: 'underline', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>UKUMBINI</div>
                  <div style={{ fontWeight: 700, fontSize: f(9), color: '#c0c8d8', lineHeight: 1.6, textTransform: 'uppercase' }}>MAWELA HALL -<br />SINZA VATICAN<br />SAA 12 JIONI</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '80%', marginBottom: '1.5%' }}>
                <div style={{ fontFamily: "'Dancing Script','Brush Script MT',cursive", fontSize: f(14), color: '#f5c518', flexShrink: 0, lineHeight: 1.2 }}>Dressing<br />Code</div>
                <div style={{ fontSize: f(9), color: '#ffffff', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>LAVENDER, DUSTY ROSE, SAGE GREEN, BROWN, OFF WHITE</div>
              </div>

              <div style={{ display: 'inline-block', border: `1px solid ${isDouble ? '#f5c518' : 'rgba(255,255,255,0.4)'}`, color: isDouble ? '#fff' : '#c0c8d8', fontSize: f(8), fontWeight: 800, padding: '2px 5px', borderRadius: 20, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 1 }}>
                {isDouble ? ' DOUBLE' : ' SINGLE'}
              </div>

              <img src={lovers} alt="" crossOrigin="anonymous" style={{ position: 'absolute', top: '20%', right: '75px', opacity: '40%', width: '30%', height: 'auto', objectFit: 'cover', objectPosition: 'center', display: 'flex' }} />

              <div style={{ width: '28%', height: '105px', border: '2px solid #f5c518', borderRadius: 6, overflow: 'hidden', position: 'relative', background: 'rgba(10,22,40,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5%' }}>
                <div style={{ padding: '1% 4% 4%', textAlign: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {qrDataUrl
                      ? <img src={qrDataUrl} alt="QR Code" style={{ width: 100, height: 100, display: 'block', borderRadius: 6, border: '2px solid rgba(201,168,76,0.5)' }} />
                      : <div style={{ width: 100, height: 100, borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: f(9), color: '#c9a84c' }}>QR...</div>
                    }
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 900, fontSize: f(11), color: '#ffffff', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>MAWASILIANO</div>
                <div style={{ fontSize: f(10), color: '#c0c8d8', letterSpacing: 0.5 }}>+255 767 100 833 / +255 754 028 185</div>
              </div>
            </div>
          </div>

          {/* ── download + WhatsApp buttons ── */}
          <div style={SH.actions}>
            <button
              style={{ ...SH.btnPdf, opacity: busy || !qrDataUrl ? 0.6 : 1 }}
              onClick={downloadPDF} disabled={busy || !qrDataUrl}
            >
              📄 {busy ? 'Inatengeneza…' : 'Pakua PDF'}
            </button>
            <button
              style={{ ...SH.btnPng, opacity: busy || !qrDataUrl ? 0.6 : 1 }}
              onClick={downloadPNG} disabled={busy || !qrDataUrl}
            >
              🖼️ {busy ? 'Inatengeneza…' : 'Pakua PNG'}
            </button>
            <button
              style={{ ...SH.btnWa, opacity: busy || !qrDataUrl ? 0.6 : 1 }}
              onClick={() => setShowWA(true)} disabled={busy || !qrDataUrl}
            >
              <span style={{ fontSize: 16 }}>📱</span>
              {busy ? '…' : 'WhatsApp'}
            </button>
          </div>

        </div>
      </div>

      {/* WhatsApp send modal */}
      {showWA && (
        <WhatsAppModal
          guest={guest}
          onClose={() => setShowWA(false)}
          captureCard={capture}
        />
      )}
    </>
  );
}

export default WeddingCard;
