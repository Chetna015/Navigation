import React, { useEffect, useRef, useState } from 'react';
import { 
  ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';
import { getMergedMapLocations } from '../utils/locationStore';
import { MAP_LOCATIONS, STARTUP_STALLS } from '../data/auditoriumData';
import { getCampusRoute } from '../utils/pathfinding';
import GoogleCampusMap from './GoogleCampusMap';

export default function DigitalTwinMap({
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
  onOpenEditLocation,
  onOpen3DView,
  onOpenSBMIndoor,
  navMode = 'preview',
  isNavigatingLive = false
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // View Mode: 'google' (Google Maps Satellite/Roadmap) or 'twin' (Canvas 2D/3D Digital Twin)
  const [viewMode] = useState('google');

  // Pan and Zoom viewport state for canvas
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredObject, setHoveredObject] = useState(null);

  // Dash line animation offset
  const animDashRef = useRef(0);

  // Calculate Shortest Route whenever origin or destination changes
  const [shortestRoute, setShortestRoute] = useState(null);

  useEffect(() => {
    let isCancelled = false;
    setShortestRoute(null);
    if (destination) {
      const sLat = currentLocation?.lat || 26.4970;
      const sLng = currentLocation?.lng || 80.2666;
      const dLat = destination?.lat || 26.5015;
      const dLng = destination?.lng || 80.2688;

      getCampusRoute(sLat, sLng, dLat, dLng).then(route => {
        if (!isCancelled && route) {
          setShortestRoute(route);
        }
      }).catch(err => {
        console.warn("DigitalTwinMap route calculation error:", err);
      });
    } else {
      setShortestRoute(null);
    }

    return () => {
      isCancelled = true;
    };
  }, [currentLocation, destination, accessibilityOptions]);

  // Reset zoom & pan when switching floors
  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  }, [activeFloor]);

  // Quick Preset Handler: From Gate to Destination
  const handleSelectPresetRoute = (destId) => {
    const allLocs = getMergedMapLocations();
    const mainGate = allLocs.find(l => l.id === 'loc_main_gate') || allLocs[0];
    const targetLoc = allLocs.find(l => l.id === destId);

    if (mainGate && setCurrentLocation) setCurrentLocation(mainGate);
    if (targetLoc && setDestination) {
      setDestination(targetLoc);
      if (targetLoc.floor) setActiveFloor(targetLoc.floor);
    }
  };

  // Window resize tracking for responsive canvas resolution
  const [resizeCount, setResizeCount] = useState(0);

  useEffect(() => {
    const handleResize = () => setResizeCount(prev => prev + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Main Canvas Rendering Loop
  useEffect(() => {
    if (viewMode !== 'twin') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animFrameId;

    const width = (canvas.width = containerRef.current.clientWidth || 900);
    const height = (canvas.height = containerRef.current.clientHeight || 600);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      // Apply pan & zoom transformations centered on canvas
      ctx.translate(width / 2 + offset.x, height / 2 + offset.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-width / 2, -height / 2);

      animDashRef.current = (animDashRef.current - 0.6) % 30;

      if (activeFloor === 'outdoor') {
        drawOutdoorMap(ctx, width, height);
      } else {
        drawIndoorAuditoriumMap(ctx, width, height);
      }

      // Draw active shortest navigation line if destination is set
      if (destination) {
        drawNavigationPath(ctx, currentLocation, destination, shortestRoute, animDashRef.current);
      }

      // Draw current user position
      drawUserPosition(ctx, currentLocation);

      ctx.restore();

      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [viewMode, zoom, offset, activeFloor, currentLocation, destination, shortestRoute, hoveredObject, highlightDomain, selectedStall, resizeCount]);

  // --- OUTDOOR DIGITAL TWIN MAP RENDERER ---
  const drawOutdoorMap = (ctx, w, h) => {
    // Ground Background
    ctx.fillStyle = '#0B1426';
    ctx.fillRect(0, 0, w, h);

    // Main Campus Road & Walkways
    ctx.fillStyle = '#16223B';
    ctx.fillRect(80, 460, 450, 80);
    ctx.fillRect(100, 320, 60, 360);
    ctx.fillRect(260, 200, 60, 580);

    // Clean Solid Walking path line (No dotted lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 500);
    ctx.lineTo(500, 500);
    ctx.stroke();

    // Gardens & Lawns
    drawGardenArea(ctx, 320, 300, 120, 100, "");
    drawGardenArea(ctx, 320, 600, 120, 100, "");

    // Buildings Footprints (Clean shapes without text overlays or dotted lines)
    drawBuildingBlock(ctx, 450, 380, 350, 240, "", "#00F0FF", true);
    drawBuildingBlock(ctx, 380, 150, 180, 120, "", "#991B1B", true);
    drawBuildingBlock(ctx, 240, 160, 140, 100, "", "#3B82F6");
    drawBuildingBlock(ctx, 240, 700, 140, 100, "", "#8B5CF6");

    // Parking Zones
    drawParkingZone(ctx, 70, 280, 100, 120, "");
    drawParkingZone(ctx, 70, 600, 100, 120, "");
  };

  // --- INDOOR AUDITORIUM DIGITAL TWIN RENDERER ---
  const drawIndoorAuditoriumMap = (ctx, w, h) => {
    ctx.fillStyle = '#0D172A';
    ctx.fillRect(0, 0, w, h);

    // Outer Shell Walls
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.4)';
    ctx.strokeRect(60, 140, 800, 560);
    ctx.shadowBlur = 0;

    // Foyer & Registration
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
    ctx.fillRect(70, 150, 260, 540);
    drawRoomLabel(ctx, 160, 180, "ENTRANCE FOYER & REGISTRATION");

    ctx.fillStyle = '#0066FF';
    ctx.fillRect(150, 440, 100, 80);
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 2;
    ctx.strokeRect(150, 440, 100, 80);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 11px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText("Registration R1-R4", 200, 485);

    // Main Stage
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(700, 200, 140, 440);
    ctx.fillStyle = '#00F0FF';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00F0FF';
    ctx.fillRect(820, 240, 12, 360);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(0, 102, 255, 0.3)';
    ctx.fillRect(720, 240, 90, 360);
    drawRoomLabel(ctx, 765, 420, "MAIN STAGE & 4K SCREEN");

    // VIP Seating
    ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(630, 220, 50, 400);
    ctx.fillRect(630, 220, 50, 400);
    drawRoomLabel(ctx, 655, 420, "VIP SEATING", "#F59E0B");

    // Startup Exhibition Arena
    ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(380, 240, 230, 240);
    ctx.fillRect(380, 240, 230, 240);
    drawRoomLabel(ctx, 495, 260, "STARTUP EXHIBITION ARENA (STALLS S01-S20)", "#10B981");

    // Render Stalls
    STARTUP_STALLS.forEach(stall => {
      const isSelected = selectedStall && selectedStall.id === stall.id;
      const isHighlight = highlightDomain && stall.domain === highlightDomain;
      const isHovered = hoveredObject && hoveredObject.id === stall.id;

      ctx.save();
      ctx.fillStyle = isSelected ? '#10B981' : isHighlight ? '#F59E0B' : '#1E293B';
      ctx.strokeStyle = isSelected ? '#00F0FF' : isHighlight ? '#F59E0B' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = isSelected || isHovered ? 3 : 1;

      ctx.fillRect(stall.x - 16, stall.y - 16, 32, 32);
      ctx.strokeRect(stall.x - 16, stall.y - 16, 32, 32);

      ctx.fillStyle = isSelected || isHighlight ? '#FFF' : '#94A3B8';
      ctx.font = 'bold 10px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(stall.id, stall.x, stall.y + 4);
      ctx.restore();
    });

    // Indoor Location Markers
    MAP_LOCATIONS.filter(loc => loc.floor === 'indoor').forEach(loc => {
      drawMapMarker(ctx, loc.x, loc.y, loc.name, loc === destination, loc === hoveredObject);
    });
  };

  // Helper Drawing Utilities
  const drawBuildingBlock = (ctx, x, y, w, h, title, glowColor = '#0066FF', isAuditorium = false) => {
    ctx.save();
    ctx.fillStyle = isAuditorium ? 'rgba(0, 102, 255, 0.15)' : 'rgba(30, 41, 59, 0.8)';
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = isAuditorium ? 3 : 1.5;
    ctx.shadowBlur = isAuditorium ? 15 : 0;
    ctx.shadowColor = glowColor;

    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${isAuditorium ? 14 : 12}px Outfit`;
    ctx.textAlign = 'center';
    ctx.fillText(title, x + w / 2, y + h / 2);
    ctx.restore();
  };

  const drawGardenArea = (ctx, x, y, w, h, label) => {
    ctx.save();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 11px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(`🌿 ${label}`, x + w / 2, y + h / 2);
    ctx.restore();
  };

  const drawParkingZone = (ctx, x, y, w, h, label) => {
    ctx.save();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 11px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(`🅿️ ${label}`, x + w / 2, y + h / 2);
    ctx.restore();
  };

  const drawRoomLabel = (ctx, x, y, label, color = '#94A3B8') => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = 'bold 11px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y);
    ctx.restore();
  };

  const drawMapMarker = (ctx, x, y, name, isDestination, isHovered) => {
    ctx.save();
    const isMainGate = name && name.toLowerCase().includes('main gate');

    // Remove all blue pinned points with their names as requested by user
    if (!isMainGate) {
      ctx.restore();
      return;
    }

    // RED MAP PIN FOR CSJMU MAIN GATE 1 (26.50302°N, 80.26749°E)
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#EF4444';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#EF4444';
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 12px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(`📍 ${name} (26.50302°, 80.26749°)`, x, y - 18);
    ctx.restore();
  };

  // Animated Glowing Navigation Line on Canvas using Dijkstra Shortest Route
  const drawNavigationPath = (ctx, startLoc, endLoc, routeObj, dashOffset) => {
    if (!startLoc || !endLoc) return;

    ctx.save();
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 5;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00F0FF';
    ctx.setLineDash([12, 12]);
    ctx.lineDashOffset = dashOffset;

    ctx.beginPath();

    if (routeObj && routeObj.canvasPointList && routeObj.canvasPointList.length > 0) {
      const points = routeObj.canvasPointList;
      ctx.moveTo(points[0].x, points[0].y);
      points.forEach(pt => {
        ctx.lineTo(pt.x, pt.y);
      });
    } else {
      ctx.moveTo(startLoc.x, startLoc.y);
      ctx.lineTo(endLoc.x, endLoc.y);
    }

    ctx.stroke();
    ctx.restore();
  };

  // Live User Location Marker
  const drawUserPosition = (ctx, loc) => {
    if (!loc) return;
    const x = loc.x;
    const y = loc.y;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 102, 255, 0.25)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#0066FF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#0066FF';
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText("START / CURRENT LOCATION", x, y - 16);
    ctx.restore();
  };

  // Mouse Drag & Click Handlers for Canvas
  const handleMouseDown = (e) => {
    if (viewMode !== 'twin') return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (viewMode !== 'twin') return;
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left - canvas.width / 2 - offset.x) / zoom + canvas.width / 2;
    const clickY = (e.clientY - rect.top - canvas.height / 2 - offset.y) / zoom + canvas.height / 2;

    const hoveredStall = STARTUP_STALLS.find(s => 
      activeFloor === 'indoor' && Math.hypot(s.x - clickX, s.y - clickY) < 20
    );

    const hoveredLoc = MAP_LOCATIONS.find(l => 
      l.floor === activeFloor && Math.hypot(l.x - clickX, l.y - clickY) < 20
    );

    setHoveredObject(hoveredStall || hoveredLoc || null);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = () => {
    if (hoveredObject) {
      if (hoveredObject.founder) {
        setSelectedStall(hoveredObject);
      } else {
        setDestination(hoveredObject);
      }
    }
  };

  return (
    <div ref={containerRef} className="digital-twin-container" style={{ position: 'relative', width: '100%', height: '100%' }}>

      {/* 2. RENDER GOOGLE MAPS VIEW OR DIGITAL TWIN CANVAS VIEW */}
      {viewMode === 'google' ? (
        <GoogleCampusMap
          isAdminMode={isAdminMode}
          currentLocation={currentLocation}
          setCurrentLocation={setCurrentLocation}
          destination={destination}
          setDestination={setDestination}
          shortestRoute={shortestRoute}
          onSelectLocation={(loc) => {
            if (setDestination) setDestination(loc);
          }}
          onOpenEditLocation={onOpenEditLocation}
          onOpen3DView={onOpen3DView}
          onOpenSBMIndoor={onOpenSBMIndoor}
          navMode={navMode}
          isNavigatingLive={isNavigatingLive}
        />
      ) : (
        <>
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleCanvasClick}
            style={{ width: '100%', height: '100%', cursor: isDragging ? 'grabbing' : hoveredObject ? 'pointer' : 'grab' }}
          />

          {/* Floating Canvas Controls */}
          <div style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 50
          }}>
            <button
              onClick={() => setZoom(prev => Math.min(prev + 0.25, 2.5))}
              className="btn-glass"
              style={{ width: '40px', height: '40px', padding: 0, justifyContent: 'center', borderRadius: '12px' }}
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.6))}
              className="btn-glass"
              style={{ width: '40px', height: '40px', padding: 0, justifyContent: 'center', borderRadius: '12px' }}
            >
              <ZoomOut size={18} />
            </button>
            <button
              onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
              className="btn-glass"
              style={{ width: '40px', height: '40px', padding: 0, justifyContent: 'center', borderRadius: '12px' }}
              title="Reset View"
            >
              <Maximize2 size={18} />
            </button>
          </div>

          {/* Legend Overlay */}
          <div className="glass-panel" style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            zIndex: 50
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0066FF' }} />
              <span>Current Origin</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F43F5E' }} />
              <span>Destination</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '4px', background: '#10B981' }} />
              <span>Startup Stall</span>
            </div>
          </div>
        </>
      )}

      {/* Hover Info Tooltip */}
      {hoveredObject && (
        <div className="glass-card" style={{
          position: 'absolute',
          bottom: '80px',
          right: '24px',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          zIndex: 50,
          border: '1px solid var(--border-glass-light)',
          maxWidth: '280px'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
            {hoveredObject.name}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {hoveredObject.domain || hoveredObject.description}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-cyan)', marginTop: '6px', fontWeight: 700 }}>
            Click to Navigate Shortest Route ➔
          </div>
        </div>
      )}
    </div>
  );
}
