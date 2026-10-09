import React, { useState, useEffect } from 'react';
import { Building2, X, Plus } from 'lucide-react';
import { saveCustomPlottedBuilding } from '../utils/pathfinding';

export default function BuildingPlotterModal({
  isOpen,
  onClose,
  initialLatLng,
  onBuildingPlotted
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Entrance');
  const [floors, setFloors] = useState(1);
  const [departmentsText, setDepartmentsText] = useState('');
  const [description, setDescription] = useState('');

  const [lat, setLat] = useState(initialLatLng ? initialLatLng.lat.toFixed(6) : '26.503020');
  const [lng, setLng] = useState(initialLatLng ? initialLatLng.lng.toFixed(6) : '80.267490');

  useEffect(() => {
    if (initialLatLng) {
      setLat(initialLatLng.lat.toFixed(6));
      setLng(initialLatLng.lng.toFixed(6));
    }
  }, [initialLatLng]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const depts = departmentsText.trim()
      ? departmentsText.split(',').map(s => s.trim())
      : ['General Dept', 'Faculty Offices'];

    const newBuilding = saveCustomPlottedBuilding({
      name: name.trim(),
      code: code.trim() || `BLD-${Math.floor(100 + Math.random() * 900)}`,
      category,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      floors: parseInt(floors, 10),
      description: description.trim() || `Custom Plotted University Facility`,
      departments: depts
    });

    if (newBuilding) {
      if (onBuildingPlotted) {
        onBuildingPlotted(newBuilding);
      }
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="animate-scale-up" style={{
        width: '100%',
        maxWidth: '540px',
        borderRadius: '16px',
        border: '1px solid var(--colors-hairline-strong)',
        boxShadow: 'var(--shadow-md)',
        background: 'var(--colors-surface-card)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--colors-hairline)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--colors-surface-card)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'var(--colors-surface-dark)',
              color: 'var(--colors-on-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 size={20} color="var(--colors-on-dark)" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--colors-ink)', fontFamily: 'var(--font-heading)' }}>
                📍 Pin & Tag Location on Map
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--colors-body)', fontFamily: 'var(--font-main)' }}>
                Set exact coordinates, tag, pin color, and name for any campus location
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Close Modal"
            style={{
              width: '32px',
              height: '32px',
              minWidth: '32px',
              minHeight: '32px',
              borderRadius: '50%',
              background: '#000000',
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '16px',
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', fontFamily: 'var(--font-heading)', marginBottom: '6px', display: 'block' }}>
              Location Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. CSJMU Main Gate 1 (GT Road), UIET Block, Canteen"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--colors-surface-soft)',
                border: '1px solid var(--colors-hairline)',
                color: 'var(--colors-ink)',
                fontSize: '13px',
                fontFamily: 'var(--font-main)',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', fontFamily: 'var(--font-heading)', marginBottom: '6px', display: 'block' }}>
                Location Code / Tag
              </label>
              <input
                type="text"
                placeholder="e.g. GATE-01, BLD-UIET"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'var(--colors-surface-soft)',
                  border: '1px solid var(--colors-hairline)',
                  color: 'var(--colors-ink)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-main)',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', fontFamily: 'var(--font-heading)', marginBottom: '6px', display: 'block' }}>
                Pin Tag & Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'var(--colors-surface-soft)',
                  border: '1px solid var(--colors-hairline)',
                  color: 'var(--colors-ink)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-main)',
                  outline: 'none'
                }}
              >
                <option value="Entrance">📍 Gate & Entrance (Red Pin)</option>
                <option value="Academic">🏢 Academic Wing (Blue Pin)</option>
                <option value="Administration">🏛️ Administration</option>
                <option value="Parking">🅿️ Parking Area</option>
                <option value="Dining">🍔 Cafeteria & Food</option>
                <option value="Hostel">🏨 Student Hostel</option>
                <option value="Sports">🏟️ Sports & SAC</option>
                <option value="Custom">🏷️ Custom Location Tag</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', fontFamily: 'var(--font-heading)', marginBottom: '6px', display: 'block' }}>
                Floors
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={floors}
                onChange={(e) => setFloors(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'var(--colors-surface-soft)',
                  border: '1px solid var(--colors-hairline)',
                  color: 'var(--colors-ink)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-main)',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', fontFamily: 'var(--font-heading)', marginBottom: '6px', display: 'block' }}>
                Latitude (°N) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 10px',
                  borderRadius: '10px',
                  background: 'var(--colors-surface-soft)',
                  border: '1px solid var(--colors-hairline)',
                  color: 'var(--colors-ink)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-code)',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', fontFamily: 'var(--font-heading)', marginBottom: '6px', display: 'block' }}>
                Longitude (°E) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 10px',
                  borderRadius: '10px',
                  background: 'var(--colors-surface-soft)',
                  border: '1px solid var(--colors-hairline)',
                  color: 'var(--colors-ink)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-code)',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', fontFamily: 'var(--font-heading)', marginBottom: '6px', display: 'block' }}>
              Departments & Laboratories (Comma separated)
            </label>
            <input
              type="text"
              placeholder="e.g. AI Research Lab, Neural Net Lab, Dean Office"
              value={departmentsText}
              onChange={(e) => setDepartmentsText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--colors-surface-soft)',
                border: '1px solid var(--colors-hairline)',
                color: 'var(--colors-ink)',
                fontSize: '13px',
                fontFamily: 'var(--font-main)',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--colors-ink)', fontFamily: 'var(--font-heading)', marginBottom: '6px', display: 'block' }}>
              Building Description
            </label>
            <textarea
              rows="2"
              placeholder="Detailed description of facility..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--colors-surface-soft)',
                border: '1px solid var(--colors-hairline)',
                color: 'var(--colors-ink)',
                fontSize: '13px',
                fontFamily: 'var(--font-main)',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="ollama-btn-secondary"
              style={{ flex: 1, height: '40px', borderRadius: '9999px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ollama-btn-primary"
              style={{ flex: 1, height: '40px', borderRadius: '9999px' }}
            >
              <Plus size={16} /> Plot Building on Map
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
