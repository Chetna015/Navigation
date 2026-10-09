import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  ZoomIn, ZoomOut, Compass, Sparkles, Lock, Plus, MousePointerClick, Layers, Eye, EyeOff, Maximize, Navigation
} from 'lucide-react';
import { DEFAULT_CAMPUS_BUILDINGS, getStoredPlottedBuildings, getCampusRoute } from '../utils/pathfinding';
import { getMergedCampusBuildings, syncLocationsFromServer } from '../utils/locationStore';
import { DEPARTMENT_AREAS } from '../data/auditoriumData';
import BuildingPlotterModal from './BuildingPlotterModal';
import BuildingDetailDrawer from './BuildingDetailDrawer';
import ManagePinsModal from './ManagePinsModal';
import SenateHallVerticalPanel from './SenateHallVerticalPanel';

// CSJMU University Campus Official Perimeter Coordinates (Kanpur Location)
const CAMPUS_BOUNDARY_POLYGON = [
  [26.5025, 80.2630], // North-West Corner
  [26.5030, 80.2685], // North-East Corner
  [26.4985, 80.2715], // East Boundary
  [26.4945, 80.2690], // South-East Corner
  [26.4945, 80.2630], // South-West Corner (GT Road Entrance)
  [26.4970, 80.2615]  // West Boundary
];

// Outer World Dark Mask Polygon
const WORLD_MASK_POLYGON = [
  [
    [90, -180],
    [90, 180],
    [-90, 180],
    [-90, -180]
  ],
  CAMPUS_BOUNDARY_POLYGON
];

// Available High-Resolution Satellite & Map Tile Providers
const TILE_PROVIDERS = {
  'hybrid': {
    name: '🛰️ Google Hybrid Satellite',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
  },
  'satellite': {
    name: '🛰️ Google Pure Satellite',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
  },
  'esri': {
    name: '🌍 Esri HD Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: []
  },
  'roadmap': {
    name: '🗺️ Google Roadmap',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
  }
};

export default function GoogleCampusMap({
  isAdminMode,
  currentLocation,
  setCurrentLocation,
  destination,
  shortestRoute,
  onSelectLocation,
  onOpenEditLocation,
  onOpen3DView,
  onOpenSBMIndoor,
  navMode = 'preview',
  isNavigatingLive = false
}) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const polylineRef = useRef(null);
  const animPolylineRef = useRef(null);
  const markersGroupRef = useRef(null);
  const deptPolygonsGroupRef = useRef(null);
  const campusBoundaryRef = useRef(null);
  const maskLayerRef = useRef(null);

  // Map Tile Type State: 'hybrid' (Google Hybrid), 'satellite', 'esri', 'roadmap'
  const [mapType, setMapType] = useState('hybrid');
  const [showDeptAreas, setShowDeptAreas] = useState(true);
  const [showOuterMask, setShowOuterMask] = useState(false); // Default off so satellite imagery is crystal clear everywhere
  const tileLayerRef = useRef(null);

  // OSRM Road Route State
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  // Plotting & Building Inspector State
  const [isPlottingMode, setIsPlottingMode] = useState(false);
  const [showPlotModal, setShowPlotModal] = useState(false);
  const [showManagePinsModal, setShowManagePinsModal] = useState(false);
  const [showSenateHallPanel, setShowSenateHallPanel] = useState(false);
  const [clickedLatLng, setClickedLatLng] = useState(null);
  const [inspectedBuilding, setInspectedBuilding] = useState(null);
  const [customBuildings, setCustomBuildings] = useState(getStoredPlottedBuildings());
  const [locationTick, setLocationTick] = useState(0);

  const isAdminModeRef = useRef(isAdminMode);
  isAdminModeRef.current = isAdminMode;
  const isPlottingModeRef = useRef(isPlottingMode);
  isPlottingModeRef.current = isPlottingMode;

  useEffect(() => {
    const handleUpdate = () => setLocationTick(t => t + 1);
    window.addEventListener('csjmu_locations_updated', handleUpdate);
    return () => window.removeEventListener('csjmu_locations_updated', handleUpdate);
  }, []);

  const lastRouteParamsRef = useRef(null);

  // Fetch OSRM Road-Snapped Campus Route whenever currentLocation or destination changes
  useEffect(() => {
    let isCancelled = false;

    async function fetchRoute() {
      if (!currentLocation || !destination || !currentLocation.lat || !destination.lat) {
        setRouteCoordinates([]);
        lastRouteParamsRef.current = null;
        return;
      }

      const startLat = currentLocation.lat;
      const startLng = currentLocation.lng;
      const destLat = destination.lat;
      const destLng = destination.lng;

      // Prevent redundant fetches if movement is under 5 meters and destination is identical
      if (lastRouteParamsRef.current) {
        const p = lastRouteParamsRef.current;
        const isSameDest = Math.abs(p.destLat - destLat) < 0.00001 && Math.abs(p.destLng - destLng) < 0.00001;
        const dStart = Math.abs(p.startLat - startLat) + Math.abs(p.startLng - startLng);
        if (dStart < 0.00005 && isSameDest) {
          return;
        }
        if (!isSameDest) {
          setRouteCoordinates([]);
        }
      }

      lastRouteParamsRef.current = { startLat, startLng, destLat, destLng };
      const routeData = await getCampusRoute(startLat, startLng, destLat, destLng);

      if (!isCancelled) {
        if (routeData && routeData.path && routeData.path.length > 0) {
          setRouteCoordinates(routeData.path);
        } else {
          setRouteCoordinates([]);
        }
      }
    }

    fetchRoute();

    return () => {
      isCancelled = true;
    };
  }, [currentLocation, destination]);

  // Initialize Leaflet Map with unrestricted panning and smooth high-resolution zoom
  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletMapRef.current) {
      const centerLat = 26.4983;
      const centerLng = 80.2658;

      const map = L.map(mapRef.current, {
        center: [centerLat, centerLng],
        zoom: 17,
        minZoom: 3,
        maxZoom: 21,
        zoomControl: false,
        attributionControl: false
      });

      const provider = TILE_PROVIDERS[mapType] || TILE_PROVIDERS['hybrid'];

      const tileLayer = L.tileLayer(provider.url, {
        maxZoom: 21,
        maxNativeZoom: 20,
        subdomains: provider.subdomains
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Attach Map Click listener directly on map creation
      map.on('click', (e) => {
        if (isAdminModeRef.current && isPlottingModeRef.current) {
          setClickedLatLng(e.latlng);
          setShowPlotModal(true);
          setIsPlottingMode(false);
        } else {
          setInspectedBuilding(null);
        }
      });

      // Initialize layers without dotted lines or text overlays
      deptPolygonsGroupRef.current = L.layerGroup().addTo(map);
      markersGroupRef.current = L.layerGroup().addTo(map);
      leafletMapRef.current = map;
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer when mapType changes
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const provider = TILE_PROVIDERS[mapType] || TILE_PROVIDERS['hybrid'];

    tileLayerRef.current = L.tileLayer(provider.url, {
      maxZoom: 21,
      maxNativeZoom: 20,
      subdomains: provider.subdomains
    }).addTo(map);
  }, [mapType]);

  // Render Department Areas (Disabled by default to remove dotted lines & texts)
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !deptPolygonsGroupRef.current) return;

    deptPolygonsGroupRef.current.clearLayers();
    // Dotted lines and text overlays removed as requested
  }, [showDeptAreas]);

  // Recenter map listener for Re-centre button & Compass click
  useEffect(() => {
    const handleReCentre = (e) => {
      const map = leafletMapRef.current;
      if (!map) return;
      const targetLat = e.detail?.lat || currentLocation?.lat || 26.4970;
      const targetLng = e.detail?.lng || currentLocation?.lng || 80.2666;
      map.flyTo([targetLat, targetLng], 19, { animate: true, duration: 1.0 });
    };

    window.addEventListener('csjmu_recenter_map', handleReCentre);
    return () => window.removeEventListener('csjmu_recenter_map', handleReCentre);
  }, [currentLocation]);

  // Render Markers (All default red & blue pinned symbols and text labels removed as requested)
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();

    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    if (animPolylineRef.current) {
      map.removeLayer(animPolylineRef.current);
      animPolylineRef.current = null;
    }

    let activePins = {};
    if (destination && destination.lat && destination.lng) {
      // ONLY show origin and destination pins when navigating/previewing route
      if (currentLocation && currentLocation.lat && currentLocation.lng) {
        activePins[currentLocation.id || 'origin'] = currentLocation;
      }
      activePins[destination.id || 'dest'] = destination;
    } else {
      activePins = getMergedCampusBuildings();
    }

// Category Style Resolver for POI Circular Markers
const getPoiCategoryStyle = (node) => {
  const name = (node.name || '').toLowerCase();
  const cat = (node.category || '').toLowerCase();

  if (cat.includes('library') || name.includes('library')) {
    return { bg: '#D97706', icon: '📚' }; // Gold/Amber
  }
  if (cat.includes('academic') || name.includes('uiet') || name.includes('lecture') || name.includes('department') || name.includes('academics') || name.includes('diet')) {
    return { bg: '#2563EB', icon: '🎓' }; // Royal Blue
  }
  if (cat.includes('food') || name.includes('cafeteria') || name.includes('canteen')) {
    return { bg: '#F97316', icon: '☕' }; // Orange
  }
  if (cat.includes('hospital') || name.includes('hospital') || name.includes('medical')) {
    return { bg: '#E11D48', icon: '🏥' }; // Rose Red
  }
  if (cat.includes('hostel') || name.includes('hostel')) {
    return { bg: '#0284C7', icon: '🏠' }; // Light Blue
  }
  if (cat.includes('gym') || name.includes('sports') || name.includes('gym')) {
    return { bg: '#059669', icon: '🏋️' }; // Emerald Green
  }
  if (cat.includes('theatre') || name.includes('theatre') || name.includes('nataraj') || name.includes('auditorium') || name.includes('hall')) {
    return { bg: '#7C3AED', icon: '🎭' }; // Purple
  }
  if (name.includes('store') || name.includes('shop') || name.includes('market')) {
    return { bg: '#0D9488', icon: '🛍️' }; // Teal
  }
  if (name.includes('admin') || name.includes('office') || name.includes('gate') || name.includes('metro')) {
    return { bg: '#475569', icon: '🏢' }; // Slate
  }

  return { bg: '#DC2626', icon: '📍' }; // Red Default POI
};

    // Render active Red Pins (Only origin & destination when navigating)
    Object.values(activePins).forEach(node => {
      if (!node || !node.lat || !node.lng) return;
      const catStyle = getPoiCategoryStyle(node);

      const customIcon = L.divIcon({
        className: 'custom-leaflet-building-marker',
        html: `
          <div style="
            display: flex;
            align-items: center;
            gap: 6px;
            transform: translate(-50%, -100%);
            cursor: pointer;
          ">
            <div style="
              width: 28px;
              height: 28px;
              border-radius: 50%;
              background: ${catStyle.bg};
              border: 2px solid #FFFFFF;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 13px;
              flex-shrink: 0;
            ">
              ${catStyle.icon}
            </div>
            <span style="
              background: rgba(15, 23, 42, 0.88);
              color: #FFFFFF;
              font-size: 12px;
              font-weight: 600;
              font-family: var(--font-main);
              padding: 3px 8px;
              border-radius: 6px;
              border: 1px solid rgba(255, 255, 255, 0.2);
              backdrop-filter: blur(4px);
              white-space: nowrap;
              box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
            ">
              ${node.name}
            </span>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      const marker = L.marker([node.lat, node.lng], { icon: customIcon });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setInspectedBuilding(node);
        if (onSelectLocation) onSelectLocation(node);
      });
      markersGroupRef.current.addLayer(marker);
    });

    // Render "My Live GPS Location 📍" Live Marker or Heading Arrow
    const fromNode = currentLocation || { lat: 26.4970, lng: 80.2666 };
    if (fromNode && fromNode.lat && fromNode.lng) {
      const heading = fromNode.heading || 45;

      const liveUserIcon = (navMode === 'active' || isNavigatingLive) ? L.divIcon({
        className: 'custom-leaflet-blue-heading-arrow',
        html: `
          <div style="
            position: relative;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            transform: translate(-50%, -50%);
          ">
            <div style="
              position: absolute;
              width: 36px;
              height: 36px;
              border-radius: 50%;
              background: rgba(16, 185, 129, 0.25);
              border: 2px solid #10B981;
              box-shadow: 0 0 20px rgba(16, 185, 129, 0.8);
            "></div>

            <div style="
              transform: rotate(${heading}deg);
              width: 26px;
              height: 26px;
              display: flex;
              align-items: center;
              justify-content: center;
              filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4));
            ">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L19 21L12 17L5 21L12 2Z" fill="#10B981" stroke="#FFFFFF" stroke-width="2.2" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      }) : L.divIcon({
        className: 'custom-leaflet-live-user-marker',
        html: `
          <div style="
            display: flex;
            align-items: center;
            gap: 6px;
            transform: translate(-50%, -100%);
            cursor: pointer;
          ">
            <div style="
              width: 30px;
              height: 30px;
              border-radius: 50%;
              background: #10B981;
              border: 2.5px solid #FFFFFF;
              box-shadow: 0 0 16px #10B981, 0 0 30px rgba(16, 185, 129, 0.6);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #FFF;
              font-size: 13px;
            ">
              📍
            </div>
            <span style="
              background: #047857;
              color: #FFFFFF;
              font-size: 12px;
              font-weight: 700;
              font-family: var(--font-heading);
              padding: 4px 10px;
              border-radius: 8px;
              border: 1.5px solid #FFFFFF;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
            ">
              ${fromNode.name || 'My Live GPS Location'}
            </span>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      const userMarker = L.marker([fromNode.lat, fromNode.lng], { icon: liveUserIcon, zIndexOffset: 2000 });
      markersGroupRef.current.addLayer(userMarker);
    }

    // Render Line connecting From & To Locations along OSRM Road Route
    const toNode = destination;
    if (fromNode && toNode && fromNode.lat && fromNode.lng && toNode.lat && toNode.lng) {
      const routePoints = (routeCoordinates && routeCoordinates.length >= 2)
        ? routeCoordinates
        : (shortestRoute && shortestRoute.latLngList && shortestRoute.latLngList.length >= 2)
        ? shortestRoute.latLngList
        : null;

      const isLiveActive = (navMode === 'active' || isNavigatingLive);

      if (routePoints && routePoints.length >= 2) {
        // Glow background line
        const glowPolyline = L.polyline(routePoints, {
          color: isLiveActive ? '#60A5FA' : '#00F0FF',
          weight: isLiveActive ? 13 : 11,
          opacity: isLiveActive ? 0.6 : 0.35,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // Main Polyline: Solid Royal Blue when live navigation active (matching Google Maps screenshot)
        const mainPolyline = L.polyline(routePoints, {
          color: isLiveActive ? '#1D4ED8' : '#0284C7',
          weight: isLiveActive ? 8 : 6,
          opacity: 0.98,
          dashArray: isLiveActive ? null : '10, 10',
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        polylineRef.current = mainPolyline;
        animPolylineRef.current = glowPolyline;
      }

      // Render Destination callout badge (Google Maps style pill) when in live navigation mode
      if (isLiveActive && toNode && toNode.lat && toNode.lng) {
        const badgeIcon = L.divIcon({
          className: 'custom-leaflet-dest-callout-badge',
          html: `
            <div style="
              transform: translate(-50%, -100%);
              background: #1D4ED8;
              color: #FFFFFF;
              font-family: system-ui, -apple-system, sans-serif;
              font-size: 13px;
              font-weight: 800;
              padding: 6px 14px;
              border-radius: 14px;
              box-shadow: 0 6px 20px rgba(29, 78, 216, 0.7);
              border: 2px solid #FFFFFF;
              white-space: nowrap;
              display: flex;
              align-items: center;
              gap: 6px;
            ">
              <span style="font-size: 14px;">📍</span> ${toNode.name || 'Destination'}
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        });

        const badgeMarker = L.marker([toNode.lat, toNode.lng], { icon: badgeIcon });
        markersGroupRef.current.addLayer(badgeMarker);
      }

      // Automatically focus map view
      try {
        if (isLiveActive && fromNode && fromNode.lat && fromNode.lng) {
          map.flyTo([fromNode.lat, fromNode.lng], 18.5, { animate: true, duration: 1.0 });
        } else {
          const bounds = L.latLngBounds(routePoints);
          map.fitBounds(bounds, { padding: [80, 80], animate: true, duration: 1.2 });
        }
      } catch (err) {
        console.warn("fitBounds warning:", err);
      }
    }
  }, [currentLocation, destination, shortestRoute, routeCoordinates, customBuildings, locationTick, navMode, isNavigatingLive]);

  // Smoothly Fly camera to Destination when updated & Open Senate Hall Vertical Panel when entering Senate Hall
  useEffect(() => {
    if (!leafletMapRef.current) return;
    if (destination && destination.lat && destination.lng) {
      const isMainGate = destination.id === 'loc_main_gate' ||
                         (destination.name && destination.name.toLowerCase().includes('main gate')) ||
                         (destination.name && destination.name.toLowerCase().includes('gt road'));
      const isSenateHall = destination.id === 'loc_senate_hall' ||
                           (destination.name && destination.name.toLowerCase().includes('senate hall'));

      const targetZoom = isMainGate ? 19.5 : (isSenateHall ? 19.8 : 18);
      leafletMapRef.current.flyTo([destination.lat, destination.lng], targetZoom, {
        duration: 1.2
      });

      if (isSenateHall) {
        setShowSenateHallPanel(true);
      } else {
        setShowSenateHallPanel(false);
      }
    }
  }, [destination]);

  // Auto Fit bounds to display all location markers clearly on Satellite map
  const handleFitAllMarkers = () => {
    if (!leafletMapRef.current) return;
    const allNodes = { ...getMergedCampusBuildings(), ...customBuildings };
    const latLngs = Object.values(allNodes)
      .filter(n => n.lat && n.lng)
      .map(n => [n.lat, n.lng]);

    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      leafletMapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Leaflet Map Container */}
      <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: '580px', zIndex: 1 }} />

      {/* Crosshair Cursor Indicator when in Building Plotting Mode */}
      {isPlottingMode && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 500,
          background: 'linear-gradient(90deg, #EF4444, #F43F5E)',
          color: '#FFF',
          padding: '10px 20px',
          borderRadius: '20px',
          fontWeight: 800,
          fontSize: '13px',
          boxShadow: '0 0 25px rgba(239, 68, 68, 0.7)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <MousePointerClick size={18} className="animate-bounce" />
          📍 PINNING MODE ACTIVE: Click anywhere on map to drop a pin & tag a location! (Click to cancel)
        </div>
      )}



      {/* Right Map Zoom & Framing Controls */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 400,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <button
          onClick={() => leafletMapRef.current?.zoomIn()}
          className="map-control-btn"
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>

        <button
          onClick={() => leafletMapRef.current?.zoomOut()}
          className="map-control-btn"
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>

        <button
          onClick={handleFitAllMarkers}
          className="map-control-btn"
          title="Auto-Fit All Markers on Map"
        >
          <Maximize size={18} />
        </button>

        <button
          onClick={() => {
            if (typeof window !== 'undefined' && 'geolocation' in navigator) {
              navigator.geolocation.getCurrentPosition((pos) => {
                const liveObj = {
                  id: 'live_user_location',
                  name: 'My Live GPS Location 📍',
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  heading: pos.coords.heading || 45,
                  isLiveUser: true
                };
                if (setCurrentLocation) setCurrentLocation(liveObj);
                if (leafletMapRef.current) {
                  leafletMapRef.current.flyTo([pos.coords.latitude, pos.coords.longitude], 19, { animate: true, duration: 1.0 });
                }
              }, (err) => {
                console.warn("GPS error:", err);
                if (currentLocation && currentLocation.lat && currentLocation.lng && leafletMapRef.current) {
                  leafletMapRef.current.flyTo([currentLocation.lat, currentLocation.lng], 19, { animate: true, duration: 1.0 });
                }
              }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
            } else if (currentLocation && currentLocation.lat && currentLocation.lng && leafletMapRef.current) {
              leafletMapRef.current.flyTo([currentLocation.lat, currentLocation.lng], 19, { animate: true, duration: 1.0 });
            }
          }}
          className="map-control-btn"
          title="Locate My Live GPS Position (मेरा स्थान)"
          style={{ color: '#10B981', border: '1.5px solid #10B981' }}
        >
          <Navigation size={18} />
        </button>

        <button
          onClick={() => {
            if (leafletMapRef.current) {
              leafletMapRef.current.setView([26.4983, 80.2658], 17);
            }
          }}
          className="map-control-btn"
          title="Recenter University Campus"
        >
          <Compass size={18} />
        </button>
      </div>

      {/* Building Detail Inspector Drawer */}
      {inspectedBuilding && (
        <BuildingDetailDrawer
          building={inspectedBuilding}
          onClose={() => setInspectedBuilding(null)}
          onNavigateToBuilding={(bld) => {
            if (onSelectLocation) onSelectLocation(bld);
            setInspectedBuilding(null);
          }}
          onEditCoordinates={(bld) => {
            if (onOpenEditLocation) onOpenEditLocation(bld);
          }}
          onBuildingDeleted={() => {
            setCustomBuildings(getStoredPlottedBuildings());
          }}
          onOpen3DView={onOpen3DView}
          onOpenSBMIndoor={onOpenSBMIndoor}
          onSetAsStartLocation={(bld) => {
            if (setCurrentLocation) {
              setCurrentLocation({
                id: bld.id,
                name: `${bld.name} 📍`,
                lat: bld.lat,
                lng: bld.lng,
                category: 'Simulated Start'
              });
            }
          }}
        />
      )}

      {/* Building Plotter Modal */}
      {showPlotModal && (
        <BuildingPlotterModal
          isOpen={showPlotModal}
          onClose={() => setShowPlotModal(false)}
          initialLatLng={clickedLatLng}
          onBuildingPlotted={(bld) => {
            syncLocationsFromServer();
            setCustomBuildings(getStoredPlottedBuildings());
            setInspectedBuilding(bld);
          }}
        />
      )}

      {/* Manage Location Pins Modal */}
      {showManagePinsModal && (
        <ManagePinsModal
          isOpen={showManagePinsModal}
          onClose={() => setShowManagePinsModal(false)}
          onStartPinningMode={() => setIsPlottingMode(true)}
          onSelectLocationOnMap={(loc) => {
            if (onSelectLocation) onSelectLocation(loc);
            setInspectedBuilding(loc);
          }}
        />
      )}

      {/* Senate Hall Vertical Side Panel (Opens ONLY when entering Senate Hall) */}
      <SenateHallVerticalPanel
        isOpen={showSenateHallPanel}
        onClose={() => setShowSenateHallPanel(false)}
        onSelectStall={(stall) => {
          setInspectedBuilding({
            id: stall.id,
            name: `${stall.id}: ${stall.name}`,
            category: stall.domain,
            description: stall.description,
            departments: [stall.founder, `Demo: ${stall.demoTiming}`],
            lat: 26.50150,
            lng: 80.26880,
            floors: 1
          });
        }}
      />
    </div>
  );
}
