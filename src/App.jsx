import React, { useState } from 'react';
import Dashboard  from './components/Dashboard';
import QRScanner  from './components/QRScanner';
import WeddingCard from './components/WeddingCard';
import './App.css';

function App() {
  /* guests live here — shared between Dashboard and Scanner */
  const [guests,       setGuests]       = useState([]);
  const [currentView,  setCurrentView]  = useState('dashboard');
  const [selectedGuest, setSelectedGuest] = useState(null);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-dot">♥</div>
          <span className="brand-name">Harusi ya Mariam Franco Magira</span>
        </div>
        <nav className="app-nav" aria-label="Menyu kuu">
          <button
            className={`nav-btn${currentView === 'dashboard' ? ' active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            📋 Orodha
          </button>
          <button
            className={`nav-btn${currentView === 'scanner' ? ' active' : ''}`}
            onClick={() => setCurrentView('scanner')}
          >
            📷 Scan QR
          </button>
        </nav>
      </header>

      <main className="main-content">
        {currentView === 'dashboard' && (
          <Dashboard
            guests={guests}
            setGuests={setGuests}
            onViewCard={(g) => setSelectedGuest(g)}
          />
        )}
        {currentView === 'scanner' && (
          <QRScanner
            guests={guests}
            setGuests={setGuests}
          />
        )}
      </main>

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
