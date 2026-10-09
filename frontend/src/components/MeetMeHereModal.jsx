import React, { useState, useMemo } from 'react';
import { 
  X, Share2, Copy, Check, MapPin, Navigation, 
  MessageCircle, Compass, Search
} from 'lucide-react';
import { getMergedMapLocations } from '../utils/locationStore';

export default function MeetMeHereModal({
  isOpen,
  onClose,
  currentLocation,
  destination,
  onNavigateToLocation
}) {
  const [selectedType, setSelectedType] = useState('live'); // 'live' | 'place' | 'destination'
  const [selectedPlaceId, setSelectedPlaceId] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const allLocations = useMemo(() => {
    return getMergedMapLocations();
  }, []);

  const popularPlaces = useMemo(() => {
    return allLocations.filter(loc => 
      !searchFilter.trim() ||
      loc.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (loc.category && loc.category.toLowerCase().includes(searchFilter.toLowerCase()))
    );
  }, [allLocations, searchFilter]);

  // Determine the spot to share based on active selection
  const activeSpot = useMemo(() => {
    if (selectedType === 'destination' && destination) {
      return {
        id: destination.id || 'destination_spot',
        name: destination.name,
        lat: destination.lat,
        lng: destination.lng,
        floor: destination.floor || 'outdoor'
      };
    }
    if (selectedType === 'place' && selectedPlaceId) {
      const found = allLocations.find(l => l.id === selectedPlaceId);
      if (found) return found;
    }
    // Default to Live Location or fallback to CSJM central coordinates
    return {
      id: 'my_live_spot',
      name: currentLocation?.name || 'My Current Campus Location 📍',
      lat: currentLocation?.lat || 26.4970,
      lng: currentLocation?.lng || 80.2666,
      floor: currentLocation?.floor || 'outdoor'
    };
  }, [selectedType, destination, selectedPlaceId, allLocations, currentLocation]);

  // Construct the shareable link with query parameters
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    const params = new URLSearchParams();
    if (activeSpot.id) params.set('meet', activeSpot.id);
    if (activeSpot.lat) params.set('lat', activeSpot.lat.toFixed(6));
    if (activeSpot.lng) params.set('lng', activeSpot.lng.toFixed(6));
    if (activeSpot.name) params.set('name', activeSpot.name);
    if (activeSpot.floor && activeSpot.floor !== 'outdoor') params.set('floor', activeSpot.floor);
    if (customNote.trim()) params.set('note', customNote.trim());
    return `${base}?${params.toString()}`;
  }, [activeSpot, customNote]);

  // Formatted WhatsApp message text
  const whatsappMessage = useMemo(() => {
    let msg = `📍 *Hey! Meet me here on CSJMU Campus*\n\n`;
    msg += `📌 *Location:* ${activeSpot.name}\n`;
    if (customNote.trim()) {
      msg += `💬 *Note:* "${customNote.trim()}"\n`;
    }
    msg += `\n🗺️ *Tap this link for exact walking directions to my spot:*\n${shareUrl}`;
    return msg;
  }, [activeSpot, customNote, shareUrl]);

  // WhatsApp share trigger
  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(whatsappMessage);
    const waUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Copy link handler
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn("Could not copy link:", err);
    }
  };

  // Native Web Share Sheet
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Meet me at ${activeSpot.name} - CSJMU Navigator`,
          text: whatsappMessage,
          url: shareUrl
        });
      } catch (err) {
        console.warn("Share cancelled or failed:", err);
      }
    } else {
      handleCopyLink();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="mobile-map-search-overlay animate-fade-in"
      onClick={onClose}
      style={{ zIndex: 1000 }}
    >
      <div 
        className="mobile-map-search-sheet animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <div className="search-sheet-handle" />

        {/* Modal Header */}
        <div className="search-sheet-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10B981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFF',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
            }}>
              <Share2 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Meet Me Here 📍
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--colors-body)', margin: 0 }}>
                Share your exact campus location with friends via WhatsApp
              </p>
            </div>
          </div>

          <button 
            type="button" 
            className="search-sheet-close"
            onClick={onClose}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Spot Selection Mode Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: destination ? '1fr 1fr 1fr' : '1fr 1fr',
          gap: '6px',
          background: 'var(--colors-surface-soft)',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid var(--colors-hairline)'
        }}>
          <button
            type="button"
            onClick={() => setSelectedType('live')}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: 'none',
              background: selectedType === 'live' ? 'var(--colors-canvas)' : 'transparent',
              color: selectedType === 'live' ? 'var(--colors-ink)' : 'var(--colors-body)',
              fontWeight: selectedType === 'live' ? 700 : 500,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: selectedType === 'live' ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Compass size={14} color="#10B981" />
            <span>My GPS Location</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('place')}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: 'none',
              background: selectedType === 'place' ? 'var(--colors-canvas)' : 'transparent',
              color: selectedType === 'place' ? 'var(--colors-ink)' : 'var(--colors-body)',
              fontWeight: selectedType === 'place' ? 700 : 500,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: selectedType === 'place' ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <MapPin size={14} color="#3B82F6" />
            <span>Select Landmark</span>
          </button>

          {destination && (
            <button
              type="button"
              onClick={() => setSelectedType('destination')}
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                border: 'none',
                background: selectedType === 'destination' ? 'var(--colors-canvas)' : 'transparent',
                color: selectedType === 'destination' ? 'var(--colors-ink)' : 'var(--colors-body)',
                fontWeight: selectedType === 'destination' ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: selectedType === 'destination' ? 'var(--shadow-sm)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <Navigation size={14} color="#8B5CF6" />
              <span>Current Pin</span>
            </button>
          )}
        </div>

        {/* Place Picker (if 'place' tab is selected) */}
        {selectedType === 'place' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--colors-surface-soft)',
              border: '1px solid var(--colors-hairline)',
              borderRadius: '10px',
              padding: '6px 12px'
            }}>
              <Search size={14} color="var(--colors-body)" />
              <input
                type="text"
                placeholder="Search UIET, Library, Cafeteria, Hostel..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  width: '100%',
                  fontSize: '12px',
                  color: 'var(--colors-ink)'
                }}
              />
            </div>

            <div style={{
              maxHeight: '140px',
              overflowY: 'auto',
              border: '1px solid var(--colors-hairline)',
              borderRadius: '10px',
              background: 'var(--colors-canvas)'
            }}>
              {popularPlaces.slice(0, 15).map(loc => (
                <div
                  key={loc.id}
                  onClick={() => setSelectedPlaceId(loc.id)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: selectedPlaceId === loc.id ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                    borderBottom: '1px solid var(--colors-hairline)',
                    fontWeight: selectedPlaceId === loc.id ? 700 : 500,
                    color: selectedPlaceId === loc.id ? '#059669' : 'var(--colors-ink)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={13} color={selectedPlaceId === loc.id ? '#10B981' : 'var(--colors-body)'} />
                    <span>{loc.name}</span>
                  </div>
                  {selectedPlaceId === loc.id && <Check size={14} color="#10B981" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Spot Details Preview Card */}
        <div style={{
          background: 'var(--colors-surface-soft)',
          border: '1px solid var(--colors-hairline-strong)',
          borderRadius: '12px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--colors-body)', letterSpacing: '0.5px' }}>
              CURRENT SHARING SPOT:
            </span>
            <span style={{
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '4px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#059669',
              fontWeight: 700
            }}>
              Exact Pedestrian Path
            </span>
          </div>

          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--colors-ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={16} color="#10B981" />
            <span>{activeSpot.name}</span>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--colors-body)', fontFamily: 'var(--font-code)' }}>
            Coordinates: {activeSpot.lat?.toFixed(5)}, {activeSpot.lng?.toFixed(5)}
          </div>
        </div>

        {/* Optional Custom Note Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--colors-body)' }}>
            Add an optional note for your friend:
          </label>
          <input
            type="text"
            placeholder="e.g. Waiting near the canteen tree / 2nd floor lab..."
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: '10px',
              border: '1px solid var(--colors-hairline-strong)',
              background: 'var(--colors-canvas)',
              color: 'var(--colors-ink)',
              fontSize: '12px',
              outline: 'none'
            }}
          />
        </div>

        {/* Primary Share Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          {/* 1. Share via WhatsApp */}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            style={{
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              color: '#FFF',
              border: 'none',
              padding: '12px 18px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
              transition: 'transform 0.15s ease'
            }}
          >
            <MessageCircle size={18} />
            <span>Share on WhatsApp ➔</span>
          </button>

          {/* Secondary Actions: Copy Link & Native Share */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                background: 'var(--colors-surface-soft)',
                border: '1px solid var(--colors-hairline-strong)',
                color: 'var(--colors-ink)',
                padding: '9px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
            >
              {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
              <span>{copied ? 'Link Copied! ✓' : 'Copy Link'}</span>
            </button>

            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
              <button
                type="button"
                onClick={handleNativeShare}
                style={{
                  background: 'var(--colors-surface-soft)',
                  border: '1px solid var(--colors-hairline-strong)',
                  color: 'var(--colors-ink)',
                  padding: '9px 14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Share2 size={14} />
                <span>More Apps...</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToLocation) {
                    onNavigateToLocation(activeSpot);
                    onClose();
                  }
                }}
                style={{
                  background: 'var(--colors-surface-soft)',
                  border: '1px solid var(--colors-hairline-strong)',
                  color: 'var(--colors-ink)',
                  padding: '9px 14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Navigation size={14} color="#3B82F6" />
                <span>View on Map</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
