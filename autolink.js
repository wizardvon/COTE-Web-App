import { auth, db } from './firebase.js';
import {
  collectionGroup, query, where, getDocs, writeBatch, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export async function autoLinkStudentToClasses({ lrn, birthdate }) {
  const user = auth.currentUser;
  if (!user) return;
  const q = query(
    collectionGroup(db, 'roster'),
    where('lrn', '==', lrn),
    where('birthdate', '==', birthdate)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.forEach(d => {
    const data = d.data();
    if (data.linkedUid) return; // already linked
    const linkedAt = serverTimestamp();
    batch.set(d.ref, { linkedUid: user.uid, linkedAt }, { merge: true });
    const parts = d.ref.path.split('/');
    const schoolId = parts[1];
    const termId = parts[3];
    const classId = parts[5];
    const classRef = doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId);
    batch.set(doc(db, 'users', user.uid, 'enrollments', classId), {
      schoolId, termId, classId, lrn, birthdate, linkedAt
    }, { merge: true });
    batch.set(doc(classRef, 'enrollments', user.uid), {
      uid: user.uid, email: user.email, lrn, birthdate, linkedAt
    }, { merge: true });
  });
  await batch.commit();
}
