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
    betCoins: 1000,
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
    maxMembers: 100,
    rosterSize: leagueData.rosterSize || 8,
    eventKey: leagueData.eventKey || '',
    eventName: leagueData.eventName || '',
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

export async function startDraft(leagueId, memberOrder) {
  await updateDoc(doc(db, 'leagues', leagueId), {
    draftOrder: memberOrder,
    draftPick: 0,
    draftStarted: true,
    draftComplete: false,
    rosters: {},
  });
}

export async function makeDraftPick(leagueId, uid, teamKey, teamName) {
  const league = await getLeague(leagueId);
  if (!league) throw new Error('League not found');

  const currentPickerIdx = league.draftPick % league.draftOrder.length;
  const round = Math.floor(league.draftPick / league.draftOrder.length);
  const snakeIdx = round % 2 === 0 ? currentPickerIdx : (league.draftOrder.length - 1 - currentPickerIdx);
  const currentPicker = league.draftOrder[snakeIdx];

  if (currentPicker !== uid) throw new Error('Not your pick');

  const allPicked = Object.values(league.rosters || {}).flat();
  if (allPicked.includes(teamKey)) throw new Error('Team already drafted');

  const myRoster = league.rosters?.[uid] || [];
  const totalPicks = league.rosterSize * league.draftOrder.length;

  await updateDoc(doc(db, 'leagues', leagueId), {
    [`rosters.${uid}`]: arrayUnion(teamKey),
    draftPick: increment(1),
    draftComplete: league.draftPick + 1 >= totalPicks,
  });

  await addDoc(collection(db, 'leagues', leagueId, 'draftHistory'), {
    uid,
    teamKey,
    teamName,
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
