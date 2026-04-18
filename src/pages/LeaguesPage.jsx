import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserLeagues, createLeague, joinLeague } from '../lib/firestore';
import { getAllEvents } from '../lib/tba';
import { Plus, LogIn, Users, Trophy, ChevronRight, X } from 'lucide-react';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function LeaguesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [events, setEvents] = useState([]);

  const [createForm, setCreateForm] = useState({
    name: '', description: '', rosterSize: 8, maxMembers: 20, eventKey: '', eventName: '',
    draftType: 'snake',
    draftOrderType: 'random',
    autodraft: 'skip',
    draftMode: 'live',
    slowDraftHours: 24,
    draftVisibility: 'public',
    auctionBudget: 200,
    draftTimerSecs: 60,
  });
  const [manualEventKey, setManualEventKey] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserLeagues(user.uid).then((l) => { setLeagues(l); setLoading(false); });
    getAllEvents().then(setEvents).catch(() => {});
  }, [user]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { id } = await createLeague(user.uid, user.displayName || user.email, createForm);
      navigate(`/leagues/${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const id = await joinLeague(joinCode.trim().toUpperCase(), user.uid, user.displayName || user.email);
      navigate(`/leagues/${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Leagues</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your fantasy leagues</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowJoin(true); setError(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1d27] border border-[#2a2d3a] hover:border-slate-500 text-slate-300 rounded-xl text-sm font-medium transition-all"
          >
            <LogIn className="w-4 h-4" /> Join
          </button>
          <button
            onClick={() => { setShowCreate(true); setError(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl animate-pulse" />)}
        </div>
      ) : leagues.length === 0 ? (
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-12 text-center">
          <Users className="w-14 h-14 text-slate-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold text-lg mb-2">No leagues yet</h3>
          <p className="text-slate-400 text-sm mb-6">Create a new league or join one with an invite code.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowJoin(true)} className="px-5 py-2.5 border border-[#2a2d3a] text-slate-300 rounded-xl text-sm font-medium hover:border-slate-500 transition-all">
              Join League
            </button>
            <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all">
              Create League
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {leagues.map((league) => {
            const myScore = league.scores?.[user.uid] ?? 0;
            const sorted = Object.entries(league.scores || {}).sort((a, b) => b[1] - a[1]);
            const myRank = sorted.findIndex(([uid]) => uid === user.uid) + 1;
            return (
              <Link
                key={league.id}
                to={`/leagues/${league.id}`}
                className="bg-[#1a1d27] border border-[#2a2d3a] hover:border-slate-600 rounded-2xl p-5 flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{league.name}</p>
                    <p className="text-slate-500 text-sm">
                      {league.members.length}/100 members · {league.eventName || 'No event'} · Roster: {league.rosterSize} teams
                    </p>
                    {league.ownerUid === user.uid && (
                      <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full mt-1 inline-block">Owner</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold">{myScore} pts</p>
                    <p className="text-slate-500 text-xs">Rank #{myRank}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Modal title="Create League" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3 max-h-[80vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">League Name *</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. FRC Legends 2026"
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Description (optional)</label>
              <input
                type="text"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="A short description"
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Teams per Roster</label>
                <select
                  value={createForm.rosterSize}
                  onChange={(e) => setCreateForm({ ...createForm, rosterSize: Number(e.target.value) })}
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>{n} teams</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Max Members</label>
                <select
                  value={createForm.maxMembers}
                  onChange={(e) => setCreateForm({ ...createForm, maxMembers: Number(e.target.value) })}
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  {[2, 4, 6, 8, 10, 15, 20, 30, 50, 100].map((n) => (
                    <option key={n} value={n}>{n} people</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t border-[#2a2d3a] pt-3">
              <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Draft Settings</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Draft Type</label>
                <select
                  value={createForm.draftType}
                  onChange={(e) => setCreateForm({ ...createForm, draftType: e.target.value })}
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="snake">Snake Draft</option>
                  <option value="linear">Linear Draft</option>
                  <option value="free_pick">Free Pick</option>
                  <option value="auction">Auction (Sealed Bids)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Draft Order</label>
                <select
                  value={createForm.draftOrderType}
                  disabled={createForm.draftType === 'free_pick' || createForm.draftType === 'auction'}
                  onChange={(e) => setCreateForm({ ...createForm, draftOrderType: e.target.value })}
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-40"
                >
                  <option value="random">Random Shuffle</option>
                  <option value="join_order">Join Order</option>
                  <option value="owner_set">Owner Sets Order</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Draft Mode</label>
                <select
                  value={createForm.draftMode}
                  onChange={(e) => setCreateForm({ ...createForm, draftMode: e.target.value })}
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="live">Live (all online)</option>
                  <option value="slow">Slow Draft (async)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  {createForm.draftMode === 'slow' ? 'Hours per Pick' : 'Pick Timer'}
                </label>
                {createForm.draftMode === 'slow' ? (
                  <select
                    value={createForm.slowDraftHours}
                    onChange={(e) => setCreateForm({ ...createForm, slowDraftHours: Number(e.target.value) })}
                    className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    {[2, 4, 8, 12, 24, 48].map((h) => <option key={h} value={h}>{h}h per pick</option>)}
                  </select>
                ) : (
                  <select
                    value={createForm.draftTimerSecs}
                    onChange={(e) => setCreateForm({ ...createForm, draftTimerSecs: Number(e.target.value) })}
                    className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value={0}>No timer</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={120}>2 minutes</option>
                    <option value={300}>5 minutes</option>
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">On Timer Expiry</label>
                <select
                  value={createForm.autodraft}
                  disabled={createForm.draftType === 'free_pick'}
                  onChange={(e) => setCreateForm({ ...createForm, autodraft: e.target.value })}
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-40"
                >
                  <option value="skip">Skip pick</option>
                  <option value="auto_pick">Auto-pick next team</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Pick Visibility</label>
                <select
                  value={createForm.draftVisibility}
                  disabled={createForm.draftType === 'auction'}
                  onChange={(e) => setCreateForm({ ...createForm, draftVisibility: e.target.value })}
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-40"
                >
                  <option value="public">Public (live)</option>
                  <option value="hidden">Hidden per round</option>
                </select>
              </div>
            </div>

            {createForm.draftType === 'auction' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Auction Budget per Person</label>
                <select
                  value={createForm.auctionBudget}
                  onChange={(e) => setCreateForm({ ...createForm, auctionBudget: Number(e.target.value) })}
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  {[100, 150, 200, 300, 500].map((b) => <option key={b} value={b}>{b} coins</option>)}
                </select>
              </div>
            )}

            {createForm.draftType === 'free_pick' && (
              <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl px-4 py-3">
                <p className="text-blue-300 text-xs">Free Pick: everyone picks their own roster anytime after draft starts. Teams are first-come-first-served — no duplicate picks across the league.</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Link to FRC Event</label>
              <input
                type="text"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                placeholder="Search by name or event key..."
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 mb-1.5"
              />
              <select
                value={createForm.eventKey}
                onChange={(e) => {
                  const ev = events.find((ev) => ev.key === e.target.value);
                  setCreateForm({ ...createForm, eventKey: e.target.value, eventName: ev?.name || '' });
                  setManualEventKey('');
                }}
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                size={4}
              >
                <option value="">— None —</option>
                {events
                  .filter((ev) => !eventSearch || ev.name.toLowerCase().includes(eventSearch.toLowerCase()) || ev.key.includes(eventSearch.toLowerCase()))
                  .map((ev) => (
                    <option key={ev.key} value={ev.key}>{ev.name} ({ev.start_date})</option>
                  ))}
              </select>
              <div className="mt-2">
                <p className="text-xs text-slate-500 mb-1">Or enter event key manually (e.g. <span className="text-slate-400">2026casj</span>)</p>
                <input
                  type="text"
                  value={manualEventKey}
                  onChange={(e) => {
                    const key = e.target.value.toLowerCase().trim();
                    setManualEventKey(key);
                    setCreateForm({ ...createForm, eventKey: key, eventName: key });
                  }}
                  placeholder="2026casj"
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              {createForm.eventKey && (
                <p className="text-green-400 text-xs mt-1.5">Selected: {createForm.eventKey}</p>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 mt-1"
            >
              {submitting ? 'Creating...' : 'Create League'}
            </button>
          </form>
        </Modal>
      )}

      {showJoin && (
        <Modal title="Join League" onClose={() => setShowJoin(false)}>
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Invite Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="e.g. ABC123"
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 uppercase tracking-widest"
                required
                maxLength={8}
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
            >
              {submitting ? 'Joining...' : 'Join League'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
