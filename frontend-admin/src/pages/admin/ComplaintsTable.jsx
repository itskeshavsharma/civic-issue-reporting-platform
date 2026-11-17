import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { civicApi } from '../../services/api';
import InspectorModal from '../../components/admin/InspectorModal';
import {
  Search,
  Filter,
  FileText,
  Clock,
  Wrench,
  CheckCircle2,
  MapPin,
  ExternalLink,
  Users,
  Calendar,
  RefreshCw,
  Eye,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Building2,
  RotateCcw,
} from 'lucide-react';

const ComplaintsTable = () => {
  const { selectedWard } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [hoveredImage, setHoveredImage] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await civicApi.getComplaints({
        ward: selectedWard,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        severity: severityFilter !== 'All' ? severityFilter : undefined,
        query: searchQuery.trim() || undefined,
        page,
        limit: 15,
      });
      setComplaints(res.data || []);
      setTotalCount(res.total ?? (res.data?.length || 0));
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Error fetching complaints table:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [selectedWard, statusFilter, severityFilter, searchQuery, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedWard, statusFilter, severityFilter, searchQuery]);

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const handleOpenInspector = (complaint) => {
    setSelectedComplaint(complaint);
    setIsInspectorOpen(true);
  };

  const handleStatusUpdated = (updated) => {
    setToastMessage(`Ticket ${updated._id} updated to "${updated.status}" successfully.`);
    fetchComplaints();
    setTimeout(() => setToastMessage(''), 4000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Submitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
            <Inbox className="w-3 h-3 text-sky-600" />
            Submitted
          </span>
        );
      case 'Assigned to Ward':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <Building2 className="w-3 h-3 text-purple-600" />
            Assigned to Ward
          </span>
        );
      case 'Assigned':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <Users className="w-3 h-3 text-indigo-600" />
            Assigned
          </span>
        );
      case 'In Progress':
      case 'Under Working':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-800 border border-orange-200">
            <Wrench className="w-3 h-3 text-orange-600" />
            {status}
          </span>
        );
      case 'Reopened':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <RotateCcw className="w-3 h-3 text-rose-600" />
            Reopened
          </span>
        );
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Resolved
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-red-50 text-red-700 border border-red-200">
            🔴 CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-orange-50 text-orange-700 border border-orange-200">
            🟠 HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
            🟡 MEDIUM
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            🟢 LOW
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 backdrop-blur-md animate-fade-in text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Grievance Management & Triage
            </h1>
            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono px-2 py-0.5 rounded-md font-bold">
              {totalCount} Total Tickets
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review citizen incident filings, inspect AI defect bounding boxes, and update ticket lifecycle proofs.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchComplaints}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-2xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search input (searches by Ticket ID, Road, or Citizen Email) */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Ticket ID, Road, or Area..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {['All', 'All Active', 'Submitted', 'Assigned to Ward', 'In Progress', 'Resolved'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Severity Filter: [All, Critical, High, Medium, Low] */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
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
              <option value="LOW">🟢 Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Complaints Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th scope="col" className="py-3.5 px-4">Ticket ID & Time</th>
                <th scope="col" className="py-3.5 px-3">Visual Evidence</th>
                <th scope="col" className="py-3.5 px-4">AI Classification</th>
                <th scope="col" className="py-3.5 px-4">Location</th>
                <th scope="col" className="py-3.5 px-3">Citizen Backing</th>
                <th scope="col" className="py-3.5 px-3">Severity</th>
                <th scope="col" className="py-3.5 px-3">Status</th>
                <th scope="col" className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                // Skeletons
                [...Array(6)].map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-4">
                      <div className="h-3.5 w-24 bg-slate-200 rounded mb-1.5" />
                      <div className="h-2.5 w-16 bg-slate-100 rounded" />
                    </td>
                    <td className="py-4 px-3">
                      <div className="w-14 h-14 bg-slate-200 rounded-xl" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-3.5 w-40 bg-slate-200 rounded mb-1.5" />
                      <div className="h-2.5 w-28 bg-slate-100 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-3 w-32 bg-slate-200 rounded mb-1" />
                      <div className="h-2.5 w-20 bg-slate-100 rounded" />
                    </td>
                    <td className="py-4 px-3">
                      <div className="h-5 w-12 bg-slate-200 rounded-full" />
                    </td>
                    <td className="py-4 px-3">
                      <div className="h-5 w-16 bg-slate-200 rounded-md" />
                    </td>
                    <td className="py-4 px-3">
                      <div className="h-5 w-20 bg-slate-200 rounded-full" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-7 w-28 bg-slate-200 rounded-xl inline-block" />
                    </td>
                  </tr>
                ))
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <FileText className="w-10 h-10 text-slate-300 mb-1" />
                      <span className="text-sm font-bold text-slate-800">No grievances found matching criteria.</span>
                      <span className="text-xs text-slate-400">
                        {searchQuery || statusFilter !== 'All' || severityFilter !== 'All'
                          ? 'Try modifying your search query or relaxing your filter selections.'
                          : 'No complaints have been reported yet in this jurisdiction.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                complaints.map((item) => {
                  const titleEn = typeof item.title === 'object' ? item.title?.en : item.title;
                  const titleHi = typeof item.title === 'object' ? item.title?.hi : '';
                  const road = item.address?.road || 'Main Road';
                  const area = item.address?.areaName || item.address?.suburb || 'Ward Jurisdiction';
                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      {/* 1. Ticket ID & Timestamp */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-600">
                            {item._id}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyId(item._id)}
                            title="Copy Ticket ID"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          >
                            {copiedId === item._id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 font-medium">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                          <span className="text-slate-400">🛡️</span>
                          <span>Citizen (Protected)</span>
                        </div>
                      </td>

                      {/* 2. Visual Evidence (Hoverable thumbnail) */}
                      <td className="py-4 px-3">
                        <div
                          className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex-shrink-0 cursor-pointer shadow-2xs group/thumb"
                          onMouseEnter={() => setHoveredImage({ url: item.imageUrl, title: titleEn })}
                          onMouseLeave={() => setHoveredImage(null)}
                          onClick={() => handleOpenInspector(item)}
                        >
                          <img
                            src={item.imageUrl}
                            alt="Evidence"
                            className="w-full h-full object-cover transition-transform group-hover/thumb:scale-110"
                          />
                          <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>
                      </td>

                      {/* 3. AI Classification (Title EN + HI) */}
                      <td className="py-4 px-4 max-w-xs">
                        <p className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1 leading-snug">
                          {titleEn || 'Reported Road Defect'}
                        </p>
                        {titleHi && (
                          <p className="text-[11px] text-indigo-700 font-semibold line-clamp-1 mt-0.5">
                            {titleHi}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-slate-500 font-mono font-medium">
                            Surface Damage: {item.areaCoveragePct || 16.8}%
                          </span>
                          {item.isRecurrent && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                              <RefreshCw className="w-2.5 h-2.5 text-amber-600" />
                              Recurring Defect
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Location (Area Name + Lat/Lng) */}
                      <td className="py-4 px-4 max-w-xs">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-slate-900 line-clamp-1">
                              {road}
                            </p>
                            <p className="text-[11px] text-slate-500 line-clamp-1 font-medium">
                              {area}
                            </p>
                            {item.location?.coordinates && (
                              <Link
                                to={`/admin/map?locate=${item._id}`}
                                className="text-[10px] font-mono text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 mt-0.5"
                                title="Locate pin on Live Map"
                              >
                                <span>{item.location.coordinates[1].toFixed(4)}, {item.location.coordinates[0].toFixed(4)}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 5. Citizen Backing (reportCount badge) */}
                      <td className="py-4 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              (item.reportCount || 1) >= 4
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <Users className="w-3 h-3 text-amber-600" />
                            {item.reportCount || 1}
                          </span>
                        </div>
                        {(item.reportCount || 1) >= 4 && (
                          <span className="text-[10px] text-red-600 font-bold block mt-0.5">
                            Auto-Escalated
                          </span>
                        )}
                      </td>

                      {/* 6. Severity Tag */}
                      <td className="py-4 px-3 whitespace-nowrap">
                        {getSeverityBadge(item.severity)}
                      </td>

                      {/* 7. Status Tag */}
                      <td className="py-4 px-3 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>

                      {/* 8. Action: "Locate on Map" & "Inspect & Update" buttons */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            to={`/admin/map?locate=${item._id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-2xs"
                            title="Locate on Map"
                          >
                            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Locate</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleOpenInspector(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Inspect & Update</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Hover Image Preview Card */}
      {hoveredImage && (
        <div className="fixed bottom-10 left-10 z-50 pointer-events-none bg-white border-2 border-indigo-500 rounded-xl overflow-hidden shadow-2xl max-w-xs animate-fade-in hidden md:block">
          <img
            src={hoveredImage.url}
            alt="Inspection Preview"
            className="w-72 h-48 object-cover"
          />
          <div className="p-2.5 bg-slate-900 text-white text-xs truncate font-semibold">
            {hoveredImage.title || 'Visual Evidence Zoom'}
          </div>
        </div>
      )}

      {/* Inspector Modal */}
      {isInspectorOpen && selectedComplaint && (
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

export default ComplaintsTable;
