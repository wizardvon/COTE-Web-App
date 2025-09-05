import { auth, db } from './firebase.js';
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

// ---------- State ----------
let currentSchool = null;
let currentTerm = null;
let currentClass = null;

// ---------- Helpers ----------
function showStep(step) {
  document.querySelectorAll('.wizard-step').forEach(p => {
    p.classList.toggle('active', p.id === `step-${step}`);
  });
  document.querySelectorAll('.wizard-tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.step === step);
  });
}

function li(text) {
  const el = document.createElement('li');
  el.textContent = text;
  return el;
}

// ---------- Step: Schools ----------
export async function loadSchools() {
  const list = document.getElementById('school-list');
  list.innerHTML = '';
  const snap = await getDocs(collection(db, 'schools'));
  snap.forEach(s => {
    const data = s.data();
    const item = li(data.name);
    item.dataset.id = s.id;
    item.classList.add('row');
    const btn = document.createElement('button');
    btn.textContent = 'Select';
    btn.onclick = () => selectSchool(s.id);
    const join = document.createElement('button');
    join.textContent = 'Join';
    join.onclick = () => joinSchool(s.id);
    item.append(btn, join);
    list.appendChild(item);
  });
}

export async function createSchool(name, address) {
  const ref = doc(collection(db, 'schools'));
  await setDoc(ref, { name, address, ownerUid: auth.currentUser.uid, createdAt: serverTimestamp() });
  // add owner to members
  await setDoc(doc(db, 'schools', ref.id, 'members', auth.currentUser.uid), {
    role: 'owner', joinedAt: serverTimestamp()
  });
  await loadSchools();
  return ref.id;
}

export async function joinSchool(schoolId) {
  await setDoc(doc(db, 'schools', schoolId, 'members', auth.currentUser.uid), {
    role: 'teacher', joinedAt: serverTimestamp()
  });
  alert('Joined school');
}

async function selectSchool(id) {
  currentSchool = id;
  currentTerm = null;
  document.getElementById('term-panel').classList.remove('hidden');
  await loadTerms(id);
}

// ---------- Terms ----------
export async function loadTerms(schoolId) {
  const list = document.getElementById('term-list');
  list.innerHTML = '';
  const snap = await getDocs(collection(db, 'schools', schoolId, 'terms'));
  snap.forEach(t => {
    const data = t.data();
    const item = li(data.name || t.id);
    item.dataset.id = t.id;
    item.onclick = () => { currentTerm = t.id; showStep('classes'); loadMyClasses(currentSchool, currentTerm); };
    list.appendChild(item);
  });
}

export async function createTerm(schoolId, schoolYear) {
  const termId = `S.Y.${schoolYear}`;
  await setDoc(doc(db, 'schools', schoolId, 'terms', termId), {
    schoolYear,
    name: termId,
    createdAt: serverTimestamp()
  });
  await loadTerms(schoolId);
  return termId;
}

// ---------- Classes ----------
export async function loadMyClasses(schoolId, termId) {
  const list = document.getElementById('class-list');
  list.innerHTML = '';
  const q = query(collection(db, 'schools', schoolId, 'terms', termId, 'classes'), where('teacherUid', '==', auth.currentUser.uid), orderBy('createdAt'));
  const snap = await getDocs(q);
  snap.forEach(c => {
    const data = c.data();
    const item = li(data.name);
    item.dataset.id = c.id;
    list.appendChild(item);
  });
}

export async function createClass(schoolId, termId, { subject, schoolYear, section }) {
  const name = `${subject} - S.Y.${schoolYear} - ${section}`;
  const ref = await addDoc(collection(db, 'schools', schoolId, 'terms', termId, 'classes'), {
    name, subject, schoolYear, section,
    teacherUid: auth.currentUser.uid,
    createdAt: serverTimestamp()
  });
  await loadMyClasses(schoolId, termId);
  return ref.id;
}


// ---------- Roster ----------
async function loadRoster(schoolId, termId, classId) {
  const table = document.getElementById('roster-table');
  table.innerHTML = '<tr><th>Name</th><th>LRN</th><th>Sex</th><th>Birthdate</th><th>Group</th></tr>';
  const snap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'));
  const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // sort: Male then Female then alphabetical by name
  students.sort((a,b)=>{
    if(a.sex!==b.sex) return a.sex==='Male'? -1:1;
    return a.name.localeCompare(b.name);
  });
  students.forEach(s => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${s.name}</td><td>${s.lrn}</td><td>${s.sex}</td><td>${s.birthdate}</td><td>${s.group}</td>`;
    row.dataset.id = s.id;
    table.appendChild(row);
  });
  rosterCache = students; // used later for score grid
  buildScoreGrid();
}

let rosterCache = [];

export async function addStudent(schoolId, termId, classId, student) {
  if (!student.lrn) throw new Error('LRN required');
  // check unique LRN
  const q = query(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'), where('lrn', '==', student.lrn));
  const snap = await getDocs(q);
  if (!snap.empty) throw new Error('LRN already exists');
  await addDoc(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'), {
    ...student, createdAt: serverTimestamp()
  });
  await loadRoster(schoolId, termId, classId);
}

// ---------- Assessments ----------
let assessmentCache = [];

export async function listAssessments(schoolId, termId, classId) {
  const list = document.getElementById('assessment-list');
  list.innerHTML = '';
  const snap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'assessments'));
  assessmentCache = snap.docs.map(d=>({id:d.id,...d.data()}));
  assessmentCache.forEach(a=>{
    const item = li(`${a.code} (${a.maxScore})`);
    item.dataset.id = a.id;
    list.appendChild(item);
  });
  buildScoreGrid();
}

export async function createAssessment(schoolId, termId, classId, data) {
  if (data.maxScore <=0) throw new Error('maxScore must be > 0');
  const ref = await addDoc(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'assessments'), {
    ...data,
    createdAt: serverTimestamp(),
    createdByUid: auth.currentUser.uid
  });
  await listAssessments(schoolId, termId, classId);
  return ref.id;
}

export async function saveScore(schoolId, termId, classId, assessmentId, studentId, score) {
  if (score < 0) score = 0;
  const assess = assessmentCache.find(a=>a.id===assessmentId);
  if (assess && score > assess.maxScore) score = assess.maxScore;
  await setDoc(doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'assessments', assessmentId, 'scores', studentId), {
    score, updatedAt: serverTimestamp(), updatedByUid: auth.currentUser.uid
  });
}

// ---------- Behavior rules ----------
let ruleCache = [];

export async function listBehaviorRules(schoolId, termId, classId) {
  const list = document.getElementById('rule-list');
  list.innerHTML = '';
  const snap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'behaviorRules'));
  ruleCache = snap.docs.map(d=>({id:d.id,...d.data()}));
  ruleCache.forEach(r=>{
    const item = li(`${r.label} (${r.points})`);
    item.dataset.id = r.id;
    list.appendChild(item);
  });
}

export async function createBehaviorRule(schoolId, termId, classId, data) {
  data.points = Number(data.points);
  if (isNaN(data.points)) throw new Error('points must be numeric');
  const ref = await addDoc(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'behaviorRules'), {
    ...data,
    createdAt: serverTimestamp(),
    createdByUid: auth.currentUser.uid
  });
  await listBehaviorRules(schoolId, termId, classId);
  return ref.id;
}

export async function logBehaviorEvent(schoolId, termId, classId, studentId, ruleId) {
  const rule = ruleCache.find(r=>r.id===ruleId);
  if (!rule) throw new Error('rule not found');
  await addDoc(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'behaviorLogs'), {
    studentId,
    ruleId,
    kind: rule.kind,
    label: rule.label,
    points: rule.points,
    createdAt: serverTimestamp(),
    createdByUid: auth.currentUser.uid
  });
}

// ---------- Score Grid ----------
function buildScoreGrid() {
  const table = document.getElementById('score-grid');
  if (!table) return;
  table.innerHTML = '';
  if (assessmentCache.length === 0 || rosterCache.length === 0) return;
  const header = document.createElement('tr');
  header.innerHTML = '<th>Student</th>' + assessmentCache.map(a=>`<th>${a.code}</th>`).join('');
  table.appendChild(header);
  rosterCache.forEach(stu=>{
    const row = document.createElement('tr');
    row.innerHTML = `<td>${stu.name}</td>` + assessmentCache.map(a=>`<td><input type="number" min="0" data-assessment="${a.id}" data-student="${stu.id}"></td>`).join('');
    table.appendChild(row);
  });
  table.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('change', async e=>{
      const assessmentId = e.target.dataset.assessment;
      const studentId = e.target.dataset.student;
      const score = Number(e.target.value);
      await saveScore(currentSchool, currentTerm, currentClass, assessmentId, studentId, score);
    });
  });
}

// ---------- UI wiring ----------
const tabBtns = document.querySelectorAll('.wizard-tabs button');
tabBtns.forEach(btn=>btn.addEventListener('click', ()=>showStep(btn.dataset.step)));

// load schools on start
onAuthStateChanged(auth, ()=>{ loadSchools(); });

// form handlers
const csForm = document.getElementById('create-school-form');
csForm.addEventListener('submit', async e=>{
  e.preventDefault();
  await createSchool(csForm['school-name'].value.trim(), csForm['school-address'].value.trim());
  csForm.reset();
});

const termForm = document.getElementById('create-term-form');
termForm.addEventListener('submit', async e=>{
  e.preventDefault();
  if (!currentSchool) return alert('Select school first');
  await createTerm(currentSchool, termForm['term-school-year'].value.trim());
  termForm.reset();
});

const classForm = document.getElementById('create-class-form');
classForm.addEventListener('submit', async e=>{
  e.preventDefault();
  if (!currentSchool || !currentTerm) return alert('Select term first');
  const data = {
    subject: classForm['class-subject'].value.trim(),
    schoolYear: classForm['class-school-year'].value.trim(),
    section: classForm['class-section'].value.trim()
  };
  await createClass(currentSchool, currentTerm, data);
  classForm.reset();
});

const studentForm = document.getElementById('add-student-form');
if (studentForm) {
  studentForm.addEventListener('submit', async e=>{
    e.preventDefault();
    if (!currentSchool || !currentTerm || !currentClass) return alert('Open a class first');
    const student = {
      name: studentForm['student-name'].value.trim(),
      lrn: studentForm['student-lrn'].value.trim(),
      sex: studentForm['student-sex'].value.trim(),
      birthdate: studentForm['student-birthdate'].value,
      group: studentForm['student-group'].value.trim()
    };
    try {
      await addStudent(currentSchool, currentTerm, currentClass, student);
      studentForm.reset();
    } catch(err) {
      alert(err.message);
    }
  });
}

const assessForm = document.getElementById('add-assessment-form');
if (assessForm) {
  assessForm.addEventListener('submit', async e=>{
    e.preventDefault();
    if (!currentClass) return alert('Open a class first');
    const data = {
      category: assessForm['assessment-category'].value,
      code: assessForm['assessment-code'].value.trim(),
      title: assessForm['assessment-title'].value.trim(),
      maxScore: Number(assessForm['assessment-max'].value),
      createdByUid: auth.currentUser.uid
    };
    try {
      await createAssessment(currentSchool, currentTerm, currentClass, data);
      assessForm.reset();
    } catch(err) { alert(err.message); }
  });
}

const ruleForm = document.getElementById('add-rule-form');
if (ruleForm) {
  ruleForm.addEventListener('submit', async e=>{
    e.preventDefault();
    if (!currentClass) return alert('Open a class first');
    const data = {
      kind: ruleForm['rule-kind'].value,
      label: ruleForm['rule-label'].value.trim(),
      points: Number(ruleForm['rule-points'].value),
      createdByUid: auth.currentUser.uid
    };
    try {
      await createBehaviorRule(currentSchool, currentTerm, currentClass, data);
      ruleForm.reset();
    } catch(err) { alert(err.message); }
  });
}

