import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Circle, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../context/AuthContext';
import { civicApi } from '../../services/api';
import InspectorModal from '../../components/admin/InspectorModal';
import {
  X,
  MapPin,
  ExternalLink,
  Filter,
  Users,
  Search,
  RefreshCw,
  Layers,
  CheckCircle2,
  Flame,
  List,
  Navigation,
  Eye,
  AlertTriangle,
  Building2,
  Briefcase,
  Shield,
} from 'lucide-react';

// Format Multilingual Title safely
const formatTitle = (title) => {
  if (!title) return 'Civic Defect';
  if (typeof title === 'object') {
    return title.en || title.hi || 'Civic Defect';
  }
  return String(title);
};

// Color definitions for status / severity markers
const getMarkerColor = (complaint) => {
  if (complaint.status === 'Resolved' || complaint.status === 'Closed') {
    return '#22C55E'; // 🟢 Green = RESOLVED
  }
  switch (complaint.severity) {
    case 'CRITICAL':
      return '#EF4444'; // 🔴 Red = CRITICAL
    case 'HIGH':
      return '#F97316'; // 🟠 Orange = HIGH
    case 'MEDIUM':
      return '#EAB308'; // 🟡 Amber = MEDIUM
    default:
      return '#3B82F6'; // 🔵 Blue = LOW
  }
};

// Custom animated teardrop SVG marker pin
const createCustomMarkerIcon = (complaint, isSelected = false) => {
  const pinColor = getMarkerColor(complaint);
  const isCritical = complaint.severity === 'CRITICAL' && complaint.status !== 'Resolved';

  const html = `
    <div style="cursor: pointer; position: relative; width: 100%; height: 100%;">
      ${isSelected
      ? `<span style="position: absolute; top: -6px; left: -6px; width: 46px; height: 46px; border-radius: 50%; border: 3px solid #4F46E5; background-color: rgba(79, 70, 229, 0.25); animation: pulse 1.5s infinite;"></span>`
      : isCritical
        ? `<span style="position: absolute; top: 8px; left: 6px; width: 22px; height: 22px; border-radius: 50%; background-color: ${pinColor}; opacity: 0.5; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>`
        : ''
    }
      <svg width="${isSelected ? 42 : 34}" height="${isSelected ? 54 : 46}" viewBox="0 0 38 50" fill="none" style="filter: drop-shadow(0 3px 8px rgba(0,0,0,0.4));">
        <path d="M19 0C8.50659 0 0 8.50659 0 19C0 33.25 19 50 19 50C19 50 38 33.25 38 19C38 8.50659 29.4934 0 19 0Z" fill="${pinColor}"/>
        <circle cx="19" cy="19" r="${isSelected ? 9 : 8}" fill="white"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'civic-marker-pin',
    iconSize: [isSelected ? 42 : 34, isSelected ? 54 : 46],
    iconAnchor: [isSelected ? 21 : 17, isSelected ? 54 : 46],
  });
};

// Component to dynamically adjust map center & bounds
const MapController = ({ center, zoom, bounds }) => {
  const map = useMap();

  useEffect(() => {
    // Invalidate size immediately and after slight delay for dynamic flex / CSS layout
    map.invalidateSize();
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    map.invalidateSize();
    if (bounds && bounds.isValid && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    } else if (center && Array.isArray(center) && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, bounds, map]);

  return null;
};

// Zoom control anchored to bottomright
const BottomRightZoomControl = () => {
  const map = useMap();
  useEffect(() => {
    const zoomCtrl = L.control.zoom({ position: 'bottomright' });
    zoomCtrl.addTo(map);
    return () => {
      zoomCtrl.remove();
    };
  }, [map]);
  return null;
};

// Spatial Clustering: Compute Red Circle Hotspots for dense problem areas
const computeHotspots = (complaints) => {
  const valid = complaints.filter(
    (c) => Array.isArray(c.location?.coordinates) && c.location.coordinates.length === 2
  );
  const clusters = [];
  const visited = new Set();

  for (let i = 0; i < valid.length; i++) {
    if (visited.has(valid[i]._id)) continue;
    const [lng1, lat1] = valid[i].location.coordinates;
    const cluster = [valid[i]];
    visited.add(valid[i]._id);

    for (let j = i + 1; j < valid.length; j++) {
      if (visited.has(valid[j]._id)) continue;
      const [lng2, lat2] = valid[j].location.coordinates;
      // Distance approximation in meters
      const dLat = (lat2 - lat1) * 111000;
      const dLng = (lng2 - lng1) * 111000 * Math.cos((lat1 * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);

      if (dist <= 500) {
        // Within 500 meters
        cluster.push(valid[j]);
        visited.add(valid[j]._id);
      }
    }

    // A hotspot is marked if >= 2 issues cluster in this 500m zone or reportCount >= 2
    const totalReports = cluster.reduce((sum, c) => sum + (c.reportCount || 1), 0);
    if (cluster.length >= 2 || totalReports >= 2) {
      const avgLat = cluster.reduce((sum, c) => sum + c.location.coordinates[1], 0) / cluster.length;
      const avgLng = cluster.reduce((sum, c) => sum + c.location.coordinates[0], 0) / cluster.length;
      clusters.push({
        id: `hotspot-${i}`,
        center: [avgLat, avgLng],
        count: cluster.length,
        totalReports,
        complaints: cluster,
        areaName: cluster[0].address?.areaName || cluster[0].address?.city || 'Dense Hazard Cluster',
      });
    }
  }
  return clusters;
};

const MapConsole = () => {
  const { selectedWard, officerProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const locateIdFromUrl = searchParams.get('locate');

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All Active');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHotspots, setShowHotspots] = useState(true);
  const [showIssuesList, setShowIssuesList] = useState(false);

  // Selected complaint for flyout drawer
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Dynamic Map Viewport state (default centroid initialized empty)
  const [mapCenter, setMapCenter] = useState([26.9124, 75.7873]); // Dynamic fallback (e.g. Rajasthan/Jaipur or initial coordinate)
  const [mapZoom, setMapZoom] = useState(13);
  const [mapBounds, setMapBounds] = useState(null);

  // Compute Hotspots from current complaints list
  const hotspots = useMemo(() => computeHotspots(complaints), [complaints]);

  // Load complaints
  const loadComplaints = async () => {
    setLoading(true);
    try {
      const queryStatus = locateIdFromUrl
        ? 'All'
        : statusFilter === 'All Statuses'
        ? 'All'
        : statusFilter === 'All Active' || statusFilter === 'All'
        ? undefined
        : statusFilter;

      const result = await civicApi.getComplaints({
        ward: selectedWard,
        status: queryStatus,
        severity: severityFilter !== 'All' ? severityFilter : undefined,
        search: searchQuery.trim() || undefined,
        query: searchQuery.trim() || undefined,
        view: 'map',
        limit: 500,
      });

      const data = result.data || [];
      setComplaints(data);

      // Extract valid coordinate points
      const validPoints = data
        .filter((c) => Array.isArray(c.location?.coordinates) && c.location.coordinates.length === 2)
        .map((c) => [c.location.coordinates[1], c.location.coordinates[0]]);

      // Priority 1: If a specific complaint is requested to locate (?locate=ID)
      if (locateIdFromUrl) {
        const target = data.find((c) => String(c._id) === String(locateIdFromUrl));
        if (target && target.location?.coordinates) {
          const [lng, lat] = target.location.coordinates;
          setSelectedComplaint(target);
          setMapCenter([lat, lng]);
          setMapZoom(17);
          setMapBounds(null);
          return;
        }
      }

      // Priority 2: Auto-fit bounds of ALL loaded complaints in this city / ward!
      if (validPoints.length > 1) {
        const bounds = L.latLngBounds(validPoints);
        setMapBounds(bounds);
      } else if (validPoints.length === 1) {
        setMapCenter(validPoints[0]);
        setMapZoom(15);
        setMapBounds(null);
      } else {
        // Fallback: If no complaints yet, center map using browser GPS or officer jurisdiction
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setMapCenter([pos.coords.latitude, pos.coords.longitude]);
              setMapZoom(13);
            },
            () => { }
          );
        }
      }
    } catch (err) {
      console.error('Failed to load map complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, [selectedWard, statusFilter, severityFilter, searchQuery, locateIdFromUrl]);

  // Marker Click Handler
  const handleMarkerClick = (complaint) => {
    setSelectedComplaint(complaint);
    if (complaint.location?.coordinates) {
      const [lng, lat] = complaint.location.coordinates;
      if (!isNaN(lat) && !isNaN(lng)) {
        setMapCenter([lat, lng]);
        setMapZoom(16);
        setMapBounds(null);
      }
    }
  };

  // Locate on Map trigger for any issue
  const handleLocateOnMap = (complaint) => {
    if (complaint.location?.coordinates) {
      const [lng, lat] = complaint.location.coordinates;
      if (!isNaN(lat) && !isNaN(lng)) {
        setSelectedComplaint(complaint);
        setMapCenter([lat, lng]);
        setMapZoom(17);
        setMapBounds(null);
        setShowIssuesList(false); // Close list to reveal map pin
      }
    }
  };

  const handleStatusUpdated = (updated) => {
    setSelectedComplaint(updated);
    loadComplaints();
  };

  return (
    <div className="relative h-[calc(100vh-6rem)] sm:h-[calc(100vh-6.5rem)] rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xl flex flex-col font-sans">
      {/* Top Filter Floating Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: Quick Filters & Radar Controls */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-2.5 shadow-lg flex flex-wrap items-center gap-2.5 pointer-events-auto">
          {/* Status Filter Pills (Active Issues Only) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {['All Active', 'Submitted', 'In Progress'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Toggle Red Circle Hotspots */}
          <button
            type="button"
            onClick={() => setShowHotspots(!showHotspots)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${showHotspots
              ? 'bg-rose-50 text-rose-700 border-rose-300'
              : 'bg-slate-100 text-slate-500 border-slate-200 hover:text-slate-700'
              }`}
            title="Toggle Red Circle Hotspot Hazard Density Radar"
          >
            <Flame className={`w-3.5 h-3.5 ${showHotspots ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`} />
            <span>Hotspots ({hotspots.length})</span>
          </button>

          {/* Active Issues Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowIssuesList(!showIssuesList)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${showIssuesList
              ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
          >
            <List className="w-3.5 h-3.5 text-indigo-600" />
            <span>Active Issues ({complaints.length})</span>
          </button>

          {/* Status Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-800 text-xs font-bold focus:outline-none cursor-pointer border-none"
            >
              <option value="All Active">⚡ All Active Issues</option>
              <option value="All Statuses">🌐 All Statuses (Inc. Resolved)</option>
              <option value="Submitted">📥 Submitted</option>
              <option value="Assigned to Ward">🏛️ Assigned to Ward</option>
              <option value="Assigned">👷 Assigned to Crew</option>
              <option value="In Progress">🛠️ In Progress</option>
              <option value="Reopened">⚠️ Reopened</option>
              <option value="Resolved">✅ Resolved</option>
              <option value="Closed">🔒 Closed</option>
            </select>
          </div>

          {/* Severity Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-transparent text-slate-800 text-xs font-bold focus:outline-none cursor-pointer border-none"
            >
              <option value="All">All Severity</option>
              <option value="CRITICAL">🔴 Critical</option>
              <option value="HIGH">🟠 High</option>
              <option value="MEDIUM">🟡 Medium</option>
              <option value="LOW">🔵 Low</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative hidden md:block">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter road or area..."
              className="bg-slate-100 border border-slate-200 rounded-xl pl-8 pr-3 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white w-36 lg:w-44"
            />
          </div>

          <button
            type="button"
            onClick={loadComplaints}
            title="Refresh map points"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>

        {/* Right: Map Legend Badge */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl px-3.5 py-2 shadow-lg hidden sm:flex items-center gap-3 text-xs font-semibold pointer-events-auto">
          <span className="flex items-center gap-1.5 text-rose-700 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-2xs"></span> Critical
          </span>
          <span className="flex items-center gap-1.5 text-orange-700 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block shadow-2xs"></span> High
          </span>
          <span className="flex items-center gap-1.5 text-amber-700 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-2xs"></span> Medium
          </span>
          <span className="flex items-center gap-1.5 text-blue-700 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shadow-2xs"></span> Low
          </span>
          <Link
            to="/admin/resolved"
            className="flex items-center gap-1 pl-2 border-l border-slate-200 text-emerald-700 hover:text-emerald-900 font-bold"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved Archive
          </Link>
        </div>
      </div>

      {/* Main Full-Screen React Leaflet Map */}
      <div className="flex-1 w-full h-full relative">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          zoomControl={false}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          {/* OpenStreetMap TileLayer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <BottomRightZoomControl />
          <MapController center={mapCenter} zoom={mapZoom} bounds={mapBounds} />

          {/* Red Circle Hotspot Overlays for High-Density Hazard Areas */}
          {showHotspots &&
            hotspots.map((hs) => (
              <Circle
                key={hs.id}
                center={hs.center}
                radius={380}
                pathOptions={{
                  color: '#DC2626',
                  fillColor: '#EF4444',
                  fillOpacity: 0.22,
                  weight: 2.5,
                  dashArray: '6, 6',
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={0.95} permanent={false}>
                  <div className="text-center font-sans p-1">
                    <div className="text-xs font-black text-rose-700 flex items-center gap-1 justify-center">
                      <Flame className="w-3.5 h-3.5" />
                      <span>High Hazard Density Hotspot</span>
                    </div>
                    <div className="text-[11px] text-slate-800 font-bold mt-0.5">{hs.areaName}</div>
                    <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                      {hs.count} Active Grievances ({hs.totalReports} total citizen reports)
                    </div>
                  </div>
                </Tooltip>
              </Circle>
            ))}

          {/* Color-coded custom teardrop SVG markers */}
          {complaints.map((item) => {
            const coords = item.location?.coordinates;
            if (!Array.isArray(coords) || coords.length !== 2) return null;
            const [lng, lat] = coords;
            if (isNaN(lat) || isNaN(lng)) return null;

            const isSelected = selectedComplaint && selectedComplaint._id === item._id;

            return (
              <Marker
                key={item._id}
                position={[lat, lng]}
                icon={createCustomMarkerIcon(item, isSelected)}
                eventHandlers={{
                  click: () => handleMarkerClick(item),
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      {/* Floating Active Issues List Drawer (Left Side) */}
      {showIssuesList && (
        <div className="absolute top-20 left-4 bottom-4 w-80 sm:w-96 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl z-30 flex flex-col overflow-hidden animate-slide-right">
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <List className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Active Issues Radar ({complaints.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowIssuesList(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {complaints.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No active complaints reported in this jurisdiction.
              </div>
            ) : (
              complaints.map((item) => {
                const isSelected = selectedComplaint && selectedComplaint._id === item._id;
                return (
                  <div
                    key={item._id}
                    className={`p-3 rounded-xl border transition-all ${isSelected
                      ? 'bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-400'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-900 truncate">{formatTitle(item.title)}</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span className="truncate">{item.address?.areaName || item.address?.city || 'Location'}</span>
                        </p>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${item.status === 'In Progress'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                          }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100">
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.reportCount > 1 ? `👥 ${item.reportCount} reports` : '1 report'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleLocateOnMap(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow-2xs transition-colors cursor-pointer"
                      >
                        <Navigation className="w-3 h-3" />
                        Locate on Map
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Marker Click Flyout / Slide-Over Drawer from the right */}
      {selectedComplaint && (
        <div className="absolute top-0 right-0 bottom-0 w-full sm:w-96 bg-white/95 backdrop-blur-xl border-l border-slate-200 shadow-2xl z-30 flex flex-col animate-slide-left overflow-y-auto">
          {/* Flyout Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full shadow-2xs" style={{ backgroundColor: getMarkerColor(selectedComplaint) }} />
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Complaint Radar Detail</h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedComplaint(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Flyout Content Body */}
          <div className="p-5 space-y-4 flex-1">
            {/* Image Thumbnail with Overlay */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video group shadow-xs">
              <img
                src={selectedComplaint.imageUrl}
                alt="Defect visual evidence"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-sm border border-slate-200 text-[10px] font-mono font-bold text-slate-800 shadow-2xs">
                {selectedComplaint._id}
              </div>
              {selectedComplaint.areaCoveragePct > 0 && (
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-mono font-bold shadow-2xs">
                  {selectedComplaint.areaCoveragePct}% Damage Area
                </div>
              )}
            </div>

            {/* Bilingual Defect Summary (EN + HI) */}
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 leading-snug">
                {formatTitle(selectedComplaint.title)}
              </h4>
              {selectedComplaint.title?.hi && (
                <p className="text-xs text-indigo-700 font-semibold">{selectedComplaint.title.hi}</p>
              )}
            </div>

            {/* Status & Severity Tags */}
            <div className="flex items-center gap-2 pt-1">
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-bold border ${selectedComplaint.status === 'Resolved' || selectedComplaint.status === 'Closed'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : selectedComplaint.status === 'In Progress'
                    ? 'bg-orange-50 text-orange-800 border-orange-300'
                    : 'bg-blue-50 text-blue-800 border-blue-300'
                  }`}
              >
                {selectedComplaint.status}
              </span>

              <span className="text-xs px-2.5 py-0.5 rounded-md font-mono font-bold bg-slate-100 border border-slate-200 text-slate-700">
                {selectedComplaint.severity}
              </span>

              {selectedComplaint.reportCount > 1 && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                  👥 {selectedComplaint.reportCount} Reports
                </span>
              )}
            </div>

            {/* Reporter Protection */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Reporter: <strong className="text-slate-700">Protected Citizen Identity</strong> 🛡️</span>
            </div>

            {/* Exact Location & Ward Details */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800 block">
                    {selectedComplaint.address?.road || 'Street / Road'}
                  </span>
                  <span className="text-slate-500">
                    {[
                      selectedComplaint.address?.areaName,
                      selectedComplaint.address?.suburb,
                      selectedComplaint.address?.city,
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Municipal Area'}
                  </span>
                  {selectedComplaint.location?.coordinates && (
                    <span className="font-mono text-[10px] text-slate-400 block mt-1">
                      GPS: [{selectedComplaint.location.coordinates[1].toFixed(5)},{' '}
                      {selectedComplaint.location.coordinates[0].toFixed(5)}]
                    </span>
                  )}
                </div>
              </div>

              {selectedComplaint.wardId && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 text-slate-700 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Ward: {selectedComplaint.wardId.name}</span>
                </div>
              )}
            </div>

            {/* Re-center / Locate on Map Button */}
            <button
              type="button"
              onClick={() => handleLocateOnMap(selectedComplaint)}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Navigation className="w-4 h-4" />
              Focus & Zoom to Pin on Map
            </button>

            {/* Inspector Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsInspectorOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4 text-indigo-600" />
              Inspect Florence-2 AI Bounding Box
            </button>
          </div>
        </div>
      )}

      {/* Inspector Modal */}
      {selectedComplaint && (
        <InspectorModal
          complaint={selectedComplaint}
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          onStatusUpdated={handleStatusUpdated}
        />
      )}
    </div>
  );
};

export default MapConsole;
