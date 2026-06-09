import React, { useRef, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './WeddingCard.css';

function WeddingCard({ guest, onClose }) {
  const cardRef = useRef(null);
  const [qrUrl, setQrUrl] = useState('');
  const [generating, setGenerating] = useState(false);

  if (!guest) return null;

  /* ── Resolve QR data ── */
  const getQrData = () => {
    try {
      if (guest.qrCodeData && typeof guest.qrCodeData === 'object') return guest.qrCodeData;
      if (guest.qrCode) return JSON.parse(guest.qrCode);
    } catch { /* fall through */ }
    return {
      uniqueCode: guest.id?.toString().substring(0, 8) ?? 'UNKNOWN',
      name: guest.name ?? 'Guest',
      phone: guest.phone ?? '',
      status: guest.status ?? 'single',
    };
  };

  const qrData = getQrData();

  useEffect(() => {
    QRCode.toDataURL(
      JSON.stringify({
        uniqueCode: qrData.uniqueCode ?? 'UNKNOWN',
        name: guest.name,
        phone: guest.phone,
        status: guest.status,
      }),
      { width: 120, margin: 2, color: { dark: '#3a1a2a', light: '#ffffff' } }
    )
      .then(setQrUrl)
      .catch(console.error);
  }, [guest, qrData.uniqueCode]);

  const formatDate = (d) => {
    if (!d) return 'Saturday, 18 December 2025';
    try {
      return new Date(d).toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch {
      return d;
    }
  };

  /* ── Canvas capture helper ── */
  const captureCard = () =>
    html2canvas(cardRef.current, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#fdf6f0',
    });

  /* ── PNG download ── */
  const downloadPNG = async () => {
    if (!cardRef.current || generating) return;
    setGenerating(true);
    try {
      const canvas = await captureCard();
      const a = document.createElement('a');
      a.download = `invitation_${guest.name.replace(/\s/g, '_')}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch (err) {
      console.error('PNG error:', err);
      alert('Failed to generate PNG. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  /* ── PDF download ── */
  const downloadPDF = async () => {
    if (!cardRef.current || generating) return;
    setGenerating(true);
    try {
      const canvas = await captureCard();
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`invitation_${guest.name.replace(/\s/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      className="card-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-title"
    >
      <div className="card-modal">
        {/* Header */}
        <div className="card-modal-head">
          <span className="card-modal-title" id="card-title">Invitation card</span>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Invitation card (captured by html2canvas) */}
        <div className="invitation-card" ref={cardRef}>
          <div className="card-eyebrow">Wedding Invitation · Come Celebrate</div>

          <div className="card-guest-name">{guest.name || 'Guest'}</div>

          <div className="card-event-date">{formatDate(guest.date)}</div>

          <div className="card-venue">
            {guest.venue || 'Ukumbi wa Harusi'}<br />
            {guest.time || '14:00'} — Welcome
          </div>

          <div className="card-divider" />

          <div className="card-description">
            We warmly invite you to celebrate our special day together with family
            and friends as we begin our beautiful journey of love and happiness.
          </div>

          <div className="qr-container">
            {qrUrl ? (
              <img src={qrUrl} alt={`QR code for ${guest.name}`} width={100} height={100} />
            ) : (
              <div className="qr-loading">Loading QR…</div>
            )}
          </div>

          <div className="card-contact">
            +255 713 456 789 &nbsp;/&nbsp; +255 712 345 678
          </div>
        </div>

        {/* Download actions */}
        <div className="card-actions">
          <button
            className="btn-dl-pdf"
            onClick={downloadPDF}
            disabled={generating}
          >
            <i className="ti ti-file-type-pdf" aria-hidden="true" />
            {generating ? 'Generating…' : 'Download PDF'}
          </button>
          <button
            className="btn-dl-png"
            onClick={downloadPNG}
            disabled={generating}
          >
            <i className="ti ti-photo-down" aria-hidden="true" />
            {generating ? 'Generating…' : 'Download PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WeddingCard;
