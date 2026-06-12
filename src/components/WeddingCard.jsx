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

/* ── Shell styles (modal frame — NOT captured by html2canvas) ── */
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
    fontSize: 13, fontWeight: 600, color: '#c9a84c',
     letterSpacing: 0.4,
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#c9a84c', fontSize: 22, lineHeight: 1, padding: 4,
  },
  actions: {
    display: 'flex', gap: 10, padding: '13px 14px',
    borderTop: '1px solid rgba(201,168,76,0.3)',
  },
  btnPdf: {
    flex: 1, padding: '10px 0',
    background: 'linear-gradient(135deg,#7a1515,#b03030)',
    color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnPng: {
    flex: 1, padding: '10px 0',
    background: 'linear-gradient(135deg,#15502a,#1e7a40)',
    color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
};

function WeddingCard({ guest, onClose }) {
  const cardRef             = useRef(null);
  const [busy, setBusy]     = useState(false);
  const [qrDataUrl, setQr]  = useState('');

  if (!guest) return null;
  const isDouble = guest.status === 'double';

  /* generate QR once per guest */
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

  /* ── font sizes scale with card width via vw-like units ── */
  const f = (px) => `${px}px`;

  return (
    <div style={SH.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={SH.modal}>

        {/* modal header */}
        <div style={SH.header}>
          <span style={SH.headerTitle}>💌 Kadi ya Mwaliko — {guest.name}</span>
          <button style={SH.closeBtn} onClick={onClose} aria-label="Funga">×</button>
        </div>

        {/* ══════════════ PRINTABLE CARD ══════════════ */}
        <div
          ref={cardRef}
          style={{
            position: 'relative',
            width: '100%',
            /* keep original image aspect ratio: 709803.png is ~820×1123px ≈ 1:1.37 */
            aspectRatio: '820 / 1123',
            overflow: 'hidden',
            fontFamily: 'Montserrat, serif',
          }}
        >
          {/* ── background image ── */}
          <img
            src={bgImage}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'top center',
              display: 'block',
            }}
          />

          {/* ── text overlay — everything positioned to match the image layout ── */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center',
            /* padding mirrors the image's internal margins */
            padding: '4% 9% 3%',
            boxSizing: 'border-box',
          }}>

            {/* ① "Familia ya" script */}
            <div style={{
              fontFamily: "'Dancing Script','Brush Script MT',cursive",
              fontSize: f(18), color: '#f5c518',
              marginBottom: '1%', marginTop: '1%', letterSpacing: 0.3,
            }}>
              Familia ya
            </div>

            {/* ② Family names */}
            <div style={{ textAlign: 'center', marginBottom: '1%' }}>
              <div style={{
                fontWeight: 700, fontSize: f(11), color: '#ffffff',
                letterSpacing: 0.8, textTransform: 'uppercase', lineHeight: 1.55,
              }}>
                BWANA &amp; BIBI JOSEPH RUTTA WA<br />
                DAR ES SALAAM KWA UPENDO WA DHATI WANAYO<br />
                FURAHA KUBWA KUKUALIKA/KUWAALIKA
              </div>
            </div>

            {/* guest name */}
                <div style={{
                  fontSize: f(16), fontWeight: 700, color: '#f5c518',
                  lineHeight: 1.2,
                }}>
                  {guest.name}
                </div>

            {/* ③ dashed line — mimic original */}
            <div style={{
              width: '80%', borderTop: '1px dashed #f5c518',
              margin: '1.5% 0',
            }} />

            {/* ④ "Kwenye" script */}
            <div style={{
              fontFamily: "'Dancing Script','Brush Script MT',cursive",
              fontSize: f(28), color: '#ffffff',
              lineHeight: 1, marginBottom: '1%',
              textShadow: '1px 2px 6px rgba(0,0,0,0.5)',
            }}>
              Kwenye
            </div>

            {/* ⑤ HARUSI bold yellow */}
            <div style={{
              fontWeight: 900, fontSize: f(32), color: '#f5c518',
              letterSpacing: 3, textTransform: 'uppercase', lineHeight: 1,
            }}>
              HARUSI
            </div>

            {/* ⑥ sub-label */}
            <div style={{
              fontSize: f(10), color: '#c0c8d8', letterSpacing: 0.5,
              margin: '1% 0 1.5%',
            }}>
              ya vijana wao wapendwa
            </div>

            {/* ⑦ Bride name (Mariam = "Jovin" slot) */}
            <div style={{
              fontFamily: "'Dancing Script','Brush Script MT',cursive",
              fontSize: f(30), color: '#ffffff', lineHeight: 1.1,
              textShadow: '1px 2px 8px rgba(0,0,0,0.55)',
            }}>
              Jovin
            </div>

            {/* ⑧ rings */}
            <div style={{ fontSize: f(20), color: '#c9a84c', margin: '0.5% 0',opacity: '50%' }}>
              &

            </div>
             <img
            src={pete}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: 'absolute',  top: '38%', left: '170px', opacity: '70%',
              width: '25%', height: 'auto',
              objectFit: 'cover', objectPosition: 'center',
              display: 'flex',
            }}
             />


            {/* ⑨ groom/family name (Franco Magira = "Christina" slot) */}
            <div style={{
              fontFamily: "'Dancing Script','Brush Script MT',cursive",
              fontSize: f(30), color: '#ffffff', lineHeight: 1.1,
              textShadow: '1px 2px 8px rgba(0,0,0,0.55)',
              marginBottom: '2%',
            }}>
              Christina
            </div>

            {/* ⑩ KANISANI / DATE / UKUMBINI row */}
            <div style={{
              display: 'flex', width: '90%', justifyContent: 'space-between',
              alignItems: 'flex-start', marginBottom: '1.5%',
              borderTop: '2px solid #f5c518',
              borderBottom: '2px solid #f5c518',
              padding: '1.5% 0',
            }}>
              {/* left: Kanisani */}
              <div style={{ flex: 1, textAlign: 'center', paddingRight: 4 }}>
                <div style={{
                  fontWeight: 900, fontSize: f(10), color: '#ffffff',
                  textDecoration: 'underline', letterSpacing: 1,
                  textTransform: 'uppercase', marginBottom: 4,
                }}>
                  KANISANI
                </div>
                <div style={{ fontWeight: 700, fontSize: f(9), color: '#c0c8d8', lineHeight: 1.6, textTransform: 'uppercase' }}>
                  KKKT - KIJITONYAMA<br />SAA 8 MCHANA
                </div>
              </div>

              {/* center: date */}
              <div style={{ textAlign: 'center', minWidth: 70 }}>
                <div style={{
                  fontWeight: 900, fontSize: f(12), color: '#f5c518',
                  letterSpacing: 2, textTransform: 'uppercase',
                }}>
                  JUNI
                </div>
                <div style={{
                  fontWeight: 800, fontSize: f(25), color: '#f5c518',
                  lineHeight: 1,
                }}>
                  14
                </div>
                <div style={{
                  fontWeight: 900, fontSize: f(14), color: '#ffffff',
                }}>
                  2026
                </div>
              </div>

              {/* right: Ukumbini */}
              <div style={{ flex: 1, textAlign: 'center', paddingLeft: 4 }}>
                <div style={{
                  fontWeight: 900, fontSize: f(10), color: '#ffffff',
                  textDecoration: 'underline', letterSpacing: 1,
                  textTransform: 'uppercase', marginBottom: 4,
                }}>
                  UKUMBINI
                </div>
                <div style={{ fontWeight: 700, fontSize: f(9), color: '#c0c8d8', lineHeight: 1.6, textTransform: 'uppercase' }}>
                  MAWELA HALL -<br />SINZA VATICAN<br />SAA 12 JIONI
                </div>
              </div>
            </div>

            {/* ⑪ Dressing Code */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '80%', marginBottom: '1.5%',
            }}>
              <div style={{
                fontFamily: "'Dancing Script','Brush Script MT',cursive",
                fontSize: f(14), color: '#f5c518', flexShrink: 0, lineHeight: 1.2,
              }}>
                Dressing<br />Code
              </div>
              <div style={{
                fontSize: f(9), color: '#ffffff', fontWeight: 600,
                letterSpacing: 0.5, textTransform: 'uppercase',
              }}>
                LAVENDER, DUSTY ROSE, SAGE GREEN, BROWN, OFF WHITE
              </div>
            </div>

                            {/* single / double badge */}
                <div style={{
                  display: 'inline-block',
                  
                  border: `1px solid ${isDouble ? '#f5c518' : 'rgba(255,255,255,0.4)'}`,
                  color: isDouble ? '#fff' : '#c0c8d8',
                  fontSize: f(8), fontWeight: 800, padding: '2px 5px',
                  borderRadius: 20, letterSpacing: 1, textTransform: 'uppercase',
                  marginBottom: 1,
                }}>
                  {isDouble ? ' DOUBLE' : ' SINGLE'}
                </div>

                 <img
            src={lovers}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: 'absolute',  top: '20%', right: '75px', opacity: '40%',
              width: '30%', height: 'auto',
              objectFit: 'cover', objectPosition: 'center',
              display: 'flex',
            }}
             />

            {/* ⑫ GUEST NAME + QR BOX — replaces the large empty box in original */}
            <div style={{
              width: '28%',
              height: '105px',
              border: '2px solid #f5c518',
              borderRadius: 6,
              overflow: 'hidden',
              position: 'relative',
              background: 'rgba(10,22,40,0.55)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '1.5%',
            }}>

              {/* guest info inside box */}
              <div style={{ padding: '1% 4% 4%', textAlign: 'center', width: '100%' }}>
                {/* mwalikwa label */}

                {/* QR code */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {qrDataUrl
                    ? <img
                        src={qrDataUrl}
                        alt="QR Code"
                        style={{
                          width: 100, height: 100, display: 'block',
                          borderRadius: 6,
                          border: '2px solid rgba(201,168,76,0.5)',
                        }}
                      />
                    : <div style={{
                        width: 100, height: 100, borderRadius: 6,
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(201,168,76,0.3)',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: f(9), color: '#c9a84c',
                      }}>
                        QR...
                      </div>
                  }
                </div>
              </div>
            </div>

            {/* ⑬ MAWASILIANO */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontWeight: 900, fontSize: f(11), color: '#ffffff',
                letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3,
              }}>
                MAWASILIANO
              </div>
              <div style={{ fontSize: f(10), color: '#c0c8d8', letterSpacing: 0.5 }}>
                +255 767 100 833 / +255 754 028 185
              </div>
            </div>

          </div>{/* end overlay */}
        </div>{/* end printable card */}

        {/* download buttons */}
        <div style={SH.actions}>
          <button
            style={{ ...SH.btnPdf, opacity: busy || !qrDataUrl ? 0.6 : 1 }}
            onClick={downloadPDF}
            disabled={busy || !qrDataUrl}
          >
            📄 {busy ? 'Inatengeneza…' : 'Pakua PDF'}
          </button>
          <button
            style={{ ...SH.btnPng, opacity: busy || !qrDataUrl ? 0.6 : 1 }}
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
