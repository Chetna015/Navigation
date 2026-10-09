// Location Overrides & Coordinate Management Utility
import { MAP_LOCATIONS } from '../data/auditoriumData';
import { DEFAULT_CAMPUS_BUILDINGS, getStoredPlottedBuildings } from './pathfinding';
import { isAdminAuthenticated, apiService } from '../services/api';

const STORAGE_KEY = 'csjmu_location_latlng_overrides';
const SERVER_LOCATIONS_KEY = 'csjmu_server_locations';

/**
 * Retrieve all custom location coordinate overrides stored in LocalStorage
 */
export function getLocationOverrides() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error("Failed to parse location overrides from LocalStorage", e);
    return {};
  }
}

/**
 * Retrieve server-synced locations (persisted in DB and cached in localStorage)
 */
export function getServerLocations() {
  try {
    const raw = localStorage.getItem(SERVER_LOCATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Save server locations to local cache and trigger reactive re-render
 */
export function setCachedServerLocations(locations) {
  try {
    localStorage.setItem(SERVER_LOCATIONS_KEY, JSON.stringify(locations || []));
    window.dispatchEvent(new CustomEvent('csjmu_locations_updated', { detail: locations }));
  } catch (e) {
    console.error("Failed to cache server locations", e);
  }
}

/**
 * Fetch latest persistent locations from backend database and sync
 */
export async function syncLocationsFromServer() {
  try {
    const data = await apiService.getLocations();
    if (data && data.success && Array.isArray(data.locations)) {
      setCachedServerLocations(data.locations);
      return data.locations;
    }
  } catch (e) {
    console.warn("Could not sync locations from server, using cached/local data:", e);
  }
  return getServerLocations();
}

/**
 * Save an updated location override (Lat, Lng, Name, Category, etc.)
 * Protected: Only Admin can modify coordinates!
 */
export function saveLocationOverride(id, updatedData) {
  if (!isAdminAuthenticated()) {
    console.warn("Unauthorized attempt to override location coordinates. Admin access required.");
    return null;
  }

  const existing = getLocationOverrides();
  existing[id] = {
    ...existing[id],
    ...updatedData,
    updatedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent('csjmu_locations_updated', { detail: existing }));
  } catch (e) {
    console.error("Failed to save location override to LocalStorage", e);
  }

  return existing[id];
}

/**
 * Reset a single location back to default coordinates (Admin Only)
 */
export function resetLocationOverride(id) {
  if (!isAdminAuthenticated()) return;
  const existing = getLocationOverrides();
  delete existing[id];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent('csjmu_locations_updated', { detail: existing }));
  } catch (e) {
    console.error("Failed to reset location override", e);
  }
}

/**
 * Reset ALL location overrides (Admin Only)
 */
export function resetAllLocationOverrides() {
  if (!isAdminAuthenticated()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('csjmu_locations_updated', { detail: {} }));
  } catch (e) {
    console.error("Failed to reset all location overrides", e);
  }
}

const DELETED_KEY = 'csjmu_deleted_location_ids';

/**
 * Retrieve list of location IDs marked as removed/deleted by user
 */
export function getDeletedLocationIds() {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Mark a location as removed/deleted (Protected: Admin Only)
 */
export function hideOrDeleteLocation(id) {
  if (!isAdminAuthenticated()) {
    console.warn("Unauthorized attempt to delete/hide location. Only Admin is permitted.");
    return;
  }

  const deleted = getDeletedLocationIds();
  if (!deleted.includes(id)) {
    deleted.push(id);
    try {
      localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
      window.dispatchEvent(new CustomEvent('csjmu_locations_updated', { detail: { deleted } }));
    } catch (e) {
      console.error(e);
    }
  }
}

/**
 * Restore all deleted locations (Admin Only)
 */
export function restoreAllDeletedLocations() {
  if (!isAdminAuthenticated()) return;
  try {
    localStorage.removeItem(DELETED_KEY);
    window.dispatchEvent(new CustomEvent('csjmu_locations_updated', { detail: {} }));
  } catch (e) {
    console.error(e);
  }
}

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function getSimplifiedKey(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(engineeringblock|foodcourt|sportscomplex|auditorium|complex|station|facility|office|offuce|point|centre|center)/g, '');
}

/**
 * Get merged Campus Buildings object using default buildings, server database pins, user custom pins, and location overrides.
 * Ensures duplicate named and duplicate co-located pins are merged into a single unique pinpoint.
 */
export function getMergedCampusBuildings() {
  const overrides = getLocationOverrides();
  const custom = getStoredPlottedBuildings();
  const serverLocs = getServerLocations();
  const deleted = getDeletedLocationIds();

  const rawList = [];

  // 1. Official primary locations
  (MAP_LOCATIONS || []).forEach(loc => {
    if (loc && loc.id) {
      rawList.push({ ...loc });
    }
  });

  // 2. Default campus buildings
  Object.values(DEFAULT_CAMPUS_BUILDINGS || {}).forEach(loc => {
    if (loc && loc.id) {
      rawList.push({ ...loc });
    }
  });

  // 3. Persistent Server Database Locations pinned by Admin
  (serverLocs || []).forEach(loc => {
    if (loc && loc.id) {
      rawList.push({
        id: loc.id,
        name: loc.name,
        code: loc.code || 'BLD-ADM',
        category: loc.category || 'Campus Facility',
        lat: parseFloat(loc.lat),
        lng: parseFloat(loc.lng),
        floors: parseInt(loc.floors || 2, 10),
        description: loc.description || 'Official University Location',
        coverImage: loc.cover_image || null,
        videoUrl: loc.video_url || null,
        isCustom: true,
        isAdminPinned: true
      });
    }
  });

  // 4. Stored local plotted buildings
  Object.values(custom || {}).forEach(loc => {
    if (loc && loc.id) {
      rawList.push({ ...loc, isCustom: true });
    }
  });

  const buildings = {};
  const keptLocations = [];

  rawList.forEach(loc => {
    if (!loc || !loc.name || !loc.lat || !loc.lng) return;

    const norm = loc.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const simp = getSimplifiedKey(loc.name);

    // Check if already in keptLocations by exact name, simplified key, or tight GPS proximity (< 18 meters)
    const isDuplicate = keptLocations.some(existing => {
      const existNorm = existing.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const existSimp = getSimplifiedKey(existing.name);
      const dist = getDistanceMeters(loc.lat, loc.lng, existing.lat, existing.lng);

      if (norm === existNorm) return true;
      if (simp && existSimp && simp === existSimp && dist < 50) return true;
      if (dist < 15) return true;
      return false;
    });

    if (isDuplicate) return;

    let finalLoc = { ...loc };
    if (overrides && overrides[loc.id]) {
      finalLoc = { ...finalLoc, ...overrides[loc.id] };
    }
    buildings[loc.id] = finalLoc;
    keptLocations.push(finalLoc);
  });

  (deleted || []).forEach(id => {
    delete buildings[id];
  });

  return buildings;
}

/**
 * Get merged MAP_LOCATIONS array using default locations, custom pins, and overrides, minus deleted locations.
 * Automatically deduplicates locations sharing the same name or coordinate footprint.
 */
export function getMergedMapLocations() {
  return Object.values(getMergedCampusBuildings());
}
