/**
 * Teacher Score Encoder for COTE Web App
 *
 * Update the CLASS_ID and TERM_ID constants below to point to a different
 * class or grading term. Columns for additional scores (e.g. ww2, pt3) are
 * automatically discovered by scanning Firestore data and the table is
 * rebuilt whenever data changes.
 */

// Firebase imports
import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ----- Configurable constants -----
const CLASS_ID = "12A-Physics"; // change to the desired class id
const TERM_ID = "2025-Q1";      // reserved for future use

// ----- Local state -----
let students = [];
let currentCols = { wwCols: ["ww1"], ptCols: ["pt1"], mCols: ["m1"], dCols: ["d1"] };

// Listen for changes in the students collection and re-render when updates arrive
const studentsCol = collection(db, "classes", CLASS_ID, "students");
onSnapshot(studentsCol, (snap) => {
  students = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      profile: data.profile || {},
      writtenWorks: data.writtenWorks || {},
      performanceTasks: data.performanceTasks || {},
      merits: data.merits || {},
      demerits: data.demerits || {}
    };
  });
  currentCols = discoverColumns(students);
  buildThead(currentCols.wwCols, currentCols.ptCols, currentCols.mCols, currentCols.dCols);
  renderRows(students, currentCols.wwCols, currentCols.ptCols, currentCols.mCols, currentCols.dCols);
});

// ----- Event bindings -----
document.getElementById("download").addEventListener("click", () =>
  downloadCsv(
    students,
    currentCols.wwCols,
    currentCols.ptCols,
    currentCols.mCols,
    currentCols.dCols
  )
);

document.getElementById("save").addEventListener("click", () => {
  document
    .querySelectorAll("#scores-body tr")
    .forEach((tr) =>
      recomputeRowTotals(
        tr,
        currentCols.wwCols,
        currentCols.ptCols,
        currentCols.mCols,
        currentCols.dCols
      )
    );
});

// ================= Helper Functions =================

// Natural sort helper based on numeric suffix (ww1, ww2, ww10, ...)
function naturalSortByIndex(prefix) {
  return (a, b) =>
    parseInt(a.slice(prefix.length), 10) -
    parseInt(b.slice(prefix.length), 10);
}

// Discover additional columns from Firestore data
function discoverColumns(students) {
  const wwSet = new Set(["ww1"]);
  const ptSet = new Set(["pt1"]);
  const mSet = new Set(["m1"]);
  const dSet = new Set(["d1"]);

  const addKeys = (obj, set, regex) => {
    Object.keys(obj || {}).forEach((k) => {
      if (regex.test(k)) set.add(k.toLowerCase());
    });
  };

  students.forEach((s) => {
    addKeys(s.writtenWorks, wwSet, /^ww\d+$/i);
    addKeys(s.performanceTasks, ptSet, /^pt\d+$/i);
    addKeys(s.merits, mSet, /^m\d+$/i);
    addKeys(s.demerits, dSet, /^d\d+$/i);
  });

  return {
    wwCols: Array.from(wwSet).sort(naturalSortByIndex("ww")),
    ptCols: Array.from(ptSet).sort(naturalSortByIndex("pt")),
    mCols: Array.from(mSet).sort(naturalSortByIndex("m")),
    dCols: Array.from(dSet).sort(naturalSortByIndex("d"))
  };
}

// Build the table header (two rows)
function buildThead(wwCols, ptCols, mCols, dCols) {
  const thead = document.querySelector("#scores-table thead");
  thead.innerHTML = "";

  const groupRow = document.createElement("tr");
  const subRow = document.createElement("tr");

  const makeGroup = (label, span) => {
    const th = document.createElement("th");
    th.textContent = label;
    th.colSpan = span;
    groupRow.appendChild(th);
  };

  makeGroup("Student Profile", 4);
  makeGroup("Written Works", wwCols.length + 1);
  makeGroup("Performance Task", ptCols.length + 1);
  makeGroup("Merit", mCols.length + 1);
  makeGroup("Demerit", dCols.length + 1);

  thead.appendChild(groupRow);

  ["Student Name", "LRN", "Grade-Section", "Class"].forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    subRow.appendChild(th);
  });

  const pushCols = (cols, totalLabel) => {
    cols.forEach((c) => {
      const th = document.createElement("th");
      th.textContent = c.toUpperCase();
      subRow.appendChild(th);
    });
    const th = document.createElement("th");
    th.textContent = totalLabel;
    subRow.appendChild(th);
  };

  pushCols(wwCols, "TWW");
  pushCols(ptCols, "TPT");
  pushCols(mCols, "TM");
  pushCols(dCols, "TD");

  thead.appendChild(subRow);
}

// Render table body rows for students
function renderRows(students, wwCols, ptCols, mCols, dCols) {
  const tbody = document.getElementById("scores-body");
  tbody.innerHTML = "";

  students.forEach((stu) => {
    const tr = document.createElement("tr");
    const addCell = (text) => {
      const td = document.createElement("td");
      td.textContent = text || "";
      tr.appendChild(td);
    };

    addCell(stu.profile.name);
    addCell(stu.profile.lrn);
    addCell(stu.profile.section);
    addCell(stu.profile.className);

    const appendGroup = (cols, bucket) => {
      cols.forEach((col) => {
        const td = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        const val = stu[bucket] ? stu[bucket][col] : undefined;
        if (val !== undefined && val !== null) input.value = val;
        input.dataset.studentId = stu.id;
        input.dataset.bucket = bucket;
        input.dataset.key = col;
        input.addEventListener("change", onScoreChange);
        td.appendChild(input);
        tr.appendChild(td);
      });
      const totalTd = document.createElement("td");
      totalTd.dataset.bucket = bucket;
      tr.appendChild(totalTd);
    };

    appendGroup(wwCols, "writtenWorks");
    appendGroup(ptCols, "performanceTasks");
    appendGroup(mCols, "merits");
    appendGroup(dCols, "demerits");

    tbody.appendChild(tr);
    recomputeRowTotals(tr, wwCols, ptCols, mCols, dCols);
  });
}

// Handle score changes from input fields
async function onScoreChange(e) {
  const input = e.target;
  const studentId = input.dataset.studentId;
  const bucket = input.dataset.bucket;
  const key = input.dataset.key;
  const valueStr = input.value.trim();
  const value = valueStr === "" ? null : Number(valueStr);
  const student = students.find((s) => s.id === studentId);

  if (value === null) {
    if (student[bucket]) delete student[bucket][key];
  } else {
    if (!student[bucket]) student[bucket] = {};
    student[bucket][key] = value;
  }

  await upsertScore(studentId, bucket, key, value);
  recomputeRowTotals(
    input.closest("tr"),
    currentCols.wwCols,
    currentCols.ptCols,
    currentCols.mCols,
    currentCols.dCols
  );
}

// Write the updated score back to Firestore
async function upsertScore(studentId, bucket, key, value) {
  const ref = doc(db, "classes", CLASS_ID, "students", studentId);
  const payload = { [bucket]: { [key]: value } };
  await setDoc(ref, payload, { merge: true });
}

// Recompute totals for a single row
function recomputeRowTotals(tr, wwCols, ptCols, mCols, dCols) {
  const sum = (cols, bucket) => {
    let total = 0;
    cols.forEach((c) => {
      const input = tr.querySelector(
        `input[data-bucket="${bucket}"][data-key="${c}"]`
      );
      const val = parseFloat(input?.value);
      if (!isNaN(val)) total += val;
    });
    const td = tr.querySelector(`td[data-bucket="${bucket}"]`);
    if (td) td.textContent = total;
  };

  sum(wwCols, "writtenWorks");
  sum(ptCols, "performanceTasks");
  sum(mCols, "merits");
  sum(dCols, "demerits");
}

// Generate and download a CSV of the current table
function downloadCsv(students, wwCols, ptCols, mCols, dCols) {
  const header = [
    "Student Name",
    "LRN",
    "Grade-Section",
    "Class",
    ...wwCols.map((c) => c.toUpperCase()),
    "TWW",
    ...ptCols.map((c) => c.toUpperCase()),
    "TPT",
    ...mCols.map((c) => c.toUpperCase()),
    "TM",
    ...dCols.map((c) => c.toUpperCase()),
    "TD"
  ];

  const lines = [header.join(",")];

  students.forEach((stu) => {
    const row = [];
    row.push(stu.profile.name || "");
    row.push(stu.profile.lrn || "");
    row.push(stu.profile.section || "");
    row.push(stu.profile.className || "");

    let total = 0;
    wwCols.forEach((c) => {
      const val = stu.writtenWorks[c];
      row.push(val != null ? val : "");
      total += Number(val) || 0;
    });
    row.push(total);

    total = 0;
    ptCols.forEach((c) => {
      const val = stu.performanceTasks[c];
      row.push(val != null ? val : "");
      total += Number(val) || 0;
    });
    row.push(total);

    total = 0;
    mCols.forEach((c) => {
      const val = stu.merits[c];
      row.push(val != null ? val : "");
      total += Number(val) || 0;
    });
    row.push(total);

    total = 0;
    dCols.forEach((c) => {
      const val = stu.demerits[c];
      row.push(val != null ? val : "");
      total += Number(val) || 0;
    });
    row.push(total);

    lines.push(row.join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `scores_${CLASS_ID}.csv`;
  a.click();
}

