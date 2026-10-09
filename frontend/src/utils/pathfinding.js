import { isAdminAuthenticated, apiService } from '../services/api';

export const DEFAULT_CAMPUS_BUILDINGS = {};

/**
 * Load Custom User Plotted Buildings from LocalStorage
 */
export function getStoredPlottedBuildings() {
  try {
    const raw = localStorage.getItem('csjmu_custom_plotted_buildings');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error(e);
  }
  return {};
}

/**
 * Save a new user-plotted building (Protected: Admin Only)
 */
export function saveCustomPlottedBuilding(newBuilding) {
  if (!isAdminAuthenticated()) {
    console.warn("Security Alert: Unauthorized user attempted to pin a location.");
    alert("Access Denied: Only authorized University Administrators can pin new locations.");
    return null;
  }

  const existing = getStoredPlottedBuildings();

  const nodeObj = {
    id: newBuilding.id || `custom_bld_${Date.now()}`,
    name: newBuilding.name,
    code: newBuilding.code || `BLD-CUST`,
    category: newBuilding.category || "Custom Building",
    lat: newBuilding.lat,
    lng: newBuilding.lng,
    x: newBuilding.x || Math.round(300 + Math.random() * 200),
    y: newBuilding.y || Math.round(300 + Math.random() * 200),
    floors: newBuilding.floors || 2,
    description: newBuilding.description || "Official Plotted University Location",
    departments: newBuilding.departments || ["General Dept"],
    isCustom: true
  };

  existing[nodeObj.id] = nodeObj;
  try {
    localStorage.setItem('csjmu_custom_plotted_buildings', JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent('csjmu_locations_updated', { detail: existing }));

    // Persist securely to backend SQLite database using Admin JWT
    apiService.saveLocation({
      id: nodeObj.id,
      name: nodeObj.name,
      code: nodeObj.code,
      category: nodeObj.category,
      lat: nodeObj.lat,
      lng: nodeObj.lng,
      x: nodeObj.x,
      y: nodeObj.y,
      floors: nodeObj.floors,
      description: nodeObj.description
    }).catch(e => console.warn('Backend sync failed:', e));
  } catch (e) {
    console.error(e);
  }
  return nodeObj;
}

/**
 * Delete a custom plotted building (Protected: Admin Only)
 */
export function deleteCustomPlottedBuilding(buildingId) {
  if (!isAdminAuthenticated()) {
    console.warn("Security Alert: Unauthorized user attempted to delete a location pin.");
    alert("Access Denied: Only authorized University Administrators can delete location pins.");
    return false;
  }

  const existing = getStoredPlottedBuildings();
  delete existing[buildingId];
  try {
    localStorage.setItem('csjmu_custom_plotted_buildings', JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent('csjmu_locations_updated', { detail: existing }));

    // Delete securely from backend SQLite database
    apiService.deleteLocation(buildingId).catch(e => console.warn('Backend delete sync failed:', e));
  } catch (e) {
    console.error(e);
  }
  return true;
}

const routeCache = new Map();
const inFlightRequests = new Map();

/**
 * Fetch road-snapped walking route from Open Source Routing Machine (OSRM) Public API
 * Profile: foot
 * Coordinates mapping: OSRM returns [lng, lat] -> Converted to Leaflet [lat, lng]
 *
 * @param {number} startLat - Origin latitude
 * @param {number} startLng - Origin longitude
 * @param {number} destLat  - Destination latitude
 * @param {number} destLng  - Destination longitude
 * @returns {Promise<{path: Array<[number, number]>, latLngList: Array<[number, number]>, totalDistanceMeters: number, walkingTimeMins: number, totalSteps: number, directions: Array} | null>}
 */
export async function getCampusRoute(startLat, startLng, destLat, destLng) {
  try {
    if (!startLat || !startLng || !destLat || !destLng) {
      return null;
    }

    const cacheKey = `${Number(startLat).toFixed(5)},${Number(startLng).toFixed(5)};${Number(destLat).toFixed(5)},${Number(destLng).toFixed(5)}`;

    if (routeCache.has(cacheKey)) {
      return routeCache.get(cacheKey);
    }

    try {
      const stored = sessionStorage.getItem(`csjmu_route_${cacheKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        routeCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch (e) {}

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const fetchPromise = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      try {
        const url = `https://router.project-osrm.org/route/v1/foot/${startLng},${startLat};${destLng},${destLat}?geometries=geojson&overview=full`;
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`OSRM HTTP Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
          return null;
        }

        const route = data.routes[0];
        const coordinates = route.geometry?.coordinates || [];

        // OSRM returns [Longitude, Latitude]. Convert to Leaflet [Latitude, Longitude]
        const path = coordinates.map(([lng, lat]) => [lat, lng]);

        const totalDistanceMeters = Math.round(route.distance || 0);
        const walkingTimeMins = Math.max(1, Math.round(totalDistanceMeters / 75)); // 75 meters/min
        const totalSteps = Math.round(totalDistanceMeters / 0.75); // 0.75m per step

        const result = {
          path,
          latLngList: path,
          totalDistanceMeters,
          walkingTimeMins,
          totalSteps,
          directions: route.legs?.[0]?.steps || []
        };

        routeCache.set(cacheKey, result);
        try {
          sessionStorage.setItem(`csjmu_route_${cacheKey}`, JSON.stringify(result));
        } catch (e) {}

        return result;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    })().finally(() => {
      inFlightRequests.delete(cacheKey);
    });

    inFlightRequests.set(cacheKey, fetchPromise);
    return await fetchPromise;
  } catch (error) {
    console.error("Error fetching campus route from OSRM:", error);
    return null;
  }
}

/**
 * Backward compatibility wrapper for legacy calculateShortestPath callers
 */
export async function calculateShortestPath(startId, endId, accessibilityWheelchair = false) {
  const startNode = (typeof startId === 'object' && startId !== null) ? startId : { lat: 26.4970, lng: 80.2666 };
  const endNode = (typeof endId === 'object' && endId !== null) ? endId : { lat: 26.5015, lng: 80.2688 };

  const sLat = startNode.lat || 26.4970;
  const sLng = startNode.lng || 80.2666;
  const eLat = endNode.lat || 26.5015;
  const eLng = endNode.lng || 80.2688;

  const result = await getCampusRoute(sLat, sLng, eLat, eLng);
  return result || null;
}

