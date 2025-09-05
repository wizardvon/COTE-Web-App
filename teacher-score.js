const tableBody = document.getElementById('studentTable').getElementsByTagName('tbody')[0];
let history = [];

function saveData() {
  const data = [];
  for (const row of tableBody.rows) {
    const rowData = [];
    for (const cell of row.cells) {
      rowData.push(cell.innerText);
    }
    data.push(rowData);
  }
  localStorage.setItem('teacherScoreData', JSON.stringify(data));
}

function loadData() {
  const data = JSON.parse(localStorage.getItem('teacherScoreData'));
  if (data) {
    tableBody.innerHTML = '';
    for (const rowData of data) {
      const row = tableBody.insertRow();
      for (const cellData of rowData) {
        const cell = row.insertCell();
        cell.contentEditable = 'true';
        cell.innerText = cellData;
      }
    }
  }
}

function addRow() {
  const row = tableBody.insertRow();
  const columns = tableBody.rows[0]?.cells.length || 0;
  for (let i = 0; i < columns; i++) {
    const cell = row.insertCell();
    cell.contentEditable = 'true';
  }
  saveData();
}

function undo() {
  if (history.length > 0) {
    tableBody.innerHTML = history.pop();
    saveData();
  }
}

function clearAll() {
  if (confirm('Clear all data?')) {
    tableBody.innerHTML = '';
    saveData();
  }
}

tableBody.addEventListener('input', () => {
  history.push(tableBody.innerHTML);
  saveData();
});

window.addEventListener('load', loadData);

