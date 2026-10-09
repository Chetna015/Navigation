import React, { useState, useMemo } from 'react';
import { 
  Search, Mic, MapPin, Navigation, ArrowRight, 
  Sun, Moon, Accessibility, Footprints, X, Star, Building2, Calendar, Sparkles,
  Bot, Volume2, VolumeX, Home, Map
} from 'lucide-react';
import { getMergedMapLocations } from '../utils/locationStore';
import { haversineDistanceMeters } from '../utils/haversine';
import { useNavigation } from '../context/NavigationContext';

export default function HomePage({
  currentLocation,
  setCurrentLocation,
  onSelectDestination,
  onOpenMap,
  onOpenAIAssistant,
  onOpenSaved,
  onOpenSchedule,
  onOpenCampusLife,
  onOpenParking,
  onOpenSBMIndoor,
  onOpenIndoor,
  onOpenStalls,
  onOpenSessions,
  onOpenStreetView,
  onOpenAccessibility,
  theme,
  setTheme,
  isListening,
  startVoiceSearch,
  gpsPermissionState,
  requestLiveGps,
  userPos
}) {
  const { voiceEnabled, toggleVoice } = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const allLocations = useMemo(() => {
    return getMergedMapLocations();
  }, []);

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();

    return allLocations.filter(loc => {
      const nameMatch = loc.name && loc.name.toLowerCase().includes(q);
      const codeMatch = loc.code && loc.code.toLowerCase().includes(q);
      const catMatch = loc.category && loc.category.toLowerCase().includes(q);
      const tagMatch = loc.tags && loc.tags.some(t => t.toLowerCase().includes(q));
      const deptMatch = loc.departments && loc.departments.some(d => d.toLowerCase().includes(q));
      return nameMatch || codeMatch || catMatch || tagMatch || deptMatch;
    }).slice(0, 8);
  }, [searchQuery, allLocations]);

  // Featured Popular Destinations
  const popularDestinations = useMemo(() => {
    const desired = [
      { name: 'UIET', fallbackName: 'Uiet', icon: '🏛️', tag: 'Academic & Engineering', desc: 'Engineering & Tech Dept' },
      { name: 'School of Business Management', fallbackName: 'SBM', icon: '🏢', tag: 'AI Summit Venue', desc: 'Workshops, Keynotes & Labs' },
      { name: 'Central Library', fallbackName: 'Library', icon: '📚', tag: 'Study & Research', desc: 'Books, Journals & Digital Hub' },
      { name: 'Cafeteria', fallbackName: 'Canteen', icon: '☕', tag: 'Food & Dining', desc: 'Campus Snacks & Meals' },
      { name: 'CSJM Main Gate', fallbackName: 'Main Gate', icon: '🚪', tag: 'Campus Entrance', desc: 'GT Road Main Gate' },
      { name: 'Senate Hall', fallbackName: 'Open Air Theatre', icon: '🎭', tag: 'Auditorium & Events', desc: 'Exhibition & Keynote Stage' },
      { name: 'CSJMU Metro Station', fallbackName: 'Metro', icon: '🚇', tag: 'Public Transit', desc: 'Kanpur Metro Connection' },
      { name: 'Girls Hostel', fallbackName: 'Hostel', icon: '🏡', tag: 'Residential', desc: 'Campus Student Living' }
    ];

    return desired.map(item => {
      const found = allLocations.find(l => 
        l.name.toLowerCase().includes(item.name.toLowerCase()) ||
        (item.fallbackName && l.name.toLowerCase().includes(item.fallbackName.toLowerCase()))
      ) || {
        id: `pop_${item.name}`,
        name: item.name,
        category: item.tag,
        lat: 26.5009,
        lng: 80.2655
      };

      // Calculate approximate distance from user
      let dist = 180;
      if (currentLocation && found.lat && found.lng) {
        dist = Math.round(haversineDistanceMeters(
          currentLocation.lat || 26.4970,
          currentLocation.lng || 80.2666,
          found.lat,
          found.lng
        ));
      }

      return {
        ...found,
        customIcon: item.icon,
        customTag: item.tag,
        customDesc: item.desc,
        calculatedDist: dist
      };
    });
  }, [allLocations, currentLocation]);

  const handleDestinationClick = (loc) => {
    setSearchQuery('');
    onSelectDestination(loc);
  };

  return (
    <div className="mobile-home-container">
      {/* 1. Top Mobile App Bar */}
      <header className="mobile-top-bar">
        <div className="mobile-brand">
          <img
            src="/csjm_logo.png"
            alt="CSJMU Logo"
            className="mobile-brand-logo"
          />
          <div className="mobile-brand-text">
            <h1 className="mobile-app-title">CSJMU Navigator</h1>
            <p className="mobile-app-subtitle">Smart Campus Navigation • Kanpur</p>
          </div>
        </div>

        <div className="mobile-header-actions">
          {/* Desktop Navigation Tabs (Hidden on Mobile) */}
          <div className="desktop-nav-tabs">
            <button
              type="button"
              className="desktop-nav-tab active"
              title="Home Dashboard"
            >
              <Home size={15} />
              <span>Home</span>
            </button>
            <button
              type="button"
              className="desktop-nav-tab"
              onClick={onOpenMap}
              title="Interactive Campus Map"
            >
              <Map size={15} />
              <span>Campus Map</span>
            </button>
            <button
              type="button"
              className="desktop-nav-tab"
              onClick={onOpenAIAssistant}
              title="CSJMU AI Campus Guide"
            >
              <Bot size={15} color="#3B82F6" />
              <span>AI Guide</span>
            </button>
            <button
              type="button"
              className="desktop-nav-tab"
              onClick={onOpenIndoor || onOpenSBMIndoor}
              title="Indoor Building Floorplans & Watercoolers"
            >
              <Building2 size={15} />
              <span>Indoor Blueprints</span>
            </button>
            <button
              type="button"
              className="desktop-nav-tab"
              onClick={onOpenSchedule || onOpenSessions}
              title="AI Summit 2026 Schedule & Sessions"
            >
              <Calendar size={15} />
              <span>Summit Schedule</span>
            </button>
          </div>

          {/* Theme Toggle (Mobile & Desktop) */}
          <button
            type="button"
            className="mobile-header-icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* GPS Status & Insecure Notice Banner */}
      {gpsPermissionState === 'prompt' && !userPos && (
        <div className="mobile-gps-prompt-banner">
          <div className="gps-prompt-text">
            <span className="gps-live-dot" />
            <span>Enable phone GPS for accurate live turn directions</span>
          </div>
          <button
            type="button"
            className="mobile-gps-enable-btn"
            onClick={requestLiveGps}
          >
            Enable GPS 📍
          </button>
        </div>
      )}

      {/* Scrollable Mobile Home Content */}
      <main className="mobile-home-scroll-area">
        <div className="responsive-home-content">
          {/* 2. Hero Search & Destination Box */}
        <section className="mobile-search-hero-card">
          <div className="mobile-hero-greeting">
            <h2>Where to? 🧭</h2>
            <p>Find any classroom, lab, water cooler, or hall across campus</p>
          </div>

          {/* Route Destination Input Container */}
          <div className="mobile-route-input-group">
            {/* FROM ROW */}
            <div className="mobile-input-row mobile-input-from">
              <div className="mobile-input-icon-wrap start-pin">
                <span className="gps-pulse-mini" />
                <MapPin size={14} color="#10B981" />
              </div>
              <div className="mobile-input-field-wrap">
                <span className="mobile-input-label">FROM</span>
                <input
                  type="text"
                  readOnly
                  value={currentLocation?.name || '📍 My Live GPS Location'}
                  className="mobile-input-readonly"
                />
              </div>
            </div>

            {/* Connecting Route Line */}
            <div className="mobile-route-connector-line" />

            {/* TO ROW */}
            <div className="mobile-input-row mobile-input-to">
              <div className="mobile-input-icon-wrap end-pin">
                <Navigation size={14} color="#3B82F6" />
              </div>
              <div className="mobile-input-field-wrap">
                <span className="mobile-input-label">TO (DESTINATION)</span>
                <input
                  type="text"
                  placeholder="Search destination (UIET, Library, SBM...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mobile-input-text"
                  autoFocus={false}
                />
              </div>

              {searchQuery ? (
                <button
                  type="button"
                  className="mobile-input-action-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear"
                >
                  <X size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className={`mobile-input-action-btn ${isListening ? 'listening' : ''}`}
                  onClick={startVoiceSearch}
                  title="Voice Search"
                >
                  <Mic size={16} color={isListening ? '#EF4444' : 'var(--colors-ink)'} />
                </button>
              )}
            </div>
          </div>

          {/* Real-time Search Autocomplete Results Dropdown */}
          {searchQuery.trim() && (
            <div className="mobile-search-results-sheet animate-slide-down">
              <div className="mobile-results-header">
                <span>Matching Campus Locations ({searchResults.length})</span>
              </div>
              {searchResults.length > 0 ? (
                <div className="mobile-results-list">
                  {searchResults.map((loc) => {
                    let d = 120;
                    if (currentLocation && loc.lat && loc.lng) {
                      d = Math.round(haversineDistanceMeters(
                        currentLocation.lat || 26.4970,
                        currentLocation.lng || 80.2666,
                        loc.lat,
                        loc.lng
                      ));
                    }
                    return (
                      <div
                        key={loc.id}
                        className="mobile-result-item"
                        onClick={() => handleDestinationClick(loc)}
                      >
                        <div className="mobile-result-icon">
                          <MapPin size={18} color="var(--colors-primary)" />
                        </div>
                        <div className="mobile-result-info">
                          <div className="mobile-result-title">{loc.name}</div>
                          <div className="mobile-result-subtitle">
                            <span className="mobile-badge-category">{loc.category || 'Facility'}</span>
                            {loc.code && <span className="mobile-badge-code">{loc.code}</span>}
                          </div>
                        </div>
                        <div className="mobile-result-action">
                          <span className="mobile-result-dist">{d}m</span>
                          <div className="mobile-nav-arrow-btn">
                            <ArrowRight size={14} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mobile-no-results">
                  <p>No campus location found for "{searchQuery}"</p>
                  <button
                    type="button"
                    className="mobile-ask-ai-quick-btn"
                    onClick={() => {
                      onOpenAIAssistant();
                    }}
                  >
                    🤖 Ask CSJMU AI Assistant
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Popular Campus Destinations (Touch Cards) */}
        <section className="mobile-section">
          <div className="mobile-section-header">
            <div>
              <h3 className="mobile-section-title">Popular Destinations</h3>
              <span className="mobile-section-subtitle">Tap any location to start route</span>
            </div>
            <button
              type="button"
              className="mobile-see-map-btn"
              onClick={onOpenMap}
            >
              View on Map ➔
            </button>
          </div>

          <div className="mobile-destinations-grid">
            {popularDestinations.map((place) => (
              <div
                key={place.id}
                className="mobile-dest-card"
                onClick={() => handleDestinationClick(place)}
              >
                <div className="dest-card-top">
                  <div className="dest-icon-box">{place.customIcon}</div>
                  <span className="dest-dist-chip">
                    <Footprints size={12} /> {place.calculatedDist}m
                  </span>
                </div>

                <div className="dest-card-body">
                  <h4 className="dest-card-title">{place.name}</h4>
                  <p className="dest-card-desc">{place.customDesc}</p>
                </div>

                <div className="dest-card-footer">
                  <span className="dest-category-pill">{place.customTag}</span>
                  <button
                    type="button"
                    className="dest-navigate-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDestinationClick(place);
                    }}
                  >
                    Go ➔
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Responsive Banners Grid (Side-by-side on desktop, stacked on mobile) */}
        <div className="responsive-banners-grid">
          {/* 5. AI Summit 2026 Schedule Banner Card */}
          <section className="mobile-section">
            <div 
              className="mobile-ai-banner-card" 
              onClick={onOpenSchedule || onOpenSessions}
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(147, 51, 234, 0.12) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.25)'
              }}
            >
              <div className="ai-banner-left">
                <div className="ai-avatar-badge" style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>📅</div>
                <div>
                  <h4 className="ai-banner-title">National AI Manthan 2.0 Schedule</h4>
                  <p className="ai-banner-sub">Plenary, Agriculture, Medical & General Tracks • 12–13 Sept</p>
                  <div className="ai-chips-preview">
                    <span className="ai-chip" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#2563EB', fontWeight: 600 }}>12–13 Sept 2026 • 27 Sessions</span>
                    <span className="ai-chip" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#DC2626', fontWeight: 600 }}>🔴 Live Now</span>
                  </div>
                </div>
              </div>
              <div className="ai-banner-arrow">
                <ArrowRight size={18} />
              </div>
            </div>
          </section>

          {/* 6. AI Assistant Interactive Banner Card */}
          <section className="mobile-section">
            <div className="mobile-ai-banner-card" onClick={onOpenAIAssistant}>
              <div className="ai-banner-left">
                <div className="ai-avatar-badge">🤖</div>
                <div>
                  <h4 className="ai-banner-title">Need Help Finding Something?</h4>
                  <p className="ai-banner-sub">Ask our polite CSJMU AI Campus Guide with Voice</p>
                  <div className="ai-chips-preview">
                    <span className="ai-chip">"Where is SBM-01?"</span>
                    <span className="ai-chip">"Nearest RO Cooler"</span>
                  </div>
                </div>
              </div>
              <div className="ai-banner-arrow">
                <ArrowRight size={18} />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Padding spacer at bottom for mobile nav bar */}
      <div className="mobile-bottom-spacer" style={{ height: '80px' }} />
      </main>
    </div>
  );
}
