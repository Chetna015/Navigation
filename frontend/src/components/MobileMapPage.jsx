import React, { useState } from 'react';
import { 
  ArrowLeft, Search, MapPin, Navigation, Compass, Layers, 
  Sparkles, Eye, Mic, X, Volume2, VolumeX, Building2,
  ChevronDown, Maximize2, RotateCcw, Languages, Bot,
  Calendar, Sun, Moon, Share2, Shield, ShieldCheck
} from 'lucide-react';
import DigitalTwinMap from './DigitalTwinMap';
import NavigationSidebar from './NavigationSidebar';
import { getMergedMapLocations } from '../utils/locationStore';
import { useNavigation } from '../context/NavigationContext';

export default function MobileMapPage({
  isAdminMode,
  currentLocation,
  setCurrentLocation,
  destination,
  setDestination,
  activeFloor,
  setActiveFloor,
  selectedStall,
  setSelectedStall,
  highlightDomain,
  accessibilityOptions,
  navMode,
  setNavMode,
  isNavigatingLive,
  setIsNavigatingLive,
  onBackToHome,
  onOpenEditLocation,
  onOpen3DView,
  onOpenSBMIndoor,
  onOpenIndoor,
  onOpenMeetMe,
  onOpenSchedule,
  onOpenStreetView,
  onOpenAIAssistant,
  onOpenAdminPanel,
  voiceEnabled: propVoiceEnabled,
  setVoiceEnabled: propSetVoiceEnabled,
  isListening,
  startVoiceSearch,
  theme,
  setTheme
}) {
  const { 
    voiceEnabled, toggleVoice, 
    voiceLang, toggleVoiceLang, 
    voiceRate, cycleVoiceRate,
    replayLastInstruction, lastSpokenText
  } = useNavigation();
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [showMapSearchSheet, setShowMapSearchSheet] = useState(false);

  const activeLocations = getMergedMapLocations();

  const filteredLocations = mapSearchQuery.trim()
    ? activeLocations.filter(loc => 
        loc.name.toLowerCase().includes(mapSearchQuery.toLowerCase()) ||
        (loc.code && loc.code.toLowerCase().includes(mapSearchQuery.toLowerCase())) ||
        (loc.category && loc.category.toLowerCase().includes(mapSearchQuery.toLowerCase()))
      ).slice(0, 6)
    : [];

  const handleSelectMapDest = (loc) => {
    setDestination(loc);
    setShowMapSearchSheet(false);
    setMapSearchQuery('');
    if (loc.floor && loc.floor !== activeFloor) {
      setActiveFloor(loc.floor);
    }
  };

  return (
    <div className="mobile-map-page-container">
      {/* 1. Mobile Map Top Header Bar */}
      <header className="mobile-map-top-bar">
        {/* Back to Home Button */}
        <button
          type="button"
          className="mobile-back-btn"
          onClick={onBackToHome}
          title="Back to Home Page"
        >
          <ArrowLeft size={18} />
          <span className="mobile-back-text">Home</span>
        </button>

        {/* Destination Bar / Search Trigger */}
        <div 
          className="mobile-map-dest-pill"
          onClick={() => setShowMapSearchSheet(true)}
        >
          <div className="dest-pill-icon">
            {destination ? <Navigation size={13} color="#3B82F6" /> : <Search size={13} color="var(--colors-body)" />}
          </div>
          <div className="dest-pill-text">
            {destination ? (
              <span className="dest-active-name">{destination.name}</span>
            ) : (
              <span className="dest-placeholder">Search destination on map...</span>
            )}
          </div>
          {destination && (
            <button
              type="button"
              className="dest-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                setDestination(null);
                setIsNavigatingLive(false);
                setNavMode('hidden');
              }}
              title="Clear Destination"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Desktop Navigation Links & Controls (Hidden on Mobile) */}
        <div className="desktop-map-header-actions">
          <div className="desktop-nav-tabs">
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
              <span>Indoor</span>
            </button>
            <button
              type="button"
              className="desktop-nav-tab"
              onClick={onOpenMeetMe || onOpenSchedule}
              title="Meet Me Here - 1-Click WhatsApp Campus Pin Sharing"
            >
              <Share2 size={15} color="#10B981" />
              <span>Meet Me Here 📍</span>
            </button>

            {onOpenAdminPanel && (
              <button
                type="button"
                className={`desktop-nav-tab ${isAdminMode ? 'admin-active' : ''}`}
                onClick={onOpenAdminPanel}
                title={isAdminMode ? "Admin Console: Manage & Pin Locations" : "Admin Portal: Restricted Login"}
                style={isAdminMode ? { color: '#059669', borderColor: 'rgba(16, 185, 129, 0.4)' } : {}}
              >
                {isAdminMode ? <ShieldCheck size={15} color="#059669" /> : <Shield size={15} color="#2563EB" />}
                <span>{isAdminMode ? 'Admin Console' : 'Admin Login'}</span>
              </button>
            )}
          </div>

          {/* Admin Mobile Quick Access Icon */}
          {onOpenAdminPanel && (
            <button
              type="button"
              className="mobile-header-icon-btn mobile-admin-icon"
              onClick={onOpenAdminPanel}
              title={isAdminMode ? "Admin Console" : "Admin Login"}
              style={isAdminMode ? { color: '#059669', background: 'rgba(16, 185, 129, 0.15)' } : {}}
            >
              {isAdminMode ? <ShieldCheck size={18} color="#059669" /> : <Shield size={18} />}
            </button>
          )}

          {setTheme && (
            <button
              type="button"
              className="mobile-header-icon-btn desktop-theme-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle Light/Dark Theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          )}
        </div>
      </header>

      {/* 2. Interactive Vector & Satellite Digital Twin Map */}
      <div className="mobile-map-canvas-area">
        <DigitalTwinMap
          isAdminMode={isAdminMode}
          currentLocation={currentLocation}
          setCurrentLocation={setCurrentLocation}
          destination={destination}
          setDestination={setDestination}
          activeFloor={activeFloor}
          setActiveFloor={setActiveFloor}
          selectedStall={selectedStall}
          setSelectedStall={setSelectedStall}
          highlightDomain={highlightDomain}
          accessibilityOptions={accessibilityOptions}
          onOpenEditLocation={onOpenEditLocation}
          onOpen3DView={onOpen3DView}
          onOpenSBMIndoor={onOpenSBMIndoor}
          navMode={navMode}
          isNavigatingLive={isNavigatingLive}
        />

        {/* Active Route Sidebar / Mobile Bottom Sheet Card */}
        {destination && (
          <NavigationSidebar
            currentLocation={currentLocation}
            destination={destination}
            onCancelNavigation={() => {
              setDestination(null);
              setIsNavigatingLive(false);
              setNavMode('hidden');
            }}
            accessibilityOptions={accessibilityOptions}
            navMode={navMode}
            setNavMode={(mode) => {
              setNavMode(mode);
              if (mode === 'active') setIsNavigatingLive(true);
              else if (mode === 'hidden') setIsNavigatingLive(false);
            }}
            onOpenStreetView={onOpenStreetView}
            onOpenAIAssistant={onOpenAIAssistant}
          />
        )}
      </div>

      {/* 3. Search Destination Bottom Sheet Modal on Map */}
      {showMapSearchSheet && (
        <div className="mobile-map-search-overlay" onClick={() => setShowMapSearchSheet(false)}>
          <div className="mobile-map-search-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="search-sheet-handle" />
            <div className="search-sheet-header">
              <h3>Choose Destination</h3>
              <button 
                type="button"
                className="search-sheet-close"
                onClick={() => setShowMapSearchSheet(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="search-sheet-input-row">
              <Search size={16} color="var(--colors-body)" />
              <input
                type="text"
                placeholder="Search UIET, SBM, Library, Hostel, Canteen..."
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                autoFocus
              />
              {mapSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMapSearchQuery('')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <X size={16} color="var(--colors-body)" />
                </button>
              )}
            </div>

            {/* Suggestions list */}
            <div className="search-sheet-results">
              {(mapSearchQuery.trim() ? filteredLocations : activeLocations.slice(0, 8)).map(loc => (
                <div
                  key={loc.id}
                  className="search-sheet-item"
                  onClick={() => handleSelectMapDest(loc)}
                >
                  <div className="sheet-item-icon">
                    <MapPin size={16} color="var(--colors-primary)" />
                  </div>
                  <div className="sheet-item-info">
                    <div className="sheet-item-name">{loc.name}</div>
                    <div className="sheet-item-category">{loc.category || 'University Building'}</div>
                  </div>
                  <button type="button" className="sheet-item-go-btn">
                    Select ➔
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
