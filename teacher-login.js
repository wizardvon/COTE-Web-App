import { auth, db } from './firebase.js';
import {
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const form = document.getElementById('teacherLoginForm');
const statusEl = document.getElementById('teacherLoginStatus');

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const ok = await verifyTeacherRole(user.uid);
  if (ok) {
    window.location.href = 'admin.html';
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusEl.textContent = '';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    statusEl.textContent = 'Please enter your email and password.';
    return;
  }

  try {
    await setPersistence(auth, browserLocalPersistence);
    const creds = await signInWithEmailAndPassword(auth, email, password);

    const ok = await verifyTeacherRole(creds.user.uid);
    if (!ok) {
      await signOut(auth);
      alert('Access denied. Your account is not registered as a teacher in users collection.');
      statusEl.textContent = 'Teacher role check failed.';
      return;
    }

    window.location.href = 'admin.html';
  } catch (error) {
    console.error(error);
    statusEl.textContent = `Login failed: ${error.message}`;
  }
});

async function verifyTeacherRole(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return false;

    const role = userDoc.data()?.role;
    return role === 'teacher';
  } catch (error) {
    console.error(error);
    return false;
  }
}
