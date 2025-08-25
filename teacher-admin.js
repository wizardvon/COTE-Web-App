import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

function getVal(id) { return document.getElementById(id).value.trim(); }
export async function createSchool(ownerUid, data) {
  const existing = await getDocs(collection(db, 'schools'));
  const duplicate = existing.docs.some(d => d.data().name.toLowerCase() === data.name.toLowerCase());
  if (duplicate) throw new Error('School already exists');
  const ref = doc(collection(db, 'schools'));
  await setDoc(ref, { ...data, ownerUid, createdAt: Date.now(), archived: false });
  return ref.id;
}

export async function createTerm(schoolId, data) {
  const existing = await getDocs(collection(db, 'schools', schoolId, 'terms'));
  const duplicate = existing.docs.some(d => {
    const term = d.data();
    return term.schoolYear === data.schoolYear && term.name.toLowerCase() === data.name.toLowerCase();
  });
  if (duplicate) throw new Error('School year and term already exist');
  const ref = doc(collection(db, 'schools', schoolId, 'terms'));
  await setDoc(ref, { ...data, createdAt: Date.now(), archived: false });
  return ref.id;
}

export async function createClass(schoolId, termId, data) {
  const ref = doc(collection(db, 'schools', schoolId, 'terms', termId, 'classes'));
  await setDoc(ref, { ...data, teacherUid: auth.currentUser.uid, createdAt: Date.now(), archived: false });
  return ref.id;
}

export async function archiveDoc(ref, archived = true) {
  await updateDoc(ref, { archived });
}

export async function listAvailableSchools(uid) {
  const snap = await getDocs(collection(db, 'schools'));
  const list = document.getElementById('school-list');
  const schoolSelects = ['school-select', 'school-select-2'].map(id => document.getElementById(id));
  list.innerHTML = '';
  schoolSelects.forEach(sel => sel.innerHTML = '<option value="">Select School</option>');
  if (snap.empty) {
    const li = document.createElement('li');
    li.textContent = 'No schools available';
    list.appendChild(li);
    return [];
  }
  for (const d of snap.docs) {
    const data = d.data();
    const id = d.id;
    const li = document.createElement('li');
    li.textContent = data.name + (data.archived ? ' (Archived)' : '');
    const isOwner = data.ownerUid === uid;
    const memberDoc = await getDoc(doc(db, 'schools', id, 'teachers', uid));
    const isMember = isOwner || memberDoc.exists();
    if (isMember) {
      if (isOwner) {
        const btn = document.createElement('button');
        btn.textContent = data.archived ? 'Unarchive' : 'Archive';
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          await archiveDoc(doc(db, 'schools', id), !data.archived);
          listAvailableSchools(uid);
        });
        li.appendChild(btn);
      }
      li.addEventListener('click', () => listTerms(id));
      schoolSelects.forEach(sel => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = data.name;
        sel.appendChild(opt);
      });
    } else {
      const btn = document.createElement('button');
      btn.textContent = 'Join';
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        await joinSchool(id);
        listAvailableSchools(uid);
        window.dispatchEvent(new Event('refresh-class-tree'));
      });
      li.appendChild(btn);
    }
    list.appendChild(li);
  }
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function joinSchool(schoolId) {
  const uid = auth.currentUser.uid;
  await setDoc(doc(db, 'schools', schoolId, 'teachers', uid), { joinedAt: Date.now() });
}

async function fetchTerms(schoolId) {
  const snap = await getDocs(collection(db, 'schools', schoolId, 'terms'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listTerms(schoolId) {
  const terms = await fetchTerms(schoolId);
  const list = document.getElementById('term-list');
  list.innerHTML = '';
  terms.forEach(t => {
    const li = document.createElement('li');
    li.textContent = t.name + (t.archived ? ' (Archived)' : '');
    const btn = document.createElement('button');
    btn.textContent = t.archived ? 'Unarchive' : 'Archive';
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await archiveDoc(doc(db, 'schools', schoolId, 'terms', t.id), !t.archived);
      listTerms(schoolId);
    });
    li.appendChild(btn);
    li.addEventListener('click', () => listClasses(schoolId, t.id));
    list.appendChild(li);
  });
  return terms;
}

async function fetchClasses(schoolId, termId) {
  const snap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listClasses(schoolId, termId) {
  const classes = await fetchClasses(schoolId, termId);
  const list = document.getElementById('class-list');
  list.innerHTML = '';
  classes.forEach(c => {
    const li = document.createElement('li');
    li.textContent = c.name + (c.archived ? ' (Archived)' : '');
    const btn = document.createElement('button');
    btn.textContent = c.archived ? 'Unarchive' : 'Archive';
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await archiveDoc(doc(db, 'schools', schoolId, 'terms', termId, 'classes', c.id), !c.archived);
      listClasses(schoolId, termId);
    });
    li.appendChild(btn);
    li.addEventListener('click', () => {
      window.location.href = `teacher-score.html?schoolId=${schoolId}&termId=${termId}&classId=${c.id}`;
    });
    list.appendChild(li);
  });
  return classes;
}

async function populateTermOptions(schoolId, selectId) {
  const select = document.getElementById(selectId);
  select.innerHTML = '<option value="">Select Term</option>';
  if (!schoolId) return;
  const terms = await fetchTerms(schoolId);
  terms.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    select.appendChild(opt);
  });
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  const docSnap = await getDoc(doc(db, 'users', user.uid));
  if (!docSnap.exists() || docSnap.data().role !== 'teacher') {
    window.location.href = 'profile.html';
    return;
  }
  listAvailableSchools(user.uid);
});

document.getElementById('create-school-form').addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    name: getVal('school-name'),
    address: getVal('school-address'),
    logoUrl: getVal('school-logo-url') || null
  };
  if (!data.name || !data.address) { alert('Fill required fields'); return; }
  try {
    const user = auth.currentUser;
    if (!user) { alert('Only teachers can create schools'); return; }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || userDoc.data().role !== 'teacher') {
      alert('Only teachers can create schools');
      return;
    }
    await createSchool(user.uid, data);
    alert('School created');
    e.target.reset();
    listAvailableSchools(auth.currentUser.uid);
    window.dispatchEvent(new Event('refresh-class-tree'));
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('create-term-form').addEventListener('submit', async e => {
  e.preventDefault();
  const schoolId = document.getElementById('school-select').value;
  const data = {
    schoolYear: getVal('school-year'),
    name: getVal('term-name')
  };
  if (!schoolId || !data.schoolYear || !data.name) { alert('Fill required fields'); return; }
  try {
    await createTerm(schoolId, data);
    alert('Term created');
    e.target.reset();
    listTerms(schoolId);
    populateTermOptions(schoolId, 'term-select');
    window.dispatchEvent(new Event('refresh-class-tree'));
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('create-class-form').addEventListener('submit', async e => {
  e.preventDefault();
  const schoolId = document.getElementById('school-select-2').value;
  const termId = document.getElementById('term-select').value;
  const data = {
    className: getVal('class-name'),
    gradeLevel: getVal('grade-level'),
    section: getVal('section'),
    subject: getVal('subject')
  };
  if (!schoolId || !termId || !data.className || !data.gradeLevel || !data.section || !data.subject) { alert('Fill required fields'); return; }
  try {
    const combined = `${data.gradeLevel} - ${data.section} - ${data.subject} - ${data.className}`;
    await createClass(schoolId, termId, { name: combined, gradeLevel: data.gradeLevel, section: data.section, subject: data.subject, classCode: data.className });
    alert('Class created');
    e.target.reset();
    listClasses(schoolId, termId);
    window.dispatchEvent(new Event('refresh-class-tree'));
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('school-select-2').addEventListener('change', e => populateTermOptions(e.target.value, 'term-select'));

document.getElementById('toggle-school-form').addEventListener('click', () => {
  const form = document.getElementById('create-school-form');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('toggle-term-form').addEventListener('click', () => {
  const form = document.getElementById('create-term-form');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('toggle-class-form').addEventListener('click', () => {
  const form = document.getElementById('create-class-form');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
});
