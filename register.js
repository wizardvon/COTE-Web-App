import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { autoLinkStudentToClasses } from './autolink.js';

const roleSelect = document.getElementById('role');
const studentFields = document.getElementById('student-fields');
roleSelect.addEventListener('change', () => {
  studentFields.style.display = roleSelect.value === 'student' ? 'block' : 'none';
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const role = roleSelect.value;
  const lrn = document.getElementById('lrn').value;
  const birthdate = document.getElementById('birthdate').value;

  try {
    await setPersistence(auth, browserLocalPersistence);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    const data = { email, role, createdAt: Date.now() };
    if (role === 'student') {
      if (lrn) data.lrn = lrn;
      if (birthdate) data.birthdate = birthdate;
    }
    await setDoc(doc(db, 'users', uid), data);
    if (role === 'student' && lrn && birthdate) {
      await autoLinkStudentToClasses({ lrn, birthdate });
    }
    alert('Registration successful!');
    window.location.href = 'login.html';
  } catch (err) {
    alert('Registration failed: ' + err.message);
  }
});
