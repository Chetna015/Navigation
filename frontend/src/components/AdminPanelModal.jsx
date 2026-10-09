import React, { useState, useEffect } from 'react';
import { 
  Shield, ShieldCheck, Lock, User, Key, LogOut, MapPin, 
  Plus, Trash2, Search, Building2, Layers, Eye, CheckCircle2, 
  AlertCircle, X, Crosshair, Compass, RefreshCw
} from 'lucide-react';
import { apiService, isAdminAuthenticated, getAdminUser } from '../services/api';
import { getMergedMapLocations, syncLocationsFromServer, hideOrDeleteLocation } from '../utils/locationStore';

const PRESET_COORDINATES = [
  { label: 'GT Road Main Gate 1', lat: '26.497000', lng: '80.266600' },
  { label: 'UIET Engineering Block 1', lat: '26.501500', lng: '80.268800' },
  { label: 'CSJM Auditorium Quad', lat: '26.504193', lng: '80.268463' },
  { label: 'Central Library', lat: '26.500900', lng: '80.265500' },
  { label: 'Senate Hall Complex', lat: '26.499800', lng: '80.267200' },
  { label: 'Health Center & Dispensary', lat: '26.502800', lng: '80.266100' }
];

const CATEGORIES = [
  'Academic Block',
  'Administrative Office',
  'Fee Counter & Accounts',
  'Examination & Result Wing',
  'Central Library & Digital Hub',
  'Student Hostel',
  'Cafeteria & Food Court',
  'Health Center & Dispensary',
  'Sports Complex & Stadium',
  'Campus Gate / Entrance',
  'Parking Area'
];

export default function AdminPanelModal({
  isOpen,
  onClose,
  onStartPinningMode,
  onSelectLocationOnMap
}) {
  const [isAuth, setIsAuth] = useState(() => isAdminAuthenticated());
  const [currentUser, setCurrentUser] = useState(() => getAdminUser());
  const [activeTab, setActiveTab] = useState('pin'); // 'pin' | 'manage' | 'security'
  
  // Login Form
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pin Form
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [lat, setLat] = useState('26.501500');
  const [lng, setLng] = useState('80.268800');
  const [floors, setFloors] = useState(2);
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  // Manage Locations Search
  const [searchQuery, setSearchQuery] = useState('');
  const [locations, setLocations] = useState(() => getMergedMapLocations());
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync auth state
  useEffect(() => {
    const checkAuth = () => {
      const authStatus = isAdminAuthenticated();
      setIsAuth(authStatus);
      setCurrentUser(getAdminUser());
    };
    checkAuth();

    const handleAuthChange = () => checkAuth();
    const handleLocationsChange = () => setLocations(getMergedMapLocations());

    window.addEventListener('csjmu_admin_auth_changed', handleAuthChange);
    window.addEventListener('csjmu_locations_updated', handleLocationsChange);

    return () => {
      window.removeEventListener('csjmu_admin_auth_changed', handleAuthChange);
      window.removeEventListener('csjmu_locations_updated', handleLocationsChange);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLocations(getMergedMapLocations());
      setStatusMessage(null);
      setLoginError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);

    try {
      const res = await apiService.login(username, password);
      if (res.success) {
        setIsAuth(true);
        setCurrentUser(res.user);
        setPassword('');
        // Sync fresh locations from server
        await syncLocationsFromServer();
        setLocations(getMergedMapLocations());
      } else {
        setLoginError(res.message || 'Invalid administrator username or password');
      }
    } catch (err) {
      setLoginError('Could not reach backend server. Please verify backend is running on port 5001.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    apiService.logout();
    setIsAuth(false);
    setCurrentUser(null);
    setPassword('');
    setStatusMessage(null);
  };

  // Handle Pin Submission
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid location name.' });
      return;
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setStatusMessage({ type: 'error', text: 'Please enter valid GPS coordinates (latitude & longitude).' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const newLocPayload = {
      id: `loc_${Date.now()}`,
      name: name.trim(),
      code: code.trim() || `CSJM-${Math.floor(100 + Math.random() * 900)}`,
      category,
      lat: parsedLat,
      lng: parsedLng,
      x: 350,
      y: 350,
      floors: parseInt(floors, 10) || 2,
      description: description.trim() || `Official ${category} at CSJMU Campus`,
      cover_image: coverImage.trim() || null
    };

    try {
      const res = await apiService.saveLocation(newLocPayload);
      if (res && res.success) {
        // Refresh local cache and trigger map reactivity
        await syncLocationsFromServer();
        setLocations(getMergedMapLocations());

        setStatusMessage({
          type: 'success',
          text: `Location "${name}" was successfully pinned and published to all students and visitors!`
        });

        // Reset form
        setName('');
        setCode('');
        setDescription('');
      } else {
        setStatusMessage({
          type: 'error',
          text: res?.error || 'Failed to pin location on server.'
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: 'Network error: Failed to save pin to database.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Location (Admin only)
  const handleDeleteLocation = async (loc) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${loc.name}" from the official campus map?`)) {
      return;
    }

    try {
      const res = await apiService.deleteLocation(loc.id);
      if (res && res.success) {
        hideOrDeleteLocation(loc.id);
        await syncLocationsFromServer();
        setLocations(getMergedMapLocations());
        setStatusMessage({
          type: 'success',
          text: `"${loc.name}" was successfully removed from the campus map.`
        });
      } else {
        alert(res?.error || 'Failed to delete location from server.');
      }
    } catch (err) {
      alert('Error deleting location: ' + err.message);
    }
  };

  // Handle Refresh / Sync
  const handleSyncLocations = async () => {
    setIsSyncing(true);
    try {
      await syncLocationsFromServer();
      setLocations(getMergedMapLocations());
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredLocations = locations.filter(l => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (l.name && l.name.toLowerCase().includes(q)) ||
           (l.category && l.category.toLowerCase().includes(q)) ||
           (l.code && l.code.toLowerCase().includes(q));
  });

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1200,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="animate-scale-up" style={{
        width: '100%',
        maxWidth: isAuth ? '780px' : '440px',
        maxHeight: '90vh',
        borderRadius: '16px',
        background: 'var(--colors-surface-card)',
        border: '1px solid var(--colors-hairline-strong)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}>
        {/* Top Header */}
        <div style={{
          padding: '16px 22px',
          background: 'var(--colors-surface-soft)',
          borderBottom: '1px solid var(--colors-hairline)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: isAuth ? '#059669' : '#2563EB',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}>
              {isAuth ? <ShieldCheck size={20} /> : <Shield size={20} />}
            </div>
            <div>
              <h2 style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--colors-ink)',
                fontFamily: 'var(--font-heading)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {isAuth ? 'CSJMU Administrator Console' : 'Official Admin Access'}
                {isAuth && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#059669',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    AUTHORIZED
                  </span>
                )}
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--colors-body)', margin: '2px 0 0 0' }}>
                {isAuth 
                  ? `Signed in as ${currentUser?.username || 'admin'} • Full Pin & Location Privileges` 
                  : 'Restricted: Non-admin users cannot add or remove pins'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Close Admin Panel"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--colors-surface-card)',
              border: '1px solid var(--colors-hairline)',
              color: 'var(--colors-ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        {!isAuth ? (
          /* LOGIN VIEW */
          <div style={{ padding: '24px', overflowY: 'auto' }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'rgba(37, 99, 235, 0.1)',
                color: '#2563EB',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px'
              }}>
                <Lock size={26} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--colors-ink)', margin: '0 0 6px 0' }}>
                Campus Map Administration
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--colors-body)', margin: 0, lineHeight: 1.5 }}>
                To maintain map integrity, <strong>only university administrators</strong> can pin new campus buildings or remove existing landmarks. Students and visitors can browse and navigate freely.
              </p>
            </div>

            {loginError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#DC2626',
                fontSize: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} flexShrink={0} />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', marginBottom: '6px' }}>
                  Admin Username
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--colors-body)' }} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter admin username"
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      borderRadius: '8px',
                      border: '1px solid var(--colors-hairline-strong)',
                      background: 'var(--colors-canvas)',
                      color: 'var(--colors-ink)',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', marginBottom: '6px' }}>
                  Admin Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Key size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--colors-body)' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      borderRadius: '8px',
                      border: '1px solid var(--colors-hairline-strong)',
                      background: 'var(--colors-canvas)',
                      color: 'var(--colors-ink)',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="ollama-btn-primary"
                style={{
                  marginTop: '8px',
                  height: '40px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? 'Authenticating...' : 'Sign In as Administrator'}
              </button>

              <div style={{
                marginTop: '6px',
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'var(--colors-surface-soft)',
                border: '1px dashed var(--colors-hairline-strong)',
                fontSize: '11px',
                color: 'var(--colors-body)',
                textAlign: 'center'
              }}>
                💡 Default Administrator credentials: <code>admin</code> / <code>admin2026</code>
              </div>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED ADMIN CONSOLE VIEW */
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Tab Navigation */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 20px',
              borderBottom: '1px solid var(--colors-hairline)',
              background: 'var(--colors-canvas)'
            }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('pin')}
                  style={{
                    padding: '12px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: activeTab === 'pin' ? 'var(--colors-primary)' : 'var(--colors-body)',
                    borderBottom: activeTab === 'pin' ? '2px solid var(--colors-primary)' : '2px solid transparent',
                    background: 'none',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <MapPin size={15} /> Pin New Location
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('manage')}
                  style={{
                    padding: '12px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: activeTab === 'manage' ? 'var(--colors-primary)' : 'var(--colors-body)',
                    borderBottom: activeTab === 'manage' ? '2px solid var(--colors-primary)' : '2px solid transparent',
                    background: 'none',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Layers size={15} /> Manage & Delete Pins ({locations.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  style={{
                    padding: '12px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: activeTab === 'security' ? 'var(--colors-primary)' : 'var(--colors-body)',
                    borderBottom: activeTab === 'security' ? '2px solid var(--colors-primary)' : '2px solid transparent',
                    background: 'none',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ShieldCheck size={15} /> Security Overview
                </button>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                title="Sign out of Admin session"
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#EF4444',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <LogOut size={13} /> Logout
              </button>
            </div>

            {/* Notification Banner */}
            {statusMessage && (
              <div style={{
                margin: '12px 20px 0 20px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: statusMessage.type === 'success' ? '#059669' : '#DC2626',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{statusMessage.text}</span>
                </div>
                <button
                  onClick={() => setStatusMessage(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* TAB 1: PIN NEW LOCATION */}
            {activeTab === 'pin' && (
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  padding: '12px 16px',
                  background: 'rgba(37, 99, 235, 0.05)',
                  border: '1px solid rgba(37, 99, 235, 0.15)',
                  borderRadius: '10px'
                }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--colors-ink)' }}>
                      Interactive Map Pinning
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--colors-body)' }}>
                      Click on the campus map directly to choose coordinates, or enter them manually below.
                    </p>
                  </div>
                  {onStartPinningMode && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onStartPinningMode();
                      }}
                      className="ollama-btn-primary"
                      style={{
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Crosshair size={14} /> Drop Pin on Map
                    </button>
                  )}
                </div>

                <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', marginBottom: '4px' }}>
                        Location / Building Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Examination Controller & Degree Wing"
                        required
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--colors-hairline-strong)',
                          background: 'var(--colors-canvas)',
                          color: 'var(--colors-ink)',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', marginBottom: '4px' }}>
                        Code / Tag
                      </label>
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="e.g. ADM-EXAM"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--colors-hairline-strong)',
                          background: 'var(--colors-canvas)',
                          color: 'var(--colors-ink)',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', marginBottom: '4px' }}>
                        Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--colors-hairline-strong)',
                          background: 'var(--colors-canvas)',
                          color: 'var(--colors-ink)',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      >
                        {CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', marginBottom: '4px' }}>
                        Total Floors
                      </label>
                      <select
                        value={floors}
                        onChange={(e) => setFloors(parseInt(e.target.value, 10))}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--colors-hairline-strong)',
                          background: 'var(--colors-canvas)',
                          color: 'var(--colors-ink)',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value={1}>1 Floor (Ground Only)</option>
                        <option value={2}>2 Floors (Ground + 1st)</option>
                        <option value={3}>3 Floors (G + 1F + 2F)</option>
                        <option value={4}>4 Floors (Multi-story)</option>
                        <option value={5}>5+ Floors</option>
                      </select>
                    </div>
                  </div>

                  {/* Coordinates & Presets */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)' }}>
                        GPS Coordinates (Latitude, Longitude) *
                      </label>
                      <span style={{ fontSize: '11px', color: 'var(--colors-body)' }}>Presets:</span>
                    </div>

                    {/* Quick Presets Pills */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {PRESET_COORDINATES.map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            setLat(p.lat);
                            setLng(p.lng);
                          }}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'var(--colors-surface-soft)',
                            border: '1px solid var(--colors-hairline)',
                            color: 'var(--colors-ink)',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <input
                        type="text"
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                        placeholder="Latitude (e.g. 26.501500)"
                        required
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--colors-hairline-strong)',
                          background: 'var(--colors-canvas)',
                          color: 'var(--colors-ink)',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                      <input
                        type="text"
                        value={lng}
                        onChange={(e) => setLng(e.target.value)}
                        placeholder="Longitude (e.g. 80.268800)"
                        required
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--colors-hairline-strong)',
                          background: 'var(--colors-canvas)',
                          color: 'var(--colors-ink)',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', marginBottom: '4px' }}>
                      Description & Important Guidance for Students / Visitors
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Student queries, migration certificates, degree collection counters (Counter 1 to 5). Open 10 AM to 4 PM."
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--colors-hairline-strong)',
                        background: 'var(--colors-canvas)',
                        color: 'var(--colors-ink)',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', marginBottom: '4px' }}>
                      Cover Image URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                      placeholder="https://... or /assets/buildings/..."
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--colors-hairline-strong)',
                        background: 'var(--colors-canvas)',
                        color: 'var(--colors-ink)',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="ollama-btn-primary"
                    style={{
                      height: '42px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 700,
                      marginTop: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Plus size={16} /> {isSubmitting ? 'Publishing Pin...' : 'Publish Pin to Live University Map'}
                  </button>
                </form>
              </div>
            )}

            {/* TAB 2: MANAGE & DELETE PINS */}
            {activeTab === 'manage' && (
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px'
                }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--colors-body)' }} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search locations to view or delete..."
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 34px',
                        borderRadius: '8px',
                        border: '1px solid var(--colors-hairline-strong)',
                        background: 'var(--colors-canvas)',
                        color: 'var(--colors-ink)',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <button
                    onClick={handleSyncLocations}
                    title="Refresh locations from database"
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--colors-hairline)',
                      background: 'var(--colors-surface-soft)',
                      color: 'var(--colors-ink)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} /> Sync
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredLocations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--colors-body)', fontSize: '13px' }}>
                      No matching pins found.
                    </div>
                  ) : (
                    filteredLocations.map(loc => (
                      <div
                        key={loc.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: '1px solid var(--colors-hairline)',
                          background: 'var(--colors-surface-soft)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: loc.isCustom ? 'rgba(16, 185, 129, 0.15)' : 'rgba(37, 99, 235, 0.15)',
                            color: loc.isCustom ? '#059669' : '#2563EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Building2 size={16} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h5 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--colors-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {loc.name}
                              </h5>
                              {loc.isCustom && (
                                <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#059669', color: '#fff' }}>
                                  CUSTOM PIN
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--colors-body)' }}>
                              {loc.category || 'Facility'} • Lat: {Number(loc.lat).toFixed(4)}, Lng: {Number(loc.lng).toFixed(4)}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {onSelectLocationOnMap && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectLocationOnMap(loc);
                                onClose();
                              }}
                              title="Focus pin on map"
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--colors-hairline)',
                                background: 'var(--colors-canvas)',
                                color: 'var(--colors-ink)',
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Eye size={13} /> View
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteLocation(loc)}
                            title="Delete this pin permanently"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#EF4444',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: SECURITY OVERVIEW */}
            {activeTab === 'security' && (
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <ShieldCheck size={20} color="#059669" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: 'var(--colors-ink)' }}>
                        Normal User & Visitor Protection Active
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--colors-body)', lineHeight: 1.5 }}>
                        Public visitors and students <strong>cannot pin new locations or delete official buildings</strong>. All mutation APIs are locked with JWT Authorization checks.
                      </p>
                    </div>
                  </div>

                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: 'var(--colors-surface-soft)',
                    border: '1px solid var(--colors-hairline)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <h5 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--colors-ink)' }}>
                      Security Specifications
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                      <div style={{ padding: '10px', background: 'var(--colors-canvas)', borderRadius: '8px', border: '1px solid var(--colors-hairline)' }}>
                        <span style={{ display: 'block', color: 'var(--colors-body)', fontSize: '11px' }}>Password Security</span>
                        <strong style={{ color: '#059669' }}>Bcrypt Salted Hash</strong>
                      </div>
                      <div style={{ padding: '10px', background: 'var(--colors-canvas)', borderRadius: '8px', border: '1px solid var(--colors-hairline)' }}>
                        <span style={{ display: 'block', color: 'var(--colors-body)', fontSize: '11px' }}>API Token Authentication</span>
                        <strong style={{ color: '#2563EB' }}>HMAC-SHA256 JWT</strong>
                      </div>
                      <div style={{ padding: '10px', background: 'var(--colors-canvas)', borderRadius: '8px', border: '1px solid var(--colors-hairline)' }}>
                        <span style={{ display: 'block', color: 'var(--colors-body)', fontSize: '11px' }}>File Upload Protection</span>
                        <strong style={{ color: '#059669' }}>MIME-type Validation (JPG/PNG/WebP)</strong>
                      </div>
                      <div style={{ padding: '10px', background: 'var(--colors-canvas)', borderRadius: '8px', border: '1px solid var(--colors-hairline)' }}>
                        <span style={{ display: 'block', color: 'var(--colors-body)', fontSize: '11px' }}>Database Sync</span>
                        <strong style={{ color: 'var(--colors-ink)' }}>SQLite Multi-User Persistence</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
