import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

function getVal(id) { return document.getElementById(id)?.value.trim(); }
function toggle(el, show) { if (!el) return; el.classList[show ? 'remove' : 'add']('hidden'); }
function confirmTyped(action, keyword, name) {
  const input = prompt(`${action} "${name}"\nType ${keyword} to confirm:`);
  return input === keyword;
}

window.currentSelection = { schoolId: null, termId: null, classId: null, ownerUid: null };
const schoolCache = new Map();

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
    const t = d.data();
    return t.schoolYear === data.schoolYear && t.name.toLowerCase() === data.name.toLowerCase();
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

async function listSchoolsForTeacher(uid) {
  const list = document.getElementById('school-list');
  list.innerHTML = '';
  schoolCache.clear();

  const snap = await getDocs(collection(db, 'schools'));
  for (const sDoc of snap.docs) {
    const data = sDoc.data();
    const id = sDoc.id;
    let include = false;
    if (data.ownerUid === uid) {
      include = true;
    } else {
      const termSnap = await getDocs(collection(db, 'schools', id, 'terms'));
      for (const tDoc of termSnap.docs) {
        const classSnap = await getDocs(collection(db, 'schools', id, 'terms', tDoc.id, 'classes'));
        if (classSnap.docs.some(c => c.data().teacherUid === uid)) { include = true; break; }
      }
    }
    if (include) schoolCache.set(id, data);
  }

  schoolCache.forEach((data, id) => {
    const li = document.createElement('li');
    li.className = 'row';
    const name = document.createElement('span');
    name.className = 'name';
    name.dataset.id = id;
    name.textContent = data.name + (data.archived ? ' (Archived)' : '');

    const actions = document.createElement('span');
    actions.className = 'actions';

    const edit = document.createElement('span');
    edit.className = 'link-btn edit-school';
    edit.dataset.id = id;
    edit.textContent = 'Edit';

    const del = document.createElement('span');
    del.className = 'danger-link delete-school';
    del.dataset.id = id;
    del.textContent = 'Delete';

    const arch = document.createElement('span');
    arch.className = 'archive-link' + (data.ownerUid === uid ? '' : ' disabled');
    arch.dataset.id = id;
    arch.textContent = data.archived ? 'Unarchive' : 'Archive';
    if (data.ownerUid !== uid) arch.title = 'Only owner can archive';

    actions.append(edit, del, arch);
    li.append(name, actions);
    list.appendChild(li);
  });

  list.querySelectorAll('.name').forEach(el => el.addEventListener('click', async e => {
    const id = e.target.dataset.id;
    const data = schoolCache.get(id);
    window.currentSelection = { schoolId: id, termId: null, classId: null, ownerUid: data.ownerUid };
    toggle(document.getElementById('terms-section'), true);
    toggle(document.getElementById('classes-section'), false);
    toggle(document.getElementById('create-term-form'), false);
    await listTerms(id);
  }));

  list.querySelectorAll('.edit-school').forEach(el => el.addEventListener('click', async e => {
    e.stopPropagation();
    const id = e.target.dataset.id;
    const data = schoolCache.get(id);
    if (!confirmTyped('Edit school', 'EDITE', data.name)) return;
    const name = prompt('School Name:', data.name) || data.name;
    const address = prompt('Address:', data.address || '') || data.address || '';
    const logoUrl = prompt('Logo URL:', data.logoUrl || '') || data.logoUrl || null;
    await updateDoc(doc(db, 'schools', id), { name, address, logoUrl });
    await listSchoolsForTeacher(uid);
  }));

  list.querySelectorAll('.delete-school').forEach(el => el.addEventListener('click', async e => {
    e.stopPropagation();
    const id = e.target.dataset.id;
    const data = schoolCache.get(id);
    const termSnap = await getDocs(collection(db, 'schools', id, 'terms'));
    if (termSnap.size > 0) {
      alert('Cannot delete school with terms. Archive instead.');
      return;
    }
    if (!confirmTyped('Delete school', 'DELETE', data.name)) return;
    await deleteDoc(doc(db, 'schools', id));
    await listSchoolsForTeacher(uid);
  }));

  list.querySelectorAll('.archive-link').forEach(el => el.addEventListener('click', async e => {
    e.stopPropagation();
    const id = e.target.dataset.id;
    const data = schoolCache.get(id);
    if (data.ownerUid !== uid) return;
    const msg = data.archived ? `Unarchive ${data.name}?` : `Archive ${data.name}?`;
    if (!confirm(msg)) return;
    await updateDoc(doc(db, 'schools', id), { archived: !data.archived });
    await listSchoolsForTeacher(uid);
  }));
}

async function listTerms(schoolId) {
  const list = document.getElementById('term-list');
  list.innerHTML = '';
  const snap = await getDocs(collection(db, 'schools', schoolId, 'terms'));
  snap.docs.forEach(tDoc => {
    const t = tDoc.data();
    const id = tDoc.id;
    const li = document.createElement('li');
    li.className = 'row';
    const name = document.createElement('span');
    name.className = 'name';
    name.dataset.id = id;
    name.textContent = t.name + (t.archived ? ' (Archived)' : '');

    const actions = document.createElement('span');
    actions.className = 'actions';

    const edit = document.createElement('span');
    edit.className = 'link-btn edit-term';
    edit.dataset.id = id;
    edit.textContent = 'Edit';

    const del = document.createElement('span');
    del.className = 'danger-link delete-term';
    del.dataset.id = id;
    del.textContent = 'Delete';

    const arch = document.createElement('span');
    arch.className = 'archive-link';
    arch.dataset.id = id;
    arch.textContent = t.archived ? 'Unarchive' : 'Archive';

    actions.append(edit, del, arch);
    li.append(name, actions);
    list.appendChild(li);
  });

  list.querySelectorAll('.name').forEach(el => el.addEventListener('click', async e => {
    const termId = e.target.dataset.id;
    window.currentSelection.termId = termId;
    window.currentSelection.classId = null;
    toggle(document.getElementById('classes-section'), true);
    toggle(document.getElementById('create-class-form'), false);
    await listClasses(window.currentSelection.schoolId, termId);
  }));

  list.querySelectorAll('.edit-term').forEach(el => el.addEventListener('click', async e => {
    e.stopPropagation();
    const termId = e.target.dataset.id;
    const tDoc = await getDoc(doc(db, 'schools', schoolId, 'terms', termId));
    const t = tDoc.data();
    if (!confirmTyped('Edit term', 'EDITE', t.name)) return;
    const name = prompt('Term Name:', t.name) || t.name;
    const schoolYear = prompt('School Year:', t.schoolYear || '') || t.schoolYear || '';
    await updateDoc(doc(db, 'schools', schoolId, 'terms', termId), { name, schoolYear });
    await listTerms(schoolId);
  }));

  list.querySelectorAll('.delete-term').forEach(el => el.addEventListener('click', async e => {
    e.stopPropagation();
    const termId = e.target.dataset.id;
    const tDoc = await getDoc(doc(db, 'schools', schoolId, 'terms', termId));
    const t = tDoc.data();
    const classSnap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes'));
    if (classSnap.size > 0) {
      alert('Cannot delete term with classes. Archive instead.');
      return;
    }
    if (!confirmTyped('Delete term', 'DELETE', t.name)) return;
    await deleteDoc(doc(db, 'schools', schoolId, 'terms', termId));
    await listTerms(schoolId);
  }));

  list.querySelectorAll('.archive-link').forEach(el => el.addEventListener('click', async e => {
    e.stopPropagation();
    const termId = e.target.dataset.id;
    const tDoc = await getDoc(doc(db, 'schools', schoolId, 'terms', termId));
    const t = tDoc.data();
    if (!confirm(`Archive status for ${t.name}?`)) return;
    await updateDoc(doc(db, 'schools', schoolId, 'terms', termId), { archived: !t.archived });
    await listTerms(schoolId);
  }));
}

async function listClasses(schoolId, termId) {
  const list = document.getElementById('class-list');
  list.innerHTML = '';
  const snap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes'));
  snap.docs.forEach(cDoc => {
    const c = cDoc.data();
    const id = cDoc.id;
    const li = document.createElement('li');
    li.className = 'row';
    const name = document.createElement('span');
    name.className = 'name';
    name.dataset.id = id;
    name.textContent = c.name + (c.archived ? ' (Archived)' : '');

    const actions = document.createElement('span');
    actions.className = 'actions';

    const edit = document.createElement('span');
    edit.className = 'link-btn edit-class';
    edit.dataset.id = id;
    edit.textContent = 'Edit';

    const del = document.createElement('span');
    del.className = 'danger-link delete-class';
    del.dataset.id = id;
    del.textContent = 'Delete';

    const arch = document.createElement('span');
    arch.className = 'archive-link';
    arch.dataset.id = id;
    arch.textContent = c.archived ? 'Unarchive' : 'Archive';

    actions.append(edit, del, arch);
    li.append(name, actions);
    list.appendChild(li);
  });

  list.querySelectorAll('.name').forEach(el => el.addEventListener('click', e => {
    const classId = e.target.dataset.id;
    const url = `teacher-score.html?schoolId=${schoolId}&termId=${termId}&classId=${classId}`;
    window.location.href = url;
  }));

  list.querySelectorAll('.edit-class').forEach(el => el.addEventListener('click', async e => {
    e.stopPropagation();
    const classId = e.target.dataset.id;
    const cDoc = await getDoc(doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId));
    const c = cDoc.data();
    if (!confirmTyped('Edit class', 'EDITE', c.name)) return;
    const name = prompt('Class Name:', c.name) || c.name;
    const gradeLevel = prompt('Grade Level:', c.gradeLevel || '') || c.gradeLevel || '';
    const section = prompt('Section:', c.section || '') || c.section || '';
    const subject = prompt('Subject:', c.subject || '') || c.subject || '';
    await updateDoc(doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId), { name, gradeLevel, section, subject });
    await listClasses(schoolId, termId);
  }));

  list.querySelectorAll('.delete-class').forEach(el => el.addEventListener('click', async e => {
    e.stopPropagation();
    const classId = e.target.dataset.id;
    const cDoc = await getDoc(doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId));
    const c = cDoc.data();
    const rosterSnap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'));
    const scoreDoc = await getDoc(doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'scores', auth.currentUser.uid));
    if (rosterSnap.size === 0 && !scoreDoc.exists()) {
      if (!confirmTyped('Delete class', 'DELETE', c.name)) return;
      await deleteDoc(doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId));
      await listClasses(schoolId, termId);
    } else {
      alert('Class has roster or scores. Please archive instead.');
    }
  }));

  list.querySelectorAll('.archive-link').forEach(el => el.addEventListener('click', async e => {
    e.stopPropagation();
    const classId = e.target.dataset.id;
    const cDoc = await getDoc(doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId));
    const c = cDoc.data();
    if (!confirm(`Archive status for ${c.name}?`)) return;
    await updateDoc(doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId), { archived: !c.archived });
    await listClasses(schoolId, termId);
  }));
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
  await listSchoolsForTeacher(user.uid);
  toggle(document.getElementById('terms-section'), false);
  toggle(document.getElementById('classes-section'), false);
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
    await createSchool(user.uid, data);
    e.target.reset();
    await listSchoolsForTeacher(user.uid);
  } catch (err) { alert(err.message); }
});

document.getElementById('create-term-form').addEventListener('submit', async e => {
  e.preventDefault();
  const schoolId = window.currentSelection.schoolId;
  const data = { schoolYear: getVal('school-year'), name: getVal('term-name') };
  if (!schoolId || !data.schoolYear || !data.name) { alert('Fill required fields'); return; }
  try {
    await createTerm(schoolId, data);
    e.target.reset();
    toggle(document.getElementById('create-term-form'), false);
    await listTerms(schoolId);
  } catch (err) { alert(err.message); }
});

document.getElementById('create-class-form').addEventListener('submit', async e => {
  e.preventDefault();
  const { schoolId, termId } = window.currentSelection;
  const data = {
    name: getVal('class-name'),
    gradeLevel: getVal('grade-level'),
    section: getVal('section'),
    subject: getVal('subject')
  };
  if (!schoolId || !termId || !data.name || !data.gradeLevel || !data.section || !data.subject) { alert('Fill required fields'); return; }
  try {
    await createClass(schoolId, termId, { name: `${data.gradeLevel} - ${data.section} - ${data.subject} - ${data.name}`, gradeLevel: data.gradeLevel, section: data.section, subject: data.subject, classCode: data.name });
    e.target.reset();
    toggle(document.getElementById('create-class-form'), false);
    await listClasses(schoolId, termId);
  } catch (err) { alert(err.message); }
});

document.getElementById('show-create-term').addEventListener('click', () => {
  toggle(document.getElementById('create-term-form'), true);
});

document.getElementById('show-create-class').addEventListener('click', () => {
  toggle(document.getElementById('create-class-form'), true);
});

