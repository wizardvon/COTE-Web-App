import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { autoLinkStudentToClasses } from './autolink.js';

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    await setPersistence(auth, browserLocalPersistence);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      if (data.role === 'teacher') {
        window.location.href = 'teacher.html';
      } else {
        if (data.lrn && data.birthdate) {
          await autoLinkStudentToClasses({ lrn: data.lrn, birthdate: data.birthdate });
        }
        window.location.href = 'profile.html';
      }
    } else {
      alert('No user profile found');
    }
  } catch (err) {
    alert('Login failed: ' + err.message);
  }
});
