import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import QRScanner from './components/QRScanner';
import WeddingCard from './components/WeddingCard';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [guests, setGuests] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('wg_v2');
      if (saved) setGuests(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load guests:', e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('wg_v2', JSON.stringify(guests));
  }, [guests]);

  const addGuest = (guestData) => {
    const newGuest = {
      id: Date.now(),
      name: guestData.name,
      phone: guestData.phone,
      status: guestData.status,
      venue: guestData.venue,
      date: guestData.date,
      time: guestData.time,
      qrCodeData: guestData.qrCodeData,
      attended: false,
      attendanceTime: null,
    };
    setGuests((prev) => [newGuest, ...prev]);
  };

  const updateAttendance = (guestId) => {
    setGuests((prev) =>
      prev.map((g) =>
        g.id === guestId
          ? { ...g, attended: true, attendanceTime: new Date().toISOString() }
          : g
      )
    );
  };

  const deleteGuest = (guestId) => {
    if (window.confirm('Remove this guest?')) {
      setGuests((prev) => prev.filter((g) => g.id !== guestId));
    }
  };

  return (
    <div className="app">
      {/* ── Top bar ── */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-dot">
            <i className="ti ti-heart" aria-hidden="true" />
          </div>
          <span className="brand-name">Harusi Manager</span>
        </div>

        <nav className="app-nav" aria-label="Main navigation">
          <button
            className={`nav-btn${currentView === 'dashboard' ? ' active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            <i className="ti ti-layout-dashboard" aria-hidden="true" />
            Dashboard
          </button>
          <button
            className={`nav-btn${currentView === 'scanner' ? ' active' : ''}`}
            onClick={() => setCurrentView('scanner')}
          >
            <i className="ti ti-qrcode" aria-hidden="true" />
            Scan QR
          </button>
        </nav>
      </header>

      {/* ── Views ── */}
      <main className="main-content">
        {currentView === 'dashboard' && (
          <Dashboard
            guests={guests}
            onAddGuest={addGuest}
            onDeleteGuest={deleteGuest}
            onViewCard={(guest) => setSelectedGuest(guest)}
          />
        )}

        {currentView === 'scanner' && (
          <QRScanner guests={guests} onUpdateAttendance={updateAttendance} />
        )}
      </main>

      {/* ── Wedding card overlay ── */}
      {selectedGuest && (
        <WeddingCard
          guest={selectedGuest}
          onClose={() => setSelectedGuest(null)}
        />
      )}
    </div>
  );
}

export default App;
