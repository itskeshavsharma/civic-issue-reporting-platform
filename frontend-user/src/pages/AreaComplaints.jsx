import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  MapPin,
  Clock,
  Hash,
  CheckCircle2,
  ChevronDown,
  Trash2,
  Lightbulb,
  Construction,
  Droplets,
  AlertTriangle,
  Navigation,
  RefreshCw,
  LoaderCircle,
  Map as MapIcon,
  List,
  Layers,
  Crosshair,
  ArrowUpDown,
  PlusCircle,
  ExternalLink,
  LocateFixed,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getAreaComplaints, getImageUrl } from '../services/api';
import BoundingBoxCanvas from '../components/BoundingBoxCanvas';

// ─── Status Configuration ─────────────────────────────────────────────────────
const STATUS_CONFIG = {
  raised: {
    label: 'Pending',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    stepIndex: 0,
  },
  working: {
    label: 'Under Working',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    stepIndex: 1,
  },
  resolved: {
    label: 'Resolved',
    badgeBg: 'bg-green-50',
    badgeText: 'text-green-700',
    badgeBorder: 'border-green-200',
    stepIndex: 2,
  },
};

const CATEGORIES = [
  'All',
  'Garbage',
  'Pothole / Road',
  'Street Light',
  'Water Leakage',
  'Drainage / Sewer',
];

const RADIUS_OPTIONS = [
  { label: '5 km', value: 5000 },
  { label: '15 km', value: 15000 },
  { label: '25 km', value: 25000 },
  { label: '50 km', value: 50000 },
  { label: 'All Region', value: null },
];

// Helper: Haversine distance in km
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Helper: Detect category from complaint title
const detectCategory = (text = '') => {
  const t = text.toLowerCase();
  if (t.includes('garbage') || t.includes('waste') || t.includes('kachra') || t.includes('trash'))
    return 'Garbage';
  if (t.includes('pothole') || t.includes('gaddha') || t.includes('road') || t.includes('sadak') || t.includes('crack'))
    return 'Pothole / Road';
  if (t.includes('light') || t.includes('batti') || t.includes('lamp') || t.includes('pole'))
    return 'Street Light';
  if (t.includes('water') || t.includes('leak') || t.includes('pipe') || t.includes('flood'))
    return 'Water Leakage';
  if (t.includes('drain') || t.includes('sewer') || t.includes('manhole') || t.includes('nali'))
    return 'Drainage / Sewer';
  return 'Other';
};

const getCategoryIcon = (category) => {
  switch (category) {
    case 'Garbage':
      return Trash2;
    case 'Street Light':
      return Lightbulb;
    case 'Water Leakage':
      return Droplets;
    case 'Drainage / Sewer':
      return AlertTriangle;
    case 'Pothole / Road':
    default:
      return Construction;
  }
};

const getSeverityBadge = (severity) => {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'HIGH':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'LOW':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'MEDIUM':
    default:
      return 'bg-blue-100 text-blue-700 border-blue-200';
  }
};

// ─── Status Badge Component ───────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.raised;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
    >
      {cfg.label}
    </span>
  );
};

// ─── Detail Modal Component ───────────────────────────────────────────────────
const DetailModal = ({ complaint, onClose }) => {
  if (!complaint) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-y-auto animate-in fade-in zoom-in duration-200"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Area Issue Details</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Complaint Image with Bounding Box if present */}
        <div className="w-full bg-slate-900 overflow-hidden relative">
          {complaint.boundingBox && complaint.boundingBox.some((v) => v > 0) ? (
            <BoundingBoxCanvas
              imageUrl={complaint.image}
              boundingBox={complaint.boundingBox}
            />
          ) : (
            <img
              src={complaint.image}
              alt={complaint.title}
              className="w-full h-56 object-contain bg-black/40"
            />
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{complaint.title}</h3>
              {complaint.titleHi && (
                <p className="text-xs text-gray-500 mt-0.5">{complaint.titleHi}</p>
              )}
            </div>
            <StatusBadge status={complaint.status} />
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md uppercase border ${getSeverityBadge(
                complaint.severity
              )}`}
            >
              Severity: {complaint.severity}
            </span>
            {complaint.reportCount > 1 && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Layers className="w-3 h-3 text-amber-600" />
                {complaint.reportCount} Citizens Reported
              </span>
            )}
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700">
              Category: {complaint.category}
            </span>
          </div>

          <div className="space-y-2 text-sm text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="font-mono text-xs font-medium text-gray-800">
                {complaint.id}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-xs font-medium text-gray-800">{complaint.location}</span>
            </div>
            {complaint.distanceLabel && (
              <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs">
                <Navigation className="w-4 h-4 shrink-0" />
                <span>{complaint.distanceLabel} from search location</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-xs">
                {complaint.date} &bull; {complaint.time}
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed bg-white border border-gray-100 p-3 rounded-xl shadow-xs">
            {complaint.description}
          </p>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Interactive Map Component for Area Complaints ───────────────────────────
const AreaMapView = ({
  complaints,
  userCoords,
  searchCoords,
  searchRadiusMeters,
  onSelectComplaint,
  onMapClickLocation,
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    // Determine initial center
    const defaultLat = searchCoords?.lat || userCoords?.lat || complaints[0]?.lat || 26.8413;
    const defaultLng = searchCoords?.lng || userCoords?.lng || complaints[0]?.lng || 75.6995;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Click on map anywhere to search that location
    map.on('click', (e) => {
      if (onMapClickLocation) {
        onMapClickLocation(e.latlng.lat, e.latlng.lng);
      }
    });

    // 1. Searched Location Pin & Radius Circle
    if (searchCoords?.lat && searchCoords?.lng) {
      const searchIcon = L.divIcon({
        className: 'search-location-pin',
        html: `
          <div style="position: relative; transform: translate(-50%, -100%);">
            <svg width="34" height="46" viewBox="0 0 38 50" fill="none">
              <path d="M19 0C8.50659 0 0 8.50659 0 19C0 33.25 19 50 19 50C19 50 38 33.25 38 19C38 8.50659 29.4934 0 19 0Z" fill="#7C3AED"/>
              <circle cx="19" cy="19" r="7" fill="white"/>
            </svg>
          </div>
        `,
        iconSize: [34, 46],
        iconAnchor: [17, 46],
      });

      L.marker([searchCoords.lat, searchCoords.lng], { icon: searchIcon })
        .addTo(map)
        .bindPopup(`<strong>Searched Area</strong><br/>${searchCoords.name || 'Selected Location'}`);

      // Translucent Search Radius Circle
      if (searchRadiusMeters) {
        L.circle([searchCoords.lat, searchCoords.lng], {
          radius: searchRadiusMeters,
          color: '#7C3AED',
          weight: 1.5,
          opacity: 0.7,
          fillColor: '#8B5CF6',
          fillOpacity: 0.1,
          dashArray: '5 5',
        }).addTo(map);
      }
    }

    // 2. User GPS location marker
    if (userCoords?.lat && userCoords?.lng) {
      const userIcon = L.divIcon({
        className: 'user-gps-marker',
        html: `
          <div style="width: 20px; height: 20px; background: #2563EB; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 12px rgba(37,99,235,0.8);"></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      L.marker([userCoords.lat, userCoords.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup('<strong>Your Device Location</strong>');
    }

    // 3. Add Markers for all real complaints
    const markerCoords = [];
    complaints.forEach((c) => {
      if (!c.lat || !c.lng) return;

      const isCritical = c.severity === 'CRITICAL';
      const isHigh = c.severity === 'HIGH';
      const isResolved = c.rawStatus === 'Resolved';
      const pinColor = isResolved ? '#22C55E' : isCritical ? '#EF4444' : isHigh ? '#F97316' : '#EAB308';

      const customIcon = L.divIcon({
        className: 'civic-marker-pin',
        html: `
          <div style="transform: translate(-50%, -100%); cursor: pointer;">
            <svg width="32" height="42" viewBox="0 0 38 50" fill="none" style="filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35));">
              <path d="M19 0C8.50659 0 0 8.50659 0 19C0 33.25 19 50 19 50C19 50 38 33.25 38 19C38 8.50659 29.4934 0 19 0Z" fill="${pinColor}"/>
              <circle cx="19" cy="19" r="8" fill="white"/>
            </svg>
          </div>
        `,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
      });

      const marker = L.marker([c.lat, c.lng], { icon: customIcon }).addTo(map);

      // Popup on click
      marker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 160px;">
          <p style="font-size: 11px; font-weight: bold; color: ${pinColor}; text-transform: uppercase; margin: 0 0 2px 0;">${c.severity} &bull; ${c.rawStatus}</p>
          <p style="font-size: 13px; font-weight: 600; margin: 0 0 4px 0; color: #111;">${c.title}</p>
          <p style="font-size: 11px; color: #666; margin: 0 0 6px 0;">${c.location}</p>
          <button id="btn-view-${c.id}" style="background: #2563EB; color: white; border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 600; cursor: pointer; width: 100%;">View Details</button>
        </div>
      `);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-view-${c.id}`);
        if (btn) {
          btn.onclick = () => onSelectComplaint(c);
        }
      });

      markerCoords.push([c.lat, c.lng]);
    });

    // Auto-fit bounds if markers exist and no manual search coords
    if (!searchCoords && markerCoords.length > 0) {
      try {
        map.fitBounds(markerCoords, { padding: [40, 40], maxZoom: 15 });
      } catch (err) {
        console.debug('Bounds fit note:', err);
      }
    } else if (searchCoords) {
      map.setView([searchCoords.lat, searchCoords.lng], 13);
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [complaints, userCoords, searchCoords, searchRadiusMeters]);

  return (
    <div className="relative w-full h-80 sm:h-96 rounded-2xl overflow-hidden border border-gray-200 shadow-sm mb-6 bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />
      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl shadow-md border border-gray-200 text-xs font-semibold text-gray-700 flex flex-wrap items-center gap-2 pointer-events-none">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Critical</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> High</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span> Medium</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Resolved</span>
      </div>
      {/* Interactive Helper note */}
      <div className="absolute bottom-2 left-3 z-10 bg-slate-900/80 text-white text-[11px] px-2.5 py-1 rounded-lg backdrop-blur pointer-events-none">
        💡 Tip: Click anywhere on the map to search complaints around that spot
      </div>
    </div>
  );
};

// ─── Main Area Complaints Page ────────────────────────────────────────────────
const AreaComplaints = () => {
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [areaFilter, setAreaFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [searchRadius, setSearchRadius] = useState(25000); // 25 km default

  // Geocoded Search Coordinates
  const [searchCoords, setSearchCoords] = useState(null);

  // Autocomplete Suggestions for Area Input
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef(null);

  // User GPS coordinates for distance and "Near Me"
  const [userCoords, setUserCoords] = useState(null);
  const [isNearMeActive, setIsNearMeActive] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Fetch real complaints from backend API
  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {};

      if (viewMode === 'map') {
        params.view = 'map';
      }

      // Status Filter
      if (selectedStatus && selectedStatus !== 'all') {
        if (selectedStatus === 'raised') params.status = 'Pending';
        else if (selectedStatus === 'working') params.status = 'Under Working';
        else if (selectedStatus === 'resolved') params.status = 'Resolved';
      }

      // Geospatial filter: if searchCoords or Near Me GPS active
      const activeCoords = isNearMeActive ? userCoords : searchCoords;
      if (activeCoords && activeCoords.lat && activeCoords.lng && searchRadius) {
        params.latitude = activeCoords.lat;
        params.longitude = activeCoords.lng;
        params.radius = searchRadius;
      }

      // Locality name filter
      if (areaFilter.trim() && !isNearMeActive) {
        params.area = areaFilter.trim();
      }

      // Keyword query
      if (searchQuery.trim()) {
        params.query = searchQuery.trim();
      }

      const res = await getAreaComplaints(params);

      if (res && res.success && Array.isArray(res.complaints)) {
        const referencePoint = activeCoords || userCoords;

        const mapped = res.complaints.map((item) => {
          const createdAt = new Date(item.createdAt || Date.now());
          const date = createdAt.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          const time = createdAt.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });

          let uiStatus = 'raised';
          if (item.status === 'Under Working') uiStatus = 'working';
          if (item.status === 'Resolved') uiStatus = 'resolved';

          const titleText = item.title?.en || item.title?.hi || 'Civic Defect';
          const titleHi = item.title?.hi || '';
          const category = detectCategory(titleText);

          // GeoJSON coordinates: [lng, lat]
          const lng = item.location?.coordinates?.[0];
          const lat = item.location?.coordinates?.[1];

          // Distance relative to reference point (search center or user GPS)
          let distanceKm = null;
          let distanceLabel = null;
          if (referencePoint && lat && lng) {
            distanceKm = calculateDistanceKm(referencePoint.lat, referencePoint.lng, lat, lng);
            distanceLabel =
              distanceKm < 1
                ? `${Math.round(distanceKm * 1000)} m away`
                : `${distanceKm.toFixed(1)} km away`;
          }

          const locationStr =
            [item.address?.road, item.address?.suburb, item.address?.areaName, item.address?.city]
              .filter(Boolean)
              .join(', ') || 'Local Vicinity';

          return {
            id: item._id,
            title: titleText,
            titleHi,
            category,
            location: locationStr,
            city: item.address?.city || '',
            areaName: item.address?.areaName || '',
            lat,
            lng,
            distanceKm,
            distanceLabel,
            date,
            time,
            createdAt: createdAt.getTime(),
            status: uiStatus,
            rawStatus: item.status,
            severity: item.severity || 'MEDIUM',
            reportCount: item.reportCount || 1,
            isRecurrent: Boolean(item.isRecurrent),
            recurrentFromTicketId: item.recurrentFromTicketId || null,
            description: titleText,
            image: getImageUrl(item.imageUrl),
            boundingBox: item.boundingBox || [0, 0, 0, 0],
            icon: getCategoryIcon(category),
          };
        });

        setComplaints(mapped);
      } else {
        setComplaints([]);
      }
    } catch (err) {
      console.error('[AreaComplaints Fetch Error]:', err);
      setError('Could not connect to backend database. Please ensure the backend server is running.');
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, isNearMeActive, userCoords, searchCoords, searchRadius, areaFilter, searchQuery]);

  // Fetch live suggestions from Nominatim when typing area
  const handleAreaInputChange = (text) => {
    setAreaFilter(text);
    if (isNearMeActive) setIsNearMeActive(false);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSuggesting(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
            text.trim()
          )}&addressdetails=1&limit=5&countrycodes=in`,
          {
            headers: {
              'Accept-Language': 'en',
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setSuggestions(data);
            setShowSuggestions(true);
          }
        }
      } catch (err) {
        console.warn('Geocoding suggestions error:', err);
      } finally {
        setIsSuggesting(false);
      }
    }, 300);
  };

  // User clicks a geocoded suggestion
  const handleSelectSuggestion = (place) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    const shortName = place.name || place.display_name.split(',')[0];
    const fullArea = `${shortName}, ${place.address?.city || place.address?.county || place.address?.state || ''}`.trim();

    setAreaFilter(fullArea);
    setSearchCoords({ lat, lng, name: place.display_name });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // User clicks anywhere on the Map to search around that location
  const handleMapClickLocation = async (lat, lng) => {
    setSearchCoords({ lat, lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
    setIsNearMeActive(false);

    // Reverse geocode to get clean readable area name
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const areaLabel =
          addr.suburb || addr.neighbourhood || addr.city || addr.town || addr.county || 'Selected Map Location';
        setAreaFilter(areaLabel);
      }
    } catch (err) {
      console.debug('Reverse geocode note:', err);
    }
  };

  // Trigger GPS detection for "Near Me"
  const handleNearMeClick = () => {
    if (isNearMeActive) {
      setIsNearMeActive(false);
      setSearchCoords(null);
      setAreaFilter('');
      return;
    }

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ lat, lng });
        setSearchCoords({ lat, lng, name: 'Your Device Location' });
        setIsNearMeActive(true);

        // Reverse geocode to label current area
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const locality =
              addr.suburb || addr.neighbourhood || addr.city || addr.town || 'Current Vicinity';
            setAreaFilter(`📍 Near Me (${locality})`);
          } else {
            setAreaFilter('📍 Near My GPS Location');
          }
        } catch {
          setAreaFilter('📍 Near My GPS Location');
        }

        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS error:', err);
        alert('Could not retrieve GPS location. Please ensure location permissions are granted.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setSearchQuery('');
    setAreaFilter('');
    setSelectedCategory('All');
    setSelectedStatus('all');
    setIsNearMeActive(false);
    setSearchCoords(null);
    setSuggestions([]);
  };

  // Fetch complaints on filter change
  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Client-side filtering & sorting (Category + Keyword text fallback + Sorting)
  const filteredResults = useMemo(() => {
    let list = [...complaints];

    // Filter by Category
    if (selectedCategory !== 'All') {
      list = list.filter((c) => c.category === selectedCategory);
    }

    // Secondary client-side query matching for instant responsiveness
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      );
    }

    // Sorting
    if (sortBy === 'newest') {
      list.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => a.createdAt - b.createdAt);
    } else if (sortBy === 'nearest') {
      list.sort((a, b) => {
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    } else if (sortBy === 'severity') {
      const rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      list.sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0));
    }

    return list;
  }, [complaints, selectedCategory, searchQuery, sortBy]);

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  Area Complaints
                </h1>
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  Live Feed
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-gray-500">
                Real municipal complaints reported by citizens across localities, fetched live from the backend database.
              </p>
            </div>

            {/* View Toggle & Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
                className="flex items-center gap-1.5 px-3 py-2 bg-white text-gray-700 hover:text-blue-600 border border-gray-200 rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                {viewMode === 'list' ? (
                  <>
                    <MapIcon className="w-4 h-4 text-blue-600" />
                    <span>Map View</span>
                  </>
                ) : (
                  <>
                    <List className="w-4 h-4 text-blue-600" />
                    <span>List View</span>
                  </>
                )}
              </button>

              <button
                onClick={fetchComplaints}
                className="p-2 text-gray-500 hover:text-blue-600 bg-white border border-gray-200 rounded-xl shadow-sm transition-colors"
                title="Refresh Complaints"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-blue-700 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Report Issue</span>
              </button>
            </div>
          </div>

          {/* Search & Location Bar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 shadow-sm mb-5 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              {/* Defect Keyword Search */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search defect type, street or issue (e.g. Garbage, Pothole, Water)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder-gray-400"
                />
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Real Location Search with Autocomplete */}
              <div className="sm:w-72 relative">
                <input
                  type="text"
                  placeholder="Search Area / City (e.g. Sanganer, Jaipur)..."
                  value={areaFilter}
                  onChange={(e) => handleAreaInputChange(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  className="w-full pl-8 pr-8 py-2.5 bg-gray-50 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder-gray-400"
                />
                <MapPin className="h-4 w-4 text-red-500 absolute left-2.5 top-3" />
                {isSuggesting ? (
                  <LoaderCircle className="h-4 w-4 text-blue-600 animate-spin absolute right-2.5 top-3" />
                ) : areaFilter ? (
                  <button
                    onClick={() => {
                      setAreaFilter('');
                      setSearchCoords(null);
                      setSuggestions([]);
                      setShowSuggestions(false);
                    }}
                    className="absolute right-2.5 top-3 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}

                {/* Autocomplete Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 max-h-60 overflow-y-auto">
                    <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Real Locations (OpenStreetMap)
                    </p>
                    {suggestions.map((item) => (
                      <button
                        key={item.place_id}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-start gap-2 border-b border-gray-50 last:border-none"
                      >
                        <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 leading-snug">
                            {item.name || item.display_name.split(',')[0]}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {item.display_name}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Near Me GPS Button */}
              <button
                onClick={handleNearMeClick}
                disabled={gpsLoading}
                className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 ${
                  isNearMeActive
                    ? 'bg-blue-600 text-white shadow-blue-200'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {gpsLoading ? (
                  <LoaderCircle className="w-4 h-4 animate-spin text-blue-600" />
                ) : (
                  <Crosshair className={`w-4 h-4 ${isNearMeActive ? 'text-white' : 'text-blue-600'}`} />
                )}
                <span>{isNearMeActive ? 'Near Me (Active)' : 'Near Me'}</span>
              </button>
            </div>

            {/* Radius Pills (Shown when searchCoords or Near Me is active) */}
            {(searchCoords || isNearMeActive) && (
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="text-gray-400 font-semibold uppercase text-[10px] tracking-wider shrink-0 flex items-center gap-1">
                  <LocateFixed className="w-3 h-3 text-purple-600" />
                  Search Radius:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {RADIUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setSearchRadius(opt.value)}
                      className={`px-2.5 py-0.5 rounded-md text-xs font-semibold transition-colors ${
                        searchRadius === opt.value
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-gray-400 font-semibold uppercase text-[10px] tracking-wider shrink-0 mr-1">
                Category:
              </span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg font-medium shrink-0 transition-colors ${
                    selectedCategory === cat
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Status & Sort Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs">
              {/* Status filter tabs */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedStatus('all')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    selectedStatus === 'all' ? 'bg-blue-100 text-blue-800' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  All Status
                </button>
                <button
                  onClick={() => setSelectedStatus('raised')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    selectedStatus === 'raised' ? 'bg-amber-100 text-amber-800' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setSelectedStatus('working')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    selectedStatus === 'working' ? 'bg-blue-100 text-blue-800' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Working
                </button>
                <button
                  onClick={() => setSelectedStatus('resolved')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    selectedStatus === 'resolved' ? 'bg-green-100 text-green-800' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Resolved
                </button>
                <button
                  onClick={() => navigate('/resolved-issues')}
                  className="px-2.5 py-1 rounded-lg font-bold text-[11px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors ml-1 cursor-pointer"
                  title="View Dedicated Resolved Issues Archive"
                >
                  Archive ↗
                </button>
              </div>

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-1.5 text-gray-500">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="text-[11px]">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold text-gray-800 focus:outline-none"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="severity">Highest Severity</option>
                  {(userCoords || searchCoords) && <option value="nearest">Nearest to Location</option>}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between">
              <span>{error}</span>
              <button onClick={fetchComplaints} className="font-bold underline ml-2 hover:text-red-900">
                Retry
              </button>
            </div>
          )}

          {/* Interactive Map View */}
          {viewMode === 'map' && (
            <AreaMapView
              complaints={filteredResults}
              userCoords={userCoords}
              searchCoords={searchCoords}
              searchRadiusMeters={searchRadius}
              onSelectComplaint={setSelectedComplaint}
              onMapClickLocation={handleMapClickLocation}
            />
          )}

          {/* Complaints Count & Status Banner */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-gray-500">
              Found {filteredResults.length} real complaint{filteredResults.length !== 1 ? 's' : ''}
              {areaFilter ? ` in "${areaFilter}"` : ' in all areas'}
            </span>
            {(areaFilter || searchQuery || selectedCategory !== 'All' || selectedStatus !== 'all' || searchCoords) && (
              <button
                onClick={handleClearAllFilters}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Complaints Grid List */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400">
              <LoaderCircle className="w-8 h-8 animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-medium">Fetching real complaints from backend database...</p>
            </div>
          ) : filteredResults.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResults.map((complaint) => {
                const Icon = complaint.icon || Construction;

                return (
                  <div
                    key={complaint.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                  >
                    {/* Thumbnail Image */}
                    <div className="w-full h-44 bg-gray-100 relative overflow-hidden">
                      <img
                        src={complaint.image}
                        alt={complaint.title}
                        className="w-full h-full object-cover"
                      />
                      <span
                        className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border uppercase ${getSeverityBadge(
                          complaint.severity
                        )}`}
                      >
                        {complaint.severity}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="flex-1 p-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                          <h3 className="font-bold text-gray-900 text-sm leading-snug truncate">
                            {complaint.title}
                          </h3>
                        </div>
                        <StatusBadge status={complaint.status} />
                      </div>

                      {/* Location & Distance */}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="flex items-center gap-1 text-xs text-gray-500 line-clamp-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {complaint.location}
                        </span>
                        {complaint.distanceLabel && (
                          <span className="flex items-center gap-1 text-xs text-blue-600 font-semibold">
                            <Navigation className="w-3 h-3 shrink-0" />
                            {complaint.distanceLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {complaint.date}
                        </span>
                        {complaint.reportCount > 1 && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            {complaint.reportCount} reports
                          </span>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="flex justify-end mt-auto pt-2">
                        <button
                          onClick={() => setSelectedComplaint(complaint)}
                          className="w-full inline-flex items-center justify-center gap-1 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 border border-blue-200 transition-colors"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                No complaints found for this area
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto mb-5">
                {areaFilter
                  ? `There are currently no civic issues reported matching "${areaFilter}".`
                  : 'There are currently no civic issues reported matching your filters.'}
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleClearAllFilters}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors"
                >
                  Clear Filters
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Report First Issue</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Complaint Details Modal */}
      {selectedComplaint && (
        <DetailModal
          complaint={selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
        />
      )}
    </>
  );
};

export default AreaComplaints;
