import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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
function validLRN(v) { return /^\d{12}$/.test(v); }
function validDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v); }

export async function createSchool(ownerUid, data) {
  const ref = doc(collection(db, 'schools'));
  await setDoc(ref, { ...data, ownerUid, createdAt: Date.now(), archived: false });
  return ref.id;
}

export async function createTerm(schoolId, data) {
  const ref = doc(collection(db, 'schools', schoolId, 'terms'));
  await setDoc(ref, { ...data, createdAt: Date.now(), archived: false });
  return ref.id;
}

export async function createClass(schoolId, termId, data) {
  const ref = doc(collection(db, 'schools', schoolId, 'terms', termId, 'classes'));
  await setDoc(ref, { ...data, teacherUid: auth.currentUser.uid, createdAt: Date.now(), archived: false });
  return ref.id;
}

export async function addRosterRow(schoolId, termId, classId, data) {
  const ref = doc(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'));
  await setDoc(ref, { ...data, linkedUid: null, createdAt: Date.now() });
}

export async function archiveDoc(ref, archived = true) {
  await updateDoc(ref, { archived });
}

export async function listSchoolsByOwner(uid) {
  const snap = await getDocs(query(collection(db, 'schools'), where('ownerUid', '==', uid)));
  const list = document.getElementById('school-list');
  const schoolSelects = ['school-select', 'school-select-2', 'school-select-3'].map(id => document.getElementById(id));
  list.innerHTML = '';
  schoolSelects.forEach(sel => sel.innerHTML = '<option value="">Select School</option>');
  snap.forEach(d => {
    const data = d.data();
    const id = d.id;
    const li = document.createElement('li');
    li.textContent = data.name + (data.archived ? ' (Archived)' : '');
    const btn = document.createElement('button');
    btn.textContent = data.archived ? 'Unarchive' : 'Archive';
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await archiveDoc(doc(db, 'schools', id), !data.archived);
      listSchoolsByOwner(uid);
    });
    li.appendChild(btn);
    li.addEventListener('click', () => listTerms(id));
    list.appendChild(li);
    schoolSelects.forEach(sel => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = data.name;
      sel.appendChild(opt);
    });
  });
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
      window.currentSelection = { schoolId, termId, classId: c.id };
      window.dispatchEvent(new CustomEvent('class-selected', { detail: window.currentSelection }));
      listRoster(schoolId, termId, c.id);
    });
    list.appendChild(li);
  });
  return classes;
}

export async function listRoster(schoolId, termId, classId) {
  const snap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'));
  const table = document.getElementById('roster-table');
  table.innerHTML = '<tr><th>Name</th><th>LRN</th><th>Birthdate</th><th>Sex</th><th>Linked</th><th>AddedAt</th></tr>';
  snap.forEach(d => {
    const r = d.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.name}</td><td>${r.lrn}</td><td>${r.birthdate}</td><td>${r.sex}</td><td>${r.linkedUid ? 'Yes' : 'No'}</td><td>${new Date(r.createdAt).toLocaleDateString()}</td>`;
    table.appendChild(tr);
  });
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

async function populateClassOptions(schoolId, termId, selectId) {
  const select = document.getElementById(selectId);
  select.innerHTML = '<option value="">Select Class</option>';
  if (!schoolId || !termId) return;
  const classes = await fetchClasses(schoolId, termId);
  classes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
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
  listSchoolsByOwner(user.uid);
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
    listSchoolsByOwner(auth.currentUser.uid);
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
    populateTermOptions(schoolId, 'term-select-2');
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('create-class-form').addEventListener('submit', async e => {
  e.preventDefault();
  const schoolId = document.getElementById('school-select-2').value;
  const termId = document.getElementById('term-select').value;
  const data = {
    name: getVal('class-name'),
    gradeLevel: getVal('grade-level'),
    section: getVal('section'),
    subject: getVal('subject')
  };
  if (!schoolId || !termId || !data.name || !data.gradeLevel || !data.section || !data.subject) { alert('Fill required fields'); return; }
  try {
    await createClass(schoolId, termId, data);
    alert('Class created');
    e.target.reset();
    listClasses(schoolId, termId);
    populateClassOptions(schoolId, termId, 'class-select');
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('add-student-form').addEventListener('submit', async e => {
  e.preventDefault();
  const schoolId = document.getElementById('school-select-3').value;
  const termId = document.getElementById('term-select-2').value;
  const classId = document.getElementById('class-select').value;
  const data = {
    name: getVal('student-name'),
    lrn: getVal('student-lrn'),
    birthdate: getVal('student-birthdate'),
    sex: getVal('student-sex'),
    email: getVal('student-email') || null,
    guardianContact: getVal('guardian-contact') || null
  };
  if (!schoolId || !termId || !classId || !data.name || !validLRN(data.lrn) || !validDate(data.birthdate) || !data.sex) { alert('Invalid input'); return; }
  try {
    await addRosterRow(schoolId, termId, classId, data);
    alert('Student added');
    e.target.reset();
    listRoster(schoolId, termId, classId);
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('school-select-2').addEventListener('change', e => populateTermOptions(e.target.value, 'term-select'));
document.getElementById('school-select-3').addEventListener('change', e => populateTermOptions(e.target.value, 'term-select-2'));
document.getElementById('term-select-2').addEventListener('change', e => populateClassOptions(document.getElementById('school-select-3').value, e.target.value, 'class-select'));
document.getElementById('class-select').addEventListener('change', e => {
  const schoolId = document.getElementById('school-select-3').value;
  const termId = document.getElementById('term-select-2').value;
  const classId = e.target.value;
  if (schoolId && termId && classId) {
    window.currentSelection = { schoolId, termId, classId };
    window.dispatchEvent(new CustomEvent('class-selected', { detail: window.currentSelection }));
    listRoster(schoolId, termId, classId);
  }
});
