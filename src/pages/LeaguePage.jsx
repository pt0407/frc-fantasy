import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLeague, startDraft, updateLeagueScores } from '../lib/firestore';
import { getEventMatches, computeFantasyScore } from '../lib/tba';
import { Trophy, Users, Copy, Check, Zap, ChevronRight, RefreshCw } from 'lucide-react';

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

  const syncScores = useCallback(async (leagueData) => {
    if (!leagueData?.eventKey || !leagueData?.draftComplete) return;
    const rosters = leagueData.rosters || {};
    if (Object.keys(rosters).length === 0) return;
    try {
      const matches = await getEventMatches(leagueData.eventKey);
      const completed = matches.filter((m) => m.alliances?.red?.score > 0 || m.alliances?.blue?.score > 0);
      const newScores = {};
      for (const [uid, teamKeys] of Object.entries(rosters)) {
        let total = 0;
        for (const teamKey of teamKeys) {
          total += computeFantasyScore(teamKey, completed);
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

  function copyCode() {
    navigator.clipboard.writeText(league.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleStartDraft() {
    if (!league) return;
    setStarting(true);
    const shuffled = [...league.members].sort(() => Math.random() - 0.5);
    try {
      await startDraft(id, shuffled);
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white">{league.name}</h1>
              {isOwner && <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">Owner</span>}
            </div>
            {league.description && <p className="text-slate-400 text-sm">{league.description}</p>}
            <p className="text-slate-500 text-sm mt-1">{league.members.length}/{league.maxMembers || 100} members · {league.eventName || 'No event linked'} · Roster: {league.rosterSize} teams</p>
            {lastSync && <p className="text-slate-600 text-xs mt-0.5">Scores last synced: {lastSync.toLocaleTimeString()}</p>}
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
  );
}
