import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';

export async function createUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), {
    uid,
    displayName: data.displayName || '',
    email: data.email || '',
    photoURL: data.photoURL || '',
    betCoins: 100,
    lastDailyClaim: null,
    createdAt: serverTimestamp(),
    ...data,
  }, { merge: true });
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function createLeague(ownerUid, ownerName, leagueData) {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const leagueRef = await addDoc(collection(db, 'leagues'), {
    name: leagueData.name,
    description: leagueData.description || '',
    ownerUid,
    ownerName,
    inviteCode: code,
    maxMembers: leagueData.maxMembers || 20,
    rosterSize: leagueData.rosterSize || 8,
    draftType: leagueData.draftType || 'snake',
    draftOrderType: leagueData.draftOrderType || 'random',
    autodraft: leagueData.autodraft || 'skip',
    draftMode: leagueData.draftMode || 'live',
    slowDraftHours: leagueData.slowDraftHours || 24,
    draftVisibility: leagueData.draftVisibility || 'public',
    auctionBudget: leagueData.auctionBudget || 200,
    draftTimerSecs: leagueData.draftTimerSecs ?? 60,
    eventKey: leagueData.eventKey || '',
    eventName: leagueData.eventName || '',
    auctionBudgets: {},
    auctionNomination: null,
    members: [ownerUid],
    memberNames: { [ownerUid]: ownerName },
    scores: { [ownerUid]: 0 },
    rosters: {},
    draftOrder: [],
    draftPick: 0,
    draftStarted: false,
    draftComplete: false,
    createdAt: serverTimestamp(),
  });
  return { id: leagueRef.id, code };
}

export async function joinLeague(code, uid, displayName) {
  const q = query(collection(db, 'leagues'), where('inviteCode', '==', code));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('League not found');
  const leagueDoc = snap.docs[0];
  const league = leagueDoc.data();
  if (league.members.includes(uid)) throw new Error('Already in league');
  if (league.members.length >= league.maxMembers) throw new Error('League is full');
  await updateDoc(leagueDoc.ref, {
    members: arrayUnion(uid),
    [`memberNames.${uid}`]: displayName,
    [`scores.${uid}`]: 0,
  });
  return leagueDoc.id;
}

export async function getLeague(leagueId) {
  const snap = await getDoc(doc(db, 'leagues', leagueId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getUserLeagues(uid) {
  const q = query(collection(db, 'leagues'), where('members', 'array-contains', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function startDraft(leagueId, memberOrder, league) {
  const auctionBudgets = {};
  if (league?.draftType === 'auction') {
    for (const uid of league.members) {
      auctionBudgets[uid] = league.auctionBudget || 200;
    }
  }
  await updateDoc(doc(db, 'leagues', leagueId), {
    draftOrder: memberOrder,
    draftPick: 0,
    draftStarted: true,
    draftComplete: false,
    rosters: {},
    auctionBudgets,
    auctionNomination: null,
  });
}

export async function setOwnerDraftOrder(leagueId, memberOrder) {
  await updateDoc(doc(db, 'leagues', leagueId), { pendingDraftOrder: memberOrder });
}

export async function nominateTeam(leagueId, uid, teamKey, teamName) {
  const league = await getLeague(leagueId);
  if (!league) throw new Error('League not found');
  if (league.auctionNomination) throw new Error('A team is already nominated');
  const allPicked = Object.values(league.rosters || {}).flat();
  if (allPicked.includes(teamKey)) throw new Error('Team already drafted');
  const bids = {};
  for (const m of league.members) bids[m] = null;
  await updateDoc(doc(db, 'leagues', leagueId), {
    auctionNomination: { teamKey, teamName, nominatedBy: uid, bids, revealed: false },
  });
}

export async function submitAuctionBid(leagueId, uid, amount) {
  const league = await getLeague(leagueId);
  if (!league?.auctionNomination) throw new Error('Nothing nominated');
  const budget = league.auctionBudgets?.[uid] ?? 0;
  if (amount > budget) throw new Error('Not enough budget');
  await updateDoc(doc(db, 'leagues', leagueId), {
    [`auctionNomination.bids.${uid}`]: amount,
  });
}

export async function revealAuctionBids(leagueId) {
  const league = await getLeague(leagueId);
  if (!league?.auctionNomination) throw new Error('Nothing to reveal');
  const nom = league.auctionNomination;
  const bids = nom.bids || {};
  let winner = null; let topBid = -1;
  for (const [uid, bid] of Object.entries(bids)) {
    if (bid !== null && bid > topBid) { topBid = bid; winner = uid; }
  }
  const updates = { 'auctionNomination.revealed': true, 'auctionNomination.winner': winner, 'auctionNomination.topBid': topBid };
  if (winner) {
    updates[`rosters.${winner}`] = arrayUnion(nom.teamKey);
    updates[`auctionBudgets.${winner}`] = increment(-topBid);
    const totalPicks = Object.values({ ...league.rosters, [winner]: [...(league.rosters?.[winner] || []), nom.teamKey] }).flat().length;
    const maxPicks = league.rosterSize * league.members.length;
    updates.draftComplete = totalPicks >= maxPicks;
  }
  await updateDoc(doc(db, 'leagues', leagueId), updates);
}

export async function clearAuctionNomination(leagueId) {
  await updateDoc(doc(db, 'leagues', leagueId), { auctionNomination: null });
}

export async function makeDraftPick(leagueId, uid, teamKey, teamName) {
  const league = await getLeague(leagueId);
  if (!league) throw new Error('League not found');

  const allPicked = Object.values(league.rosters || {}).flat();
  if (allPicked.includes(teamKey)) throw new Error('Team already drafted');

  const draftType = league.draftType || 'snake';

  if (draftType === 'free_pick') {
    const myRoster = league.rosters?.[uid] || [];
    if (myRoster.length >= league.rosterSize) throw new Error('Your roster is full');
    const allRosters = Object.values(league.rosters || {});
    const newTotal = allRosters.reduce((s, r) => s + r.length, 0) + 1;
    const maxPicks = league.rosterSize * league.members.length;
    await updateDoc(doc(db, 'leagues', leagueId), {
      [`rosters.${uid}`]: arrayUnion(teamKey),
      draftComplete: newTotal >= maxPicks,
    });
  } else {
    const n = league.draftOrder.length;
    const currentPickerIdx = league.draftPick % n;
    const round = Math.floor(league.draftPick / n);
    const idx = (draftType === 'snake' && round % 2 !== 0) ? (n - 1 - currentPickerIdx) : currentPickerIdx;
    const currentPicker = league.draftOrder[idx];
    if (currentPicker !== uid) throw new Error('Not your pick');
    const totalPicks = league.rosterSize * n;
    await updateDoc(doc(db, 'leagues', leagueId), {
      [`rosters.${uid}`]: arrayUnion(teamKey),
      draftPick: increment(1),
      draftComplete: league.draftPick + 1 >= totalPicks,
    });
  }

  await addDoc(collection(db, 'leagues', leagueId, 'draftHistory'), {
    uid, teamKey, teamName,
    pick: league.draftPick,
    timestamp: serverTimestamp(),
  });
}

export async function placeBet(uid, matchKey, alliance, amount, matchDescription) {
  const userRef = doc(db, 'users', uid);
  const user = await getUserProfile(uid);
  if (!user) throw new Error('User not found');
  if (user.betCoins < amount) throw new Error('Not enough coins');

  await addDoc(collection(db, 'bets'), {
    uid,
    matchKey,
    alliance,
    amount,
    matchDescription,
    status: 'pending',
    result: null,
    createdAt: serverTimestamp(),
  });

  await updateDoc(userRef, { betCoins: increment(-amount) });
}

export async function claimDailyCoins(uid) {
  const userRef = doc(db, 'users', uid);
  const user = await getUserProfile(uid);
  if (!user) throw new Error('User not found');
  const now = new Date();
  if (user.lastDailyClaim) {
    const last = user.lastDailyClaim.toDate ? user.lastDailyClaim.toDate() : new Date(user.lastDailyClaim);
    const diffHours = (now - last) / (1000 * 60 * 60);
    if (diffHours < 24) {
      const hoursLeft = Math.ceil(24 - diffHours);
      throw new Error(`Already claimed today. Come back in ${hoursLeft}h`);
    }
  }
  await updateDoc(userRef, {
    betCoins: increment(50),
    lastDailyClaim: serverTimestamp(),
  });
  return 50;
}

export async function getUserBets(uid) {
  const q = query(collection(db, 'bets'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateLeagueScores(leagueId, scores) {
  const updates = {};
  for (const [uid, score] of Object.entries(scores)) {
    updates[`scores.${uid}`] = score;
  }
  await updateDoc(doc(db, 'leagues', leagueId), updates);
}
