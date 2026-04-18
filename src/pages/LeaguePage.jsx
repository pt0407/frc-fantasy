import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLeague, startDraft, updateLeagueScores, setOwnerDraftOrder, leaveLeague, updateLeagueSettings } from '../lib/firestore';
import { getEventMatches, getEventAwards, computeFantasyScore } from '../lib/tba';
import { Trophy, Users, Copy, Check, Zap, ChevronRight, RefreshCw, ArrowUp, ArrowDown, LogOut, Settings } from 'lucide-react';

export default function LeaguePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [ownerOrder, setOwnerOrder] = useState([]);
  const [editingLimit, setEditingLimit] = useState(false);
  const [newLimit, setNewLimit] = useState('');
  const [showEditSettings, setShowEditSettings] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const syncScores = useCallback(async (leagueData) => {
    if (!leagueData?.eventKey || !leagueData?.draftComplete) return;
    const rosters = leagueData.rosters || {};
    if (Object.keys(rosters).length === 0) return;
    try {
      const [matches, awards] = await Promise.all([
        getEventMatches(leagueData.eventKey),
        getEventAwards(leagueData.eventKey).catch(() => []),
      ]);
      const allCompleted = matches.filter((m) => {
        const rs = m.alliances?.red?.score ?? -1;
        const bs = m.alliances?.blue?.score ?? -1;
        return rs >= 0 && bs >= 0;
      });
      const newScores = {};
      for (const [uid, teamKeys] of Object.entries(rosters)) {
        const joinedSecs = leagueData.memberJoinedAt?.[uid]?.seconds
          ?? leagueData.createdAt?.seconds
          ?? null;
        const eligible = joinedSecs === null ? allCompleted : allCompleted.filter((m) => {
          const matchTime = m.actual_time || m.post_result_time || null;
          return matchTime !== null && matchTime >= joinedSecs;
        });
        let total = 0;
        for (const teamKey of teamKeys) {
          total += computeFantasyScore(teamKey, eligible, awards);
        }
        newScores[uid] = total;
      }
      await updateLeagueScores(leagueData.id, newScores);
      setLastSync(new Date());
      const updated = await getLeague(leagueData.id);
      setLeague(updated);
    } catch (e) {
      console.error('Score sync failed:', e);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const l = await getLeague(id);
      setLeague(l);
      setLoading(false);
      if (l?.draftComplete && l?.eventKey) syncScores(l);
    }
    init();
    const pollInterval = setInterval(() => getLeague(id).then(setLeague), 5000);
    const syncInterval = setInterval(async () => {
      const l = await getLeague(id);
      if (l?.draftComplete && l?.eventKey) syncScores(l);
    }, 5 * 60 * 1000);
    return () => { clearInterval(pollInterval); clearInterval(syncInterval); };
  }, [id, syncScores]);

  async function handleManualSync() {
    if (!league || syncing) return;
    setSyncing(true);
    await syncScores(league);
    setSyncing(false);
  }

  async function handleLeave() {
    if (!league) return;
    const msg = league.draftStarted
      ? 'The draft has already started. Leaving will abandon your roster. Are you sure?'
      : league.ownerUid === user?.uid && league.members.length > 1
      ? 'You are the owner. Leaving will transfer ownership to the next member. Continue?'
      : 'Leave this league? This cannot be undone.';
    const confirm = window.confirm(msg);
    if (!confirm) return;
    try {
      const { deleted } = await leaveLeague(id, user.uid);
      navigate('/leagues');
    } catch (e) {
      alert(e.message);
    }
  }

  function openEditSettings() {
    setEditForm({
      name: league.name,
      description: league.description || '',
      rosterSize: league.rosterSize || 8,
      maxMembers: league.maxMembers || 20,
      draftType: league.draftType || 'snake',
      draftOrderType: league.draftOrderType || 'random',
      autodraft: league.autodraft || 'skip',
      draftMode: league.draftMode || 'live',
      slowDraftHours: league.slowDraftHours || 24,
      draftVisibility: league.draftVisibility || 'public',
      auctionBudget: league.auctionBudget || 200,
      draftTimerSecs: league.draftTimerSecs ?? 60,
      openJoin: league.openJoin || false,
      uniqueTeams: league.uniqueTeams !== false,
    });
    setShowEditSettings(true);
  }

  async function handleSaveSettings() {
    if (!editForm) return;
    setSavingSettings(true);
    try {
      await updateLeagueSettings(id, editForm);
      const updated = await getLeague(id);
      setLeague(updated);
      setShowEditSettings(false);
    } catch (e) { alert(e.message); }
    finally { setSavingSettings(false); }
  }

  async function handleSaveLimit() {
    const val = parseInt(newLimit);
    if (!val || val < league.members.length) {
      alert(`Must be at least ${league.members.length} (current member count).`);
      return;
    }
    try {
      await updateLeagueSettings(id, { maxMembers: val });
      const updated = await getLeague(id);
      setLeague(updated);
      setEditingLimit(false);
    } catch (e) { alert(e.message); }
  }

  function copyCode() {
    navigator.clipboard.writeText(league.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    if (league && league.draftOrderType === 'owner_set' && ownerOrder.length === 0) {
      setOwnerOrder(league.pendingDraftOrder?.length ? league.pendingDraftOrder : [...league.members]);
    }
  }, [league]);

  function moveOrder(idx, dir) {
    const next = [...ownerOrder];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setOwnerOrder(next);
    setOwnerDraftOrder(id, next);
  }

  async function handleStartDraft() {
    if (!league) return;
    setStarting(true);
    let order;
    if (league.draftType === 'free_pick' || league.draftType === 'auction') {
      order = [...league.members];
    } else if (league.draftOrderType === 'random') {
      order = [...league.members].sort(() => Math.random() - 0.5);
    } else if (league.draftOrderType === 'join_order') {
      order = [...league.members];
    } else {
      order = ownerOrder.length ? ownerOrder : [...league.members];
    }
    try {
      await startDraft(id, order, league);
      navigate(`/leagues/${id}/draft`);
    } catch (e) {
      alert(e.message);
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  if (!league) return <div className="text-center text-slate-400 py-20">League not found.</div>;

  const isOwner = league.ownerUid === user?.uid;
  const sorted = Object.entries(league.scores || {})
    .map(([uid, score]) => ({ uid, score, name: league.memberNames?.[uid] || uid }))
    .sort((a, b) => b.score - a.score);

  const myRoster = league.rosters?.[user?.uid] || [];

  return (
    <>
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white">{league.name}</h1>
              {isOwner && <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">Owner</span>}
            </div>
            {league.description && <p className="text-slate-400 text-sm">{league.description}</p>}
            <div className="flex items-center gap-2 mt-1">
              <p className="text-slate-500 text-sm">
                {league.members.length}/
                {editingLimit ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      type="number"
                      value={newLimit}
                      onChange={(e) => setNewLimit(e.target.value)}
                      className="w-14 bg-[#0f1117] border border-blue-500 rounded-lg px-2 py-0.5 text-white text-sm focus:outline-none"
                      autoFocus
                      min={league.members.length}
                    />
                    <button onClick={handleSaveLimit} className="text-xs text-green-400 hover:text-green-300 font-medium">Save</button>
                    <button onClick={() => setEditingLimit(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
                  </span>
                ) : (
                  <span>
                    {league.maxMembers || 100}
                    {isOwner && (
                      <button onClick={() => { setNewLimit(String(league.maxMembers || 100)); setEditingLimit(true); }} className="ml-1.5 text-xs text-slate-600 hover:text-blue-400 transition-colors">[edit]</button>
                    )}
                  </span>
                )}
                {' '}members · {league.eventName || 'No event linked'} · Roster: {league.rosterSize} teams
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[league.draftType, league.draftMode, league.draftVisibility].filter(Boolean).map((tag) => (
                <span key={tag} className="text-xs bg-[#0f1117] border border-[#2a2d3a] text-slate-400 px-2 py-0.5 rounded-full capitalize">{tag.replace('_',' ')}</span>
              ))}
              {league.openJoin && (
                <span className="text-xs bg-green-600/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Open Join</span>
              )}
            </div>
            {lastSync && <p className="text-slate-600 text-xs mt-1">Scores last synced: {lastSync.toLocaleTimeString()}</p>}
          </div>

          <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
            {league.draftComplete && league.eventKey && (
              <button
                onClick={handleManualSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-green-600/20 border border-green-500/30 hover:border-green-500/60 text-green-400 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Scores'}
              </button>
            )}
            <button
              onClick={copyCode}
              className="flex items-center gap-2 px-4 py-2 bg-[#0f1117] border border-[#2a2d3a] hover:border-slate-500 text-slate-300 rounded-xl text-sm font-medium transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {league.inviteCode}
            </button>
            <button
              onClick={handleLeave}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/10 border border-red-500/20 hover:border-red-500/50 text-red-400 rounded-xl text-sm font-medium transition-all"
            >
              <LogOut className="w-4 h-4" /> Leave
            </button>

            {isOwner && !league.draftStarted && (
              <button
                onClick={openEditSettings}
                className="flex items-center gap-2 px-4 py-2 bg-[#0f1117] border border-[#2a2d3a] hover:border-slate-500 text-slate-300 rounded-xl text-sm font-medium transition-all"
              >
                <Settings className="w-4 h-4" /> Edit Settings
              </button>
            )}
            {isOwner && !league.draftStarted && (
              <button
                onClick={handleStartDraft}
                disabled={starting || league.members.length < 2}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                {starting ? 'Starting...' : 'Start Draft'}
              </button>
            )}

            {league.draftStarted && !league.draftComplete && (
              <Link
                to={`/leagues/${id}/draft`}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-all"
              >
                <Zap className="w-4 h-4" /> Go to Draft
              </Link>
            )}
          </div>
        </div>
      </div>

      {isOwner && league.draftOrderType === 'owner_set' && !league.draftStarted && ownerOrder.length > 0 && (
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-1">Set Draft Order</h2>
          <p className="text-slate-400 text-xs mb-4">Drag with arrows to set who picks first.</p>
          <div className="space-y-2">
            {ownerOrder.map((uid, idx) => (
              <div key={uid} className="flex items-center gap-3 bg-[#0f1117] rounded-xl px-4 py-2.5">
                <span className="text-slate-500 text-sm w-5">{idx + 1}</span>
                <span className="text-white text-sm flex-1">{league.memberNames?.[uid] || uid}{uid === user?.uid ? ' (you)' : ''}</span>
                <div className="flex gap-1">
                  <button onClick={() => moveOrder(idx, -1)} disabled={idx === 0} className="p-1 text-slate-500 hover:text-white disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => moveOrder(idx, 1)} disabled={idx === ownerOrder.length - 1} className="p-1 text-slate-500 hover:text-white disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-5">
        <details>
          <summary className="text-white font-semibold text-sm cursor-pointer select-none flex items-center gap-2">
            <span>📊 How Points Are Calculated</span>
          </summary>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-400">
            <div>
              <p className="text-slate-300 font-semibold mb-2 uppercase tracking-wider text-[10px]">Per Match</p>
              <ul className="space-y-1">
                <li>• Alliance score ÷ 10 <span className="text-slate-500">(rounded down)</span></li>
                <li>• Win bonus: <span className="text-green-400 font-medium">+5 pts</span></li>
                <li>• Each ranking point: <span className="text-blue-400 font-medium">+3 pts</span></li>
                <li>• Auto points ÷ 5 bonus</li>
              </ul>
            </div>
            <div>
              <p className="text-slate-300 font-semibold mb-2 uppercase tracking-wider text-[10px]">Awards</p>
              <ul className="space-y-1">
                <li>• FIRST Impact Award: <span className="text-yellow-400 font-medium">+50 pts</span></li>
                <li>• Event Winner: <span className="text-yellow-400 font-medium">+40 pts</span></li>
                <li>• Engineering Inspiration: <span className="text-blue-400 font-medium">+30 pts</span></li>
                <li>• Event Finalist: <span className="text-slate-300 font-medium">+25 pts</span></li>
                <li>• Rookie All-Star: <span className="text-slate-300 font-medium">+20 pts</span></li>
                <li>• Gracious Professionalism: <span className="text-slate-300 font-medium">+15 pts</span></li>
                <li>• Other awards: <span className="text-slate-300 font-medium">+10 pts</span></li>
              </ul>
              <p className="text-slate-600 mt-2 text-[10px]">Awards may not appear until TBA posts them after the event.</p>
            </div>
          </div>
        </details>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-semibold text-lg">Leaderboard</h2>
          </div>
          <div className="space-y-2">
            {sorted.map(({ uid, score, name }, idx) => (
              <div
                key={uid}
                className={`flex items-center gap-3 p-3 rounded-xl ${uid === user?.uid ? 'bg-blue-600/10 border border-blue-500/20' : 'bg-[#0f1117]'}`}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  idx === 0 ? 'bg-yellow-500 text-black' : idx === 1 ? 'bg-slate-400 text-black' : idx === 2 ? 'bg-orange-600 text-white' : 'bg-[#2a2d3a] text-slate-400'
                }`}>
                  {idx + 1}
                </span>
                <span className="text-white text-sm font-medium flex-1 truncate">{name}{uid === user?.uid ? ' (you)' : ''}</span>
                <span className="text-yellow-400 font-bold text-sm">{score} pts</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              <h2 className="text-white font-semibold text-lg">My Roster</h2>
            </div>
            {league.draftStarted && !league.draftComplete && (
              <Link to={`/leagues/${id}/draft`} className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
                Draft room <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          {myRoster.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">
                {league.draftStarted ? 'Draft in progress \u2014 make your picks!' : "Draft hasn't started yet."}
              </p>
              {!league.draftStarted && isOwner && (
                <p className="text-slate-500 text-xs mt-2">Start the draft when all members have joined.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {myRoster.map((teamKey) => (
                <div key={teamKey} className="flex items-center justify-between p-3 bg-[#0f1117] rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <span className="text-blue-400 text-xs font-bold">FRC</span>
                    </div>
                    <span className="text-white text-sm font-medium">{teamKey.replace('frc', 'Team ')}</span>
                  </div>
                  <span className="text-slate-500 text-xs">0 pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-slate-400" />
          <h2 className="text-white font-semibold">Members</h2>
          <span className="text-slate-500 text-sm">({league.members.length})</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {league.members.map((uid) => (
            <span key={uid} className={`px-3 py-1.5 rounded-full text-sm ${uid === user?.uid ? 'bg-blue-600/20 text-blue-300 border border-blue-500/20' : 'bg-[#0f1117] text-slate-300 border border-[#2a2d3a]'}`}>
              {league.memberNames?.[uid] || uid}
              {uid === league.ownerUid ? ' 👑' : ''}
            </span>
          ))}
        </div>
      </div>
    </div>

    {showEditSettings && editForm && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-[#2a2d3a]">
            <h2 className="text-white font-semibold text-lg flex items-center gap-2"><Settings className="w-5 h-5" /> Edit League Settings</h2>
            <button onClick={() => setShowEditSettings(false)} className="text-slate-500 hover:text-white transition-colors text-xl leading-none">&times;</button>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">League Name</label>
              <input value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
              <input value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})} className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Teams per Roster</label>
                <select value={editForm.rosterSize} onChange={e=>setEditForm({...editForm,rosterSize:Number(e.target.value)})} className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500">
                  {[3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n} teams</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Max Members</label>
                <select value={editForm.maxMembers} onChange={e=>setEditForm({...editForm,maxMembers:Number(e.target.value)})} className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500">
                  {[2,4,6,8,10,15,20,30,50,100].map(n=><option key={n} value={n}>{n} people</option>)}
                </select>
              </div>
            </div>
            <div className="border-t border-[#2a2d3a] pt-3">
              <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Draft Settings</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Draft Type</label>
                <select value={editForm.draftType} onChange={e=>setEditForm({...editForm,draftType:e.target.value})} className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="snake">Snake Draft</option>
                  <option value="linear">Linear Draft</option>
                  <option value="free_pick">Free Pick</option>
                  <option value="auction">Auction (Sealed Bids)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Draft Order</label>
                <select value={editForm.draftOrderType} disabled={editForm.draftType==='free_pick'||editForm.draftType==='auction'} onChange={e=>setEditForm({...editForm,draftOrderType:e.target.value})} className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-40">
                  <option value="random">Random Shuffle</option>
                  <option value="join_order">Join Order</option>
                  <option value="owner_set">Owner Sets Order</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Draft Mode</label>
                <select value={editForm.draftMode} onChange={e=>setEditForm({...editForm,draftMode:e.target.value})} className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="live">Live (all online)</option>
                  <option value="slow">Slow Draft (async)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{editForm.draftMode==='slow'?'Hours per Pick':'Pick Timer'}</label>
                {editForm.draftMode==='slow'?(
                  <select value={editForm.slowDraftHours} onChange={e=>setEditForm({...editForm,slowDraftHours:Number(e.target.value)})} className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500">
                    {[2,4,8,12,24,48].map(h=><option key={h} value={h}>{h}h per pick</option>)}
                  </select>
                ):(
                  <select value={editForm.draftTimerSecs} onChange={e=>setEditForm({...editForm,draftTimerSecs:Number(e.target.value)})} className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500">
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
                <select value={editForm.autodraft} disabled={editForm.draftType==='free_pick'} onChange={e=>setEditForm({...editForm,autodraft:e.target.value})} className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-40">
                  <option value="skip">Skip pick</option>
                  <option value="auto_pick">Auto-pick next team</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Pick Visibility</label>
                <select value={editForm.draftVisibility} disabled={editForm.draftType==='auction'} onChange={e=>setEditForm({...editForm,draftVisibility:e.target.value})} className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-40">
                  <option value="public">Public (live)</option>
                  <option value="hidden">Hidden per round</option>
                </select>
              </div>
            </div>
            {editForm.draftType==='auction'&&(
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Auction Budget per Person</label>
                <select value={editForm.auctionBudget} onChange={e=>setEditForm({...editForm,auctionBudget:Number(e.target.value)})} className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500">
                  {[100,150,200,300,500].map(b=><option key={b} value={b}>{b} coins</option>)}
                </select>
              </div>
            )}
            {[
              {key:'uniqueTeams',label:'Unique Teams Only',desc:'Each team can only be picked by one person.'},
              {key:'openJoin',label:'Open Joining',desc:'Allow members to join after the draft starts.'},
            ].map(({key,label,desc})=>(
              <div key={key} onClick={()=>setEditForm({...editForm,[key]:!editForm[key]})} className="flex items-center justify-between bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 cursor-pointer select-none hover:border-slate-500 transition-all">
                <div><p className="text-white text-sm font-medium">{label}</p><p className="text-slate-500 text-xs mt-0.5">{desc}</p></div>
                <div className={`w-10 h-6 rounded-full flex-shrink-0 ml-4 flex items-center px-1 transition-all ${editForm[key]?'bg-blue-600':'bg-[#2a2d3a]'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${editForm[key]?'translate-x-4':'translate-x-0'}`} />
                </div>
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={()=>setShowEditSettings(false)} className="flex-1 py-3 bg-[#0f1117] border border-[#2a2d3a] text-slate-300 rounded-xl text-sm font-medium hover:border-slate-500 transition-all">Cancel</button>
              <button onClick={handleSaveSettings} disabled={savingSettings} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60">
                {savingSettings?'Saving...':'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
