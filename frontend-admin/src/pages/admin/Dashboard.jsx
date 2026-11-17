import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { civicApi } from '../../services/api';
import InspectorModal from '../../components/admin/InspectorModal';
import {
  Inbox,
  Clock,
  Wrench,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  ShieldAlert,
  MapPin,
  RefreshCw,
  Activity,
  Layers,
  ChevronRight,
  Building2,
  Briefcase,
  Users,
  Send,
  Upload,
  RotateCcw,
  UserCheck,
  Check,
  X,
  Loader2,
  Calendar,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const formatTitle = (title) => {
  if (!title) return 'Civic Grievance';
  if (typeof title === 'object') {
    return title.en || title.hi || 'Civic Grievance';
  }
  return String(title);
};

const getSeverityBadge = (severity) => {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
          <Flame className="w-2.5 h-2.5 text-red-600" />
          CRITICAL
        </span>
      );
    case 'HIGH':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
          HIGH
        </span>
      );
    case 'MEDIUM':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
          MEDIUM
        </span>
      );
    case 'LOW':
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          LOW
        </span>
      );
  }
};

const Dashboard = () => {
  const { userRole, isSuperAdmin, isManagingOfficer, isWardOfficer, isFieldOfficer, officerProfile, selectedWard } =
    useAuth();

  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Analytics State (for Super Admin)
  const [analytics, setAnalytics] = useState(null);

  // Workflow Queue State (for Managing, Ward, and Field Officers)
  const [queue, setQueue] = useState([]);
  const [queueTotal, setQueueTotal] = useState(0);

  // Master Lists for routing and assignment
  const [wards, setWards] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [staffOfficers, setStaffOfficers] = useState([]);

  // Inspector Modal State
  const [inspectorComplaint, setInspectorComplaint] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Managing Officer Forward Modal State
  const [forwardComplaint, setForwardComplaint] = useState(null);
  const [forwardWardId, setForwardWardId] = useState('');
  const [isForwarding, setIsForwarding] = useState(false);

  // Ward Officer Assign to Field Modal State
  const [assignComplaint, setAssignComplaint] = useState(null);
  const [assignDeptId, setAssignDeptId] = useState('');
  const [assignOfficerId, setAssignOfficerId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Ward Officer Reassign Modal State (Leave coverage)
  const [reassignComplaint, setReassignComplaint] = useState(null);
  const [newOfficerId, setNewOfficerId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  // Upward Return Modal State
  const [returnComplaint, setReturnComplaint] = useState(null);
  const [returnReason, setReturnReason] = useState('');
  const [isReturning, setIsReturning] = useState(false);

  // Field Officer Start Work Modal State
  const [startComplaint, setStartComplaint] = useState(null);
  const [startRemark, setStartRemark] = useState('');
  const [startPhotoFile, setStartPhotoFile] = useState(null);
  const [startPhotoPreview, setStartPhotoPreview] = useState(null);
  const [isStarting, setIsStarting] = useState(false);

  // Field Officer Resolve Work Modal State
  const [resolveComplaint, setResolveComplaint] = useState(null);
  const [resolveRemark, setResolveRemark] = useState('');
  const [resolvePhotoFile, setResolvePhotoFile] = useState(null);
  const [resolvePhotoPreview, setResolvePhotoPreview] = useState(null);
  const [isResolving, setIsResolving] = useState(false);

  // Show Toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  // Fetch Data based on active Role
  const loadData = async () => {
    setLoading(true);
    try {
      if (isSuperAdmin) {
        const [statsRes, analyticsRes, wardsRes, deptsRes] = await Promise.all([
          civicApi.getStats({ areaName: selectedWard }),
          civicApi.getSystemAnalytics(),
          civicApi.getWards(),
          civicApi.getDepartments(),
        ]);
        setAnalytics(analyticsRes);
        setWards(wardsRes.wards || []);
        setDepartments(deptsRes.departments || []);

        // Also fetch any 3-strike escalated or breached tickets for quick radar
        const queueRes = await civicApi.getWorkflowQueue({ isEscalated: 'true' });
        setQueue(queueRes.complaints || []);
        setQueueTotal(queueRes.total || 0);
      } else {
        // Operational Tiers (managing_officer, ward_officer, field_officer)
        const [queueRes, wardsRes, deptsRes, staffRes] = await Promise.all([
          civicApi.getWorkflowQueue(),
          civicApi.getWards(),
          civicApi.getDepartments(),
          civicApi.getStaff({ includeRevoked: 'false' }).catch(() => ({ officers: [] })),
        ]);
        setQueue(queueRes.complaints || []);
        setQueueTotal(queueRes.total || 0);
        setWards(wardsRes.wards || []);
        setDepartments(deptsRes.departments || []);
        setStaffOfficers(staffRes.officers || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedWard, userRole]);

  // Managing Officer Forward Action
  const handleForwardToWard = async (e) => {
    e.preventDefault();
    if (!forwardComplaint || !forwardWardId) return;
    setIsForwarding(true);
    try {
      const res = await civicApi.forwardToWard(forwardComplaint._id, forwardWardId);
      showToast(res.message || 'Complaint routed to ward successfully.');
      setForwardComplaint(null);
      setForwardWardId('');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Routing failed.');
    } finally {
      setIsForwarding(false);
    }
  };

  // Ward Officer Assign to Field Crew Action
  const handleAssignToField = async (e) => {
    e.preventDefault();
    if (!assignComplaint || !assignOfficerId || !assignDeptId) return;
    setIsAssigning(true);
    try {
      const res = await civicApi.assignToField(assignComplaint._id, {
        fieldOfficerId: assignOfficerId,
        departmentId: assignDeptId,
      });
      showToast(res.message || 'Task assigned to field officer successfully.');
      setAssignComplaint(null);
      setAssignOfficerId('');
      setAssignDeptId('');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Assignment failed.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Ward Officer Reassign Action
  const handleReassignOfficer = async (e) => {
    e.preventDefault();
    if (!reassignComplaint || !newOfficerId) return;
    setIsReassigning(true);
    try {
      const res = await civicApi.reassignOfficer(reassignComplaint._id, {
        newFieldOfficerId: newOfficerId,
        reason: reassignReason.trim() || 'Officer leave coverage reassignment',
      });
      showToast(res.message || 'Complaint successfully reassigned.');
      setReassignComplaint(null);
      setNewOfficerId('');
      setReassignReason('');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Reassignment failed.');
    } finally {
      setIsReassigning(false);
    }
  };

  // Upward Return Action
  const handleReturnUpward = async (e) => {
    e.preventDefault();
    if (!returnComplaint || !returnReason.trim()) return;
    setIsReturning(true);
    try {
      const res = await civicApi.returnUpward(returnComplaint._id, {
        reason: returnReason.trim(),
      });
      showToast(res.message || 'Ticket returned upward.');
      setReturnComplaint(null);
      setReturnReason('');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Upward return failed.');
    } finally {
      setIsReturning(false);
    }
  };

  // Field Officer Start Work Action
  const handleStartWork = async (e) => {
    e.preventDefault();
    if (!startComplaint) return;
    setIsStarting(true);
    try {
      const res = await civicApi.startWork(startComplaint._id, {
        proofImage: startPhotoFile,
        officialRemark: startRemark.trim(),
      });
      showToast(res.message || 'Work started on ticket.');
      setStartComplaint(null);
      setStartRemark('');
      setStartPhotoFile(null);
      setStartPhotoPreview(null);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Could not start work.');
    } finally {
      setIsStarting(false);
    }
  };

  // Field Officer Resolve Work Action
  const handleResolveWork = async (e) => {
    e.preventDefault();
    if (!resolveComplaint || !resolvePhotoFile) {
      showToast('Mandatory resolution proof photo is required.');
      return;
    }
    setIsResolving(true);
    try {
      const res = await civicApi.resolveWork(resolveComplaint._id, {
        proofImage: resolvePhotoFile,
        officialRemark: resolveRemark.trim(),
      });
      showToast(res.message || 'Ticket marked resolved and citizen notified.');
      setResolveComplaint(null);
      setResolveRemark('');
      setResolvePhotoFile(null);
      setResolvePhotoPreview(null);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Resolution failed.');
    } finally {
      setIsResolving(false);
    }
  };

  // Helper for SLA Remaining Badge
  const renderSlaBadge = (complaint) => {
    if (complaint.slaBreached) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          SLA Breached
        </span>
      );
    }

    let deadline = null;
    let label = '';
    if (complaint.status === 'Submitted') {
      deadline = complaint.forwardDeadline;
      label = 'Forward SLA';
    } else if (complaint.status === 'Assigned to Ward') {
      deadline = complaint.assignDeadline;
      label = 'Dispatch SLA';
    } else if (['Assigned', 'In Progress'].includes(complaint.status)) {
      deadline = complaint.resolutionDeadline;
      label = 'Resolution SLA';
    }

    if (!deadline) return null;
    const diffHours = (new Date(deadline) - new Date()) / (1000 * 60 * 60);

    if (diffHours < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          Overdue
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
        <Clock className="w-3 h-3 text-indigo-500" />
        {label}: {diffHours.toFixed(1)}h left
      </span>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md animate-fade-in text-sm font-semibold border border-slate-700">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {isSuperAdmin
                ? 'City Executive Command Center'
                : isManagingOfficer
                ? 'Central Intake & Ward Router'
                : isWardOfficer
                ? 'Ward Dispatch & Field Allocation'
                : 'Ground Crew Field Tasks'}
            </h1>
            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono px-2 py-0.5 rounded-md font-bold">
              LIVE HIERARCHY
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isSuperAdmin
              ? 'Citywide grievance velocity, SLA compliance radar, and 3-strike escalation oversight.'
              : isManagingOfficer
              ? 'Central intake queue. Inspect citizen map pin coordinates and route complaints to official Master Wards.'
              : isWardOfficer
              ? `Supervise ward grievances, dispatch field officers, and handle 1-click leave reassignment.`
              : 'Execute on-ground task resolutions, capture work evidence, and verify municipal repairs.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: SUPER ADMIN EXECUTIVE RADAR
         ========================================================================= */}
      {isSuperAdmin && (
        <div className="space-y-6">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                Total Grievances
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {analytics?.totalComplaints ?? 0}
              </span>
              <span className="text-[10px] text-slate-500">All Master Wards</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-blue-500 block tracking-wider">
                Intake Pending
              </span>
              <span className="text-2xl font-black text-blue-700 mt-1 block">
                {analytics?.submittedCount ?? 0}
              </span>
              <span className="text-[10px] text-slate-500">Awaiting Ward Router</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-amber-500 block tracking-wider">
                Active Ground Work
              </span>
              <span className="text-2xl font-black text-amber-600 mt-1 block">
                {(analytics?.assignedCount || 0) + (analytics?.inProgressCount || 0)}
              </span>
              <span className="text-[10px] text-slate-500">Field Crew Dispatched</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-emerald-500 block tracking-wider">
                Resolved & Closed
              </span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">
                {(analytics?.resolvedCount || 0) + (analytics?.closedCount || 0)}
              </span>
              <span className="text-[10px] text-slate-500">Proof Verified</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-rose-500 block tracking-wider">
                SLA Breaches
              </span>
              <span className="text-2xl font-black text-rose-700 mt-1 block">
                {analytics?.slaBreachCount ?? 0}
              </span>
              <span className="text-[10px] text-rose-500 font-semibold">Immediate Action</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-purple-500 block tracking-wider">
                Avg Resolution
              </span>
              <span className="text-2xl font-black text-purple-700 mt-1 block">
                {analytics?.avgResolutionHours ?? 0}h
              </span>
              <span className="text-[10px] text-slate-500">City Turnaround</span>
            </div>
          </div>

          {/* 3-Strike Escalation Radar Banner */}
          {analytics?.escalatedCount > 0 && (
            <div className="bg-rose-50 border border-rose-300 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert className="w-6 h-6 text-rose-600 flex-shrink-0" />
                <div>
                  <h3 className="text-base font-extrabold text-rose-900">
                    High-Priority Escalation Alert: {analytics.escalatedCount} Grievance(s) Exceeded 3 Returns
                  </h3>
                  <p className="text-xs text-rose-700 mt-0.5">
                    These tickets have been returned upward 3 or more times across the hierarchy and require immediate
                    intervention by the Municipal Head.
                  </p>
                </div>
              </div>

              {/* Escalated Queue Table */}
              <div className="mt-4 bg-white rounded-xl border border-rose-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-rose-100/60 text-rose-900 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2.5">Ticket</th>
                      <th className="px-3 py-2.5">Ward</th>
                      <th className="px-3 py-2.5">Return Count</th>
                      <th className="px-3 py-2.5">Last Reason</th>
                      <th className="px-3 py-2.5 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100">
                    {queue.map((t) => (
                      <tr key={t._id} className="hover:bg-rose-50/50">
                        <td className="px-3 py-2 font-bold text-slate-900">{formatTitle(t.title)}</td>
                        <td className="px-3 py-2 text-slate-600">{t.wardId?.name || 'Unassigned'}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-200 text-rose-900">
                            {t.returnCount} Returns
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500 italic max-w-xs truncate">
                          "{t.returnedBy?.reason || 'Multiple failed dispatches'}"
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <Link
                              to={`/admin/map?locate=${t._id}`}
                              className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg inline-flex items-center gap-1 transition-colors"
                              title="Locate pin on Live GIS Map"
                            >
                              <MapPin className="w-3 h-3 text-indigo-600" />
                              <span>Map</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setInspectorComplaint(t);
                                setIsInspectorOpen(true);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg cursor-pointer"
                            >
                              Inspect AI Radar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Master Breakdown Grids */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ward Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">Master Ward Distribution</h3>
                </div>
                <Link
                  to="/admin/wards"
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                >
                  Manage Wards <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {analytics?.wardBreakdown?.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No ward-specific grievances logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {analytics?.wardBreakdown?.map((wb) => (
                    <div
                      key={wb._id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                    >
                      <span className="font-bold text-slate-800">
                        {wb.name} <span className="text-[10px] text-slate-400 font-normal">({wb.code})</span>
                      </span>
                      <span className="font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                        {wb.count} tickets
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Department Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">Department Velocity & SLA</h3>
                </div>
                <Link
                  to="/admin/departments"
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                >
                  Manage Departments <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {analytics?.deptBreakdown?.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No departmental tasks assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {analytics?.deptBreakdown?.map((db) => (
                    <div
                      key={db._id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                    >
                      <span className="font-bold text-slate-800">
                        {db.name} <span className="text-[10px] text-slate-400 font-normal">({db.code})</span>
                      </span>
                      <span className="font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        {db.count} tasks
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: MANAGING OFFICER CENTRAL INTAKE QUEUE
         ========================================================================= */}
      {isManagingOfficer && (
        <div className="space-y-6">
          {/* Quick Counter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                Intake Pending Routing
              </span>
              <span className="text-2xl font-black text-indigo-700 mt-1 block">{queueTotal}</span>
              <span className="text-[10px] text-slate-500">Requires Ward Determination</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-amber-500 block tracking-wider">
                Upward Returns from Wards
              </span>
              <span className="text-2xl font-black text-amber-600 mt-1 block">
                {queue.filter((q) => q.returnedBy?.role === 'ward_officer').length}
              </span>
              <span className="text-[10px] text-slate-500">Needs Ward Re-routing</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-emerald-500 block tracking-wider">
                Master Wards Available
              </span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">{wards.length}</span>
              <span className="text-[10px] text-slate-500">Configured in System</span>
            </div>
          </div>

          {/* Central Intake Queue List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Central Intake & Routing Queue</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {queue.length} ticket(s)
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                <p className="text-xs">Loading central intake queue...</p>
              </div>
            ) : queue.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Central Intake is 100% Clear!</p>
                <p className="text-xs text-slate-400 mt-1">All newly submitted complaints have been routed to wards.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {queue.map((item) => {
                  const isReturned = item.returnedBy?.role === 'ward_officer';
                  return (
                    <div key={item._id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        {/* Left: Thumbnail & Details */}
                        <div className="flex items-start gap-3.5 flex-1">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={formatTitle(item.title)}
                              className="w-16 h-16 rounded-xl object-cover border border-slate-200 flex-shrink-0 cursor-pointer hover:opacity-90"
                              onClick={() => {
                                setInspectorComplaint(item);
                                setIsInspectorOpen(true);
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                              <MapPin className="w-6 h-6" />
                            </div>
                          )}

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{formatTitle(item.title)}</span>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                {item.category}
                              </span>
                              {renderSlaBadge(item)}
                            </div>

                            <p className="text-xs text-slate-600 line-clamp-2">
                              {typeof item.description === 'object'
                                ? item.description?.en || item.description?.hi
                                : item.description || (item.title?.hi ? item.title.hi : formatTitle(item.title))}
                            </p>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                              <span className="flex items-center gap-1 font-medium">
                                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                {item.address?.areaName || item.address?.formattedAddress || 'Pin Location'}
                              </span>
                              {item.location?.coordinates && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  ({item.location.coordinates[1].toFixed(5)}, {item.location.coordinates[0].toFixed(5)})
                                </span>
                              )}
                              <span>• {new Date(item.createdAt).toLocaleString()}</span>
                            </div>

                            {/* Return Notice if returned upward */}
                            {isReturned && (
                              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                                <strong>Returned Upward by Ward Officer:</strong> "{item.returnedBy?.reason}"
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex flex-row md:flex-col items-center md:items-end gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setForwardComplaint(item);
                              setForwardWardId(item.wardId?._id || item.wardId || '');
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Forward to Ward
                          </button>

                          <div className="flex items-center gap-1.5">
                            <Link
                              to={`/admin/map?locate=${item._id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg transition-colors shadow-2xs"
                              title="Locate on Map"
                            >
                              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Locate</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setInspectorComplaint(item);
                                setIsInspectorOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Inspect
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: WARD OFFICER DISPATCH & LEAVE COVERAGE
         ========================================================================= */}
      {isWardOfficer && (
        <div className="space-y-6">
          {/* Ward Header Counters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                Awaiting Field Crew
              </span>
              <span className="text-2xl font-black text-indigo-700 mt-1 block">
                {queue.filter((q) => ['Assigned to Ward', 'Reopened'].includes(q.status)).length}
              </span>
              <span className="text-[10px] text-slate-500">Requires Field Dispatch</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-amber-500 block tracking-wider">
                Ground Work In Progress
              </span>
              <span className="text-2xl font-black text-amber-600 mt-1 block">
                {queue.filter((q) => ['Assigned', 'In Progress'].includes(q.status)).length}
              </span>
              <span className="text-[10px] text-slate-500">Under Execution</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-rose-500 block tracking-wider">
                Returned by Ground Crew
              </span>
              <span className="text-2xl font-black text-rose-700 mt-1 block">
                {queue.filter((q) => q.returnedBy?.role === 'field_officer').length}
              </span>
              <span className="text-[10px] text-rose-500 font-semibold">Needs Reassignment</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-blue-500 block tracking-wider">
                Crew on Leave
              </span>
              <span className="text-2xl font-black text-blue-700 mt-1 block">
                {staffOfficers.filter((o) => o.isOnLeave).length}
              </span>
              <span className="text-[10px] text-slate-500">Reassign Active Tasks</span>
            </div>
          </div>

          {/* Ward Queue */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Ward Task Dispatch Queue</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {queue.length} ticket(s)
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                <p className="text-xs">Loading ward tasks...</p>
              </div>
            ) : queue.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No pending tasks in this ward!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {queue.map((item) => {
                  const isCrewOnLeave = item.assignedFieldOfficerId?.isOnLeave;
                  const isReturnedFromField = item.returnedBy?.role === 'field_officer';

                  return (
                    <div key={item._id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex items-start gap-3.5 flex-1">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={formatTitle(item.title)}
                              className="w-16 h-16 rounded-xl object-cover border border-slate-200 flex-shrink-0 cursor-pointer"
                              onClick={() => {
                                setInspectorComplaint(item);
                                setIsInspectorOpen(true);
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                              <MapPin className="w-6 h-6" />
                            </div>
                          )}

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{formatTitle(item.title)}</span>
                              {getSeverityBadge(item.severity)}
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  item.status === 'Assigned to Ward'
                                    ? 'bg-blue-100 text-blue-800'
                                    : item.status === 'Reopened'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : item.status === 'In Progress'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                {item.status === 'Reopened' ? '⚠️ Reopened by Citizen' : item.status}
                              </span>
                              {renderSlaBadge(item)}
                            </div>

                            <p className="text-xs text-slate-600 line-clamp-2">
                              {typeof item.description === 'object'
                                ? item.description?.en || item.description?.hi
                                : item.description || (item.title?.hi ? item.title.hi : formatTitle(item.title))}
                            </p>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                              <span className="flex items-center gap-1 font-medium">
                                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                {item.address?.areaName || item.address?.formattedAddress || 'Ward Location'}
                              </span>
                              {item.departmentId && (
                                <span className="flex items-center gap-1 text-blue-700 font-semibold">
                                  <Briefcase className="w-3.5 h-3.5" />
                                  {item.departmentId.name}
                                </span>
                              )}
                              {item.assignedFieldOfficerId && (
                                <span className="flex items-center gap-1 text-slate-700 font-medium">
                                  <Users className="w-3.5 h-3.5" />
                                  Crew: {item.assignedFieldOfficerId.name}
                                </span>
                              )}
                            </div>

                            {/* Warning: Assigned Officer On Leave */}
                            {isCrewOnLeave && (
                              <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-center justify-between">
                                <span>
                                  <strong>Leave Alert:</strong> Assigned officer {item.assignedFieldOfficerId.name} is
                                  currently on leave.
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReassignComplaint(item);
                                    setNewOfficerId('');
                                  }}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-bold text-[10px] cursor-pointer"
                                >
                                  1-Click Reassign
                                </button>
                              </div>
                            )}

                            {/* Return Notice from Field */}
                            {isReturnedFromField && (
                              <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                                <strong>Returned by Field Officer:</strong> "{item.returnedBy?.reason}"
                              </div>
                            )}

                            {/* Citizen Reopened Alert */}
                            {item.status === 'Reopened' && (
                              <div className="mt-2 p-2 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800 flex items-start gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <strong>Citizen Reopened Complaint:</strong> "{item.reopenReason || 'Citizen requested reinspection.'}"
                                </div>
                              </div>
                            )}

                            {/* Recurrent Defect Alert */}
                            {item.isRecurrent && (
                              <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-800 flex items-start gap-1.5">
                                <RefreshCw className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <strong>Recurring Defect:</strong> This issue reoccurred at a previously closed site. Fresh municipal addressing required.
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-row md:flex-col items-center md:items-end gap-2 flex-shrink-0">
                          {/* If waiting for dispatch or reopened */}
                          {['Assigned to Ward', 'Reopened'].includes(item.status) && (
                            <button
                              type="button"
                              onClick={() => {
                                setAssignComplaint(item);
                                setAssignDeptId(item.departmentId?._id || item.departmentId || '');
                                setAssignOfficerId('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              {item.status === 'Reopened' ? 'Re-dispatch Field Crew' : 'Assign Field Crew'}
                            </button>
                          )}

                          {/* Reassign Button (if already assigned) */}
                          {['Assigned', 'In Progress'].includes(item.status) && (
                            <button
                              type="button"
                              onClick={() => {
                                setReassignComplaint(item);
                                setNewOfficerId('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Reassign Crew
                            </button>
                          )}

                          {/* Upward Return to Managing Officer & Locate on Map */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setInspectorComplaint(item);
                                setIsInspectorOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                              title="Adjust Complaint Priority / Severity or Review AI Inspection"
                            >
                              <Flame className="w-3.5 h-3.5 text-amber-600" />
                              <span>Priority / Inspect</span>
                            </button>
                            <Link
                              to={`/admin/map?locate=${item._id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg transition-colors shadow-2xs"
                              title="Locate on Map"
                            >
                              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Locate</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setReturnComplaint(item);
                                setReturnReason('');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                              Return Upward
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: FIELD OFFICER GROUND OPERATIONAL TASKS
         ========================================================================= */}
      {isFieldOfficer && (
        <div className="space-y-6">
          {/* Task Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                My Assigned Tasks
              </span>
              <span className="text-2xl font-black text-indigo-700 mt-1 block">{queueTotal}</span>
              <span className="text-[10px] text-slate-500">Active Ground Queue</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-amber-500 block tracking-wider">
                Work In Progress
              </span>
              <span className="text-2xl font-black text-amber-600 mt-1 block">
                {queue.filter((q) => q.status === 'In Progress').length}
              </span>
              <span className="text-[10px] text-slate-500">Under Repair</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-emerald-500 block tracking-wider">
                Awaiting Start
              </span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                {queue.filter((q) => q.status === 'Assigned').length}
              </span>
              <span className="text-[10px] text-slate-500">Ready to Initiate</span>
            </div>
          </div>

          {/* Ground Queue List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Assigned Operational Tasks</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {queue.length} task(s)
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                <p className="text-xs">Loading operational tasks...</p>
              </div>
            ) : queue.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No active tasks assigned!</p>
                <p className="text-xs text-slate-400 mt-1">Check back when the Ward Supervisor allocates new work.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {queue.map((item) => (
                  <div key={item._id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex items-start gap-3.5 flex-1">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={formatTitle(item.title)}
                            className="w-20 h-20 rounded-xl object-cover border border-slate-200 flex-shrink-0 cursor-pointer"
                            onClick={() => {
                              setInspectorComplaint(item);
                              setIsInspectorOpen(true);
                            }}
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                            <MapPin className="w-6 h-6" />
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{formatTitle(item.title)}</span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                item.status === 'In Progress'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {item.status}
                            </span>
                            {renderSlaBadge(item)}
                          </div>

                          <p className="text-xs text-slate-600 line-clamp-2">
                            {typeof item.description === 'object'
                              ? item.description?.en || item.description?.hi
                              : item.description || (item.title?.hi ? item.title.hi : formatTitle(item.title))}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                            <span className="flex items-center gap-1 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                              {item.address?.areaName || item.address?.formattedAddress || 'Location'}
                            </span>
                            {item.departmentId && (
                              <span className="font-semibold text-blue-700">
                                {item.departmentId.name} ({item.departmentId.slaHours}h SLA)
                              </span>
                            )}
                          </div>

                          {/* Work in progress remark if present */}
                          {item.workInProgress?.officialRemark && (
                            <p className="text-xs text-slate-500 italic bg-amber-50/70 p-2 rounded-lg border border-amber-200 mt-2">
                              Crew Note: "{item.workInProgress.officialRemark}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Execution Action Buttons */}
                      <div className="flex flex-row md:flex-col items-center md:items-end gap-2 flex-shrink-0">
                        {item.status === 'Assigned' && (
                          <button
                            type="button"
                            onClick={() => {
                              setStartComplaint(item);
                              setStartRemark('');
                              setStartPhotoFile(null);
                              setStartPhotoPreview(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            Start Work
                          </button>
                        )}

                        {item.status === 'In Progress' && (
                          <button
                            type="button"
                            onClick={() => {
                              setResolveComplaint(item);
                              setResolveRemark('');
                              setResolvePhotoFile(null);
                              setResolvePhotoPreview(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Resolve & Submit Proof
                          </button>
                        )}

                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/admin/map?locate=${item._id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg transition-colors shadow-2xs"
                            title="Locate pin on Live GIS Map"
                          >
                            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Locate</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setReturnComplaint(item);
                              setReturnReason('');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                            Cannot Complete / Return
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS & OVERLAYS
         ========================================================================= */}

      {/* 1. Forward to Ward Modal (Managing Officer) */}
      {forwardComplaint && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Route Complaint to Official Ward</h3>
              </div>
              <button
                type="button"
                onClick={() => setForwardComplaint(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleForwardToWard} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <p className="font-bold text-slate-800">{formatTitle(forwardComplaint.title)}</p>
                <p className="text-slate-500">
                  Citizen Pin Location:{' '}
                  <strong>{forwardComplaint.address?.areaName || forwardComplaint.address?.formattedAddress}</strong>
                </p>
                {forwardComplaint.location?.coordinates && (
                  <p className="font-mono text-[10px] text-slate-400">
                    GPS: [{forwardComplaint.location.coordinates[1]}, {forwardComplaint.location.coordinates[0]}]
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Master Ward *
                </label>
                <select
                  required
                  value={forwardWardId}
                  onChange={(e) => setForwardWardId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- Select Master Ward --</option>
                  {wards.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Human-in-the-loop: Verify the map pin against the municipal ward registry.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setForwardComplaint(null)}
                  disabled={isForwarding}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isForwarding || !forwardWardId}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isForwarding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Forward to Ward
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Assign to Field Crew Modal (Ward Officer) */}
      {assignComplaint && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Dispatch Task to Field Crew</h3>
              </div>
              <button
                type="button"
                onClick={() => setAssignComplaint(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignToField} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <p className="font-bold text-slate-800">{formatTitle(assignComplaint.title)}</p>
                <p className="text-slate-500">{assignComplaint.address?.areaName || 'Location'}</p>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Responsible Department *
                </label>
                <select
                  required
                  value={assignDeptId}
                  onChange={(e) => setAssignDeptId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- Select Department --</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} (SLA: {d.slaHours} hours)
                    </option>
                  ))}
                </select>
              </div>

              {/* Field Officer Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Field Officer *
                </label>
                <select
                  required
                  value={assignOfficerId}
                  onChange={(e) => setAssignOfficerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- Select Field Officer --</option>
                  {staffOfficers
                    .filter((o) => o.role === 'field_officer')
                    .map((fo) => (
                      <option key={fo._id} value={fo._id} disabled={fo.isOnLeave}>
                        {fo.name} {fo.isOnLeave ? '— (ON LEAVE)' : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignComplaint(null)}
                  disabled={isAssigning}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning || !assignDeptId || !assignOfficerId}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                  Dispatch Officer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Reassign Modal (Ward Officer Leave Coverage) */}
      {reassignComplaint && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Reassign Task to Available Crew</h3>
              </div>
              <button
                type="button"
                onClick={() => setReassignComplaint(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReassignOfficer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  New Field Officer *
                </label>
                <select
                  required
                  value={newOfficerId}
                  onChange={(e) => setNewOfficerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- Select Active Replacement Crew --</option>
                  {staffOfficers
                    .filter((o) => o.role === 'field_officer' && !o.isOnLeave && o._id !== reassignComplaint.assignedFieldOfficerId?._id)
                    .map((fo) => (
                      <option key={fo._id} value={fo._id}>
                        {fo.name} ({fo.departmentId?.name || 'Field'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reassignment Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Officer on medical leave, workload rebalancing"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReassignComplaint(null)}
                  disabled={isReassigning}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReassigning || !newOfficerId}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isReassigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Confirm Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Upward Return Modal (Ward & Field Officers) */}
      {returnComplaint && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Return Ticket Upward to {isFieldOfficer ? 'Ward Officer' : 'Managing Officer'}
              </h3>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Provide a clear justification. If this grievance is returned 3 times across the municipal hierarchy, it
              will automatically escalate to the Municipal Head / Super Admin.
            </p>

            <form onSubmit={handleReturnUpward} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mandatory Return Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Beyond ward boundary, requires heavy machinery, jurisdiction mismatch..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturnComplaint(null)}
                  disabled={isReturning}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReturning || !returnReason.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isReturning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Confirm Upward Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Field Officer Start Work Modal */}
      {startComplaint && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">Initiate Ground Repair</h3>
              </div>
              <button
                type="button"
                onClick={() => setStartComplaint(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartWork} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Official Crew Remark (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Crew arrived on site, commenced excavation"
                  value={startRemark}
                  onChange={(e) => setStartRemark(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  In-Progress Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setStartPhotoFile(f);
                      setStartPhotoPreview(URL.createObjectURL(f));
                    }
                  }}
                  className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-50 file:text-amber-800 hover:file:bg-amber-100"
                />
                {startPhotoPreview && (
                  <img
                    src={startPhotoPreview}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded-xl mt-2 border border-slate-200"
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStartComplaint(null)}
                  disabled={isStarting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isStarting}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {isStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
                  Mark In Progress
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Field Officer Resolve Work Modal (Mandatory Proof Photo) */}
      {resolveComplaint && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Submit Resolution Proof</h3>
              </div>
              <button
                type="button"
                onClick={() => setResolveComplaint(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolveWork} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Resolution Remark *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pothole filled with cold mix bitumen, road open for traffic"
                  value={resolveRemark}
                  onChange={(e) => setResolveRemark(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mandatory After-Fix Photo *
                </label>
                <input
                  type="file"
                  required
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setResolvePhotoFile(f);
                      setResolvePhotoPreview(URL.createObjectURL(f));
                    }
                  }}
                  className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Mandatory proof uploaded to Cloudinary. Enables Citizen Before vs After visual inspection.
                </p>
                {resolvePhotoPreview && (
                  <img
                    src={resolvePhotoPreview}
                    alt="Proof Preview"
                    className="w-full h-40 object-cover rounded-xl mt-2 border border-slate-200"
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolveComplaint(null)}
                  disabled={isResolving}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResolving || !resolvePhotoFile || !resolveRemark.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isResolving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Submit Proof & Resolve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Inspector Modal (Florence-2 & Photos) */}
      {inspectorComplaint && (
        <InspectorModal
          complaint={inspectorComplaint}
          isOpen={isInspectorOpen}
          onClose={() => {
            setIsInspectorOpen(false);
            setInspectorComplaint(null);
          }}
          onStatusUpdated={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;