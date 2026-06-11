import React, { useRef, useEffect, useState, useCallback } from 'react';
import html2canvas from 'html2canvas';

/* ─── All styles inline so html2canvas captures them cleanly ─── */
const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: 16, backdropFilter: 'blur(4px)',
  },
  shell: {
    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500,
    maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
  },
  shellHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', borderBottom: '1px solid #ede0e8',
  },
  shellTitle: { fontSize: 15, fontWeight: 600, color: '#5a2d4a', fontFamily: 'Georgia, serif' },
  closeX: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9a7a8a', lineHeight: 1, padding: 4 },

  card: {
    margin: '16px 16px 0', borderRadius: 12, overflow: 'hidden', position: 'relative',
    background: 'linear-gradient(160deg, #e8ddf0 0%, #f5e6ee 30%, #fdf4f0 55%, #f0e8f5 80%, #e6dced 100%)',
    fontFamily: 'Georgia, serif',
  },
  goldFrame:      { position: 'absolute', inset: 8,  border: '1.5px solid #c9a84c', borderRadius: 8, pointerEvents: 'none', zIndex: 2 },
  goldFrameInner: { position: 'absolute', inset: 13, border: '0.5px solid #c9a84c', borderRadius: 6, pointerEvents: 'none', zIndex: 2 },
  floralTL: { position: 'absolute', top: 0,    left: 0,   width: 140, height: 170, background: 'radial-gradient(ellipse at 15% 15%, rgba(160,90,150,0.5) 0%, rgba(140,80,170,0.28) 40%, transparent 68%)', pointerEvents: 'none' },
  floralTR: { position: 'absolute', top: 0,    right: 0,  width: 130, height: 150, background: 'radial-gradient(ellipse at 85% 15%, rgba(150,80,170,0.45) 0%, rgba(170,120,190,0.22) 45%, transparent 68%)', pointerEvents: 'none' },
  floralBR: { position: 'absolute', bottom: 0, right: 0,  width: 160, height: 180, background: 'radial-gradient(ellipse at 90% 90%, rgba(190,110,150,0.55) 0%, rgba(160,90,175,0.28) 45%, transparent 68%)', pointerEvents: 'none' },
  floralBL: { position: 'absolute', bottom: 0, left: 0,   width: 110, height: 140, background: 'radial-gradient(ellipse at 10% 90%, rgba(165,100,135,0.38) 0%, rgba(145,80,165,0.2) 45%, transparent 68%)', pointerEvents: 'none' },

  inner:         { position: 'relative', zIndex: 3, padding: '26px 30px 20px' },
  medallion:     { width: 40, height: 40, margin: '0 auto 10px', border: '1.5px solid #c9a84c', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9a84c', fontSize: 15 },
  hostText:      { textAlign: 'center', fontSize: 12.5, lineHeight: 1.8, color: '#3a2030', marginBottom: 8 },
  ornament:      { textAlign: 'center', color: '#c9a84c', fontSize: 13, margin: '6px 0', letterSpacing: 5 },
  honorific:     { textAlign: 'center', fontWeight: 700, fontSize: 12.5, color: '#7a3a8a', letterSpacing: 0.3, marginBottom: 2 },
  honorificSub:  { textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#3a9a5a', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  dashedLine:    { borderTop: '1.5px dashed #c9a84c', margin: '8px 20px' },
  subText:       { textAlign: 'center', fontSize: 12.5, color: '#3a2030', margin: '8px 0 2px' },
  brideName: {
    textAlign: 'center', fontSize: 32, fontWeight: 400, color: '#8b1a3a',
    fontFamily: "'Dancing Script', 'Brush Script MT', cursive",
    lineHeight: 1.2, margin: '4px 0 2px', textShadow: '0 1px 3px rgba(139,26,58,0.18)',
  },
  guestPill: {
    background: 'none', padding: '2px',
    margin: ' 1px', textAlign: 'center',
  },
  guestPillLabel: { fontSize: 9.5, color: '#9a6a7a', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 2 },
  guestPillName:  { fontSize: 15, fontWeight: 700, color: '#5a1a3a', textAlign: 'center' },
  badge: { display: 'inline-block', marginTop: 4, fontSize: 10, padding: '2px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: 0.5 },

  infoRow:   { display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', margin: '10px 0 6px', gap: 2 },
  infoCol:   { flex: 1, textAlign: 'center', padding: '0 2px' },
  infoEmoji: { fontSize: 17, marginBottom: 2, display: 'block' },
  infoLabel: { fontWeight: 700, fontSize: 11.5, display: 'block', marginBottom: 2 },
  infoVal:   { fontSize: 11, color: '#3a2030', lineHeight: 1.5 },
  vLine:     { width: 1, alignSelf: 'stretch', background: '#c9a84c', opacity: 0.35, margin: '0 2px' },

  bottomRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8, paddingTop: 8, borderTop: '1px dashed rgba(201,168,76,0.45)', gap: 10 },
  contactTitle: { fontFamily: "'Brush Script MT', cursive", fontSize: 13.5, color: '#6a3a5a', marginBottom: 5 },
  contactLine:  { fontSize: 10, color: '#3a2030', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 },
  dressTitle:   { fontFamily: "'Brush Script MT', cursive", fontSize: 13.5, color: '#6a3a5a', marginBottom: 4, textAlign: 'right' },
  dressItem:    { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginBottom: 3, fontSize: 10.5, color: '#3a2030' },
  dot:          { width: 10, height: 10, borderRadius: '50%', flexShrink: 0, border: '1px solid rgba(0,0,0,0.15)' },

  /* QR section — single img tag, no wrapper div that gets re-rendered */
  qrRow:       { display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 4 },
  qrBox:       { background: '#fff', padding: 3, borderRadius: 4, border: '1px solid #c9a84c', lineHeight: 0 },
  qrImg:       { display: 'block', width: 58, height: 58, borderRadius: 2 },
  doubleBadge: { background: '#3a2030', color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 7px', borderRadius: 3, letterSpacing: 1, textTransform: 'uppercase', alignSelf: 'flex-end', marginBottom: 1 },

  actions: { display: 'flex', gap: 10, padding: '14px 16px' },
  btnPdf:  { flex: 1, padding: '9px 0', background: '#8b1a3a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnPng:  { flex: 1, padding: '9px 0', background: '#3a6a2a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
};

const DRESS_COLORS = [
  ['#b09ac0', 'Lavender'],
  ['#c98a8a', 'Dusty Rose'],
  ['#7a9a7a', 'Sage green'],
  ['#6a4a3a', 'Brown'],
];

/* ── generate QR as a data-URL string (not a DOM node) ── */
async function buildQRDataUrl(text) {
  /* lazy-load qrcode lib */
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(text, {
    width:  58,
    margin: 1,
    color:  { dark: '#3a2030', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

function WeddingCard({ guest, onClose }) {
  const cardRef       = useRef(null);
  const [busy,   setBusy]   = useState(false);
  /* single data-URL — rendered as one <img>, never duplicated */
  const [qrDataUrl, setQrDataUrl] = useState('');

  if (!guest) return null;
  const isDouble = guest.status === 'double';

  /* ── generate QR once whenever guest changes ── */
  useEffect(() => {
    setQrDataUrl(''); // clear old QR immediately
    const code = guest.qrCodeData?.uniqueCode ?? String(guest._id ?? guest.id ?? 'UNKNOWN').substring(0, 8);
    const payload = JSON.stringify({ uniqueCode: code, name: guest.name, status: guest.status });

    let cancelled = false;
    buildQRDataUrl(payload)
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(console.error);

    return () => { cancelled = true; }; // cleanup if guest changes mid-render
  }, [guest._id, guest.id, guest.name, guest.status, guest.qrCodeData?.uniqueCode]);

  /* ── capture card as canvas ── */
  const capture = useCallback(() =>
    html2canvas(cardRef.current, {
      scale: 3, useCORS: true, logging: false,
      backgroundColor: '#f5e6ee',
      /* tell html2canvas to wait for the QR image */
      allowTaint: false,
      imageTimeout: 5000,
    }),
  []);

  const downloadPNG = async () => {
    if (busy || !qrDataUrl) return;
    setBusy(true);
    try {
      const c = await capture();
      const a = document.createElement('a');
      a.download = `kadi_${guest.name.replace(/\s/g, '_')}.png`;
      a.href = c.toDataURL('image/png');
      a.click();
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

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.shell}>
        <div style={S.shellHead}>
          <span style={S.shellTitle}>Kadi ya Mwaliko</span>
          <button style={S.closeX} onClick={onClose} aria-label="Funga">×</button>
        </div>

        {/* ══ PRINTABLE CARD — captured by html2canvas ══ */}
        <div ref={cardRef} style={S.card}>
          {/* floral corners */}
          <div style={S.floralTL} /><div style={S.floralTR} />
          <div style={S.floralBR} /><div style={S.floralBL} />
          {/* gold border frames */}
          <div style={S.goldFrame} /><div style={S.goldFrameInner} />

          <div style={S.inner}>
            {/* medallion */}
            <div style={S.medallion}>♥</div>

            {/* host family text */}
            <p style={S.hostText}>
              Familia ya Mr. &amp; Mrs Franco Magira<br />
              wa Kipunguni-B, Dar es salaam<br />
              kwa kushirikiana na kamati ya maandalizi,<br />
              wanayo furaha kubwa kukukaribisha/kuwakaribisha
            </p>

            <div style={S.ornament}>~ · · ~</div>
            <div style={S.honorific}>Mh/Mch/Prof/Dr/CPA/Bw &amp; Bi/Ndg/Mwl/Eng</div>
            <div style={S.honorificSub}>MR &amp; MRS. ELIAM KYARUZI</div>
              <div style={S.guestPillName}>{guest.name}</div>
            <div style={S.dashedLine} />
            <p style={S.subText}>kwenye sherehe ya kumuaga binti yao mpendwa</p>
            <div style={S.brideName}>Mariam Franco Magira</div>
            <div style={S.ornament}>✦ · ♥ · ✦</div>

            {/* guest name pill */}
            <div style={S.guestPill}>
              <span style={{
                ...S.badge,
                background: isDouble ? '#e8d5f0' : '#d5e8f0',
                color:      isDouble ? '#6a2a8a' : '#1a5a8a',
              }}>
                {isDouble ? '👥 DOUBLE' : '👤 SINGLE'}
              </span>
            </div>

            {/* venue / date / time */}
            <div style={S.infoRow}>
              <div style={S.infoCol}>
                <span style={S.infoEmoji}></span>
                <span style={{ ...S.infoLabel, color: '#7a3a8a' }}>Mahali:</span>
                <span style={S.infoVal}>Mawela Hall,<br />Sinza Vatican -<br />Dar es Salaam</span>
              </div>
              <div style={S.vLine} />
              <div style={S.infoCol}>
                <span style={S.infoEmoji}>📅</span>
                <span style={{ ...S.infoLabel, color: '#8a6a10' }}>Tarehe:</span>
                <span style={S.infoVal}>Jumanne,<br />09 Juni 2026</span>
              </div>
              <div style={S.vLine} />
              <div style={S.infoCol}>
                <span style={S.infoEmoji}>🕛</span>
                <span style={{ ...S.infoLabel, color: '#3a6a3a' }}>Muda:</span>
                <span style={S.infoVal}>Saa 12:00<br />jioni</span>
              </div>
            </div>

            {/* contacts + dress code + QR */}
            <div style={S.bottomRow}>
              {/* left: contacts + single QR */}
              <div style={{ flex: 1 }}>
                <div style={S.contactTitle}>Mawasiliano zaidi:</div>
                <div style={S.contactLine}>✱ Franco Magira: 0767 100 833</div>
                <div style={S.contactLine}>✱ Japhet Matiko Werema: 0754 028 185</div>
                <div style={S.contactLine}>✱ Mama Mwenda: 0784 864 974</div>

                {/* ── SINGLE QR CODE — one <img> tag, data-URL, no library DOM injection ── */}
                <div style={S.qrRow}>
                  <div style={S.qrBox}>
                    {qrDataUrl
                      ? <img src={qrDataUrl} alt="QR Code" style={S.qrImg} />
                      : <div style={{ ...S.qrImg, background: '#f0e8ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#9a7080' }}>...</div>
                    }
                  </div>
                  {isDouble && <div style={S.doubleBadge}>DOUBLE</div>}
                </div>
              </div>

              {/* right: dress code */}
              <div style={{ flexShrink: 0 }}>
                <div style={S.dressTitle}>Dress Code</div>
                {DRESS_COLORS.map(([color, label]) => (
                  <div key={label} style={S.dressItem}>
                    <span>{label}</span>
                    <div style={{ ...S.dot, background: color }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* download buttons */}
        <div style={S.actions}>
          <button
            style={{ ...S.btnPdf, opacity: busy || !qrDataUrl ? 0.6 : 1 }}
            onClick={downloadPDF}
            disabled={busy || !qrDataUrl}
          >
            📄 {busy ? 'Inatengeneza…' : 'Pakua PDF'}
          </button>
          <button
            style={{ ...S.btnPng, opacity: busy || !qrDataUrl ? 0.6 : 1 }}
            onClick={downloadPNG}
            disabled={busy || !qrDataUrl}
          >
            🖼️ {busy ? 'Inatengeneza…' : 'Pakua PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WeddingCard;
