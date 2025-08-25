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

async function buildClassTree(uid, selectedSchoolId = null) {
  const tree = document.getElementById('class-tree');
  if (!tree) return;
  tree.innerHTML = '';

  if (selectedSchoolId) {
    const backLi = document.createElement('li');
    backLi.textContent = '\u2190 Back to all schools';
    backLi.classList.add('back-link');
    backLi.addEventListener('click', () => {
      window.location.href = 'teacher.html';
    });
    tree.appendChild(backLi);
  }

  let schoolDocs = [];
  if (selectedSchoolId) {
    const docSnap = await getDoc(doc(db, 'schools', selectedSchoolId));
    if (docSnap.exists()) {
      schoolDocs.push({ id: docSnap.id, data: docSnap.data() });
    }
  } else {
    const schoolsSnap = await getDocs(collection(db, 'schools'));
    schoolDocs = schoolsSnap.docs.map(d => ({ id: d.id, data: d.data() }));
  }

  for (const school of schoolDocs) {
    const schoolLi = document.createElement('li');
    schoolLi.textContent = '\u25B6 ' + school.data.name;
    const yearUl = document.createElement('ul');
    yearUl.style.display = 'none';
    schoolLi.appendChild(yearUl);
    schoolLi.addEventListener('click', () => {
      const expanded = yearUl.style.display === 'none';
      yearUl.style.display = expanded ? 'block' : 'none';
      schoolLi.textContent = `${expanded ? '\u25BC' : '\u25B6'} ${school.data.name}`;
    });
    tree.appendChild(schoolLi);

    const termsSnap = await getDocs(collection(db, 'schools', school.id, 'terms'));
    const byYear = {};
    termsSnap.forEach(t => {
      const data = t.data();
      if (!byYear[data.schoolYear]) byYear[data.schoolYear] = [];
      byYear[data.schoolYear].push({ id: t.id, name: data.name });
    });
    Object.entries(byYear).forEach(([year, termArr]) => {
      const yearLi = document.createElement('li');
      yearLi.textContent = '\u25B6 ' + year;
      const termUl = document.createElement('ul');
      termUl.style.display = 'none';
      yearLi.appendChild(termUl);
      yearLi.addEventListener('click', e => {
        e.stopPropagation();
        const expanded = termUl.style.display === 'none';
        termUl.style.display = expanded ? 'block' : 'none';
        yearLi.textContent = `${expanded ? '\u25BC' : '\u25B6'} ${year}`;
      });
      yearUl.appendChild(yearLi);

      termArr.forEach(term => {
        const termLi = document.createElement('li');
        termLi.textContent = '\u25B6 ' + term.name;
        const classUl = document.createElement('ul');
        classUl.style.display = 'none';
        termLi.appendChild(classUl);
        termLi.addEventListener('click', async e => {
          e.stopPropagation();
          if (classUl.childElementCount === 0) {
            const classesSnap = await getDocs(collection(db, 'schools', school.id, 'terms', term.id, 'classes'));
            classesSnap.forEach(c => {
              const classLi = document.createElement('li');
              classLi.textContent = c.data().name;
              classLi.addEventListener('click', e2 => {
                e2.stopPropagation();
                window.location.href = `teacher-score.html?schoolId=${school.id}&termId=${term.id}&classId=${c.id}`;
              });
              classUl.appendChild(classLi);
            });
          }
          const expanded = classUl.style.display === 'none';
          classUl.style.display = expanded ? 'block' : 'none';
          termLi.textContent = `${expanded ? '\u25BC' : '\u25B6'} ${term.name}`;
        });
        termUl.appendChild(termLi);
      });
    });
  }
}

const selectedSchoolId = window.selectedSchoolId || null;

onAuthStateChanged(auth, user => {
  if (user) buildClassTree(user.uid, selectedSchoolId);
});

window.addEventListener('refresh-class-tree', () => {
  const user = auth.currentUser;
  if (user) buildClassTree(user.uid, selectedSchoolId);
});
