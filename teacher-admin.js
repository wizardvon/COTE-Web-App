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

window.currentSelection = { schoolId: null, termId: null, classId: null };
function toggle(el, show) { if (!el) return; el.classList[show ? 'remove' : 'add']('hidden'); }
let currentSchoolOwnerUid = null;
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

export async function listSchoolsForTeacher(uid) {
  const list = document.getElementById('school-list');
  const schoolSelectIds = ['school-select', 'school-select-2', 'school-select-3'];
  const schoolSelects = schoolSelectIds.map(id => document.getElementById(id)).filter(Boolean);
  list.innerHTML = '';
  schoolSelects.forEach(sel => sel.innerHTML = "<option value=''>Select School</option>");
  schoolCache.clear();
  try {
    const schoolSnap = await getDocs(collection(db, 'schools'));
    for (const sDoc of schoolSnap.docs) {
      const data = sDoc.data();
      const id = sDoc.id;
      if (data.ownerUid === uid) {
        schoolCache.set(id, data);
        continue;
      }
      const termSnap = await getDocs(collection(db, 'schools', id, 'terms'));
      for (const tDoc of termSnap.docs) {
        const classSnap = await getDocs(collection(db, 'schools', id, 'terms', tDoc.id, 'classes'));
        if (classSnap.docs.some(c => c.data().teacherUid === uid)) {
          schoolCache.set(id, data);
          break;
        }
      }
    }
    schoolCache.forEach((data, id) => {
      const li = document.createElement('li');
      li.className = 'row';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'name';
      nameSpan.textContent = data.name + (data.archived ? ' (Archived)' : '');
      const archiveSpan = document.createElement('span');
      archiveSpan.className = 'archive-link';
      archiveSpan.textContent = data.archived ? 'Unarchive' : 'Archive';
      const canArchive = data.ownerUid === uid;
      if (!canArchive) {
        archiveSpan.classList.add('disabled');
        archiveSpan.title = 'Only owner can archive';
      } else {
        archiveSpan.addEventListener('click', async e => {
          e.stopPropagation();
          const msg = data.archived ? `Are you sure you want to unarchive ${data.name}?` : `Are you sure you want to archive ${data.name}?`;
          if (!confirm(msg)) return;
          await updateDoc(doc(db, 'schools', id), { archived: !data.archived });
          await listSchoolsForTeacher(uid);
        });
      }
      nameSpan.addEventListener('click', async () => {
        window.currentSelection = { schoolId: id, termId: null, classId: null };
        currentSchoolOwnerUid = data.ownerUid;
        document.getElementById('school-select').value = id;
        const sel2 = document.getElementById('school-select-2'); if (sel2) sel2.value = id;
        toggle(document.getElementById('toggle-term-form'), true);
        toggle(document.getElementById('create-term-form'), true);
        toggle(document.getElementById('toggle-class-form'), false);
        toggle(document.getElementById('create-class-form'), false);
        await listTerms(id);
      });
      li.append(nameSpan, archiveSpan);
      list.appendChild(li);
      schoolSelects.forEach(sel => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = data.name;
        sel.appendChild(opt);
      });
    });
    return Array.from(schoolCache, ([id, data]) => ({ id, ...data }));
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function listAvailableSchools(uid) {
  const snap = await getDocs(collection(db, 'schools'));
  const list = document.getElementById('school-list');
  const schoolSelects = ['school-select', 'school-select-2']
    .map(id => document.getElementById(id))
    .filter(Boolean);
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

    // Add all schools to selection dropdowns regardless of membership
    schoolSelects.forEach(sel => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = data.name;
      sel.appendChild(opt);
    });

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
  if (schoolSelects.length) {
    schoolSelects.forEach(sel => {
      if (sel.options.length > 1 && !sel.value) sel.value = sel.options[1].value;
    });
    const selected = document.getElementById('school-select-2')?.value;
    if (selected) {
      await populateTermOptions(selected, 'term-select');
      await listTerms(selected);
    }
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
  const select = document.getElementById('term-select');
  list.innerHTML = '';
  select.innerHTML = "<option value=''>Select Term</option>";
  const canArchive = auth.currentUser.uid === currentSchoolOwnerUid;
  terms.forEach(t => {
    const li = document.createElement('li');
    li.className = 'row';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = t.name + (t.archived ? ' (Archived)' : '');
    const archiveSpan = document.createElement('span');
    archiveSpan.className = 'archive-link';
    archiveSpan.textContent = t.archived ? 'Unarchive' : 'Archive';
    if (!canArchive) {
      archiveSpan.classList.add('disabled');
      archiveSpan.title = 'Only owner can archive';
    } else {
      archiveSpan.addEventListener('click', async e => {
        e.stopPropagation();
        const msg = t.archived ? `Are you sure you want to unarchive ${t.name}?` : `Are you sure you want to archive ${t.name}?`;
        if (!confirm(msg)) return;
        await archiveDoc(doc(db, 'schools', schoolId, 'terms', t.id), !t.archived);
        await listTerms(schoolId);
      });
    }
    nameSpan.addEventListener('click', async () => {
      window.currentSelection.termId = t.id;
      window.currentSelection.classId = null;
      document.getElementById('term-select').value = t.id;
      toggle(document.getElementById('toggle-class-form'), true);
      toggle(document.getElementById('create-class-form'), true);
      await listClasses(schoolId, t.id);
    });
    li.append(nameSpan, archiveSpan);
    list.appendChild(li);
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    select.appendChild(opt);
  });
  document.getElementById('class-list').innerHTML = '';
  const classSelect = document.getElementById('class-select');
  if (classSelect) classSelect.innerHTML = "<option value=''>Select Class</option>";
  return terms;
}

async function fetchClasses(schoolId, termId) {
  const snap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listClasses(schoolId, termId) {
  const classes = await fetchClasses(schoolId, termId);
  const list = document.getElementById('class-list');
  const select = document.getElementById('class-select');
  list.innerHTML = '';
  if (select) select.innerHTML = "<option value=''>Select Class</option>";
  const uid = auth.currentUser.uid;
  classes.forEach(c => {
    const li = document.createElement('li');
    li.className = 'row';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = c.name + (c.archived ? ' (Archived)' : '');
    const archiveSpan = document.createElement('span');
    archiveSpan.className = 'archive-link';
    archiveSpan.textContent = c.archived ? 'Unarchive' : 'Archive';
    const canArchive = uid === currentSchoolOwnerUid || c.teacherUid === uid;
    if (!canArchive) {
      archiveSpan.classList.add('disabled');
      archiveSpan.title = 'Only owner or class teacher can archive';
    } else {
      archiveSpan.addEventListener('click', async e => {
        e.stopPropagation();
        const msg = c.archived ? `Are you sure you want to unarchive ${c.name}?` : `Are you sure you want to archive ${c.name}?`;
        if (!confirm(msg)) return;
        await archiveDoc(doc(db, 'schools', schoolId, 'terms', termId, 'classes', c.id), !c.archived);
        await listClasses(schoolId, termId);
      });
    }
    nameSpan.addEventListener('click', async () => {
      window.currentSelection.classId = c.id;
      if (select) select.value = c.id;
      window.dispatchEvent(new CustomEvent('class-selected', { detail: window.currentSelection }));
      await listRoster(schoolId, termId, c.id);
    });
    li.append(nameSpan, archiveSpan);
    list.appendChild(li);
    if (select) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    }
  });
  return classes;
}

async function listRoster(schoolId, termId, classId) {
  // Placeholder for roster rendering handled elsewhere
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
  await listSchoolsForTeacher(user.uid);
  toggle(document.getElementById('toggle-term-form'), false);
  toggle(document.getElementById('create-term-form'), false);
  toggle(document.getElementById('toggle-class-form'), false);
  toggle(document.getElementById('create-class-form'), false);
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
    listSchoolsForTeacher(auth.currentUser.uid);
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
    await listTerms(schoolId);
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
    await listClasses(schoolId, termId);
    window.dispatchEvent(new Event('refresh-class-tree'));
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('school-select').addEventListener('change', async e => {
  const schoolId = e.target.value || null;
  window.currentSelection = { schoolId, termId: null, classId: null };
  currentSchoolOwnerUid = schoolId ? (schoolCache.get(schoolId)?.ownerUid || null) : null;
  const sel2 = document.getElementById('school-select-2');
  if (sel2) sel2.value = schoolId || '';
  toggle(document.getElementById('toggle-term-form'), !!schoolId);
  toggle(document.getElementById('create-term-form'), !!schoolId);
  toggle(document.getElementById('toggle-class-form'), false);
  toggle(document.getElementById('create-class-form'), false);
  if (schoolId) {
    await listTerms(schoolId);
  } else {
    document.getElementById('term-list').innerHTML = '';
    document.getElementById('class-list').innerHTML = '';
    document.getElementById('term-select').innerHTML = "<option value=''>Select Term</option>";
    const classSelect = document.getElementById('class-select');
    if (classSelect) classSelect.innerHTML = "<option value=''>Select Class</option>";
  }
});

document.getElementById('term-select').addEventListener('change', async e => {
  const termId = e.target.value || null;
  const schoolId = window.currentSelection.schoolId;
  window.currentSelection.termId = termId;
  window.currentSelection.classId = null;
  const classSelect = document.getElementById('class-select');
  if (classSelect) classSelect.value = '';
  toggle(document.getElementById('toggle-class-form'), !!termId);
  toggle(document.getElementById('create-class-form'), !!termId);
  if (schoolId && termId) {
    await listClasses(schoolId, termId);
  } else {
    document.getElementById('class-list').innerHTML = '';
    if (classSelect) classSelect.innerHTML = "<option value=''>Select Class</option>";
  }
});

document.getElementById('class-select').addEventListener('change', async e => {
  const classId = e.target.value || null;
  const { schoolId, termId } = window.currentSelection;
  window.currentSelection.classId = classId;
  if (schoolId && termId && classId) {
    window.dispatchEvent(new CustomEvent('class-selected', { detail: window.currentSelection }));
    await listRoster(schoolId, termId, classId);
  }
});

document.getElementById('toggle-school-form').addEventListener('click', () => {
  const form = document.getElementById('create-school-form');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('toggle-term-form').addEventListener('click', () => {
  const form = document.getElementById('create-term-form');
  form.classList.toggle('hidden');
});
document.getElementById('toggle-class-form').addEventListener('click', () => {
  const form = document.getElementById('create-class-form');
  form.classList.toggle('hidden');
});
