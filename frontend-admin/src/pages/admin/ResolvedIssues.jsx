import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  MapPin,
  Calendar,
  Clock,
  Search,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  Layers,
  X,
  FileText,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../context/AuthContext';
import { civicApi } from '../../services/api';

// Custom green marker pin for resolved issues
const resolvedPinIcon = L.divIcon({
  html: `
    <div style="transform: translate(-50%, -100%); cursor: pointer;">
      <svg width="34" height="46" viewBox="0 0 38 50" fill="none" style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));">
        <path d="M19 0C8.50659 0 0 8.50659 0 19C0 33.25 19 50 19 50C19 50 38 33.25 38 19C38 8.50659 29.4934 0 19 0Z" fill="#10B981"/>
        <circle cx="19" cy="19" r="8" fill="white"/>
      </svg>
    </div>
  `,
  className: 'civic-resolved-pin',
  iconSize: [34, 46],
  iconAnchor: [17, 46],
});

const ResolvedIssues = () => {
  const { isSuperAdmin, selectedWard, officerProfile } = useAuth();

  const [complaints, setComplaints] = useState([]);
  const [groupedByArea, setGroupedByArea] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAreaTab, setActiveAreaTab] = useState('All');
  const [selectedMapComplaint, setSelectedMapComplaint] = useState(null);

  // Load resolved complaints from live backend API
  const fetchResolved = async () => {
    setLoading(true);
    try {
      const params = {};
      if (!isSuperAdmin) {
        params.areaName = officerProfile?.assignedWard || selectedWard;
      } else if (activeAreaTab !== 'All') {
        params.areaName = activeAreaTab;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await civicApi.getResolvedComplaints(params);
      const list = res.complaints || [];
      setComplaints(list);
      setGroupedByArea(res.groupedByArea || {});
    } catch (err) {
      console.error('[ResolvedIssues] Error fetching archive:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResolved();
  }, [activeAreaTab, selectedWard]);

  // Unique area list for tabs
  const areaNames = Object.keys(groupedByArea);

  // Filter complaints based on activeAreaTab and searchQuery
  const displayedComplaints = complaints.filter((c) => {
    if (activeAreaTab !== 'All') {
      const cArea = c.address?.areaName || c.address?.suburb || c.address?.city || 'General Area';
      if (cArea.toLowerCase() !== activeAreaTab.toLowerCase()) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = (c.title?.en || c.title || '').toLowerCase();
      const road = (c.address?.road || '').toLowerCase();
      const area = (c.address?.areaName || '').toLowerCase();
      const remark = (c.resolutionProof?.officialRemark || '').toLowerCase();
      const id = (c._id || '').toLowerCase();
      return title.includes(q) || road.includes(q) || area.includes(q) || remark.includes(q) || id.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Title & Control Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Resolved Issues Archive
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Verified before & after photographic resolution proofs across municipal wards
              </p>
            </div>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, road, or remarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchResolved()}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <button
            type="button"
            onClick={fetchResolved}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Area-Wise Filter Tabs */}
      {isSuperAdmin && areaNames.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setActiveAreaTab('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeAreaTab === 'All'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Areas ({complaints.length})
          </button>
          {areaNames.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => setActiveAreaTab(area)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeAreaTab === area
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {area} ({groupedByArea[area]?.length || 0})
            </button>
          ))}
        </div>
      )}

      {/* Main Complaints List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading resolved archive records...</p>
        </div>
      ) : displayedComplaints.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">No Resolved Complaints Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            {searchQuery
              ? 'No resolved tickets matched your search query.'
              : 'There are currently no resolved complaints recorded in this jurisdiction.'}
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveAreaTab('All');
              }}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Clear Search Filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {displayedComplaints.map((complaint) => {
            const resolvedAt = complaint.resolutionProof?.resolvedAt
              ? new Date(complaint.resolutionProof.resolvedAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : new Date(complaint.updatedAt || Date.now()).toLocaleDateString('en-GB');

            const beforeImage = complaint.imageUrl || complaint.image;
            const afterImage = complaint.resolutionProof?.imageUrl;

            return (
              <div
                key={complaint._id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  {/* Top Badge & Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        #{String(complaint._id).substring(String(complaint._id).length - 6).toUpperCase()}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Resolved
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{resolvedAt}</span>
                    </div>
                  </div>

                  {/* Title & Location */}
                  <h3 className="text-sm font-bold text-slate-900 leading-snug mb-1">
                    {complaint.title?.en || complaint.title || 'Civic Issue'}
                  </h3>
                  {complaint.title?.hi && (
                    <p className="text-xs text-slate-500 mb-2">{complaint.title.hi}</p>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="truncate">
                      {[
                        complaint.address?.road,
                        complaint.address?.areaName || complaint.address?.suburb,
                        complaint.address?.city,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'Municipal Jurisdiction'}
                    </span>
                  </div>

                  {/* Before vs After Evidence Photos */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                        Original Issue (Before)
                      </span>
                      <div className="aspect-4/3 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative group">
                        {beforeImage ? (
                          <img
                            src={beforeImage}
                            alt="Original Defect"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-slate-400 text-xs font-medium">
                            No photo
                          </div>
                        )}
                        <span className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          Reported
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">
                        Resolution Proof (After)
                      </span>
                      <div className="aspect-4/3 rounded-xl overflow-hidden bg-emerald-50 border border-emerald-200 relative group">
                        {afterImage ? (
                          <img
                            src={afterImage}
                            alt="Resolution Evidence"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-emerald-600 text-xs font-medium p-2 text-center">
                            <ShieldCheck className="w-5 h-5 mb-1 text-emerald-500" />
                            <span>Verified on Site</span>
                          </div>
                        )}
                        <span className="absolute bottom-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          Fixed
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Official Remarks */}
                  {complaint.resolutionProof?.officialRemark && (
                    <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 mb-4 text-xs text-emerald-950 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-[11px] text-emerald-800">
                          Official Closing Remark:
                        </span>
                        <p className="mt-0.5 leading-relaxed">
                          {complaint.resolutionProof.officialRemark}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action: On-Demand Map Trigger */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {complaint.reportCount > 1
                      ? `${complaint.reportCount} citizens notified`
                      : 'Citizen notified via push'}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedMapComplaint(complaint)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                    <span>View on Map</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* On-Demand Geolocation Map Modal */}
      {selectedMapComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">
                    {selectedMapComplaint.title?.en || selectedMapComplaint.title || 'Resolved Issue Location'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
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
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Leaflet Map */}
            <div className="h-96 w-full relative">
              {(() => {
                const coords = selectedMapComplaint.location?.coordinates;
                const hasValidCoords = Array.isArray(coords) && coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);

                if (!hasValidCoords) {
                  return (
                    <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-slate-50 text-slate-500">
                      <MapPin className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-sm font-bold text-slate-700">Coordinates Not Recorded</p>
                      <p className="text-xs text-slate-400 mt-1">This grievance did not capture GPS location data.</p>
                    </div>
                  );
                }

                const lat = coords[1];
                const lng = coords[0];
                const modalTitle = typeof selectedMapComplaint.title === 'object' 
                  ? selectedMapComplaint.title?.en || selectedMapComplaint.title?.hi || 'Resolved Grievance'
                  : selectedMapComplaint.title || 'Resolved Grievance';

                return (
                  <MapContainer
                    center={[lat, lng]}
                    zoom={16}
                    scrollWheelZoom={true}
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[lat, lng]} icon={resolvedPinIcon}>
                      <Popup>
                        <div className="p-1 text-xs font-sans">
                          <p className="font-bold text-slate-900">{modalTitle}</p>
                          <p className="text-emerald-600 font-semibold mt-0.5">Status: Resolved ✅</p>
                          <p className="text-slate-500 mt-1 font-mono text-[10px]">
                            {lat.toFixed(5)}, {lng.toFixed(5)}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono">
                Coordinates: {selectedMapComplaint.location?.coordinates?.[1]?.toFixed(5) || 'N/A'},{' '}
                {selectedMapComplaint.location?.coordinates?.[0]?.toFixed(5) || 'N/A'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedMapComplaint(null)}
                className="px-4 py-1.5 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
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
