import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  MapPin,
  Calendar,
  Search,
  RefreshCw,
  X,
  ShieldCheck,
  ChevronRight,
  SlidersHorizontal,
  ExternalLink,
  Layers,
  ArrowRight,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getResolvedComplaints, getImageUrl } from '../services/api';

// Green marker pin for resolved issues
const resolvedPinIcon = L.divIcon({
  html: `
    <div style="transform: translate(-50%, -100%); cursor: pointer;">
      <svg width="34" height="46" viewBox="0 0 38 50" fill="none" style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));">
        <path d="M19 0C8.50659 0 0 8.50659 0 19C0 33.25 19 50 19 50C19 50 38 33.25 38 19C38 8.50659 29.4934 0 19 0Z" fill="#10B981"/>
        <circle cx="19" cy="19" r="8" fill="white"/>
      </svg>
    </div>
  `,
  className: 'civic-citizen-resolved-pin',
  iconSize: [34, 46],
  iconAnchor: [17, 46],
});

/**
 * Pure Leaflet Modal Map Component
 * Completely isolated and mounted on-demand only when a user triggers "View on Map"
 */
const ModalMap = ({ complaint }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const coords = complaint.location?.coordinates;
  const hasValidCoords = Array.isArray(coords) && coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);

  useEffect(() => {
    if (!hasValidCoords || !mapContainerRef.current) return;

    const lat = coords[1];
    const lng = coords[0];

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const displayTitle = typeof complaint.title === 'object'
        ? complaint.title?.en || complaint.title?.hi || 'Civic Issue'
        : complaint.title || 'Civic Issue';

      const marker = L.marker([lat, lng], { icon: resolvedPinIcon }).addTo(map);
      marker
        .bindPopup(`
          <div style="font-family: system-ui, sans-serif; font-size: 12px; padding: 2px;">
            <b>${displayTitle}</b>
            <p style="color: #10B981; font-weight: bold; margin: 4px 0 0;">Status: Resolved ✅</p>
            <p style="color: #64748B; font-family: monospace; font-size: 10px; margin: 2px 0 0;">${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
          </div>
        `)
        .openPopup();

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [hasValidCoords, coords, complaint]);

  if (!hasValidCoords) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-slate-50 text-slate-500">
        <p className="text-sm font-bold text-slate-700">Coordinates Not Recorded</p>
        <p className="text-xs text-slate-400 mt-1">This grievance did not record GPS location coordinates.</p>
      </div>
    );
  }

  return <div ref={mapContainerRef} className="h-full w-full" />;
};

const ResolvedIssues = () => {
  const [complaints, setComplaints] = useState([]);
  const [groupedByArea, setGroupedByArea] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('All');
  const [selectedMapComplaint, setSelectedMapComplaint] = useState(null);

  const fetchArchive = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedArea !== 'All') {
        params.areaName = selectedArea;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await getResolvedComplaints(params);
      if (res && res.success) {
        setComplaints(res.complaints || res.data || []);
        setGroupedByArea(res.groupedByArea || {});
      }
    } catch (err) {
      console.warn('[ResolvedIssues] Error fetching resolved archive:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchive();
  }, [selectedArea]);

  const areaList = Object.keys(groupedByArea);

  // Filter complaints based on search query
  const filteredComplaints = complaints.filter((c) => {
    if (selectedArea !== 'All') {
      const area = c.address?.areaName || c.address?.suburb || c.address?.city || 'General Area';
      if (area.toLowerCase() !== selectedArea.toLowerCase()) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleEn = (c.title?.en || c.title || '').toLowerCase();
      const titleHi = (c.title?.hi || '').toLowerCase();
      const road = (c.address?.road || '').toLowerCase();
      const area = (c.address?.areaName || '').toLowerCase();
      const remark = (c.resolutionProof?.officialRemark || '').toLowerCase();
      const id = (c._id || '').toLowerCase();
      return (
        titleEn.includes(q) ||
        titleHi.includes(q) ||
        road.includes(q) ||
        area.includes(q) ||
        remark.includes(q) ||
        id.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold mb-3 border border-white/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>Public Redressal Archive</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Area-Wise Resolved Complaints
          </h1>
          <p className="text-sm text-emerald-100 font-medium mt-1 leading-relaxed">
            Transparent before & after photographic evidence of completed civic repairs across municipal wards.
          </p>
        </div>

        {/* Floating Quick Stats */}
        <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center gap-6 text-xs font-semibold">
          <div>
            <span className="text-emerald-200 block text-[11px] font-normal uppercase tracking-wider">Total Resolved</span>
            <span className="text-xl font-black">{complaints.length} Issues</span>
          </div>
          <div>
            <span className="text-emerald-200 block text-[11px] font-normal uppercase tracking-wider">Wards Covered</span>
            <span className="text-xl font-black">{areaList.length} Areas</span>
          </div>
          <div>
            <span className="text-emerald-200 block text-[11px] font-normal uppercase tracking-wider">Inspection Status</span>
            <span className="text-xl font-black">100% Verified</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by issue title, road, or area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchArchive()}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={fetchArchive}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Area Chips */}
      {areaList.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedArea('All')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedArea === 'All'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All Areas ({complaints.length})
          </button>
          {areaList.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => setSelectedArea(area)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedArea === area
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {area} ({groupedByArea[area]?.length || 0})
            </button>
          ))}
        </div>
      )}

      {/* Complaints Grid */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-xs">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">Loading resolved complaints archive...</p>
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">No Resolved Complaints Yet</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
            {searchQuery
              ? 'No resolved complaints match your search query.'
              : 'Resolved civic issues with before & after photographic evidence will appear here.'}
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedArea('All');
              }}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredComplaints.map((item) => {
            const resolvedAt = item.resolutionProof?.resolvedAt
              ? new Date(item.resolutionProof.resolvedAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : new Date(item.updatedAt || Date.now()).toLocaleDateString('en-GB');

            const beforeUrl = item.imageUrl || item.image;
            const afterUrl = item.resolutionProof?.imageUrl;

            return (
              <div
                key={item._id}
                className="bg-white rounded-3xl border border-gray-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                      #{String(item._id).substring(String(item._id).length - 6).toUpperCase()}
                    </span>

                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Resolved on {resolvedAt}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-gray-900 mb-0.5">
                    {item.title?.en || item.title || 'Civic Issue'}
                  </h3>
                  {item.title?.hi && (
                    <p className="text-xs text-gray-500 mb-2">{item.title.hi}</p>
                  )}

                  {/* Location Banner */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100 mb-4">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="truncate">
                      {[
                        item.address?.road,
                        item.address?.areaName || item.address?.suburb,
                        item.address?.city,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'Local Ward'}
                    </span>
                  </div>

                  {/* Before vs After Photos */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block mb-1">
                        Reported (Before)
                      </span>
                      <div className="aspect-4/3 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 relative">
                        {beforeUrl ? (
                          <img
                            src={beforeUrl}
                            alt="Original Defect"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                            No photo
                          </div>
                        )}
                        <span className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                          Before Fix
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 block mb-1">
                        Resolved (After)
                      </span>
                      <div className="aspect-4/3 rounded-2xl overflow-hidden bg-emerald-50 border border-emerald-200 relative">
                        {afterUrl ? (
                          <img
                            src={afterUrl}
                            alt="Resolution Evidence"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-emerald-600 text-xs font-semibold p-2 text-center">
                            <ShieldCheck className="w-5 h-5 mb-1" />
                            <span>Verified on Site</span>
                          </div>
                        )}
                        <span className="absolute bottom-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                          Fixed ✅
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Official Remarks */}
                  {item.resolutionProof?.officialRemark && (
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 mb-4 text-xs text-emerald-900">
                      <span className="font-extrabold block text-emerald-800 text-[11px] mb-0.5">
                        Official Action Taken:
                      </span>
                      <p className="leading-relaxed">{item.resolutionProof.officialRemark}</p>
                    </div>
                  )}
                </div>

                {/* Footer Action: On-Demand Map */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    {item.reportCount > 1
                      ? `${item.reportCount} citizens reported`
                      : 'Verified by Field Crew'}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedMapComplaint(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>View on Map</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* On-Demand Map Modal */}
      {selectedMapComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 truncate max-w-sm">
                    {selectedMapComplaint.title?.en || selectedMapComplaint.title}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {[
                      selectedMapComplaint.address?.road,
                      selectedMapComplaint.address?.areaName,
                      selectedMapComplaint.address?.city,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMapComplaint(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Map */}
            <div className="h-96 w-full relative">
              <ModalMap complaint={selectedMapComplaint} />
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-gray-200 bg-white flex items-center justify-between text-xs text-gray-500">
              <span className="font-mono">
                GPS: {selectedMapComplaint.location?.coordinates?.[1]?.toFixed(5) || 'N/A'},{' '}
                {selectedMapComplaint.location?.coordinates?.[0]?.toFixed(5) || 'N/A'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedMapComplaint(null)}
                className="px-4 py-1.5 rounded-xl font-bold bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResolvedIssues;
