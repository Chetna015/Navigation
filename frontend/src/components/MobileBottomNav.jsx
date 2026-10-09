import React from 'react';
import { Home, Map, Bot, Building2, Share2 } from 'lucide-react';

export default function MobileBottomNav({
  currentPage,
  onNavigateTab,
  onOpenAIAssistant,
  onOpenIndoor,
  onOpenMeetMe,
  onOpenSchedule,
  onOpenSessions,
  onOpenSaved,
  hasActiveRoute
}) {
  const handleMeetMeClick = () => {
    if (onOpenMeetMe) {
      onOpenMeetMe();
    } else if (onOpenSchedule) {
      onOpenSchedule();
    } else if (onOpenSessions) {
      onOpenSessions();
    } else if (onOpenSaved) {
      onOpenSaved();
    }
  };

  return (
    <nav className="mobile-bottom-nav">
      {/* 1. Home Tab */}
      <button
        type="button"
        className={`mobile-nav-item ${currentPage === 'home' ? 'active' : ''}`}
        onClick={() => onNavigateTab('home')}
        title="Home"
      >
        <div className="mobile-nav-icon-wrap">
          <Home size={20} />
        </div>
        <span className="mobile-nav-label">Home</span>
      </button>

      {/* 2. Map Tab */}
      <button
        type="button"
        className={`mobile-nav-item ${currentPage === 'map' ? 'active' : ''}`}
        onClick={() => onNavigateTab('map')}
        title="Campus Map"
      >
        <div className="mobile-nav-icon-wrap">
          <Map size={20} />
          {hasActiveRoute && <span className="mobile-nav-badge-dot" />}
        </div>
        <span className="mobile-nav-label">Map</span>
      </button>

      {/* 3. AI Assistant Tab */}
      <button
        type="button"
        className="mobile-nav-item mobile-nav-item-ai"
        onClick={onOpenAIAssistant}
        title="AI Campus Guide"
      >
        <div className="mobile-nav-icon-wrap mobile-ai-icon-pulse">
          <Bot size={22} color="#FFFFFF" />
        </div>
        <span className="mobile-nav-label">AI Guide</span>
      </button>

      {/* 4. Indoor Rooms & Water Coolers Tab */}
      <button
        type="button"
        className="mobile-nav-item"
        onClick={onOpenIndoor}
        title="Indoor Floorplans & Rooms"
      >
        <div className="mobile-nav-icon-wrap">
          <Building2 size={20} />
        </div>
        <span className="mobile-nav-label">Indoor</span>
      </button>

      {/* 5. Meet Me Here (WhatsApp Pin Sharing) Tab */}
      <button
        type="button"
        className="mobile-nav-item"
        onClick={handleMeetMeClick}
        title="Meet Me Here - Share Campus Spot on WhatsApp"
      >
        <div className="mobile-nav-icon-wrap">
          <Share2 size={20} />
        </div>
        <span className="mobile-nav-label">Meet Me</span>
      </button>
    </nav>
  );
}
