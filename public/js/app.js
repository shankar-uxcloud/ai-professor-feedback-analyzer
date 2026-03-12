const navLinks = document.querySelectorAll('.nav-links a');
const themeToggle = document.getElementById('themeToggle');

function getTheme() {
  return localStorage.getItem('pfa_theme') || 'light';
}

function setTheme(theme) {
  if (!theme) return;
  document.body.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('pfa_theme', theme);
  if (themeToggle) themeToggle.innerText = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
}

function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === path));
}

async function loadFileContent(file) {
  if (!file) return '';

  const name = file.name.toLowerCase();
  if (file.type === 'text/plain' || name.endsWith('.txt')) {
    return await file.text();
  }

  if (name.endsWith('.docx')) {
    if (window.mammoth) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }
    return 'Cannot parse DOCX in this browser environment.';
  }

  if (name.endsWith('.pdf')) {
    if (window.pdfjsLib) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      const pages = Math.min(5, pdf.numPages);
      for (let i = 1; i <= pages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((i) => i.str).join(' ') + '\n\n';
      }
      return text;
    }
    return 'Cannot parse PDF in this browser environment.';
  }

  return `Unsupported file type (${file.type || name}). Please copy/paste the content.`;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.right = '24px';
  toast.style.padding = '0.75rem 1rem';
  toast.style.background = type === 'error' ? '#dc2626' : '#2563eb';
  toast.style.color = '#fff';
  toast.style.borderRadius = '10px';
  toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
  toast.innerText = message;
  toast.style.zIndex = 999;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

async function initUploadPage() {
  const uploadInput = document.getElementById('assignmentFile');
  const filePreview = document.getElementById('filePreview');
  const assignmentInput = document.getElementById('assignmentText');

  if (uploadInput) {
    uploadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      filePreview.innerText = `Loading ${file.name}...`;
      try {
        const content = await loadFileContent(file);
        assignmentInput.value = content;
        filePreview.innerHTML = `<strong>Loaded:</strong> ${file.name}`;
      } catch (err) {
        console.error(err);
        filePreview.innerHTML = `<strong>Error:</strong> ${err.message || err}`;
      }
    });
  }

  const form = document.getElementById('analyzeForm');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const studentName = document.getElementById('studentName').value.trim() || 'Student';
    const assignmentTitle = document.getElementById('assignmentTitle').value.trim() || 'Untitled Assignment';
    const assignmentText = document.getElementById('assignmentText').value.trim();
    const professorComments = document.getElementById('professorComments').value.trim();

    if (!assignmentText && !professorComments) {
      showToast('Please provide assignment content or professor comments.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName, assignmentTitle, assignmentText, professorComments }),
      });
      const data = await res.json();

      if (!data.success) {
        showToast(data.error || 'Analysis failed', 'error');
        return;
      }

      localStorage.setItem('pfa_latest_analysis', JSON.stringify(data.data));
      showToast('Analysis completed! Redirecting to dashboard...', 'success');
      setTimeout(() => (window.location = 'dashboard.html'), 600);
    } catch (err) {
      console.error(err);
      showToast('Network error while analyzing.', 'error');
    }
  });
}

function buildList(items) {
  if (!items || !items.length) return '<em>No findings.</em>';
  return '<ul>' + items.map((i) => `<li>${i}</li>`).join('') + '</ul>';
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

async function initDashboardPage() {
  const dataJson = localStorage.getItem('pfa_latest_analysis');
  if (!dataJson) {
    document.getElementById('dashboardContent').innerHTML = '<p>No analysis available yet. Start <a href="upload.html">here</a>.</p>';
    return;
  }

  const entry = JSON.parse(dataJson);
  const analysis = entry.analysis || {
    strengths: [], weaknesses: [], improvementTips: [], learningAreas: [], suggestedResources: [], gradePrediction: '-', qualityScore: 0, criticalIssues: '-', summary: '-'
  };

  const statsTotal = (analysis.strengths?.length || 0) + (analysis.weaknesses?.length || 0);

  document.getElementById('studentNameDisplay').innerText = entry.studentName || 'Student';
  document.getElementById('assignmentTitleDisplay').innerText = entry.assignmentTitle || 'Untitled Assignment';
  document.getElementById('analysisTimestamp').innerText = formatDate(entry.timestamp);

  document.getElementById('strengthsPanel').innerHTML = buildList(analysis.strengths);
  document.getElementById('weaknessesPanel').innerHTML = buildList(analysis.weaknesses);
  document.getElementById('improvementPanel').innerHTML = buildList(analysis.improvementTips);
  document.getElementById('learningPanel').innerHTML = buildList(analysis.learningAreas);
  document.getElementById('resourcesPanel').innerHTML = buildList(analysis.suggestedResources);

  document.getElementById('gradePrediction').innerText = analysis.gradePrediction || 'N/A';
  document.getElementById('qualityScore').innerText = `${analysis.qualityScore || 0}/100`;
  document.getElementById('criticalIssue').innerText = analysis.criticalIssues || 'None';
  document.getElementById('summary').innerText = analysis.summary || 'No summary available.';

  const ctx1 = document.getElementById('chartStrengthWeakness').getContext('2d');
  window.chart1 = new Chart(ctx1, {
    type: 'doughnut',
    data: {
      labels: ['Strengths', 'Weaknesses'],
      datasets: [{ data: [analysis.strengths?.length || 0, analysis.weaknesses?.length || 0], backgroundColor: ['#16a34a', '#dc2626'] }],
    },
    options: { plugins: { legend: { position: 'bottom' } } },
  });

  const ctx2 = document.getElementById('chartImprovements').getContext('2d');
  window.chart2 = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: ['Improvement areas'],
      datasets: [{ label: 'Count', data: [analysis.improvementTips?.length || 0], backgroundColor: '#0ea5e9' }],
    },
    options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });

  const ctx3 = document.getElementById('chartQualityScore').getContext('2d');
  window.chart3 = new Chart(ctx3, {
    type: 'doughnut',
    data: {
      labels: ['Score', 'Remaining'],
      datasets: [{ data: [analysis.qualityScore || 0, Math.max(0, 100 - (analysis.qualityScore || 0))], backgroundColor: ['#60a5fa', '#cbd5e1'] }],
    },
    options: {
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      }
    },
  });

  document.getElementById('exportPdf').addEventListener('click', () => {
    const doc = new window.jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFontSize(18);
    doc.text('Professor Feedback Analyzer Report', 40, 45);
    doc.setFontSize(12);

    const lines = [
      `Student: ${entry.studentName || ''}`,
      `Assignment: ${entry.assignmentTitle || ''}`,
      `Date: ${formatDate(entry.timestamp)}`,
      `Grade Prediction: ${analysis.gradePrediction || ''}`,
      `Quality Score: ${analysis.qualityScore || 0}/100`,
      '',
      'Summary:',
      analysis.summary || '',
      '',
      'Critical Issue:',
      analysis.criticalIssues || '',
      '',
      'Strengths:',
      ...(analysis.strengths || []).map((x) => `- ${x}`),
      '',
      'Weaknesses:',
      ...(analysis.weaknesses || []).map((x) => `- ${x}`),
      '',
      'Improvement Tips:',
      ...(analysis.improvementTips || []).map((x) => `- ${x}`),
      '',
      'Key Learning Areas:',
      ...(analysis.learningAreas || []).map((x) => `- ${x}`),
    ];

    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(lines.join('\n'), 520), 40, 75);
    doc.save('pfa-report.pdf');
    showToast('Downloaded PDF report.');
  });
}

async function initHistoryPage() {
  try {
    const res = await fetch('/api/history');
    const json = await res.json();
    if (!json.success) { throw new Error('Failed to load history'); }
    const list = json.data || [];

    const output = document.getElementById('historyList');
    if (!output) return;

    if (!list.length) {
      output.innerHTML = '<div class="card"><p>No history entries yet. Do an analysis first.</p></div>';
      return;
    }

    output.innerHTML = list.map((item) => {
      const grade = item.analysis?.gradePrediction || 'N/A';
      return `
        <div class="card">
          <p><strong>${item.assignmentTitle || 'Untitled'}</strong></p>
          <p><small>${formatDate(item.timestamp)}</small></p>
          <p><span class="badge info">Grade prediction: ${grade}</span></p>
          <div class="simple-inline">
            <button class="button" data-id="${item.id}" data-action="view">View</button>
          </div>
        </div>`;
    }).join('');

    output.querySelectorAll('button[data-action="view"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.target.dataset.id);
        const selected = list.find((row) => row.id === id);
        if (selected) {
          localStorage.setItem('pfa_latest_analysis', JSON.stringify(selected));
          window.location.href = 'dashboard.html';
        }
      });
    });
  } catch (err) {
    console.error(err);
    document.getElementById('historyList').innerHTML = '<p>Error loading history.</p>';
  }
}

function initPage() {
  setTheme(getTheme());
  setActiveNav();

  if (themeToggle) {
    themeToggle.addEventListener('click', () => setTheme(document.body.classList.contains('dark') ? 'light' : 'dark'));
  }

  const page = window.location.pathname.split('/').pop();
  if (page === 'upload.html') initUploadPage();
  if (page === 'dashboard.html') initDashboardPage();
  if (page === 'history.html') initHistoryPage();
}

window.addEventListener('DOMContentLoaded', initPage);