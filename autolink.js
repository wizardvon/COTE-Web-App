import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collectionGroup, query, where, getDocs, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtaaCxT9tYXPwX3Pvoh_5pJosdmI1KEkM",
  authDomain: "cote-web-app.firebaseapp.com",
  projectId: "cote-web-app",
  storageBucket: "cote-web-app.appspot.com",
  messagingSenderId: "763908867537",
  appId: "1:763908867537:web:8611fb58fdaca485be0cf0",
  measurementId: "G-ZHZDZDGKQX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export async function autoLinkStudentToClasses({ lrn, birthdate }) {
  const user = auth.currentUser;
  if (!user) return;
  const q = query(
    collectionGroup(db, 'roster'),
    where('lrn', '==', lrn),
    where('birthdate', '==', birthdate),
    where('linkedUid', '==', null)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  const linkedAt = Date.now();
  snap.forEach(d => {
    batch.set(d.ref, { linkedUid: user.uid }, { merge: true });
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
