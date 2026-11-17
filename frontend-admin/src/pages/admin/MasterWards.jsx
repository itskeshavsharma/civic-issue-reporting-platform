import React, { useState, useEffect } from 'react';
import { civicApi } from '../../services/api';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';

const MasterWards = () => {
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWard, setEditingWard] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const loadWards = async () => {
    setLoading(true);
    try {
      const res = await civicApi.getWards({ includeInactive: false });
      setWards(res.wards || []);
    } catch (err) {
      console.error('Failed to load wards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWards();
  }, []);

  const openCreateModal = () => {
    setEditingWard(null);
    setName('');
    setCode('');
    setDescription('');
    setFeedback({ type: '', message: '' });
    setModalOpen(true);
  };

  const openEditModal = (ward) => {
    setEditingWard(ward);
    setName(ward.name);
    setCode(ward.code);
    setDescription(ward.description || '');
    setFeedback({ type: '', message: '' });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!name.trim() || !code.trim()) {
      setFeedback({ type: 'error', message: 'Ward name and code are required.' });
      return;
    }

    setSubmitting(true);
    try {
      if (editingWard) {
        await civicApi.updateWard(editingWard._id, {
          name: name.trim(),
          code: code.trim(),
          description: description.trim(),
        });
      } else {
        await civicApi.createWard({
          name: name.trim(),
          code: code.trim(),
          description: description.trim(),
        });
      }
      setModalOpen(false);
      await loadWards();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to save ward.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, wardName) => {
    if (!window.confirm(`Are you sure you want to deactivate ward "${wardName}"?`)) return;
    try {
      await civicApi.deleteWard(id);
      await loadWards();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to deactivate ward.');
    }
  };

  const filteredWards = wards.filter((w) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return w.name.toLowerCase().includes(q) || w.code.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 font-sans">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
              <MapPin className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Master Wards & Zones</h1>
              <p className="text-xs text-slate-500 font-medium">
                Configure jurisdictional municipal wards and administrative zones dynamically
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ward name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Ward</span>
          </button>
        </div>
      </div>

      {/* Wards Grid / Table */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Loading master wards...</p>
        </div>
      ) : filteredWards.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">No Wards Configured Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Create your municipality's first ward to begin routing grievances and assigning Ward Officers.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Create Ward
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredWards.map((w) => (
            <div
              key={w._id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {w.code}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">{w.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed min-h-[2rem]">
                  {w.description || 'No specific zone notes added.'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => openEditModal(w)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                  title="Edit Ward"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(w._id, w.name)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Deactivate Ward"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                {editingWard ? 'Edit Ward Details' : 'Register New Ward'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {feedback.message && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{feedback.message}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Ward / Zone Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ward 10 - Downtown Zone"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Unique Ward Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. W10 or DZ-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Zone Notes / Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Boundaries, landmarks, or jurisdiction details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingWard ? 'Save Changes' : 'Register Ward'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterWards;
