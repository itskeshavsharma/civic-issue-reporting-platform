import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Search,
  Crosshair,
  Check,
  X,
  LoaderCircle,
  Navigation,
} from 'lucide-react';

/**
 * Custom modern Google-Maps-style pin marker icon (pure HTML & SVG).
 * Completely immune to Leaflet default asset loading path issues in Vite.
 */
const createPinIcon = () =>
  L.divIcon({
    className: 'civic-map-pin',
    html: `
      <div style="position: relative; transform: translate(-50%, -100%);">
        <svg width="38" height="50" viewBox="0 0 38 50" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.35)); cursor: grab;">
          <path d="M19 0C8.50659 0 0 8.50659 0 19C0 33.25 19 50 19 50C19 50 38 33.25 38 19C38 8.50659 29.4934 0 19 0Z" fill="#EF4444"/>
          <circle cx="19" cy="19" r="8" fill="white"/>
        </svg>
        <div style="width: 12px; height: 5px; background: rgba(0,0,0,0.3); border-radius: 50%; margin: -4px auto 0; filter: blur(1px);"></div>
      </div>
    `,
    iconSize: [38, 50],
    iconAnchor: [19, 50],
  });

/**
 * LocationMapPicker:
 * Interactive Map Modal allowing the citizen to drop or drag a pin anywhere,
 * search locations, see reverse-geocoded address in real time, and lock the coordinates.
 */
const LocationMapPicker = ({
  initialLat = 26.4499,
  initialLng = 74.6399,
  initialAddress = '',
  onConfirm,
  onClose,
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [coords, setCoords] = useState({
    lat: initialLat || 26.4499,
    lng: initialLng || 74.6399,
  });
  const [addressData, setAddressData] = useState({
    formattedAddress: initialAddress || 'Fetching address...',
    road: '',
    area: '',
    city: '',
    state: '',
  });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Reverse geocode given coordinates
  const reverseGeocode = async (lat, lng) => {
    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      if (!res.ok) throw new Error('Reverse geocode failed');
      const data = await res.json();

      let formattedAddress = '';
      let road = '',
        area = '',
        city = '',
        state = '',
        country = '',
        postcode = '';

      if (data && data.address) {
        const addr = data.address;
        road = addr.road || addr.street || addr.pedestrian || '';
        area =
          addr.suburb ||
          addr.neighbourhood ||
          addr.village ||
          addr.subdivision ||
          '';
        city =
          addr.city ||
          addr.town ||
          addr.municipality ||
          addr.county ||
          'Ajmer';
        state = addr.state || 'Rajasthan';
        country = addr.country || 'India';
        postcode = addr.postcode || '';

        const parts = [road, area, city, state, country, postcode].filter(
          Boolean
        );
        formattedAddress = parts.join(', ');
      }

      setAddressData({
        formattedAddress:
          formattedAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        road,
        area: area || city || 'Local Area',
        city: city || 'City',
        state,
      });
    } catch (err) {
      console.warn('Geocoding note:', err);
      setAddressData((prev) => ({
        ...prev,
        formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      }));
    } finally {
      setIsGeocoding(false);
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Prevent re-initialization error
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const startLat = coords.lat;
    const startLng = coords.lng;

    const map = L.map(mapContainerRef.current, {
      center: [startLat, startLng],
      zoom: 16,
      zoomControl: false,
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Zoom control on bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Add Draggable Pin Marker
    const marker = L.marker([startLat, startLng], {
      icon: createPinIcon(),
      draggable: true,
    }).addTo(map);

    // Handle Marker Drag
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setCoords({ lat: pos.lat, lng: pos.lng });
      reverseGeocode(pos.lat, pos.lng);
    });

    // Handle Map Click (drop pin anywhere clicked)
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setCoords({ lat, lng });
      reverseGeocode(lat, lng);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    // Initial reverse geocode if address missing
    if (!initialAddress) {
      reverseGeocode(startLat, startLng);
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Search location via Nominatim Search API
  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError('');

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1`
      );
      if (!res.ok) throw new Error('Search network error');
      const results = await res.json();

      if (results && results.length > 0) {
        const item = results[0];
        const newLat = parseFloat(item.lat);
        const newLng = parseFloat(item.lon);

        setCoords({ lat: newLat, lng: newLng });

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([newLat, newLng], 16, { duration: 1.2 });
          markerRef.current.setLatLng([newLat, newLng]);
        }

        reverseGeocode(newLat, newLng);
      } else {
        setSearchError('Location not found. Try typing city or landmark.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('Could not search location. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Re-center to device GPS
  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 17, {
            duration: 1.2,
          });
          markerRef.current.setLatLng([latitude, longitude]);
        }
        reverseGeocode(latitude, longitude);
      },
      (err) => console.warn('Locate error:', err),
      { enableHighAccuracy: true }
    );
  };

  // Confirm Location
  const handleConfirm = () => {
    onConfirm({
      latitude: coords.lat,
      longitude: coords.lng,
      formattedAddress: addressData.formattedAddress,
      road: addressData.road,
      area: addressData.area,
      city: addressData.city,
      state: addressData.state,
      accuracy: 5, // manual pin precision
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
        style={{ height: '88vh', maxHeight: '720px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2 text-gray-900">
            <div className="p-2 bg-red-50 text-red-600 rounded-xl">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-snug">Set Location on Map</h3>
              <p className="text-xs text-gray-500">
                Click anywhere or drag the red pin to set exact complaint location
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar & GPS Button */}
        <div className="p-3 bg-gray-50 border-b border-gray-100 flex gap-2">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <input
              type="text"
              placeholder="Search area, road, landmark (e.g. Civil Lines, Ajmer)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white pl-9 pr-20 py-2 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-1.5 top-1.5 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {isSearching ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
            </button>
          </form>

          <button
            onClick={handleLocateMe}
            title="Locate my GPS"
            className="flex items-center gap-1 px-3 py-2 bg-white text-gray-700 hover:text-blue-600 border border-gray-200 rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Crosshair className="h-4 w-4 text-blue-600" />
            <span className="hidden sm:inline">GPS</span>
          </button>
        </div>

        {searchError && (
          <div className="px-4 py-1.5 bg-amber-50 text-amber-800 text-xs border-b border-amber-200">
            {searchError}
          </div>
        )}

        {/* Interactive Map Container */}
        <div className="flex-1 relative w-full h-full min-h-[250px] bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />

          {/* Hint Overlay badge */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full shadow-md border border-gray-200 text-[11px] font-medium text-gray-700 pointer-events-none flex items-center gap-1.5">
            <Navigation className="h-3 w-3 text-red-500" />
            <span>Tap map or drag pin to position</span>
          </div>
        </div>

        {/* Footer with Selected Address & Confirm Button */}
        <div className="p-4 bg-white border-t border-gray-100 shadow-lg">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Selected Location Details
              </span>
              {isGeocoding && (
                <span className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                  <LoaderCircle className="h-3 w-3 animate-spin" /> Resolving address...
                </span>
              )}
            </div>

            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
              {addressData.formattedAddress}
            </p>

            <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-gray-500">
              <span>Lat: {coords.lat.toFixed(6)}</span>
              <span>Lng: {coords.lng.toFixed(6)}</span>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-[2] flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-md transition-colors active:scale-[0.98]"
            >
              <Check className="h-4 w-4" />
              Confirm This Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationMapPicker;
