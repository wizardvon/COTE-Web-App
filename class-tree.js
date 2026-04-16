import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

  if (schoolDocs.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No schools available';
    tree.appendChild(li);
    return;
  }

  for (const school of schoolDocs) {
    const schoolLi = document.createElement('li');
    const schoolHeader = document.createElement('span');
    schoolHeader.textContent = '\u25B6 ' + school.data.name;
    schoolLi.appendChild(schoolHeader);
    const yearUl = document.createElement('ul');
    yearUl.style.display = 'none';
    schoolLi.appendChild(yearUl);

    schoolHeader.addEventListener('click', () => {
      const expanded = yearUl.style.display === 'none';
      yearUl.style.display = expanded ? 'block' : 'none';
      schoolHeader.textContent = `${expanded ? '\u25BC' : '\u25B6'} ${school.data.name}`;
    });

    const isOwner = school.data.ownerUid === uid;
    const memberDoc = await getDoc(doc(db, 'schools', school.id, 'members', uid));
    if (!isOwner && !memberDoc.exists()) {
      const joinBtn = document.createElement('button');
      joinBtn.textContent = 'Join';
      joinBtn.addEventListener('click', async e => {
        e.stopPropagation();
        await setDoc(doc(db, 'schools', school.id, 'members', uid), { joinedAt: serverTimestamp() });
        buildClassTree(uid, selectedSchoolId);
        window.dispatchEvent(new Event('refresh-class-tree'));
      });
      schoolLi.insertBefore(joinBtn, yearUl);
    }

    tree.appendChild(schoolLi);

    const termsSnap = await getDocs(collection(db, 'schools', school.id, 'terms'));
    const byYear = {};
    termsSnap.forEach(t => {
      const data = t.data();
      const name = data.name || t.id;
      if (!byYear[data.schoolYear]) byYear[data.schoolYear] = [];
      byYear[data.schoolYear].push({ id: t.id, name });
    });
    Object.entries(byYear).forEach(([year, termArr]) => {
      const yearLi = document.createElement('li');
      const yearHeader = document.createElement('span');
      yearHeader.textContent = '\u25B6 ' + year;
      yearLi.appendChild(yearHeader);
      const termUl = document.createElement('ul');
      termUl.style.display = 'none';
      yearLi.appendChild(termUl);
      yearHeader.addEventListener('click', e => {
        e.stopPropagation();
        const expanded = termUl.style.display === 'none';
        termUl.style.display = expanded ? 'block' : 'none';
        yearHeader.textContent = `${expanded ? '\u25BC' : '\u25B6'} ${year}`;
      });
      yearUl.appendChild(yearLi);

      termArr.forEach(term => {
        const termLi = document.createElement('li');
        const termHeader = document.createElement('span');
        termHeader.textContent = '\u25B6 ' + term.name;
        termLi.appendChild(termHeader);
        const classUl = document.createElement('ul');
        classUl.style.display = 'none';
        termLi.appendChild(classUl);
        termHeader.addEventListener('click', async e => {
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
          termHeader.textContent = `${expanded ? '\u25BC' : '\u25B6'} ${term.name}`;
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
