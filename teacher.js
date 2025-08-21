// Event listeners for actions
document.getElementById('download').addEventListener('click', downloadCSV);
document.getElementById('save').addEventListener('click', saveTable);

// Initial counts for dynamic columns
let wwCount = 3;
let ptCount = 3;
let meritCount = 3;
let demeritCount = 3;

function addRow() {
  const tbody = document.getElementById('scores-body');
  const row = document.createElement('tr');
  let cells = `
    <td><input type="text" placeholder="Student Name"></td>
    <td><input type="text" placeholder="LRN"></td>
    <td><input type="text" placeholder="Grade-Section"></td>
    <td><input type="text" placeholder="Class"></td>
  `;

  for (let i = 0; i < wwCount; i++) {
    cells += `<td><input type="number" class="ww-input"></td>`;
  }
  cells += `<td><input type="number" class="ww-total" readonly></td>`;

  for (let i = 0; i < ptCount; i++) {
    cells += `<td><input type="number" class="pt-input"></td>`;
  }
  cells += `<td><input type="number" class="pt-total" readonly></td>`;

  for (let i = 0; i < meritCount; i++) {
    cells += `<td><input type="number" class="merit-input"></td>`;
  }
  cells += `<td><input type="number" class="merit-total" readonly></td>`;

  for (let i = 0; i < demeritCount; i++) {
    cells += `<td><input type="number" class="demerit-input"></td>`;
  }
  cells += `<td><input type="number" class="demerit-total" readonly></td>`;

  row.innerHTML = cells;
  tbody.appendChild(row);

  attachRowListeners(row);
  updateRowTotals(row);
  updateAddRowButton();
}

function attachRowListeners(row) {
  row.querySelectorAll('.ww-input').forEach(input => input.addEventListener('input', () => updateRowTotals(row)));
  row.querySelectorAll('.pt-input').forEach(input => input.addEventListener('input', () => updateRowTotals(row)));
  row.querySelectorAll('.merit-input').forEach(input => input.addEventListener('input', () => updateRowTotals(row)));
  row.querySelectorAll('.demerit-input').forEach(input => input.addEventListener('input', () => updateRowTotals(row)));
}

function updateRowTotals(row) {
  const sum = selector => Array.from(row.querySelectorAll(selector)).reduce((acc, input) => acc + (parseFloat(input.value) || 0), 0);
  row.querySelector('.ww-total').value = sum('.ww-input');
  row.querySelector('.pt-total').value = sum('.pt-input');
  row.querySelector('.merit-total').value = sum('.merit-input');
  row.querySelector('.demerit-total').value = sum('.demerit-input');
}

function updateWWAddButton() {
  const header = document.getElementById('ww-group');
  header.style.position = 'relative';
  if (!header.querySelector('.add-col-btn')) {
    const btn = document.createElement('button');
    btn.textContent = '+';
    btn.className = 'add-col-btn';
    btn.addEventListener('click', addWWColumn);
    header.appendChild(btn);
  }
}

function updatePTAddButton() {
  const header = document.getElementById('pt-group');
  header.style.position = 'relative';
  if (!header.querySelector('.add-col-btn')) {
    const btn = document.createElement('button');
    btn.textContent = '+';
    btn.className = 'add-col-btn';
    btn.addEventListener('click', addPTColumn);
    header.appendChild(btn);
  }
}

function updateMeritAddButton() {
  const header = document.getElementById('merit-group');
  header.style.position = 'relative';
  if (!header.querySelector('.add-col-btn')) {
    const btn = document.createElement('button');
    btn.textContent = '+';
    btn.className = 'add-col-btn';
    btn.addEventListener('click', addMeritColumn);
    header.appendChild(btn);
  }
}

function updateDemeritAddButton() {
  const header = document.getElementById('demerit-group');
  header.style.position = 'relative';
  if (!header.querySelector('.add-col-btn')) {
    const btn = document.createElement('button');
    btn.textContent = '+';
    btn.className = 'add-col-btn';
    btn.addEventListener('click', addDemeritColumn);
    header.appendChild(btn);
  }
}

function updateAddRowButton() {
  const tbody = document.getElementById('scores-body');
  const existing = document.getElementById('add-row-btn-row');
  if (existing) existing.remove();
  const addRowRow = document.createElement('tr');
  addRowRow.id = 'add-row-btn-row';
  const totalColumns = 4 + (wwCount + 1) + (ptCount + 1) + (meritCount + 1) + (demeritCount + 1);
  const btnCell = document.createElement('td');
  btnCell.className = 'add-row-cell';
  const btn = document.createElement('button');
  btn.textContent = '+';
  btn.className = 'add-row-btn';
  btn.addEventListener('click', addRow);
  btnCell.appendChild(btn);
  addRowRow.appendChild(btnCell);
  const spacer = document.createElement('td');
  spacer.colSpan = totalColumns - 1;
  spacer.className = 'add-row-spacer';
  addRowRow.appendChild(spacer);
  tbody.appendChild(addRowRow);
}

function addWWColumn() {
  wwCount++;
  const subHeader = document.getElementById('sub-header');
  const totalHeader = document.getElementById('ww-total-header');
  const th = document.createElement('th');
  th.className = 'ww-header';
  th.textContent = `WW${wwCount}`;
  subHeader.insertBefore(th, totalHeader);
  document.getElementById('ww-group').colSpan = wwCount + 1;

  const maxRow = document.getElementById('max-row');
  const maxPlaceholder = document.getElementById('ww-max-placeholder');
  const maxTh = document.createElement('th');
  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.className = 'ww-max';
  maxTh.appendChild(maxInput);
  maxRow.insertBefore(maxTh, maxPlaceholder);

  const rows = document.querySelectorAll('#scores-body tr');
  rows.forEach(row => {
    const totalCell = row.querySelector('.ww-total').parentElement;
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'ww-input';
    input.addEventListener('input', () => updateRowTotals(row));
    td.appendChild(input);
    row.insertBefore(td, totalCell);
  });
  updateWWAddButton();
  updateAddRowButton();
}

function addPTColumn() {
  ptCount++;
  const subHeader = document.getElementById('sub-header');
  const totalHeader = document.getElementById('pt-total-header');
  const th = document.createElement('th');
  th.className = 'pt-header';
  th.textContent = `PT${ptCount}`;
  subHeader.insertBefore(th, totalHeader);
  document.getElementById('pt-group').colSpan = ptCount + 1;

  const maxRow = document.getElementById('max-row');
  const maxPlaceholder = document.getElementById('pt-max-placeholder');
  const maxTh = document.createElement('th');
  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.className = 'pt-max';
  maxTh.appendChild(maxInput);
  maxRow.insertBefore(maxTh, maxPlaceholder);

  const rows = document.querySelectorAll('#scores-body tr');
  rows.forEach(row => {
    const totalCell = row.querySelector('.pt-total').parentElement;
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'pt-input';
    input.addEventListener('input', () => updateRowTotals(row));
    td.appendChild(input);
    row.insertBefore(td, totalCell);
  });
  updatePTAddButton();
  updateAddRowButton();
}

function addMeritColumn() {
  meritCount++;
  const subHeader = document.getElementById('sub-header');
  const totalHeader = document.getElementById('merit-total-header');
  const th = document.createElement('th');
  th.className = 'merit-header';
  th.textContent = `M${meritCount}`;
  subHeader.insertBefore(th, totalHeader);
  document.getElementById('merit-group').colSpan = meritCount + 1;

  const maxRow = document.getElementById('max-row');
  const maxPlaceholder = document.getElementById('merit-max-placeholder');
  const maxTh = document.createElement('th');
  const maxInput = document.createElement('input');
  maxInput.type = 'text';
  maxInput.className = 'merit-label';
  maxInput.maxLength = 4;
  maxTh.appendChild(maxInput);
  maxRow.insertBefore(maxTh, maxPlaceholder);

  const rows = document.querySelectorAll('#scores-body tr');
  rows.forEach(row => {
    const totalCell = row.querySelector('.merit-total').parentElement;
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'merit-input';
    input.addEventListener('input', () => updateRowTotals(row));
    td.appendChild(input);
    row.insertBefore(td, totalCell);
  });
  updateMeritAddButton();
  updateAddRowButton();
}

function addDemeritColumn() {
  demeritCount++;
  const subHeader = document.getElementById('sub-header');
  const totalHeader = document.getElementById('demerit-total-header');
  const th = document.createElement('th');
  th.className = 'demerit-header';
  th.textContent = `D${demeritCount}`;
  subHeader.insertBefore(th, totalHeader);
  document.getElementById('demerit-group').colSpan = demeritCount + 1;

  const maxRow = document.getElementById('max-row');
  const maxPlaceholder = document.getElementById('demerit-max-placeholder');
  const maxTh = document.createElement('th');
  const maxInput = document.createElement('input');
  maxInput.type = 'text';
  maxInput.className = 'demerit-label';
  maxInput.maxLength = 4;
  maxTh.appendChild(maxInput);
  maxRow.insertBefore(maxTh, maxPlaceholder);

  const rows = document.querySelectorAll('#scores-body tr');
  rows.forEach(row => {
    const totalCell = row.querySelector('.demerit-total').parentElement;
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'demerit-input';
    input.addEventListener('input', () => updateRowTotals(row));
    td.appendChild(input);
    row.insertBefore(td, totalCell);
  });
  updateDemeritAddButton();
  updateAddRowButton();
}

function downloadCSV() {
  const rows = document.querySelectorAll('#scores-table tr');
  const csv = Array.from(rows).map(row => {
    const cols = row.querySelectorAll('th, td');
    return Array.from(cols).map(col => {
      const input = col.querySelector('input');
      return input ? input.value : col.innerText;
    }).join(',');
  }).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'scores.csv';
  link.click();
}

function saveTable() {
  localStorage.setItem('scoresTable', document.getElementById('scores-table').innerHTML);
  localStorage.setItem('wwCount', wwCount);
  localStorage.setItem('ptCount', ptCount);
  localStorage.setItem('meritCount', meritCount);
  localStorage.setItem('demeritCount', demeritCount);
  alert('Scores saved');
}

function loadSavedData() {
  const saved = localStorage.getItem('scoresTable');
  if (saved) {
    document.getElementById('scores-table').innerHTML = saved;
    wwCount = parseInt(localStorage.getItem('wwCount')) || 3;
    ptCount = parseInt(localStorage.getItem('ptCount')) || 3;
    meritCount = parseInt(localStorage.getItem('meritCount')) || 3;
    demeritCount = parseInt(localStorage.getItem('demeritCount')) || 3;
    document.querySelectorAll('#scores-body tr').forEach(row => {
      attachRowListeners(row);
      updateRowTotals(row);
    });
    document.querySelectorAll('#ww-group .add-col-btn').forEach(btn => btn.addEventListener('click', addWWColumn));
    document.querySelectorAll('#pt-group .add-col-btn').forEach(btn => btn.addEventListener('click', addPTColumn));
    document.querySelectorAll('#merit-group .add-col-btn').forEach(btn => btn.addEventListener('click', addMeritColumn));
    document.querySelectorAll('#demerit-group .add-col-btn').forEach(btn => btn.addEventListener('click', addDemeritColumn));
    updateAddRowButton();
  } else {
    addRow();
    updateAddRowButton();
  }
  updateWWAddButton();
  updatePTAddButton();
  updateMeritAddButton();
  updateDemeritAddButton();
}

// Initialize
loadSavedData();
