import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  writeBatch,
  increment,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const teacherSubtitle = document.getElementById('teacherSubtitle');
const logoutBtn = document.getElementById('logoutBtn');
const loadedStudentsCount = document.getElementById('loadedStudentsCount');
const selectedStudentsCount = document.getElementById('selectedStudentsCount');
const currentSectionLabel = document.getElementById('currentSectionLabel');
const sectionFilter = document.getElementById('sectionFilter');
const searchInput = document.getElementById('searchInput');
const applyFilterBtn = document.getElementById('applyFilterBtn');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const studentListHint = document.getElementById('studentListHint');
const studentTableBody = document.getElementById('studentTableBody');
const pointsInput = document.getElementById('pointsInput');
const reasonInput = document.getElementById('reasonInput');
const addMeritBtn = document.getElementById('addMeritBtn');
const addDemeritBtn = document.getElementById('addDemeritBtn');
const actionStatus = document.getElementById('actionStatus');
const recentLogsList = document.getElementById('recentLogsList');

let activeTeacher = null;
let allStudents = [];
let filteredStudents = [];

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'teacher-login.html';
});

applyFilterBtn.addEventListener('click', () => {
  applyStudentFilters();
  renderStudents();
});

searchInput.addEventListener('input', () => {
  applyStudentFilters();
  renderStudents();
});

sectionFilter.addEventListener('change', () => {
  applyStudentFilters();
  renderStudents();
});

selectAllCheckbox.addEventListener('change', () => {
  const checkboxes = studentTableBody.querySelectorAll('.student-select');
  checkboxes.forEach((cb) => { cb.checked = selectAllCheckbox.checked; });
  updateSelectionCount();
});

addMeritBtn.addEventListener('click', () => applyPointAction('merit'));
addDemeritBtn.addEventListener('click', () => applyPointAction('demerit'));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'teacher-login.html';
    return;
  }

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const role = userDoc.exists() ? userDoc.data().role : null;

  if (role !== 'teacher') {
    await signOut(auth);
    alert('Access denied. Teacher account is required.');
    window.location.href = 'teacher-login.html';
    return;
  }

  const teacherDoc = await getDoc(doc(db, 'teachers', user.uid));
  const teacherData = teacherDoc.exists() ? teacherDoc.data() : {};
  const teacherName = [teacherData.firstName, teacherData.lastName].filter(Boolean).join(' ').trim();

  activeTeacher = {
    uid: user.uid,
    email: user.email || userDoc.data()?.email || '',
    displayName: teacherName || user.email || 'Teacher'
  };

  teacherSubtitle.textContent = `${activeTeacher.displayName} • Teacher access verified`;

  await loadStudents();
  await loadRecentLogs();
});

async function loadStudents() {
  const snap = await getDocs(collection(db, 'students'));
  allStudents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const uniqueSections = [...new Set(allStudents.map((s) => (s.section || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  sectionFilter.innerHTML = '<option value="">All Sections</option>';
  uniqueSections.forEach((sec) => {
    const opt = document.createElement('option');
    opt.value = sec;
    opt.textContent = sec;
    sectionFilter.appendChild(opt);
  });

  applyStudentFilters();
  renderStudents();
}

function applyStudentFilters() {
  const section = sectionFilter.value.trim().toLowerCase();
  const searchText = searchInput.value.trim().toLowerCase();

  filteredStudents = allStudents
    .filter((s) => {
      const sectionOk = !section || (s.section || '').toLowerCase() === section;
      if (!sectionOk) return false;

      if (!searchText) return true;
      const fullName = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ').toLowerCase();
      const lrn = String(s.lrn || '').toLowerCase();
      return fullName.includes(searchText) || lrn.includes(searchText);
    })
    .sort((a, b) => {
      const nameA = [a.lastName, a.firstName].filter(Boolean).join(' ');
      const nameB = [b.lastName, b.firstName].filter(Boolean).join(' ');
      return nameA.localeCompare(nameB);
    });

  loadedStudentsCount.textContent = String(filteredStudents.length);
  currentSectionLabel.textContent = sectionFilter.value || 'All Sections';
  selectAllCheckbox.checked = false;
}

function renderStudents() {
  if (filteredStudents.length === 0) {
    studentTableBody.innerHTML = '<tr><td colspan="5" class="empty-row">No students match the selected filters.</td></tr>';
    studentListHint.textContent = 'No students in current view.';
    updateSelectionCount();
    return;
  }

  studentTableBody.innerHTML = filteredStudents.map((student) => {
    const fullName = [student.lastName, student.firstName, student.middleName].filter(Boolean).join(', ');
    const safeName = fullName || student.email || 'Unknown Student';
    return `
      <tr data-student-id="${student.id}">
        <td><input class="student-select" type="checkbox" aria-label="Select ${safeName}"></td>
        <td>${safeName}</td>
        <td>${student.lrn || '-'}</td>
        <td>${student.section || '-'}</td>
        <td>${Number(student.points || 0)}</td>
      </tr>
    `;
  }).join('');

  studentListHint.textContent = `${filteredStudents.length} students loaded.`;

  studentTableBody.querySelectorAll('.student-select').forEach((cb) => {
    cb.addEventListener('change', () => {
      syncSelectAllState();
      updateSelectionCount();
    });
  });

  updateSelectionCount();
}

function syncSelectAllState() {
  const checkboxes = [...studentTableBody.querySelectorAll('.student-select')];
  if (checkboxes.length === 0) {
    selectAllCheckbox.checked = false;
    return;
  }
  selectAllCheckbox.checked = checkboxes.every((cb) => cb.checked);
}

function getSelectedStudents() {
  return [...studentTableBody.querySelectorAll('tr')]
    .filter((row) => row.querySelector('.student-select')?.checked)
    .map((row) => {
      const studentId = row.dataset.studentId;
      return filteredStudents.find((s) => s.id === studentId);
    })
    .filter(Boolean);
}

function updateSelectionCount() {
  selectedStudentsCount.textContent = String(getSelectedStudents().length);
}

async function applyPointAction(type) {
  actionStatus.textContent = '';
  const selectedStudents = getSelectedStudents();
  const points = Number(pointsInput.value);
  const reason = reasonInput.value.trim();

  if (selectedStudents.length === 0) {
    actionStatus.textContent = 'Please select at least one student.';
    return;
  }

  if (!Number.isInteger(points) || points <= 0) {
    actionStatus.textContent = 'Please enter a valid positive whole number of points.';
    return;
  }

  if (!reason) {
    actionStatus.textContent = 'Please enter a reason before submitting.';
    return;
  }

  const direction = type === 'merit' ? 1 : -1;
  const batch = writeBatch(db);

  try {
    selectedStudents.forEach((student) => {
      batch.update(doc(db, 'students', student.id), {
        points: increment(direction * points)
      });
    });

    await batch.commit();

    for (const student of selectedStudents) {
      const studentName = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ').trim()
        || student.email || 'Unknown Student';

      await addDoc(collection(db, 'pointLogs'), {
        studentId: student.id,
        studentName,
        lrn: student.lrn || '',
        section: student.section || '',
        type,
        points,
        reason,
        teacherId: activeTeacher.uid,
        teacherName: activeTeacher.displayName,
        teacherEmail: activeTeacher.email,
        createdAt: serverTimestamp()
      });
    }

    actionStatus.textContent = `${type === 'merit' ? 'Merit' : 'Demerit'} applied to ${selectedStudents.length} student(s).`;
    pointsInput.value = '';
    reasonInput.value = '';

    await loadStudents();
    await loadRecentLogs();
  } catch (error) {
    console.error(error);
    actionStatus.textContent = `Failed to apply ${type}. Please try again.`;
  }
}

async function loadRecentLogs() {
  recentLogsList.innerHTML = '<p class="small-note">Loading recent logs...</p>';

  try {
    const q = query(collection(db, 'pointLogs'), orderBy('createdAt', 'desc'), limit(15));
    const snap = await getDocs(q);

    if (snap.empty) {
      recentLogsList.innerHTML = '<p class="small-note">No point logs yet.</p>';
      return;
    }

    const logsHtml = snap.docs.map((entry) => {
      const log = entry.data();
      const when = log.createdAt?.toDate ? log.createdAt.toDate() : null;
      const formattedDate = when
        ? new Intl.DateTimeFormat('en-US', {
          month: 'short', day: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }).format(when)
        : 'Pending timestamp';

      const teacherDisplay = log.teacherName || log.teacherEmail || 'Unknown Teacher';
      const typeClass = (log.type || '').toLowerCase() === 'demerit' ? 'demerit' : 'merit';

      return `
        <article class="log-item" role="listitem">
          <div class="log-top">
            <span>${log.studentName || 'Unknown Student'}</span>
            <span>${formattedDate}</span>
          </div>
          <div>
            <span class="log-type ${typeClass}">${log.type || '-'}</span>
            <strong>${Number(log.points || 0)} pts</strong>
          </div>
          <p>${log.reason || 'No reason provided.'}</p>
          <p class="small-note">Teacher: ${teacherDisplay}</p>
        </article>
      `;
    }).join('');

    recentLogsList.innerHTML = logsHtml;
  } catch (error) {
    console.error(error);
    recentLogsList.innerHTML = '<p class="small-note">Unable to load logs. Check Firestore index/settings.</p>';
  }
}
