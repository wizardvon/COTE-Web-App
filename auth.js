import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export function setupNav() {
  const protectedIds = ['profile-link', 'cote-task-link', 'elms-link', 'transfer-link', 'teacher-link'];
  const loginLink = document.getElementById('login-link');
  const logoutLink = document.getElementById('logout-link');

  // Hide protected links by default
  protectedIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  if (logoutLink) logoutLink.style.display = 'none';

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Show all protected links
      protectedIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'inline';
      });
      if (loginLink) loginLink.style.display = 'none';
      if (logoutLink) {
        logoutLink.style.display = 'inline';
        logoutLink.onclick = async (e) => {
          e.preventDefault();
          try {
            await signOut(auth);
          } catch (err) {
            console.error('Failed to sign out', err);
          }
        };
      }

      // Show teacher link only for teacher role
      const teacherLink = document.getElementById('teacher-link');
      if (teacherLink) {
        try {
          const docSnap = await getDoc(doc(db, 'users', user.uid));
          const role = docSnap.exists() ? docSnap.data().role : null;
          if (role === 'teacher') {
            teacherLink.style.display = 'inline';
          } else {
            teacherLink.style.display = 'none';
          }
        } catch (err) {
          console.error('Failed to fetch role', err);
          teacherLink.style.display = 'none';
        }
      }
    } else {
      // User not logged in
      if (loginLink) loginLink.style.display = 'inline';
      if (logoutLink) logoutLink.style.display = 'none';
    }
  });
}

export function requireLogin(allowedRoles = []) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    if (allowedRoles.length > 0) {
      try {
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        const role = docSnap.exists() ? docSnap.data().role : null;
        if (!allowedRoles.includes(role)) {
          window.location.href = 'login.html';
        }
      } catch (err) {
        console.error('Failed to fetch role', err);
        window.location.href = 'login.html';
      }
    }
  });
}
