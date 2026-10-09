import React, { useState, useEffect } from 'react';
import SplashScreen from './components/SplashScreen';
import HomePage from './components/HomePage';
import MobileMapPage from './components/MobileMapPage';
import MobileBottomNav from './components/MobileBottomNav';
import AIAssistantModal from './components/AIAssistantModal';
import SavedLocationsModal from './components/SavedLocationsModal';
import StartupExhibitionModal from './components/StartupExhibitionModal';
import EventSessionsModal from './components/EventSessionsModal';
import AccessibilityModal from './components/AccessibilityModal';
import StallDetailDrawer from './components/StallDetailDrawer';
import EditLocationModal from './components/EditLocationModal';
import ManagePinsModal from './components/ManagePinsModal';
import Building3DViewerModal from './components/Building3DViewerModal';
import CampusLifeStatusModal from './components/CampusLifeStatusModal';
import ParkingFinderModal from './components/ParkingFinderModal';
import SBMBuildingIndoorModal from './components/SBMBuildingIndoorModal';
import IndoorBuildingSelectorModal from './components/IndoorBuildingSelectorModal';
import MeetMeHereModal from './components/MeetMeHereModal';
import useLiveNavigationVoice from './hooks/useLiveNavigationVoice';
import { MAP_LOCATIONS, STARTUP_STALLS } from './data/auditoriumData';
import { useNavigation } from './context/NavigationContext';

export default function App() {
  const {
    currentLocation, setCurrentLocation,
    destination, setDestination,
    shortestRoute, setShortestRoute,
    navMode, setNavMode,
    isNavigatingLive, setIsNavigatingLive,
    isAdminMode,
    activeFloor, setActiveFloor,
    defaultLiveLocation,
    voiceEnabled, setVoiceEnabled, toggleVoice,
    voiceLang, setVoiceLang,
    voiceRate, setVoiceRate
  } = useNavigation();

  // Mobile App Active View: 'home' (Mobile Home Page) | 'map' (Mobile Map Navigation)
  const [currentPage, setCurrentPage] = useState('home');
  const [showSplash, setShowSplash] = useState(false);
  const [building3D, setBuilding3D] = useState(null);
  const [sosBanner, setSosBanner] = useState(false);

  // Live Geolocation Tracking & Voice Assistance
  const {
    userPos,
    distanceMeters,
    stepsCount,
    isOffTrack,
    gpsPermissionState,
    gpsErrorMsg,
    requestLiveGps
  } = useLiveNavigationVoice({
    currentLocation,
    destination,
    voiceEnabled,
    setVoiceEnabled,
    voiceLang,
    voiceRate,
    isNavigatingLive
  });

  // Automatically update currentLocation with exact real-time phone GPS position when received
  useEffect(() => {
    if (userPos && userPos.lat && userPos.lng) {
      setCurrentLocation(prev => ({
        ...prev,
        id: 'live_user_location',
        name: 'My Live GPS Location 📍',
        lat: userPos.lat,
        lng: userPos.lng,
        heading: userPos.heading || 45,
        isLiveUser: true
      }));
    }
  }, [userPos, setCurrentLocation]);

  // Sync navMode when destination is set or cleared
  useEffect(() => {
    if (destination) {
      if (navMode === 'hidden') setNavMode('preview');
    } else {
      setNavMode('hidden');
    }
  }, [destination]);

  const [highlightDomain, setHighlightDomain] = useState(null);

  // Modals visibility states
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [showMeetMeModal, setShowMeetMeModal] = useState(false);
  const [friendMeetBanner, setFriendMeetBanner] = useState(null);
  const [showStallsModal, setShowStallsModal] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [showAccessibilityModal, setShowAccessibilityModal] = useState(false);
  const [showEditLocationModal, setShowEditLocationModal] = useState(false);
  const [showManagePinsModal, setShowManagePinsModal] = useState(false);
  const [showCampusLifeModal, setShowCampusLifeModal] = useState(false);
  const [showParkingModal, setShowParkingModal] = useState(false);
  const [showSBMIndoorModal, setShowSBMIndoorModal] = useState(false);
  const [showIndoorSelector, setShowIndoorSelector] = useState(false);
  const [indoorBuildingId, setIndoorBuildingId] = useState('sbm'); // 'sbm' | 'auditorium'
  const [editingLocation, setEditingLocation] = useState(null);
  const [selectedStall, setSelectedStall] = useState(null);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'campus-map'

  // Automatic "Meet Me Here" Inbound Shared WhatsApp Link Parser
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const meetParam = params.get('meet');
    const latParam = params.get('lat');
    const lngParam = params.get('lng');
    const nameParam = params.get('name');
    const noteParam = params.get('note');
    const floorParam = params.get('floor');

    if (latParam && lngParam) {
      const parsedLat = parseFloat(latParam);
      const parsedLng = parseFloat(lngParam);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        const spotObj = {
          id: meetParam || 'shared_friend_spot',
          name: nameParam ? `${nameParam} 📍` : "Friend's Meeting Spot 📍",
          lat: parsedLat,
          lng: parsedLng,
          floor: floorParam || 'outdoor',
          customNote: noteParam || null
        };
        setDestination(spotObj);
        setIsNavigatingLive(false);
        setNavMode('preview');
        setCurrentPage('map');
        setFriendMeetBanner({
          name: nameParam || "Friend's Campus Location",
          note: noteParam || null
        });
      }
    } else if (meetParam) {
      const found = MAP_LOCATIONS.find(l => l.id === meetParam || l.code === meetParam);
      if (found) {
        handleSelectLocation(found);
        setFriendMeetBanner({
          name: found.name,
          note: noteParam || null
        });
      }
    }
  }, []);

  // Dynamic Indoor Mode Switcher
  const handleOpenIndoorModal = (buildingId = 'sbm') => {
    setIndoorBuildingId(buildingId);
    setShowSBMIndoorModal(true);
  };

  // Explore Building Mode Trigger (Switch to Indoor Mode after arrival)
  const handleExploreBuilding = (bld) => {
    const name = (bld.name || '').toLowerCase();
    let buildingId = 'sbm';
    if (name.includes('auditorium')) {
      buildingId = 'auditorium';
    }
    setDestination(null);
    setIsNavigatingLive(false);
    setNavMode('hidden');
    handleOpenIndoorModal(buildingId);
  };

  // Automatic Arrival Detection Zone
  useEffect(() => {
    if (navMode === 'active' && destination && distanceMeters > 0) {
      const radius = destination.arrivalRadius || 25;
      if (distanceMeters <= radius) {
        setNavMode('arrived');
        setIsNavigatingLive(false);

        // Voice synthesizer alert on arrival
        if (voiceEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
            const speechText = `आप ${destination.originalBuilding?.name || destination.name} पर पहुँच गए हैं।`;
            const msg = new SpeechSynthesisUtterance(speechText);
            msg.lang = 'hi-IN';
            window.speechSynthesis.speak(msg);
          } catch (e) {
            console.warn("SpeechSynthesis error:", e);
          }
        }
      }
    }
  }, [distanceMeters, navMode, destination, setNavMode, setIsNavigatingLive, voiceEnabled]);

  const handleOpenEditLocation = (loc = null) => {
    setEditingLocation(loc);
    setShowEditLocationModal(true);
  };

  // App settings & preferences
  const [theme, setTheme] = useState('light');
  const [bookmarks, setBookmarks] = useState(['loc_uiet', 'loc_central_library', 'loc_girls_hostel', 'loc_cafeteria']);
  const [accessibilityOptions, setAccessibilityOptions] = useState({
    wheelchairRoute: false,
    highContrast: false,
    largeFont: false
  });
  const [isListening, setIsListening] = useState(false);

  // Update body attributes when theme/accessibility changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-high-contrast', accessibilityOptions.highContrast);
    document.documentElement.setAttribute('data-large-font', accessibilityOptions.largeFont);
  }, [theme, accessibilityOptions]);

  // Voice Search Handler
  const startVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Browser speech recognition not available. Please type your destination in search.");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';

    setIsListening(true);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      
      // Look for a matching location
      const query = transcript.toLowerCase();
      const match = MAP_LOCATIONS.find(loc => 
        loc.name.toLowerCase().includes(query) ||
        (loc.code && loc.code.toLowerCase().includes(query)) ||
        (loc.tags && loc.tags.some(t => t.toLowerCase().includes(query)))
      );

      if (match) {
        handleSelectLocation(match);
        setCurrentPage('map');
      } else {
        setShowAIAssistant(true);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  };

  // Set Location as Navigation Destination with entrance snapping and transition to Map Page
  const handleSelectLocation = (loc) => {
    let targetLoc = { ...loc };
    if (loc.entrances && loc.entrances.length > 0) {
      let selectedEntrance = loc.entrances[0];
      if (currentLocation && currentLocation.lat && currentLocation.lng) {
        let minDistance = Infinity;
        loc.entrances.forEach(ent => {
          const dist = Math.pow(ent.lat - currentLocation.lat, 2) + Math.pow(ent.lng - currentLocation.lng, 2);
          if (dist < minDistance) {
            minDistance = dist;
            selectedEntrance = ent;
          }
        });
      }
      targetLoc = {
        ...loc,
        lat: selectedEntrance.lat,
        lng: selectedEntrance.lng,
        name: `${loc.name} - ${selectedEntrance.name} 🚪`,
        originalBuilding: loc,
        selectedEntrance: selectedEntrance
      };
    }
    setDestination(targetLoc);
    setIsNavigatingLive(false);
    if (targetLoc.floor && targetLoc.floor !== activeFloor) {
      setActiveFloor(targetLoc.floor);
    }
    // Switch to Map Page immediately when destination is chosen
    setCurrentPage('map');
  };

  // Set Startup Stall as Navigation Destination
  const handleSelectStallDestination = (stall) => {
    setSelectedStall(stall);
    const destObj = {
      id: stall.id,
      name: `Stall ${stall.id}: ${stall.name}`,
      floor: 'indoor',
      x: stall.x,
      y: stall.y,
      description: stall.description
    };
    setDestination(destObj);
    setIsNavigatingLive(false);
    setActiveFloor('indoor');
    setShowStallsModal(false);
    setCurrentPage('map');
  };

  // Bookmark toggle
  const handleToggleBookmark = (id) => {
    setBookmarks(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleTriggerSOS = () => {
    const medBooth = MAP_LOCATIONS.find(l => l.id === 'loc_medical_booth') || {
      id: 'loc_medical_booth',
      name: 'Emergency Medical Booth 🚑',
      lat: 26.4985,
      lng: 80.2662,
      floor: 'outdoor'
    };
    handleSelectLocation(medBooth);
    setSosBanner(true);
  };

  return (
    <div className="mobile-app-shell">
      {/* 1. Splash Screen Intro */}
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}

      {/* 2. Emergency SOS Alert Banner */}
      {sosBanner && (
        <div style={{
          background: 'linear-gradient(90deg, #EF4444 0%, #F43F5E 100%)',
          color: '#FFF',
          padding: '10px 24px',
          fontWeight: 800,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 999
        }}>
          <div>
            🚑 EMERGENCY SOS ACTIVATED: Dispatching On-site Medical First-Aid Team to your location. Directing you to Emergency Medical Booth.
          </div>
          <button
            onClick={() => setSosBanner(false)}
            style={{ background: 'rgba(0,0,0,0.2)', border: 'none', color: '#FFF', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2.5 Inbound "Meet Me Here" Shared Location Banner */}
      {friendMeetBanner && (
        <div style={{
          background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
          color: '#FFF',
          padding: '10px 20px',
          fontWeight: 700,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 999
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>📍 Friend's Location Loaded: <strong>{friendMeetBanner.name}</strong></span>
            {friendMeetBanner.note && (
              <span style={{ background: 'rgba(0,0,0,0.22)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                "{friendMeetBanner.note}"
              </span>
            )}
            <span style={{ fontSize: '11px', opacity: 0.9 }}>• Walking route ready on map</span>
          </div>
          <button
            onClick={() => setFriendMeetBanner(null)}
            style={{ background: 'rgba(0,0,0,0.25)', border: 'none', color: '#FFF', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* 2. Primary Mobile Views (Page 1: HomePage | Page 2: MobileMapPage) */}
      <div className="mobile-view-viewport">
        {currentPage === 'home' ? (
          <HomePage
            currentLocation={currentLocation}
            setCurrentLocation={setCurrentLocation}
            onSelectDestination={handleSelectLocation}
            onOpenMap={() => setCurrentPage('map')}
            onOpenAIAssistant={() => setShowAIAssistant(true)}
            onOpenSaved={() => setShowSavedModal(true)}
            onOpenMeetMe={() => setShowMeetMeModal(true)}
            onOpenSchedule={() => setShowSessionsModal(true)}
            onOpenSessions={() => setShowSessionsModal(true)}
            onOpenCampusLife={() => setShowCampusLifeModal(true)}
            onOpenParking={() => setShowParkingModal(true)}
            onOpenSBMIndoor={() => setShowSBMIndoorModal(true)}
            onOpenIndoor={() => setShowIndoorSelector(true)}
            onOpenStalls={() => setShowStallsModal(true)}
            onOpenAccessibility={() => setShowAccessibilityModal(true)}
            theme={theme}
            setTheme={setTheme}
            isListening={isListening}
            startVoiceSearch={startVoiceSearch}
            gpsPermissionState={gpsPermissionState}
            requestLiveGps={requestLiveGps}
            userPos={userPos}
          />
        ) : (
          <MobileMapPage
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
            onOpenEditLocation={handleOpenEditLocation}
            onOpen3DView={(bld) => setBuilding3D(bld)}
            onOpenSBMIndoor={() => setShowSBMIndoorModal(true)}
            onOpenIndoor={() => setShowIndoorSelector(true)}
            onOpenMeetMe={() => setShowMeetMeModal(true)}
            onOpenSchedule={() => setShowSessionsModal(true)}
            onOpenAIAssistant={() => setShowAIAssistant(true)}
            navMode={navMode}
            setNavMode={setNavMode}
            isNavigatingLive={isNavigatingLive}
            setIsNavigatingLive={setIsNavigatingLive}
            onBackToHome={() => setCurrentPage('home')}
            voiceEnabled={voiceEnabled}
            setVoiceEnabled={setVoiceEnabled}
            isListening={isListening}
            startVoiceSearch={startVoiceSearch}
            theme={theme}
            setTheme={setTheme}
          />
        )}
      </div>

      {/* 3. Mobile Bottom Navigation Bar (Home, Map, AI Guide, Indoor Floorplans, Meet Me Here) */}
      <MobileBottomNav
        currentPage={currentPage}
        onNavigateTab={(tab) => setCurrentPage(tab)}
        onOpenAIAssistant={() => setShowAIAssistant(true)}
        onOpenIndoor={() => setShowIndoorSelector(true)}
        onOpenMeetMe={() => setShowMeetMeModal(true)}
        onOpenSchedule={() => setShowSessionsModal(true)}
        onOpenSessions={() => setShowSessionsModal(true)}
        onOpenSaved={() => setShowSavedModal(true)}
        hasActiveRoute={!!destination}
      />

      {/* 4. Mobile Modals & Bottom Drawers */}
      <AIAssistantModal
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        currentLocation={currentLocation}
        destination={destination}
        onSelectLocation={handleSelectLocation}
        onStartNavigation={(mode = 'preview') => {
          setNavMode(mode);
          if (mode === 'active') setIsNavigatingLive(true);
          setCurrentPage('map');
        }}
        onCancelNavigation={() => {
          setDestination(null);
          setIsNavigatingLive(false);
          setNavMode('hidden');
        }}
        onOpenStalls={() => setShowStallsModal(true)}
        onOpenSessions={() => setShowSessionsModal(true)}
        onOpen3DView={(bld) => setBuilding3D(bld)}
        onOpenSBMIndoor={() => setShowSBMIndoorModal(true)}
        onOpenParking={() => setShowParkingModal(true)}
        onOpenCampusLife={() => setShowCampusLifeModal(true)}
      />

      {/* Saved Places / Bookmarks Modal */}
      <SavedLocationsModal
        isOpen={showSavedModal}
        onClose={() => setShowSavedModal(false)}
        bookmarks={bookmarks}
        onToggleBookmark={handleToggleBookmark}
        onNavigateToLocation={handleSelectLocation}
        currentLocation={currentLocation}
      />

      <StartupExhibitionModal
        isOpen={showStallsModal}
        onClose={() => setShowStallsModal(false)}
        onSelectStallDestination={handleSelectStallDestination}
        bookmarks={bookmarks}
        onToggleBookmark={handleToggleBookmark}
      />

      {/* AI Summit 2026 Complete Schedule Modal */}
      <EventSessionsModal
        isOpen={showSessionsModal}
        onClose={() => setShowSessionsModal(false)}
        onNavigateToVenue={handleSelectLocation}
        onOpenIndoorModal={handleOpenIndoorModal}
        bookmarks={bookmarks}
        onToggleBookmark={handleToggleBookmark}
      />

      {/* "Meet Me Here" WhatsApp Campus Pin Sharing Modal */}
      <MeetMeHereModal
        isOpen={showMeetMeModal}
        onClose={() => setShowMeetMeModal(false)}
        currentLocation={currentLocation}
        destination={destination}
        onNavigateToLocation={(spot) => {
          handleSelectLocation(spot);
          setShowMeetMeModal(false);
          setCurrentPage('map');
        }}
      />

      <AccessibilityModal
        isOpen={showAccessibilityModal}
        onClose={() => setShowAccessibilityModal(false)}
        accessibilityOptions={accessibilityOptions}
        setAccessibilityOptions={setAccessibilityOptions}
      />

      <EditLocationModal
        isOpen={showEditLocationModal}
        onClose={() => setShowEditLocationModal(false)}
        initialLocation={editingLocation}
        onLocationSaved={(updatedLoc) => {
          if (currentLocation && currentLocation.id === updatedLoc.id) {
            setCurrentLocation(prev => ({ ...prev, ...updatedLoc }));
          }
          if (destination && destination.id === updatedLoc.id) {
            setDestination(prev => ({ ...prev, ...updatedLoc }));
          }
        }}
      />

      <ManagePinsModal
        isOpen={showManagePinsModal}
        onClose={() => setShowManagePinsModal(false)}
        onSelectLocationOnMap={(loc) => {
          handleSelectLocation(loc);
        }}
      />

      {/* 3D Building Viewer Modal */}
      <Building3DViewerModal
        isOpen={!!building3D}
        building={building3D}
        onClose={() => setBuilding3D(null)}
        onNavigateToBuilding={(bld) => {
          handleSelectLocation(bld);
          setBuilding3D(null);
        }}
      />

      <CampusLifeStatusModal
        isOpen={showCampusLifeModal}
        onClose={() => setShowCampusLifeModal(false)}
        onNavigateToFacility={(facName) => {
          handleSelectLocation({ name: facName, lat: 26.5005, lng: 80.2680 });
          setShowCampusLifeModal(false);
        }}
      />

      <ParkingFinderModal
        isOpen={showParkingModal}
        onClose={() => setShowParkingModal(false)}
        onNavigateToParking={(parkName) => {
          handleSelectLocation({ name: parkName, lat: 26.4980, lng: 80.2660 });
          setShowParkingModal(false);
        }}
      />

      <SBMBuildingIndoorModal
        isOpen={showSBMIndoorModal}
        onClose={() => setShowSBMIndoorModal(false)}
        initialBuildingId={indoorBuildingId}
        onNavigateToBuilding={(bld) => {
          handleSelectLocation(bld);
          setShowSBMIndoorModal(false);
        }}
      />

      <IndoorBuildingSelectorModal
        isOpen={showIndoorSelector}
        onClose={() => setShowIndoorSelector(false)}
        onSelectBuilding={(buildingId) => handleOpenIndoorModal(buildingId)}
      />

      {/* Selected Stall Detail Drawer */}
      {selectedStall && !destination && (
        <StallDetailDrawer
          stall={selectedStall}
          onClose={() => setSelectedStall(null)}
          onNavigate={handleSelectStallDestination}
          isBookmarked={bookmarks.includes(selectedStall.id)}
          onToggleBookmark={handleToggleBookmark}
        />
      )}
    </div>
  );
}
