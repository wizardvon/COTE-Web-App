import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

async function buildClassTree(uid) {
  const tree = document.getElementById('class-tree');
  if (!tree) return;
  tree.innerHTML = '';
  const schoolsSnap = await getDocs(collection(db, 'schools'));
  for (const schoolDoc of schoolsSnap.docs) {
    const schoolData = schoolDoc.data();
    const isOwner = schoolData.ownerUid === uid;
    const memberDoc = await getDoc(doc(db, 'schools', schoolDoc.id, 'teachers', uid));
    if (!isOwner && !memberDoc.exists()) continue;
    const schoolLi = document.createElement('li');
    schoolLi.textContent = schoolData.name;
    const yearUl = document.createElement('ul');
    yearUl.style.display = 'none';
    schoolLi.appendChild(yearUl);
    schoolLi.addEventListener('click', () => {
      yearUl.style.display = yearUl.style.display === 'none' ? 'block' : 'none';
    });
    tree.appendChild(schoolLi);

    const termsSnap = await getDocs(collection(db, 'schools', schoolDoc.id, 'terms'));
    const byYear = {};
    termsSnap.forEach(t => {
      const data = t.data();
      if (!byYear[data.schoolYear]) byYear[data.schoolYear] = [];
      byYear[data.schoolYear].push({ id: t.id, name: data.name });
    });
    Object.entries(byYear).forEach(([year, termArr]) => {
      const yearLi = document.createElement('li');
      yearLi.textContent = year;
      const termUl = document.createElement('ul');
      termUl.style.display = 'none';
      yearLi.appendChild(termUl);
      yearLi.addEventListener('click', e => {
        e.stopPropagation();
        termUl.style.display = termUl.style.display === 'none' ? 'block' : 'none';
      });
      yearUl.appendChild(yearLi);

      termArr.forEach(term => {
        const termLi = document.createElement('li');
        termLi.textContent = term.name;
        const classUl = document.createElement('ul');
        classUl.style.display = 'none';
        termLi.appendChild(classUl);
        termLi.addEventListener('click', async e => {
          e.stopPropagation();
          if (classUl.childElementCount === 0) {
            const classesSnap = await getDocs(collection(db, 'schools', schoolDoc.id, 'terms', term.id, 'classes'));
            classesSnap.forEach(c => {
              const classLi = document.createElement('li');
              classLi.textContent = c.data().name;
              classLi.addEventListener('click', e2 => {
                e2.stopPropagation();
                window.location.href = `teacher-score.html?schoolId=${schoolDoc.id}&termId=${term.id}&classId=${c.id}`;
              });
              classUl.appendChild(classLi);
            });
          }
          classUl.style.display = classUl.style.display === 'none' ? 'block' : 'none';
        });
        termUl.appendChild(termLi);
      });
    });
  }
}

onAuthStateChanged(auth, user => {
  if (user) buildClassTree(user.uid);
});

window.addEventListener('refresh-class-tree', () => {
  const user = auth.currentUser;
  if (user) buildClassTree(user.uid);
});
