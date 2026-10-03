// ========================================================
// STATE MANAGEMENT & GLOBAL VARIABLES
// ========================================================
let currentUser = null;
let authToken = localStorage.getItem('iot_token');
let currentTab = 1;
let currentPage = 1;
let recordsPerPage = 10;
let totalPages = 1;
let totalRecords = 0;
let telemetryChart = null;
let pollTimer = null;
let ledState = 'OFF';
let lcdState = { line1: 'Simple IoT World', line2: 'Welcome Tushar' };
let currentLcdColor = 'green';

// ========================================================
// INITIALIZATION ON DOM READY
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  checkAuth();
  initChart();
  updateLcdPreview();
});

// ========================================================
// THEME MANAGEMENT (LIGHT / DARK)
// ========================================================
function initTheme() {
  const savedTheme = localStorage.getItem('iot_theme') || 'dark';
  applyTheme(savedTheme);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const newTheme = isDark ? 'light' : 'dark';
  applyTheme(newTheme);
  localStorage.setItem('iot_theme', newTheme);
  showToast(`Switched to ${newTheme.toUpperCase()} mode`, 'info');
}

function applyTheme(theme) {
  const sunIcon = document.getElementById('sun-icon');
  const moonIcon = document.getElementById('moon-icon');

  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    if (sunIcon) sunIcon.classList.remove('hidden');
    if (moonIcon) moonIcon.classList.add('hidden');
  } else {
    document.documentElement.classList.remove('dark');
    if (sunIcon) sunIcon.classList.add('hidden');
    if (moonIcon) moonIcon.classList.remove('hidden');
  }

  // Update chart colors if chart exists
  if (telemetryChart) {
    updateChartTheme();
  }
}

// ========================================================
// AUTHENTICATION LOGIC (PAGE 1)
// ========================================================
function showAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  const loginBtn = document.getElementById('tab-login-btn');
  const regBtn = document.getElementById('tab-register-btn');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    loginBtn.className = 'flex-1 pb-3 text-sm font-semibold border-b-2 border-red-600 text-red-600 dark:text-red-400 transition-colors';
    regBtn.className = 'flex-1 pb-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors';
  } else {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    regBtn.className = 'flex-1 pb-3 text-sm font-semibold border-b-2 border-red-600 text-red-600 dark:text-red-400 transition-colors';
    loginBtn.className = 'flex-1 pb-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors';
  }
}

function fillDemoAccount() {
  document.getElementById('login-email').value = 'tushar@example.com';
  document.getElementById('login-password').value = 'password123';
  showToast('Filled demo credentials for Tushar', 'info');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const submitBtn = document.getElementById('login-submit-btn');

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Signing In...</span>`;

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Login failed');
    }

    // Save Auth
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('iot_token', authToken);
    localStorage.setItem('iot_user', JSON.stringify(currentUser));

    showToast(`Welcome back, ${currentUser.name}!`, 'success');
    showDashboardView();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>Sign In to Dashboard</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>`;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const submitBtn = document.getElementById('reg-submit-btn');

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Creating Account...</span>`;

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Registration failed');
    }

    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('iot_token', authToken);
    localStorage.setItem('iot_user', JSON.stringify(currentUser));

    showToast(`Account created! Welcome, ${currentUser.name}!`, 'success');
    showDashboardView();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>Register & Login</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>`;
  }
}

function handleLogout() {
  localStorage.removeItem('iot_token');
  localStorage.removeItem('iot_user');
  authToken = null;
  currentUser = null;
  if (pollTimer) clearInterval(pollTimer);
  showAuthView();
  showToast('Logged out successfully', 'info');
}

function checkAuth() {
  const savedUser = localStorage.getItem('iot_user');
  if (authToken && savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      showDashboardView();
    } catch {
      showAuthView();
    }
  } else {
    showAuthView();
  }
}

function showAuthView() {
  document.getElementById('auth-page').classList.remove('hidden');
  document.getElementById('dashboard-page').classList.add('hidden');
  if (pollTimer) clearInterval(pollTimer);
}

function showDashboardView() {
  document.getElementById('auth-page').classList.add('hidden');
  document.getElementById('dashboard-page').classList.remove('hidden');

  // Update Header User Name
  const welcomeText = currentUser ? `Welcome ${currentUser.name}` : 'Welcome User';
  const headerUser = document.getElementById('header-user-welcome');
  if (headerUser) headerUser.textContent = welcomeText;

  // Load Initial Data
  refreshData();
  fetchDeviceState();

  // Start Live Polling every 3 seconds
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    refreshData(false); // background refresh without loading spinners
  }, 3000);
}

// ========================================================
// TAB SWITCHING (TABS 1, 2, 3)
// ========================================================
function switchDashboardTab(tabIndex) {
  currentTab = tabIndex;

  // Nav buttons
  for (let i = 1; i <= 3; i++) {
    const btn = document.getElementById(`nav-tab-${i}`);
    const content = document.getElementById(`content-tab-${i}`);

    if (i === tabIndex) {
      btn.className = 'tab-btn active px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm shadow-red-500/20';
      content.classList.remove('hidden');
    } else {
      btn.className = 'tab-btn px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all';
      content.classList.add('hidden');
    }
  }

  if (tabIndex === 1 && telemetryChart) {
    setTimeout(() => {
      telemetryChart.resize();
    }, 100);
  }
}

// ========================================================
// SENSOR TELEMETRY & RECORDS (TAB 1)
// ========================================================
async function refreshData(showSpinner = true) {
  try {
    const res = await fetch(`/api/sensor-data?page=${currentPage}&limit=${recordsPerPage}`);
    const data = await res.json();

    if (!data.success) return;

    // 1. Update ESP8266 ONLINE / OFFLINE Status Badge
    updateDeviceBadge(data.device.isOnline, data.device.lastPingSecondsAgo);

    // 2. Update Gauges with current values
    if (data.current) {
      updateTelemetryGauges(data.current.temperature, data.current.humidity);
    }

    // 3. Update Chart
    if (data.chartData) {
      updateTelemetryChart(data.chartData);
    }

    // 4. Update Records Table & Pagination
    if (data.records && data.pagination) {
      renderRecordsTable(data.records, data.pagination);
    }

    // 5. Update LED button state if changed remotely
    if (data.device && data.device.ledStatus) {
      updateLedUI(data.device.ledStatus);
    }

    // 6. Update LCD state if not editing
    if (data.device && data.device.lcdLine1 && !document.getElementById('lcd-input-1').matches(':focus')) {
      document.getElementById('lcd-input-1').value = data.device.lcdLine1.trim();
      document.getElementById('lcd-input-2').value = (data.device.lcdLine2 || '').trim();
      updateLcdPreview();
    }

  } catch (err) {
    console.error('Error refreshing data:', err);
  }
}

// Update ESP8266 Live Online/Offline Status Indicator
function updateDeviceBadge(isOnline, secondsAgo) {
  const badge = document.getElementById('device-status-badge');
  const dot = document.getElementById('device-status-dot');
  const text = document.getElementById('device-status-text');

  if (!badge || !dot || !text) return;

  if (isOnline) {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 online-pulse';
    text.className = 'text-emerald-600 dark:text-emerald-400 font-bold';
    text.textContent = 'ESP8266 ONLINE';
    badge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/80 shadow-sm';
    badge.title = secondsAgo !== null ? `Last active: ${secondsAgo}s ago` : 'Connected';
  } else {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
    text.className = 'text-rose-600 dark:text-rose-400 font-semibold';
    text.textContent = 'ESP8266 OFFLINE';
    badge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700';
    badge.title = secondsAgo !== null ? `Offline (Last seen: ${secondsAgo}s ago)` : 'Device has not connected yet';
  }
}

// Update Colorful Gauges & Seekbars
function updateTelemetryGauges(temp, hum) {
  const tempVal = parseFloat(temp) || 0;
  const humVal = parseFloat(hum) || 0;

  // Temperature Elements
  const tempDisplay = document.getElementById('temp-display-val');
  const tempCircle = document.getElementById('temp-gauge-circle');
  const tempSeekBar = document.getElementById('temp-seek-bar');
  const tempStatus = document.getElementById('temp-status-tag');

  if (tempDisplay) tempDisplay.textContent = tempVal.toFixed(1);

  // SVG Circumference = 2 * PI * 40 = 251.2
  const maxTemp = 50; // max scale 50°C
  const tempPercent = Math.min(100, Math.max(0, (tempVal / maxTemp) * 100));
  const tempOffset = 251.2 - (tempPercent / 100) * 251.2;

  if (tempCircle) tempCircle.style.strokeDashoffset = tempOffset;
  if (tempSeekBar) tempSeekBar.style.width = `${tempPercent}%`;

  if (tempStatus) {
    if (tempVal < 18) {
      tempStatus.textContent = 'Cool / Cold';
      tempStatus.className = 'font-semibold text-blue-500';
    } else if (tempVal <= 32) {
      tempStatus.textContent = 'Optimal / Comfortable';
      tempStatus.className = 'font-semibold text-emerald-500';
    } else if (tempVal <= 38) {
      tempStatus.textContent = 'Warm / Elevated';
      tempStatus.className = 'font-semibold text-amber-500';
    } else {
      tempStatus.textContent = 'High / Critical';
      tempStatus.className = 'font-semibold text-rose-500';
    }
  }

  // Humidity Elements
  const humDisplay = document.getElementById('hum-display-val');
  const humCircle = document.getElementById('hum-gauge-circle');
  const humSeekBar = document.getElementById('hum-seek-bar');
  const humStatus = document.getElementById('hum-status-tag');

  if (humDisplay) humDisplay.textContent = humVal.toFixed(1);

  const humPercent = Math.min(100, Math.max(0, humVal));
  const humOffset = 251.2 - (humPercent / 100) * 251.2;

  if (humCircle) humCircle.style.strokeDashoffset = humOffset;
  if (humSeekBar) humSeekBar.style.width = `${humPercent}%`;

  if (humStatus) {
    if (humVal < 30) {
      humStatus.textContent = 'Dry';
      humStatus.className = 'font-semibold text-amber-500';
    } else if (humVal <= 65) {
      humStatus.textContent = 'Ideal / Comfortable';
      humStatus.className = 'font-semibold text-cyan-500';
    } else {
      humStatus.textContent = 'Humid / High';
      humStatus.className = 'font-semibold text-blue-500';
    }
  }
}

// Render Saved Records Table with Exact Specifications
function renderRecordsTable(records, pagination) {
  const tbody = document.getElementById('records-table-body');
  const paginationInfo = document.getElementById('pagination-info');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');
  const pillsContainer = document.getElementById('pagination-pills');

  totalPages = pagination.totalPages;
  totalRecords = pagination.totalRecords;
  currentPage = pagination.currentPage;

  // Update table rows
  if (records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-12 text-center text-slate-400">
          <svg class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
          No saved sensor records found yet.
        </td>
      </tr>
    `;
  } else {
    const startIndex = (currentPage - 1) * recordsPerPage;
    tbody.innerHTML = records.map((rec, index) => {
      const serialNum = startIndex + index + 1;
      return `
        <tr class="hover:bg-red-50/40 dark:hover:bg-red-950/20 transition-colors">
          <td class="px-4 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">${serialNum}</td>
          <td class="px-4 py-3.5 font-bold text-red-600 dark:text-red-400">
            ${rec.temperature} 'C
          </td>
          <td class="px-4 py-3.5 font-semibold text-cyan-600 dark:text-cyan-400">
            ${rec.humidity}%
          </td>
          <td class="px-4 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-300">
            ${rec.time}
          </td>
          <td class="px-4 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-300">
            ${rec.date}
          </td>
          <td class="px-4 py-3.5 text-right">
            <button onclick="deleteRecord('${rec.id}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60 border border-transparent hover:border-red-200 dark:hover:border-red-900 transition-colors inline-flex items-center gap-1" title="Delete record">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              <span>Delete</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Update pagination info text
  const startCount = totalRecords === 0 ? 0 : (currentPage - 1) * recordsPerPage + 1;
  const endCount = Math.min(totalRecords, currentPage * recordsPerPage);
  paginationInfo.innerHTML = `Showing <span class="font-bold text-slate-800 dark:text-slate-200">${startCount}</span> to <span class="font-bold text-slate-800 dark:text-slate-200">${endCount}</span> of <span class="font-bold text-slate-800 dark:text-slate-200">${totalRecords}</span> records`;

  // Buttons state
  btnPrev.disabled = !pagination.hasPrev;
  btnNext.disabled = !pagination.hasNext;

  // Generate page pill numbers
  let pillsHtml = '';
  const maxPills = 5;
  let startPill = Math.max(1, currentPage - 2);
  let endPill = Math.min(totalPages, startPill + maxPills - 1);
  if (endPill - startPill < maxPills - 1) {
    startPill = Math.max(1, endPill - maxPills + 1);
  }

  for (let p = startPill; p <= endPill; p++) {
    if (p === currentPage) {
      pillsHtml += `<button class="w-7 h-7 rounded-lg bg-red-600 text-white font-bold text-xs">${p}</button>`;
    } else {
      pillsHtml += `<button onclick="goToPage(${p})" class="w-7 h-7 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold">${p}</button>`;
    }
  }
  pillsContainer.innerHTML = pillsHtml;
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  refreshData();
}

function changeLimit(newLimit) {
  recordsPerPage = parseInt(newLimit);
  currentPage = 1;
  refreshData();
}

async function deleteRecord(id) {
  try {
    const res = await fetch(`/api/sensor-data/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to delete record');
    }
    showToast('Record deleted successfully', 'success');
    refreshData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Simulate Sensor Reading (Quick test helper button)
async function simulateSensorReading() {
  const simulatedTemp = (Math.random() * (39 - 31) + 31).toFixed(1);
  const simulatedHum = Math.round(Math.random() * (65 - 45) + 45);

  try {
    const res = await fetch('/api/sensor-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temperature: simulatedTemp, humidity: simulatedHum })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Pushed test data: ${simulatedTemp}°C | ${simulatedHum}%`, 'success');
      refreshData();
    }
  } catch (err) {
    showToast('Failed to simulate reading', 'error');
  }
}

// ========================================================
// CHART.JS INTEGRATION (DUAL TELEMETRY GRAPHS)
// ========================================================
function initChart() {
  const ctx = document.getElementById('telemetryChart');
  if (!ctx) return;

  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

  telemetryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: "Temperature ('C)",
          data: [],
          borderColor: '#e11d48',
          backgroundColor: 'rgba(225, 29, 72, 0.15)',
          fill: true,
          tension: 0.38,
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#e11d48',
          yAxisID: 'y'
        },
        {
          label: 'Humidity (%)',
          data: [],
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          fill: true,
          tension: 0.38,
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#06b6d4',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#334155',
          borderColor: 'rgba(225, 29, 72, 0.3)',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 10 } }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Temperature (°C)',
            color: '#e11d48',
            font: { size: 11, weight: '600' }
          },
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 10 } },
          min: 0,
          max: 50
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Humidity (%)',
            color: '#06b6d4',
            font: { size: 11, weight: '600' }
          },
          grid: { drawOnChartArea: false },
          ticks: { color: textColor, font: { size: 10 } },
          min: 0,
          max: 100
        }
      }
    }
  });
}

function updateTelemetryChart(chartData) {
  if (!telemetryChart || !chartData) return;

  const labels = chartData.map(d => d.time || '');
  const temps = chartData.map(d => d.temperature);
  const hums = chartData.map(d => d.humidity);

  telemetryChart.data.labels = labels;
  telemetryChart.data.datasets[0].data = temps;
  telemetryChart.data.datasets[1].data = hums;
  telemetryChart.update('none'); // smooth update without animation reset
}

function updateChartTheme() {
  if (!telemetryChart) return;
  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

  telemetryChart.options.scales.x.ticks.color = textColor;
  telemetryChart.options.scales.x.grid.color = gridColor;
  telemetryChart.options.scales.y.ticks.color = textColor;
  telemetryChart.options.scales.y.grid.color = gridColor;
  telemetryChart.options.scales.y1.ticks.color = textColor;
  telemetryChart.update();
}

// ========================================================
// 16x2 LCD CONTROLLER (TAB 2)
// ========================================================
function updateLcdPreview() {
  const line1Input = document.getElementById('lcd-input-1');
  const line2Input = document.getElementById('lcd-input-2');
  const count1 = document.getElementById('char-count-line1');
  const count2 = document.getElementById('char-count-line2');
  const row1Preview = document.getElementById('lcd-preview-row1');
  const row2Preview = document.getElementById('lcd-preview-row2');

  const l1 = line1Input ? line1Input.value.substring(0, 16) : '';
  const l2 = line2Input ? line2Input.value.substring(0, 16) : '';

  if (count1) count1.textContent = `${l1.length} / 16`;
  if (count2) count2.textContent = `${l2.length} / 16`;

  // Format 16 characters with padding for authentic LCD look
  if (row1Preview) row1Preview.textContent = l1.padEnd(16, ' ');
  if (row2Preview) row2Preview.textContent = l2.padEnd(16, ' ');
}

function setLcdColor(color) {
  currentLcdColor = color;
  const screen = document.getElementById('virtual-lcd-screen');
  const btnGreen = document.getElementById('btn-lcd-green');
  const btnBlue = document.getElementById('btn-lcd-blue');

  if (color === 'blue') {
    screen.className = 'lcd-screen-blue rounded p-4 font-mono-lcd text-base sm:text-lg tracking-widest font-bold select-none overflow-hidden';
    btnBlue.className = 'w-5 h-5 rounded-full bg-sky-500 ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-900 transition-all';
    btnGreen.className = 'w-5 h-5 rounded-full bg-emerald-500 opacity-60 hover:opacity-100 transition-all';
  } else {
    screen.className = 'lcd-screen-green rounded p-4 font-mono-lcd text-base sm:text-lg tracking-widest font-bold select-none overflow-hidden';
    btnGreen.className = 'w-5 h-5 rounded-full bg-emerald-500 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 transition-all';
    btnBlue.className = 'w-5 h-5 rounded-full bg-sky-500 opacity-60 hover:opacity-100 transition-all';
  }
}

async function saveLcdText(e) {
  e.preventDefault();
  const line1 = document.getElementById('lcd-input-1').value.substring(0, 16);
  const line2 = document.getElementById('lcd-input-2').value.substring(0, 16);
  const saveBtn = document.getElementById('lcd-save-btn');

  try {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span>Transmitting to Cloud...</span>`;

    const res = await fetch('/api/device-state/lcd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line1, line2 })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to save LCD text');
    }

    lcdState.line1 = line1;
    lcdState.line2 = line2;
    updateLcdPreview();
    showToast('Saved! Displaying on 16x2 LCD on next cycle', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg><span>Save & Transmit to LCD</span>`;
  }
}

// ========================================================
// INNOVATIVE LED ACTUATOR BUTTON (TAB 3)
// ========================================================
async function fetchDeviceState() {
  try {
    const res = await fetch('/api/device-state');
    const data = await res.json();
    if (data.success) {
      updateLedUI(data.ledStatus);
      if (data.lcdLine1 && !document.getElementById('lcd-input-1').matches(':focus')) {
        document.getElementById('lcd-input-1').value = data.lcdLine1.trim();
        document.getElementById('lcd-input-2').value = (data.lcdLine2 || '').trim();
        updateLcdPreview();
      }
    }
  } catch (err) {
    console.error('Error fetching device state:', err);
  }
}

async function toggleLed() {
  const nextState = ledState === 'ON' ? 'OFF' : 'ON';
  const btn = document.getElementById('innovative-led-btn');

  try {
    // Optimistic UI update
    updateLedUI(nextState);

    const res = await fetch('/api/device-state/led', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ledStatus: nextState })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      // Revert if error
      updateLedUI(ledState);
      throw new Error(data.message || 'Failed to toggle LED');
    }

    showToast(`LED has been turned ${nextState}!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateLedUI(status) {
  ledState = status;
  const btn = document.getElementById('innovative-led-btn');
  const statusPill = document.getElementById('led-status-pill');
  const statusIndicator = document.getElementById('led-status-indicator');
  const statusLabel = document.getElementById('led-status-label');
  const ambientGlow = document.getElementById('led-ambient-glow');
  const logicLevel = document.getElementById('led-logic-level');

  if (!btn || !statusPill) return;

  if (status === 'ON') {
    btn.className = 'led-toggle-btn state-on group';
    statusPill.className = 'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-300 border border-red-300 dark:border-red-800 shadow-md shadow-red-500/20';
    statusIndicator.className = 'w-2.5 h-2.5 rounded-full bg-red-500 online-pulse';
    statusLabel.textContent = 'LED IS CURRENTLY ON';
    if (ambientGlow) ambientGlow.className = 'absolute inset-0 bg-red-600/10 dark:bg-red-600/15 transition-colors duration-500 pointer-events-none';
    if (logicLevel) logicLevel.textContent = 'HIGH (3.3V)';
  } else {
    btn.className = 'led-toggle-btn state-off group';
    statusPill.className = 'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700';
    statusIndicator.className = 'w-2.5 h-2.5 rounded-full bg-slate-400';
    statusLabel.textContent = 'LED IS CURRENTLY OFF';
    if (ambientGlow) ambientGlow.className = 'absolute inset-0 bg-red-600/0 transition-colors duration-500 pointer-events-none';
    if (logicLevel) logicLevel.textContent = 'LOW (0V)';
  }
}

// ========================================================
// TOAST NOTIFICATION UTILITY
// ========================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold transform translate-y-2 opacity-0 transition-all duration-300 border';

  let icon = '';
  if (type === 'success') {
    toast.classList.add('bg-white', 'dark:bg-slate-800', 'text-slate-800', 'dark:text-white', 'border-emerald-500/50');
    icon = `<svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
  } else if (type === 'error') {
    toast.classList.add('bg-white', 'dark:bg-slate-800', 'text-slate-800', 'dark:text-white', 'border-rose-500/50');
    icon = `<svg class="w-4 h-4 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
  } else {
    toast.classList.add('bg-white', 'dark:bg-slate-800', 'text-slate-800', 'dark:text-white', 'border-red-500/30');
    icon = `<svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  }

  toast.innerHTML = `${icon}<span>${message}</span>`;
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  // Auto remove after 3.5 seconds
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
