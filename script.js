// script.js
// GHOST-HUB v3.1 - Исправленная версия с IndexedDB и новым модулем Слежка

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
const AppState = {
  user: null,
  isOnline: false,
  isRecording: false,
  isVoiceActive: false,
  deadManActive: false,
  deadManTimeLeft: 600,
  tremorActive: false,
  radarActive: false,
  audioContext: null,
  mediaRecorder: null,
  audioChunks: [],
  audioStartTime: null,
  audioRingBuffer: [],
  ringBufferSize: 0,
  recognition: null,
  maps: {},
  teamMembers: [],
  equipment: [],
  pulseDevices: [],
  currentView: 'map',
  lastIncidentAudio: null,
  deadManTimerInterval: null,
  tremorAnimationId: null,
  radarAnimationId: null,
  currentRecordId: null,
  currentLogId: null,
  heading: 0,
  radarPosition: { lat: 0, lng: 0 }
};

// ==================== AUDIO ENGINE ====================
const AudioEngine = {
  ctx: null,
  
  init() {
    if (this.ctx) return;
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    } catch (e) {
      console.log('AudioContext not supported');
    }
  },
  
  playTone(freq, duration, type = 'sine', volume = 0.1) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.log('Audio play error:', e);
    }
  },
  
  play(name) {
    if (!this.ctx) this.init();
    switch(name) {
      case 'click': this.playTone(800, 0.05, 'sine', 0.1); break;
      case 'success': 
        this.playTone(600, 0.1, 'sine', 0.1);
        setTimeout(() => this.playTone(800, 0.1, 'sine', 0.1), 100);
        setTimeout(() => this.playTone(1000, 0.15, 'sine', 0.15), 200);
        break;
      case 'alert': 
        this.playTone(200, 0.3, 'sawtooth', 0.2);
        setTimeout(() => this.playTone(150, 0.3, 'sawtooth', 0.2), 150);
        break;
      case 'warning': 
        this.playTone(800, 0.1, 'square', 0.15);
        setTimeout(() => this.playTone(800, 0.1, 'square', 0.15), 200);
        break;
      case 'recordStart': this.playTone(1000, 0.2, 'sine', 0.15); break;
      case 'message': this.playTone(1200, 0.1, 'sine', 0.1); break;
      case 'pulse': this.playTone(440, 0.05, 'sine', 0.1); break;
      case 'vibrate': 
        if (navigator.vibrate) navigator.vibrate(50);
        break;
    }
  }
};

// ==================== IndexedDB для Аудио (исправление переполнения) ====================
const AudioDB = {
  db: null,
  
  async init() {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('GhostHubAudioDB', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('audio_records')) {
          const store = db.createObjectStore('audio_records', { keyPath: 'id' });
          store.createIndex('time', 'time', { unique: false });
        }
      };
    });
  },
  
  async saveRecord(id, blob, duration, time) {
    await this.init();
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const transaction = this.db.transaction(['audio_records'], 'readwrite');
      const store = transaction.objectStore('audio_records');
      const record = { id, blob, duration, time, url, created: Date.now() };
      const request = store.put(record);
      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(request.error);
    });
  },
  
  async getRecords(limit = 50) {
    await this.init();
    return new Promise((resolve) => {
      const transaction = this.db.transaction(['audio_records'], 'readonly');
      const store = transaction.objectStore('audio_records');
      const index = store.index('time');
      const request = index.openCursor(null, 'prev');
      const records = [];
      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && records.length < limit) {
          records.push(cursor.value);
          cursor.continue();
        } else {
          resolve(records);
        }
      };
      request.onerror = () => resolve([]);
    });
  },
  
  async deleteRecord(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['audio_records'], 'readwrite');
      const store = transaction.objectStore('audio_records');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};

// ==================== HAPTIC FEEDBACK ====================
function haptic() {
  AudioEngine.play('vibrate');
  if (navigator.vibrate) {
    navigator.vibrate(30);
  }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  document.addEventListener('click', () => {
    AudioEngine.init();
  }, { once: true });

  await showNativeSplash();
  await initDatabase();
  showBootSequence();
  
  setTimeout(() => {
    hideBootScreen();
    checkAuth();
  }, 2500);
});

async function showNativeSplash() {
  return new Promise(resolve => {
    const splash = document.getElementById('native-splash');
    const progress = document.querySelector('.splash-progress');
    
    setTimeout(() => {
      progress.style.width = '100%';
    }, 100);
    
    setTimeout(() => {
      splash.classList.add('hidden');
      resolve();
    }, 2000);
  });
}

async function initDatabase() {
  if (typeof ghostDB !== 'undefined') {
    try {
      await ghostDB.init();
      AppState.isOnline = ghostDB.isOnline();
    } catch (e) {
      console.log('DB init error:', e);
      AppState.isOnline = false;
    }
    updateOfflineIndicator();
  }
  await AudioDB.init();
}

function showBootSequence() {
  const boot = document.getElementById('boot-screen');
  boot.classList.remove('hidden');
}

function hideBootScreen() {
  const boot = document.getElementById('boot-screen');
  boot.style.opacity = '0';
  setTimeout(() => {
    boot.classList.add('hidden');
    document.getElementById('main-interface').classList.remove('hidden');
  }, 300);
}

// ==================== АУТЕНТИФИКАЦИЯ ====================
function checkAuth() {
  const savedUser = localStorage.getItem('GHOST_HUB_USER');
  
  if (savedUser) {
    try {
      AppState.user = JSON.parse(savedUser);
      enterApp();
    } catch (e) {
      showAuthScreen();
    }
  } else {
    showAuthScreen();
  }
}

function showAuthScreen() {
  const authScreen = document.getElementById('auth-screen');
  authScreen.classList.remove('hidden');
  
  document.getElementById('app-header').classList.add('hidden');
  document.getElementById('quick-actions').classList.add('hidden');
  document.getElementById('mobile-nav').classList.add('hidden');
  document.getElementById('content-area').classList.add('hidden');
  
  updateStatusIndicator(false);
}

document.getElementById('auth-login-btn').addEventListener('click', async function() {
  haptic();
  const name = document.getElementById('auth-name').value.trim();
  const role = document.getElementById('auth-role').value;
  
  if (!name || !role) {
    showToast('Введите позывной и выберите роль', 'error');
    AudioEngine.play('alert');
    return;
  }
  
  const deviceId = 'device-' + Math.random().toString(36).substr(2, 9);
  
  let userData = { 
    id: 'local-' + Date.now(), 
    name, 
    role, 
    deviceId, 
    offline: true 
  };
  
  if (typeof ghostDB !== 'undefined' && ghostDB.isOnline()) {
    try {
      const { data, error } = await ghostDB.registerUser(name, role, deviceId);
      if (data) userData = data;
    } catch (e) {
      console.log('DB register error:', e);
    }
  }
  
  AppState.user = userData;
  localStorage.setItem('GHOST_HUB_USER', JSON.stringify(userData));
  
  AudioEngine.play('success');
  enterApp();
});

function enterApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  
  document.getElementById('app-header').classList.remove('hidden');
  document.getElementById('quick-actions').classList.remove('hidden');
  document.getElementById('mobile-nav').classList.remove('hidden');
  document.getElementById('content-area').classList.remove('hidden');
  
  document.querySelectorAll('.action-btn, .nav-btn').forEach(btn => {
    btn.disabled = false;
  });
  
  updateStatusIndicator(true);
  
  initClock();
  initGeolocation();
  initTeamStatus();
  initNavigation();
  initQuickActions();
  initNavigator();
  initTremor();
  initAudioRecorder();
  initLogs();
  initEquipment();
  initPulse();
  initChat();
  initVoiceCommand();
  initDeadManSwitch();
  initSwipeNavigation();
  initBackButton();
  initStalker();
  
  setTimeout(() => {
    WebRTCChat.init();
  }, 1000);
  
  requestPermissions();
}

function updateStatusIndicator(online) {
  const indicator = document.getElementById('status-indicator');
  const text = document.getElementById('status-text');
  
  if (online) {
    indicator.classList.remove('offline');
    indicator.classList.add('online');
    text.classList.remove('offline');
    text.classList.add('online');
    text.textContent = 'ONLINE';
  } else {
    indicator.classList.add('offline');
    indicator.classList.remove('online');
    text.classList.add('offline');
    text.classList.remove('online');
    text.textContent = 'OFFLINE';
  }
}

function updateOfflineIndicator() {
  const indicator = document.getElementById('offline-indicator');
  if (AppState.isOnline) {
    indicator.classList.add('hidden');
  } else {
    indicator.classList.remove('hidden');
  }
}

// ==================== РАЗРЕШЕНИЯ ====================
async function requestPermissions() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      () => console.log('GPS OK'),
      (err) => console.log('GPS error:', err),
      { enableHighAccuracy: true }
    );
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    console.log('Mic OK');
  } catch (err) {
    console.log('Mic error:', err);
  }
  
  if ('Notification' in window) {
    Notification.requestPermission();
  }
}

// ==================== ЧАСЫ И GPS ====================
function initClock() {
  function update() {
    const now = new Date();
    const msk = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
    const h = String(msk.getHours()).padStart(2, '0');
    const m = String(msk.getMinutes()).padStart(2, '0');
    const s = String(msk.getSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = `${h}:${m}:${s}`;
  }
  update();
  setInterval(update, 1000);
}

function initGeolocation() {
  const gpsEl = document.getElementById('gps');
  
  if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        gpsEl.textContent = `${lat}°N ${lng}°E`;
        AppState.radarPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        
        if (AppState.user && typeof ghostDB !== 'undefined') {
          ghostDB.updateUserLocation(AppState.user.id, pos.coords.latitude, pos.coords.longitude);
        }
      },
      (err) => {
        console.log('GPS error:', err);
        simulateGPS();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } else {
    simulateGPS();
  }
}

function simulateGPS() {
  let baseLat = 55.7558;
  let baseLng = 37.6173;
  setInterval(() => {
    baseLat += (Math.random() - 0.5) * 0.0002;
    baseLng += (Math.random() - 0.5) * 0.0002;
    document.getElementById('gps').textContent = `${baseLat.toFixed(4)}°N ${baseLng.toFixed(4)}°E`;
    AppState.radarPosition = { lat: baseLat, lng: baseLng };
  }, 3000);
}

// ==================== СТАТУС КОМАНДЫ ====================
function initTeamStatus() {
  loadTeamMembers();
  setInterval(updateTeamDisplay, 5000);
}

async function loadTeamMembers() {
  const local = JSON.parse(localStorage.getItem('TEAM_MEMBERS') || '[]');
  AppState.teamMembers = local;
  updateTeamDisplay();
}

function updateTeamDisplay() {
  const grid = document.getElementById('team-grid');
  const countEl = document.getElementById('nodes-count');
  
  if (AppState.teamMembers.length === 0) {
    grid.innerHTML = `
      <div class="team-empty">
        <div class="scanning-animation">⌖</div>
        <div>Поиск членов команды в сети...</div>
      </div>
    `;
    countEl.textContent = '1 (ВЫ)';
    return;
  }
  
  grid.innerHTML = AppState.teamMembers.map(member => `
    <div class="team-card">
      <div class="team-avatar">👤</div>
      <div class="team-info">
        <div class="team-info-name">${member.name}</div>
        <div class="team-info-role">${member.role}</div>
      </div>
      <div class="team-stats">
        ${member.pulse ? `<div class="team-pulse">❤️ ${member.pulse}</div>` : ''}
        ${member.battery ? `<div class="team-battery">🔋 ${member.battery}%</div>` : ''}
      </div>
    </div>
  `).join('');
  
  countEl.textContent = `${AppState.teamMembers.length + 1} (ВЫ)`;
}

// ==================== НАВИГАЦИЯ ====================
function initNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view-section');
  
  navBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      haptic();
      const viewId = this.dataset.view + '-view';
      
      if (AppState.currentView === 'tremor' && AppState.tremorActive) {
        stopTremor();
      }
      if (AppState.currentView === 'radar' && StalkerRadar.isActive) {
        StalkerRadar.stop();
      }
      
      navBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      views.forEach(view => {
        view.classList.remove('active');
        if (view.id === viewId) {
          view.classList.add('active');
        }
      });
      
      AppState.currentView = this.dataset.view;
      
      if (this.dataset.view === 'navigator') {
        setTimeout(() => {
          Object.values(AppState.maps).forEach(m => {
            if (m && m.invalidateSize) m.invalidateSize();
          });
        }, 100);
      }
    });
  });
}

// ==================== SWIPE & BACK BUTTON ====================
function initSwipeNavigation() {
  let touchStartX = 0;
  let touchStartY = 0;
  
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  
  document.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
      const activeIndex = navBtns.findIndex(b => b.classList.contains('active'));
      
      if (deltaX > 0 && activeIndex > 0) {
        navBtns[activeIndex - 1].click();
      } else if (deltaX < 0 && activeIndex < navBtns.length - 1) {
        navBtns[activeIndex + 1].click();
      }
    }
  }, { passive: true });
}

function initBackButton() {
  history.pushState({ page: 'main' }, '');
  
  window.addEventListener('popstate', (e) => {
    if (e.state) {
      const modals = document.querySelectorAll('.modal:not(.hidden)');
      if (modals.length > 0) {
        modals[modals.length - 1].classList.add('hidden');
        history.pushState({ page: 'main' }, '');
        return;
      }
      
      const navBtns = document.querySelectorAll('.nav-btn');
      const active = document.querySelector('.nav-btn.active');
      const activeIndex = Array.from(navBtns).indexOf(active);
      
      if (activeIndex > 0) {
        navBtns[activeIndex - 1].click();
        history.pushState({ page: 'main' }, '');
      } else {
        history.pushState({ page: 'main' }, '');
      }
    }
  });
}

// ==================== QUICK ACTIONS ====================
function initQuickActions() {
  document.getElementById('incident-btn').addEventListener('click', async function() {
    haptic();
    AudioEngine.play('alert');
    
    const now = new Date();
    const time = now.toLocaleTimeString('ru-RU', { hour12: false });
    const gps = document.getElementById('gps').textContent;
    
    const audioData = await getAudioBufferSlice(30);
    
    const logData = {
      time,
      gps,
      lat: AppState.radarPosition.lat || 55.7558,
      lng: AppState.radarPosition.lng || 37.6173,
      emf: (Math.random() * 5).toFixed(2) + ' μT',
      noise: Math.floor(Math.random() * 40 + 30) + ' dB',
      audioData,
      audioDuration: 30
    };
    
    const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
    logs.unshift({ ...logData, id: Date.now() });
    localStorage.setItem('INCIDENT_LOGS', JSON.stringify(logs.slice(0, 50)));
    
    document.getElementById('incident-time').textContent = time;
    document.getElementById('incident-coords').textContent = gps;
    document.getElementById('incident-emf').textContent = logData.emf;
    document.getElementById('incident-noise').textContent = logData.noise;
    
    const modal = document.getElementById('incident-modal');
    modal.classList.remove('hidden');
    
    setTimeout(() => modal.classList.add('hidden'), 3000);
    
    loadLogs();
    AudioEngine.play('success');
  });
  
  document.getElementById('night-ops-btn').addEventListener('click', function() {
    haptic();
    const overlay = document.getElementById('night-ops-overlay');
    const btn = document.getElementById('night-ops-btn');
    const isHidden = overlay.classList.contains('hidden');
    
    overlay.classList.toggle('hidden', !isHidden);
    btn.classList.toggle('active', isHidden);
    document.body.classList.toggle('night-mode', isHidden);
  });
  
  document.getElementById('voice-cmd-btn').addEventListener('click', function() {
    haptic();
    document.getElementById('voice-help-modal').classList.remove('hidden');
  });
  
  document.getElementById('deadman-btn').addEventListener('click', function() {
    haptic();
    document.getElementById('deadman-modal').classList.remove('hidden');
  });
}

// ==================== НАВИГАТОР ====================
function initNavigator() {
  document.querySelectorAll('.nav-mode-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      haptic();
      const mode = this.dataset.mode;
      
      document.querySelectorAll('.nav-mode-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      document.querySelectorAll('.navigator-mode-content').forEach(c => c.classList.remove('active'));
      document.getElementById('mode-' + mode).classList.add('active');
      
      if (mode === 'map-to-coords') {
        setTimeout(initPickerMap, 100);
      }
    });
  });
  
  document.getElementById('btn-show-on-map').addEventListener('click', function() {
    haptic();
    const lat = parseFloat(document.getElementById('input-lat').value);
    const lng = parseFloat(document.getElementById('input-lng').value);
    
    if (isNaN(lat) || isNaN(lng)) {
      showToast('Введите корректные координаты', 'error');
      return;
    }
    
    const result = document.getElementById('coords-result-map');
    result.classList.remove('hidden');
    
    setTimeout(() => {
      if (AppState.maps['map1']) {
        AppState.maps['map1'].remove();
      }
      
      const map = L.map('leaflet-map-1').setView([lat, lng], 15);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);
      
      L.marker([lat, lng]).addTo(map)
        .bindPopup(`Широта: ${lat}<br>Долгота: ${lng}`)
        .openPopup();
      
      AppState.maps['map1'] = map;
      document.getElementById('result-coords-1').textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }, 100);
    
    AudioEngine.play('success');
  });
  
  document.getElementById('copy-coords-1').addEventListener('click', function() {
    haptic();
    const text = document.getElementById('result-coords-1').textContent;
    navigator.clipboard.writeText(text).then(() => showToast('Координаты скопированы'));
  });
  
  document.getElementById('btn-get-coords').addEventListener('click', async function() {
    haptic();
    const address = document.getElementById('input-address').value.trim();
    if (!address) {
      showToast('Введите адрес', 'error');
      return;
    }
    
    const btn = document.getElementById('btn-get-coords');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>◈ ПОИСК...</span>';
    btn.disabled = true;
    
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        document.getElementById('result-lat').textContent = parseFloat(result.lat).toFixed(6);
        document.getElementById('result-lng').textContent = parseFloat(result.lon).toFixed(6);
        document.getElementById('result-full-address').textContent = result.display_name;
        document.getElementById('address-result').classList.remove('hidden');
        AudioEngine.play('success');
      } else {
        showToast('Адрес не найден', 'error');
      }
    } catch (err) {
      showToast('Ошибка поиска', 'error');
      console.log('Geocode error:', err);
    }
    
    btn.innerHTML = originalText;
    btn.disabled = false;
  });
  
  document.getElementById('copy-address-coords').addEventListener('click', function() {
    haptic();
    const lat = document.getElementById('result-lat').textContent;
    const lng = document.getElementById('result-lng').textContent;
    navigator.clipboard.writeText(`${lat}, ${lng}`).then(() => showToast('Координаты скопированы'));
  });
  
  document.getElementById('show-address-on-map').addEventListener('click', function() {
    haptic();
    const lat = parseFloat(document.getElementById('result-lat').textContent);
    const lng = parseFloat(document.getElementById('result-lng').textContent);
    
    const mapContainer = document.getElementById('leaflet-map-2');
    mapContainer.classList.remove('hidden');
    
    setTimeout(() => {
      if (AppState.maps['map2']) {
        AppState.maps['map2'].remove();
      }
      
      const map = L.map('leaflet-map-2').setView([lat, lng], 15);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);
      
      L.marker([lat, lng]).addTo(map);
      AppState.maps['map2'] = map;
    }, 100);
  });
  
  window.initPickerMap = function() {
    if (AppState.maps['picker']) {
      AppState.maps['picker'].invalidateSize();
      return;
    }
    
    setTimeout(() => {
      const map = L.map('leaflet-map-3').setView([55.7558, 37.6173], 10);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);
      
      const marker = L.marker([55.7558, 37.6173], { draggable: true }).addTo(map);
      
      marker.on('dragend', async (e) => {
        const pos = e.target.getLatLng();
        updatePickerCoords(pos.lat, pos.lng);
      });
      
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        updatePickerCoords(e.latlng.lat, e.latlng.lng);
      });
      
      AppState.maps['picker'] = map;
    }, 100);
  };
  
  async function updatePickerCoords(lat, lng) {
    document.getElementById('picker-lat').textContent = lat.toFixed(6);
    document.getElementById('picker-lng').textContent = lng.toFixed(6);
    document.getElementById('picker-result').classList.remove('hidden');
    
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      document.getElementById('picker-address').textContent = data.display_name || 'Адрес не определён';
    } catch {
      document.getElementById('picker-address').textContent = 'Адрес не определён';
    }
    
    AudioEngine.play('success');
  }
  
  document.getElementById('copy-picker-coords').addEventListener('click', function() {
    haptic();
    const lat = document.getElementById('picker-lat').textContent;
    const lng = document.getElementById('picker-lng').textContent;
    navigator.clipboard.writeText(`${lat}, ${lng}`).then(() => showToast('Координаты скопированы'));
  });
  
  document.getElementById('use-picker-coords').addEventListener('click', function() {
    haptic();
    document.getElementById('input-lat').value = document.getElementById('picker-lat').textContent;
    document.getElementById('input-lng').value = document.getElementById('picker-lng').textContent;
    document.querySelector('[data-mode="coords-to-map"]').click();
    showToast('Координаты перенесены');
  });
  
  document.querySelectorAll('.quick-coord-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      haptic();
      document.getElementById('input-lat').value = this.dataset.lat;
      document.getElementById('input-lng').value = this.dataset.lng;
      document.querySelector('[data-mode="coords-to-map"]').click();
      document.getElementById('btn-show-on-map').click();
    });
  });
}

// ==================== СЕЙСМО ====================
function initTremor() {
  const canvas = document.getElementById('seismograph');
  const ctx = canvas.getContext('2d');
  
  canvas.width = canvas.offsetWidth || 300;
  canvas.height = 180;
  
  const historyX = [], historyY = [], historyZ = [];
  const maxHistory = 100;
  let sensitivity = 5;
  
  document.getElementById('sensitivity').addEventListener('input', function() {
    sensitivity = parseInt(this.value);
    document.getElementById('sensitivity-value').textContent = sensitivity;
    document.getElementById('threshold').textContent = (sensitivity * 0.1).toFixed(2);
  });
  
  document.getElementById('tremor-start-btn').addEventListener('click', async function() {
    haptic();
    
    if (typeof DeviceMotionEvent !== 'undefined' && 
        typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') {
          showToast('Доступ к датчикам запрещён', 'error');
          return;
        }
      } catch (err) {
        console.log('Permission error:', err);
      }
    }
    
    AppState.tremorActive = true;
    document.getElementById('tremor-start-btn').classList.add('hidden');
    document.getElementById('tremor-stop-btn').classList.remove('hidden');
    document.getElementById('tremor-status-dot').classList.add('active');
    document.getElementById('tremor-status-text').textContent = 'АКТИВЕН';
    
    AudioEngine.play('success');
    startTremorLoop();
  });
  
  document.getElementById('tremor-stop-btn').addEventListener('click', function() {
    haptic();
    stopTremor();
  });
  
  function startTremorLoop() {
    window.addEventListener('devicemotion', handleMotion);
    
    if (!window.DeviceMotionEvent) {
      simulateMotion();
    }
    
    draw();
  }
  
  function handleMotion(e) {
    const acc = e.accelerationIncludingGravity;
    if (!acc) return;
    
    updateTremorData(acc.x || 0, acc.y || 0, acc.z || 9.8);
  }
  
  function simulateMotion() {
    if (!AppState.tremorActive) return;
    
    const noise = () => (Math.random() - 0.5) * 0.5;
    const spike = Math.random() > 0.98 ? (Math.random() - 0.5) * sensitivity : 0;
    
    updateTremorData(
      noise() + spike,
      noise() + spike * 0.5,
      9.8 + noise() + spike * 0.3
    );
    
    requestAnimationFrame(simulateMotion);
  }
  
  function updateTremorData(x, y, z) {
    if (historyX.length >= maxHistory) {
      historyX.shift();
      historyY.shift();
      historyZ.shift();
    }
    historyX.push(x);
    historyY.push(y);
    historyZ.push(z);
    
    const mag = Math.sqrt(x*x + y*y + (z-9.8)*(z-9.8));
    document.getElementById('magnitude').textContent = mag.toFixed(2);
    
    const threshold = sensitivity * 0.1;
    
    if (mag > threshold) {
      addTremorLog(mag.toFixed(2));
      AudioEngine.play('warning');
    }
  }
  
  function addTremorLog(mag) {
    const container = document.getElementById('tremor-entries');
    const empty = container.querySelector('.entry-empty');
    if (empty) empty.remove();
    
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    const entry = document.createElement('div');
    entry.className = 'tremor-entry';
    entry.innerHTML = `<span style="color: #888">[${time}]</span> Вибрация ${mag} м/с²`;
    
    container.insertBefore(entry, container.firstChild);
    if (container.children.length > 20) container.removeChild(container.lastChild);
  }
  
  function draw() {
    if (!AppState.tremorActive) return;
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const centerY = canvas.height / 2;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    drawAxis(historyX, '#FF6666', 0, 'X');
    drawAxis(historyY, '#66FF66', 0, 'Y');
    drawAxis(historyZ, '#6699FF', 9.8, 'Z');
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.stroke();
    
    AppState.tremorAnimationId = requestAnimationFrame(draw);
  }
  
  function drawAxis(history, color, offset, label) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < history.length; i++) {
      const x = (i / maxHistory) * canvas.width;
      const val = history[i] - offset;
      const y = canvas.height / 2 + val * (canvas.height / 25);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    if (history.length > 0) {
      ctx.fillStyle = color;
      ctx.font = '10px JetBrains Mono';
      const lastVal = history[history.length - 1] - offset;
      ctx.fillText(label, canvas.width - 20, canvas.height / 2 + lastVal * (canvas.height / 25) - 5);
    }
  }
  
  window.stopTremor = function() {
    AppState.tremorActive = false;
    window.removeEventListener('devicemotion', handleMotion);
    cancelAnimationFrame(AppState.tremorAnimationId);
    
    document.getElementById('tremor-start-btn').classList.remove('hidden');
    document.getElementById('tremor-stop-btn').classList.add('hidden');
    document.getElementById('tremor-status-dot').classList.remove('active');
    document.getElementById('tremor-status-text').textContent = 'ОЖИДАНИЕ';
    document.getElementById('tremor-entries').innerHTML = '<div class="entry-empty">Анализ не запущен</div>';
  };
}

// ==================== АУДИО РЕКОРДЕР (с IndexedDB) ====================
function initAudioRecorder() {
  let mediaRecorder = null;
  let audioChunks = [];
  let startTime = null;
  let timerInterval = null;
  
  initAudioRingBuffer();
  
  document.getElementById('record-btn').addEventListener('click', async function() {
    haptic();
    
    if (!AppState.isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
          audioChunks.push(e.data);
          addToRingBuffer(e.data);
        };
        
        mediaRecorder.onstop = async () => {
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          const duration = Math.floor((Date.now() - startTime) / 1000);
          const id = Date.now();
          const time = new Date().toLocaleString('ru-RU');
          
          await AudioDB.saveRecord(id, blob, duration, time);
          stream.getTracks().forEach(t => t.stop());
          loadAudioRecords();
        };
        
        mediaRecorder.start(100);
        AppState.isRecording = true;
        startTime = Date.now();
        
        document.getElementById('record-btn').classList.add('recording');
        document.getElementById('record-btn').innerHTML = '<span class="record-icon">⏹</span><span class="record-text">СТОП</span>';
        document.getElementById('audio-status-dot').classList.add('active');
        document.getElementById('audio-status-dot').style.background = 'var(--danger)';
        document.getElementById('audio-status-text').textContent = 'ЗАПИСЬ';
        
        AudioEngine.play('recordStart');
        
        timerInterval = setInterval(updateTimer, 1000);
        updateTimer();
        
        visualizeAudio(stream);
        
      } catch (err) {
        showToast('Доступ к микрофону запрещён', 'error');
      }
    } else {
      mediaRecorder.stop();
      AppState.isRecording = false;
      clearInterval(timerInterval);
      
      document.getElementById('record-btn').classList.remove('recording');
      document.getElementById('record-btn').innerHTML = '<span class="record-icon">●</span><span class="record-text">ЗАПИСЬ</span>';
      document.getElementById('audio-status-dot').classList.remove('active');
      document.getElementById('audio-status-text').textContent = 'ГОТОВ';
      document.getElementById('audio-timer').textContent = '00:00';
    }
  });
  
  function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    document.getElementById('audio-timer').textContent = `${m}:${s}`;
  }
  
  loadAudioRecords();
}

function initAudioRingBuffer() {
  AppState.audioRingBuffer = [];
  AppState.ringBufferSize = 0;
  
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    
    recorder.ondataavailable = (e) => {
      chunks.push(e.data);
      AppState.ringBufferSize += 100;
      
      while (AppState.ringBufferSize > 30000 && chunks.length > 0) {
        const old = chunks.shift();
        AppState.ringBufferSize -= 100;
      }
      
      AppState.audioRingBuffer = [...chunks];
    };
    
    recorder.start(100);
    AppState.ringBufferRecorder = recorder;
    AppState.ringBufferStream = stream;
  }).catch(() => {
    console.log('Ring buffer: mic not available');
  });
}

function addToRingBuffer(data) {}

async function getAudioBufferSlice(seconds) {
  const chunkCount = seconds * 10;
  const start = Math.max(0, AppState.audioRingBuffer.length - chunkCount);
  const slice = AppState.audioRingBuffer.slice(start);
  
  if (slice.length === 0) return null;
  
  const blob = new Blob(slice, { type: 'audio/webm' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function loadAudioRecords() {
  const list = document.getElementById('records-list');
  const records = await AudioDB.getRecords(20);
  
  if (records.length === 0) {
    list.innerHTML = '<div class="records-empty">Нет записей</div>';
    return;
  }
  
  list.innerHTML = records.map(rec => `
    <div class="record-item" data-id="${rec.id}">
      <div class="record-info">
        <div class="record-time">${rec.time}</div>
        <div class="record-duration">${formatDuration(rec.duration)}</div>
      </div>
      <div class="record-actions">
        <button class="record-btn-small play-btn" data-url="${rec.url}">▶</button>
        <button class="record-btn-small menu-btn" data-id="${rec.id}">⠇</button>
      </div>
    </div>
  `).join('');
  
  list.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      haptic();
      const audio = new Audio(this.dataset.url);
      audio.play();
    });
  });
  
  list.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      haptic();
      AppState.currentRecordId = parseInt(this.dataset.id);
      document.getElementById('record-menu-modal').classList.remove('hidden');
    });
  });
}

document.getElementById('download-record-btn').addEventListener('click', async function() {
  haptic();
  const records = await AudioDB.getRecords();
  const rec = records.find(r => r.id === AppState.currentRecordId);
  if (rec && rec.blob) {
    const url = URL.createObjectURL(rec.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghost-hub-record-${rec.id}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Скачивание началось');
  }
  document.getElementById('record-menu-modal').classList.add('hidden');
});

document.getElementById('delete-record-btn').addEventListener('click', async function() {
  haptic();
  if (confirm('Удалить запись?')) {
    await AudioDB.deleteRecord(AppState.currentRecordId);
    loadAudioRecords();
    showToast('Запись удалена');
  }
  document.getElementById('record-menu-modal').classList.add('hidden');
});

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function visualizeAudio(stream) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  
  const canvas = document.getElementById('audio-waveform');
  const ctx = canvas.getContext('2d');
  
  function draw() {
    if (!AppState.isRecording) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#00E5FF';
    const barWidth = canvas.width / dataArray.length;
    
    for (let i = 0; i < dataArray.length; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth, barHeight);
    }
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    document.getElementById('level-fill').style.width = (average / 2.55) + '%';
    document.getElementById('level-text').textContent = '-' + Math.floor(60 - average / 4) + ' dB';
    
    requestAnimationFrame(draw);
  }
  
  draw();
}

// ==================== ЛОГИ ====================
function initLogs() {
  loadLogs();
  
  document.getElementById('logs-clear-all').addEventListener('click', function() {
    haptic();
    if (!confirm('Удалить ВСЕ логи?')) return;
    
    localStorage.removeItem('INCIDENT_LOGS');
    loadLogs();
    AudioEngine.play('alert');
  });
}

function loadLogs() {
  const list = document.getElementById('logs-list');
  const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
  
  if (logs.length === 0) {
    list.innerHTML = '<div class="logs-empty">Нет зафиксированных событий</div>';
    return;
  }
  
  list.innerHTML = logs.map(log => `
    <div class="log-item" data-id="${log.id}">
      <div class="log-header">
        <span class="log-time">${log.time}</span>
        <div class="log-menu">
          <button class="log-menu-btn" data-id="${log.id}">⠇</button>
        </div>
      </div>
      <div class="log-coords">${log.gps}</div>
      <div class="log-actions">
        <button class="log-btn play-log-btn" data-id="${log.id}">▶ Прослушать</button>
      </div>
    </div>
  `).join('');
  
  list.querySelectorAll('.log-menu-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      haptic();
      AppState.currentLogId = parseInt(this.dataset.id);
      document.getElementById('log-menu-modal').classList.remove('hidden');
    });
  });
  
  list.querySelectorAll('.play-log-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      haptic();
      playLogAudio(parseInt(this.dataset.id));
    });
  });
}

document.getElementById('download-log-btn').addEventListener('click', function() {
  haptic();
  const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
  const log = logs.find(l => l.id === AppState.currentLogId);
  if (log && log.audioData) {
    const a = document.createElement('a');
    a.href = log.audioData;
    a.download = `ghost-hub-log-${log.id}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Скачивание началось');
  }
  document.getElementById('log-menu-modal').classList.add('hidden');
});

document.getElementById('delete-log-btn').addEventListener('click', function() {
  haptic();
  if (confirm('Удалить этот лог?')) {
    const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
    const updated = logs.filter(l => l.id !== AppState.currentLogId);
    localStorage.setItem('INCIDENT_LOGS', JSON.stringify(updated));
    loadLogs();
    showToast('Лог удалён');
  }
  document.getElementById('log-menu-modal').classList.add('hidden');
});

function playLogAudio(id) {
  const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
  const log = logs.find(l => l.id === id);
  
  if (!log || !log.audioData) {
    showToast('Аудио не найдено', 'error');
    return;
  }
  
  const modal = document.getElementById('log-player-modal');
  document.getElementById('log-player-info').textContent = `Лог от ${log.time} | ${log.gps}`;
  document.getElementById('log-audio-player').src = log.audioData;
  modal.classList.remove('hidden');
}

// ==================== ОБОРУДОВАНИЕ ====================
function initEquipment() {
  loadEquipment();
  
  document.getElementById('equip-add-btn').addEventListener('click', function() {
    haptic();
    document.getElementById('equipment-connect').classList.toggle('hidden');
  });
  
  document.getElementById('equip-scan-btn').addEventListener('click', async function() {
    haptic();
    showToast('Сканирование сети...');
    
    const found = [
      { id: 'cam-1', name: 'Камера-1', type: 'camera', ip: '192.168.1.45', battery: 45, status: 'online', isOn: true },
      { id: 'light-1', name: 'Лампа-A', type: 'light', ip: '192.168.1.46', battery: 78, status: 'online', isOn: false }
    ];
    
    AppState.equipment = found;
    localStorage.setItem('EQUIPMENT', JSON.stringify(found));
    loadEquipment();
    
    showToast(`Найдено устройств: ${found.length}`);
  });
}

function loadEquipment() {
  const cameras = document.getElementById('cameras-list');
  const lights = document.getElementById('lights-list');
  const equipment = JSON.parse(localStorage.getItem('EQUIPMENT') || '[]');
  
  const cams = equipment.filter(e => e.type === 'camera');
  const ligs = equipment.filter(e => e.type === 'light');
  
  cameras.innerHTML = cams.length ? cams.map(renderEquipmentItem).join('') : '<div class="equip-empty">Нет подключенных камер</div>';
  lights.innerHTML = ligs.length ? ligs.map(renderEquipmentItem).join('') : '<div class="equip-empty">Нет подключенных ламп</div>';
}

function renderEquipmentItem(item) {
  const batteryClass = item.battery < 20 ? 'low' : '';
  const onClass = item.isOn ? 'active' : '';
  
  return `
    <div class="equip-item" data-id="${item.id}">
      <div class="equip-icon">${item.type === 'camera' ? '📹' : '💡'}</div>
      <div class="equip-info">
        <div class="equip-info-name">${item.name}</div>
        <div class="equip-info-status">
          <span class="equip-battery ${batteryClass}">🔋 ${item.battery}%</span>
          <span class="equip-state">${item.status}</span>
        </div>
      </div>
      <div class="equip-controls">
        <button class="equip-btn ${onClass}" onclick="toggleEquipment('${item.id}')">${item.isOn ? 'ВЫКЛ' : 'ВКЛ'}</button>
      </div>
    </div>
  `;
}

async function toggleEquipment(id) {
  haptic();
  const equipment = JSON.parse(localStorage.getItem('EQUIPMENT') || '[]');
  const item = equipment.find(e => e.id === id);
  if (!item) return;
  
  item.isOn = !item.isOn;
  
  try {
    await fetch(`http://${item.ip}/control`, {
      method: 'POST',
      body: JSON.stringify({ action: item.isOn ? 'on' : 'off' }),
      mode: 'no-cors'
    });
  } catch {
    // Offline
  }
  
  if (item.battery < 20 && !item.batteryWarningSent) {
    item.batteryWarningSent = true;
    showPushNotification('GHOST-HUB', `⚠️ ${item.name} — критический заряд: ${item.battery}%`);
    AudioEngine.play('alert');
  }
  
  localStorage.setItem('EQUIPMENT', JSON.stringify(equipment));
  loadEquipment();
}

// ==================== ПУЛЬС ====================
function initPulse() {
  loadPulseDevices();
  
  document.getElementById('pulse-connect-btn').addEventListener('click', async function() {
    haptic();
    
    if (!('bluetooth' in navigator)) {
      showToast('Bluetooth не поддерживается', 'error');
      return;
    }
    
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'GHOST-PULSE' }],
        optionalServices: ['heart_rate']
      });
      
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('heart_rate');
      const characteristic = await service.getCharacteristic('heart_rate_measurement');
      
      await characteristic.startNotifications();
      
      characteristic.addEventListener('characteristicvaluechanged', (e) => {
        const value = e.target.value;
        const hr = value.getUint8(1);
        const battery = 85;
        
        updatePulseDevice(device.name, hr, battery);
      });
      
      showToast(`Подключено: ${device.name}`);
      AudioEngine.play('success');
      
    } catch (err) {
      showToast('Демо: симуляция пульса');
      simulatePulseDevice();
    }
  });
}

function simulatePulseDevice() {
  const mockDevice = {
    id: 'pulse-demo',
    name: 'GHOST-PULSE-ДИМА',
    hr: 72,
    battery: 85
  };
  
  setInterval(() => {
    mockDevice.hr = 60 + Math.floor(Math.random() * 40);
    updatePulseDevice(mockDevice.name, mockDevice.hr, mockDevice.battery);
  }, 1000);
}

function updatePulseDevice(name, hr, battery) {
  const container = document.getElementById('pulse-devices');
  
  let existing = container.querySelector(`[data-name="${name}"]`);
  
  if (!existing) {
    existing = document.createElement('div');
    existing.className = 'pulse-device';
    existing.dataset.name = name;
    container.appendChild(existing);
  }
  
  existing.innerHTML = `
    <div class="pulse-indicator">❤️</div>
    <div class="pulse-info">
      <div class="pulse-name">${name}</div>
      <div class="pulse-value">${hr} BPM</div>
    </div>
    <div class="pulse-battery">🔋 ${battery}%</div>
  `;
  
  if (AppState.user) {
    AppState.user.pulse = hr;
    AppState.user.battery = battery;
    updateTeamDisplay();
    
    if (typeof ghostDB !== 'undefined') {
      ghostDB.updateUserPulse(AppState.user.id, hr, battery);
    }
  }
  
  AudioEngine.play('pulse');
}

function loadPulseDevices() {}

// ==================== ЧАТ ====================
function initChat() {
  loadChatHistory();
  
  document.getElementById('chat-send').addEventListener('click', sendChatMessage);
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
  
  initP2PChat();
}

function loadChatHistory() {
  const history = JSON.parse(localStorage.getItem('CHAT_HISTORY') || '[]');
  const container = document.getElementById('chat-messages');
  
  container.innerHTML = `
    <div class="chat-system">
      <span class="system-time">[${new Date().toLocaleTimeString('ru-RU', {hour12:false, hour:'2-digit', minute:'2-digit'})}]</span>
      <span class="system-text">СИСТЕМА: Ожидание подключения узлов...</span>
    </div>
  `;
  
  history.forEach(msg => {
    addMessageToChat(msg, false);
  });
}

function sendChatMessage() {
  haptic();
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !AppState.user) return;
  
  if (WebRTCChat.connected && WebRTCChat.sendMessage(text)) {
    const msg = {
      id: Date.now(),
      author: AppState.user.name,
      role: AppState.user.role,
      text: text,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      outgoing: true,
      isWebRTC: true
    };
    addMessageToChat(msg, true);
    input.value = '';
    AudioEngine.play('message');
    return;
  }
  
  const msg = {
    id: Date.now(),
    author: AppState.user.name,
    role: AppState.user.role,
    text: text,
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    outgoing: true
  };
  
  addMessageToChat(msg, true);
  
  const history = JSON.parse(localStorage.getItem('CHAT_HISTORY') || '[]');
  history.push(msg);
  localStorage.setItem('CHAT_HISTORY', JSON.stringify(history.slice(-100)));
  
  broadcastMessage(msg);
  
  if (typeof ghostDB !== 'undefined' && ghostDB.isOnline()) {
    ghostDB.sendMessage(AppState.user.id, AppState.user.name, AppState.user.role, text);
  }
  
  input.value = '';
  AudioEngine.play('message');
}

function addMessageToChat(msg, animate) {
  const container = document.getElementById('chat-messages');
  
  const div = document.createElement('div');
  div.className = `chat-message ${msg.outgoing ? 'outgoing' : 'incoming'} ${msg.isAlarm ? 'alarm' : ''} ${msg.isWebRTC ? 'webrtc' : ''}`;
  div.innerHTML = `
    <div class="chat-author">${msg.author} (${msg.role})</div>
    <div>${escapeHtml(msg.text)}</div>
    <div class="chat-time">${msg.time}</div>
  `;
  
  if (animate) div.style.animation = 'slideIn 0.2s ease';
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function initP2PChat() {
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('ghost_hub_chat');
    
    channel.onmessage = (e) => {
      if (e.data.type === 'chat') {
        const msg = { ...e.data.payload, outgoing: false };
        addMessageToChat(msg, true);
        
        if (document.hidden) {
          showPushNotification('GHOST-HUB', `${msg.author}: ${msg.text.substring(0, 50)}...`);
        }
      }
    };
    
    AppState.broadcastChannel = channel;
  }
}

function broadcastMessage(msg) {
  if (AppState.broadcastChannel) {
    AppState.broadcastChannel.postMessage({
      type: 'chat',
      payload: msg
    });
  }
}

// ==================== ГОЛОСОВОЕ УПРАВЛЕНИЕ ====================
function initVoiceCommand() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.log('Speech recognition not supported');
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  recognition.lang = 'ru-RU';
  recognition.continuous = true;
  recognition.interimResults = false;
  
  AppState.recognition = recognition;
  
  let isListening = false;
  
  document.getElementById('start-voice').addEventListener('click', function() {
    haptic();
    
    if (!isListening) {
      try {
        recognition.start();
        isListening = true;
        AppState.isVoiceActive = true;
        this.textContent = '[ ВЫКЛЮЧИТЬ ГОЛОСОВОЕ УПРАВЛЕНИЕ ]';
        document.getElementById('voice-cmd-btn').classList.add('active');
        showToast('Голосовое управление активно');
        AudioEngine.play('success');
      } catch (e) {
        showToast('Ошибка запуска распознавания', 'error');
      }
    } else {
      recognition.stop();
      isListening = false;
      AppState.isVoiceActive = false;
      this.textContent = '[ ВКЛЮЧИТЬ ГОЛОСОВОЕ УПРАВЛЕНИЕ ]';
      document.getElementById('voice-cmd-btn').classList.remove('active');
    }
  });
  
  recognition.onresult = (event) => {
    const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
    processVoiceCommand(command);
  };
  
  recognition.onend = () => {
    if (AppState.isVoiceActive) {
      setTimeout(() => {
        try {
          recognition.start();
        } catch (err) {
          console.log('Voice restart failed:', err);
        }
      }, 500);
    }
  };
  
  recognition.onerror = (event) => {
    console.log('Voice error:', event.error);
    if (event.error === 'not-allowed') {
      showToast('Доступ к микрофону запрещён', 'error');
      AppState.isVoiceActive = false;
      document.getElementById('start-voice').textContent = '[ ВКЛЮЧИТЬ ГОЛОСОВОЕ УПРАВЛЕНИЕ ]';
      document.getElementById('voice-cmd-btn').classList.remove('active');
    }
  };
}

function processVoiceCommand(command) {
  const statusEl = document.getElementById('voice-status');
  statusEl.classList.remove('hidden');
  statusEl.classList.add('active');
  statusEl.querySelector('.voice-text').textContent = `РАСПОЗНАНО: "${command}"`;
  
  if (command.includes('лог')) {
    document.getElementById('incident-btn').click();
    speakResponse('Событие зафиксировано');
  } else if (command.includes('ночь') || command.includes('темно')) {
    const btn = document.getElementById('night-ops-btn');
    if (!btn.classList.contains('active')) btn.click();
    speakResponse('Ночной режим активирован');
  } else if (command.includes('день') || command.includes('светло')) {
    const btn = document.getElementById('night-ops-btn');
    if (btn.classList.contains('active')) btn.click();
    speakResponse('Ночной режим отключён');
  } else if (command.includes('звук') || command.includes('начать')) {
    const btn = document.getElementById('record-btn');
    if (!AppState.isRecording) btn.click();
    speakResponse('Запись начата');
  } else if (command.includes('стоп')) {
    const btn = document.getElementById('record-btn');
    if (AppState.isRecording) btn.click();
    speakResponse('Запись остановлена');
  } else if (command.includes('статус')) {
    const gps = document.getElementById('gps').textContent;
    const time = document.getElementById('clock').textContent;
    speakResponse(`Время ${time}. Координаты ${gps}`);
  }
  
  setTimeout(() => {
    statusEl.classList.add('hidden');
  }, 2000);
}

function speakResponse(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 0.9;
    utterance.pitch = 0.8;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  }
}

// ==================== DEAD MAN SWITCH ====================
function initDeadManSwitch() {
  const modal = document.getElementById('deadman-modal');
  const startBtn = document.getElementById('start-timer');
  const resetBtn = document.getElementById('reset-timer');
  const stopBtn = document.getElementById('stop-timer');
  const miniReset = document.getElementById('mini-reset');
  const timerDisplay = document.getElementById('deadman-timer');
  const miniTimer = document.getElementById('mini-timer');
  const statusEl = document.getElementById('deadman-status');
  
  document.getElementById('deadman-btn').addEventListener('click', function() {
    haptic();
    modal.classList.remove('hidden');
  });
  
  modal.querySelector('.close-btn').addEventListener('click', function() {
    haptic();
    modal.classList.add('hidden');
  });
  
  modal.querySelector('.modal-overlay').addEventListener('click', function() {
    modal.classList.add('hidden');
  });
  
  startBtn.addEventListener('click', function() {
    haptic();
    AudioEngine.play('alert');
    AppState.deadManActive = true;
    AppState.deadManTimeLeft = 600;
    
    startBtn.classList.add('hidden');
    resetBtn.classList.remove('hidden');
    stopBtn.classList.remove('hidden');
    
    statusEl.innerHTML = '<span class="status-icon">▶</span><span class="status-text">ПРОТОКОЛ АКТИВЕН</span>';
    statusEl.style.color = 'var(--danger)';
    
    document.getElementById('deadman-mini').classList.remove('hidden');
    document.getElementById('deadman-btn').classList.add('active');
    
    updateTimerDisplay();
    
    showToast('Включите аудиозапись перед выходом!');
    
    AppState.deadManTimerInterval = setInterval(() => {
      AppState.deadManTimeLeft--;
      updateTimerDisplay();
      
      if ([300, 120, 60, 30, 10].includes(AppState.deadManTimeLeft)) {
        AudioEngine.play('warning');
        showToast(`Safety: ${formatTime(AppState.deadManTimeLeft)}`);
      }
      
      if (AppState.deadManTimeLeft <= 0) {
        triggerDeadManAlarm();
      }
    }, 1000);
  });
  
  resetBtn.addEventListener('click', function() {
    haptic();
    AudioEngine.play('success');
    AppState.deadManTimeLeft = 600;
    updateTimerDisplay();
    showToast('Таймер сброшен на 10:00');
  });
  
  miniReset.addEventListener('click', function() {
    haptic();
    AudioEngine.play('success');
    AppState.deadManTimeLeft = 600;
    updateTimerDisplay();
    showToast('Таймер сброшен');
  });
  
  stopBtn.addEventListener('click', function() {
    haptic();
    AudioEngine.play('click');
    clearInterval(AppState.deadManTimerInterval);
    AppState.deadManActive = false;
    
    startBtn.classList.remove('hidden');
    resetBtn.classList.add('hidden');
    stopBtn.classList.add('hidden');
    
    statusEl.innerHTML = '<span class="status-icon">⏸</span><span class="status-text">ОЖИДАНИЕ АКТИВАЦИИ</span>';
    statusEl.style.color = '';
    
    document.getElementById('deadman-mini').classList.add('hidden');
    document.getElementById('deadman-btn').classList.remove('active');
    
    AppState.deadManTimeLeft = 600;
    updateTimerDisplay();
  });
  
  function updateTimerDisplay() {
    const timeStr = formatTime(AppState.deadManTimeLeft);
    
    timerDisplay.textContent = timeStr;
    miniTimer.textContent = timeStr;
    
    if (AppState.deadManTimeLeft < 60) {
      timerDisplay.classList.add('warning');
      miniTimer.style.color = 'var(--warning)';
    } else {
      timerDisplay.classList.remove('warning');
      miniTimer.style.color = '';
    }
  }
  
  function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }
  
  async function triggerDeadManAlarm() {
    clearInterval(AppState.deadManTimerInterval);
    AudioEngine.play('alert');
    
    const gps = document.getElementById('gps').textContent;
    const time = document.getElementById('clock').textContent;
    const pulse = AppState.user?.pulse || '--';
    
    const audioData = await getAudioBufferSlice(10);
    
    const alarmMsg = {
      id: Date.now(),
      author: 'SYSTEM',
      role: 'SAFETY',
      text: `🚨 DEAD MAN SWITCH\nПользователь: ${AppState.user?.name || 'Unknown'}\nВремя: ${time}\nКоординаты: ${gps}\nПульс: ${pulse} BPM`,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      outgoing: false,
      isAlarm: true,
      audioData
    };
    
    addMessageToChat(alarmMsg, true);
    
    const history = JSON.parse(localStorage.getItem('CHAT_HISTORY') || '[]');
    history.push(alarmMsg);
    localStorage.setItem('CHAT_HISTORY', JSON.stringify(history.slice(-100)));
    
    showPushNotification('🚨 GHOST-HUB SAFETY', `${AppState.user?.name} - ТРЕВОГА!`);
    
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 1000]);
    }
    
    if (typeof ghostDB !== 'undefined') {
      await ghostDB.sendMessage(null, 'SYSTEM', 'SAFETY', alarmMsg.text);
    }
    
    if (audioData) {
      const playConfirm = confirm('Safety сработал! Прослушать аудиозапись?');
      if (playConfirm) {
        const audio = new Audio(audioData);
        audio.play();
      }
    }
    
    setTimeout(() => {
      stopBtn.click();
    }, 10000);
  }
}

// ==================== СЛЕЖКА (STALKER RADAR) ====================
const StalkerRadar = {
  mode: 'start',
  isActive: false,
  perimeterPath: [],
  currentPosition: { x: 0, y: 0, heading: 0 },
  centerPosition: null,
  devices: new Map(),
  ownDevices: new Set(),
  scanStartTime: null,
  
  init() {
    this.loadOwnDevices();
    this.bindUI();
  },
  
  loadOwnDevices() {
    const saved = localStorage.getItem('STALKER_OWN_DEVICES');
    if (saved) {
      const devices = JSON.parse(saved);
      devices.forEach(d => this.ownDevices.add(d.mac));
    }
  },
  
  saveOwnDevices() {
    const devices = Array.from(this.ownDevices).map(mac => ({
      mac,
      name: localStorage.getItem(`device_name_${mac}`) || 'Unknown'
    }));
    localStorage.setItem('STALKER_OWN_DEVICES', JSON.stringify(devices));
  },
  
  bindUI() {
    document.getElementById('stalker-start-btn').addEventListener('click', () => this.startPerimeter());
    document.getElementById('perimeter-done-btn').addEventListener('click', () => this.finishPerimeter());
    document.getElementById('center-scan-btn').addEventListener('click', () => this.startScanning());
    document.getElementById('stalker-new-scan-btn').addEventListener('click', () => this.reset());
    document.getElementById('stalker-settings-btn').addEventListener('click', () => {
      document.getElementById('stalker-settings-modal').classList.remove('hidden');
      this.renderOwnDevices();
    });
    
    document.getElementById('add-own-device-btn').addEventListener('click', () => {
      const mac = document.getElementById('new-device-mac').value.trim();
      const name = document.getElementById('new-device-name').value.trim();
      if (mac) {
        this.ownDevices.add(mac);
        if (name) localStorage.setItem(`device_name_${mac}`, name);
        this.saveOwnDevices();
        this.renderOwnDevices();
        document.getElementById('new-device-mac').value = '';
        document.getElementById('new-device-name').value = '';
      }
    });
    
    window.addEventListener('deviceorientation', (e) => {
      if (e.alpha !== null) {
        this.currentPosition.heading = e.alpha;
        this.updateCompass();
      }
    });
  },
  
  renderOwnDevices() {
    const list = document.getElementById('own-devices-list');
    if (this.ownDevices.size === 0) {
      list.innerHTML = '<div class="devices-empty">Нет добавленных устройств</div>';
      return;
    }
    
    list.innerHTML = Array.from(this.ownDevices).map(mac => `
      <div class="own-device-item">
        <div class="device-info">
          <div class="device-mac">${mac}</div>
          <div class="device-name">${localStorage.getItem(`device_name_${mac}`) || 'Unknown'}</div>
        </div>
        <button class="remove-device-btn" data-mac="${mac}">×</button>
      </div>
    `).join('');
    
    list.querySelectorAll('.remove-device-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.ownDevices.delete(e.target.dataset.mac);
        this.saveOwnDevices();
        this.renderOwnDevices();
      });
    });
  },
  
  switchScreen(screenName) {
    document.querySelectorAll('.stalker-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`stalker-${screenName}`).classList.add('active');
    this.mode = screenName;
  },
  
  async startPerimeter() {
    haptic();
    this.perimeterPath = [];
    this.currentPosition = { x: 0, y: 0, heading: 0 };
    
    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', this.handleMotion.bind(this));
    }
    
    this.switchScreen('perimeter');
    this.isActive = true;
    
    let steps = 0;
    this.perimeterInterval = setInterval(() => {
      steps++;
      document.getElementById('perimeter-steps').textContent = steps;
      const length = (steps * 0.7).toFixed(1);
      document.getElementById('perimeter-length').textContent = length + 'м';
      const percent = Math.min(100, (steps / 50) * 100);
      document.getElementById('perimeter-fill').style.width = percent + '%';
      document.getElementById('perimeter-percent').textContent = Math.floor(percent) + '%';
    }, 1000);
  },
  
  handleMotion(e) {
    const acc = e.accelerationIncludingGravity;
    if (!acc) return;
    
    const magnitude = Math.sqrt(acc.x**2 + acc.y**2);
    if (magnitude > 2) {
      this.perimeterPath.push({
        x: this.currentPosition.x,
        y: this.currentPosition.y,
        heading: this.currentPosition.heading,
        time: Date.now()
      });
    }
  },
  
  updateCompass() {
    const arrow = document.getElementById('perimeter-arrow');
    if (arrow) {
      arrow.style.transform = `translate(-50%, -50%) rotate(${this.currentPosition.heading}deg)`;
    }
    document.getElementById('perimeter-heading').textContent = Math.floor(this.currentPosition.heading) + '°';
  },
  
  finishPerimeter() {
    haptic();
    clearInterval(this.perimeterInterval);
    window.removeEventListener('devicemotion', this.handleMotion.bind(this));
    
    if (this.perimeterPath.length > 0) {
      let sumX = 0, sumY = 0;
      this.perimeterPath.forEach(p => {
        sumX += p.x;
        sumY += p.y;
      });
      this.centerPosition = {
        x: sumX / this.perimeterPath.length,
        y: sumY / this.perimeterPath.length
      };
    }
    
    document.getElementById('center-gps-status').textContent = '✓';
    document.getElementById('center-orient-status').textContent = '✓';
    this.switchScreen('center');
  },
  
  async startScanning() {
    haptic();
    this.switchScreen('scanning');
    this.devices.clear();
    this.scanStartTime = Date.now();
    
    let seconds = 10;
    const timer = setInterval(() => {
      seconds--;
      document.getElementById('scan-timer').textContent = `00:0${seconds}`;
      if (seconds <= 0) {
        clearInterval(timer);
        this.finishScanning();
      }
    }, 1000);
    
    const beam = document.getElementById('scan-beam');
    beam.style.animation = 'scanRotate 10s linear infinite';
    
    try {
      if ('bluetooth' in navigator) {
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['battery_service']
        });
        
        this.addDevice({
          mac: device.id,
          name: device.name || 'Unknown Device',
          rssi: -70 + Math.floor(Math.random() * 20),
          heading: this.currentPosition.heading,
          time: Date.now()
        });
      }
    } catch (err) {
      console.log('Bluetooth scan:', err);
    }
    
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.addDevice({
          mac: 'sim-' + i,
          name: ['Mi Band', 'AirTag', 'Samsung', 'Unknown'][i],
          rssi: -40 - Math.floor(Math.random() * 40),
          heading: Math.random() * 360,
          time: Date.now()
        });
      }, i * 2000);
    }
  },
  
  addDevice(device) {
    const existing = this.devices.get(device.mac);
    if (existing) {
      existing.rssi = (existing.rssi + device.rssi) / 2;
      existing.heading = device.heading;
    } else {
      this.devices.set(device.mac, device);
    }
    this.updateScanList();
  },
  
  rssiToDistance(rssi) {
    const txPower = -59;
    const n = 2.0;
    return Math.pow(10, (txPower - rssi) / (10 * n));
  },
  
  classifyDevice(mac, name) {
    if (this.ownDevices.has(mac)) return 'friendly';
    if (name?.includes('AirTag') || name?.includes('Tile') || name?.includes('SmartTag')) return 'tracker';
    if (!name || name === 'Unknown' || name === 'Unknown Device') return 'suspicious';
    return 'unknown';
  },
  
  updateScanList() {
    const list = document.getElementById('scan-devices-list');
    if (this.devices.size === 0) {
      list.innerHTML = '<div class="scan-empty">Повернитесь медленно...</div>';
      return;
    }
    
    list.innerHTML = Array.from(this.devices.values()).map(d => `
      <div class="scan-device-item ${this.classifyDevice(d.mac, d.name)}">
        <span class="device-name">${d.name}</span>
        <span class="device-signal">${d.rssi} dBm</span>
      </div>
    `).join('');
    
    this.updatePolarMap('stalker-devices-layer');
  },
  
  updatePolarMap(layerId) {
    const layer = document.getElementById(layerId);
    if (!layer) return;
    
    layer.innerHTML = '';
    
    this.devices.forEach(device => {
      const distance = this.rssiToDistance(device.rssi);
      const maxDist = 10;
      const radius = Math.min(45, (distance / maxDist) * 45);
      const angle = device.heading * Math.PI / 180;
      
      const x = 50 + radius * Math.sin(angle);
      const y = 50 - radius * Math.cos(angle);
      
      const dot = document.createElement('div');
      dot.className = `device-dot ${this.classifyDevice(device.mac, device.name)}`;
      dot.style.left = x + '%';
      dot.style.top = y + '%';
      dot.style.width = (8 - distance/2) + 'px';
      dot.style.height = (8 - distance/2) + 'px';
      dot.title = `${device.name}\n${distance.toFixed(1)}м\n${device.rssi} dBm`;
      
      layer.appendChild(dot);
    });
  },
  
  finishScanning() {
    this.switchScreen('results');
    this.updatePolarMap('results-devices-layer');
    
    const detailList = document.getElementById('devices-detail-list');
    detailList.innerHTML = Array.from(this.devices.values()).map(d => {
      const dist = this.rssiToDistance(d.rssi);
      const type = this.classifyDevice(d.mac, d.name);
      const typeNames = {
        friendly: 'Свое',
        tracker: 'Трекер',
        suspicious: 'Подозрительное',
        unknown: 'Неизвестное'
      };
      return `
        <div class="device-detail ${type}">
          <div class="detail-main">
            <span class="detail-name">${d.name}</span>
            <span class="detail-type">${typeNames[type]}</span>
          </div>
          <div class="detail-stats">
            <span>Расстояние: ${dist.toFixed(1)}м</span>
            <span>Сигнал: ${d.rssi} dBm</span>
            <span>Направление: ${Math.floor(d.heading)}°</span>
          </div>
          ${type !== 'friendly' ? `<button class="mark-friendly-btn" data-mac="${d.mac}" data-name="${d.name}">Отметить как свое</button>` : ''}
        </div>
      `;
    }).join('');
    
    detailList.querySelectorAll('.mark-friendly-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mac = e.target.dataset.mac;
        const name = e.target.dataset.name;
        this.ownDevices.add(mac);
        localStorage.setItem(`device_name_${mac}`, name);
        this.saveOwnDevices();
        this.finishScanning();
        showToast('Устройство добавлено в белый список');
      });
    });
  },
  
  reset() {
    this.devices.clear();
    this.perimeterPath = [];
    this.switchScreen('start');
  },
  
  stop() {
    this.isActive = false;
    clearInterval(this.perimeterInterval);
  }
};

function initStalker() {
  StalkerRadar.init();
}

// ==================== WEBRTC P2P CHAT - ИСПРАВЛЕННЫЙ ====================
const WebRTCChat = {
  peer: null,
  dataChannel: null,
  roomId: null,
  isHost: false,
  connected: false,
  currentPanel: 'menu',
  
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  },
  
  init() {
    this.initUI();
    this.initSignaling();
  },
  
  initUI() {
    document.getElementById('chat-mode-wifi').addEventListener('click', () => {
      haptic();
      this.openWebRTCModal();
    });
    
    document.getElementById('chat-mode-bt').addEventListener('click', () => {
      haptic();
      document.getElementById('bluetooth-modal').classList.remove('hidden');
    });
    
    document.getElementById('chat-mode-lora').addEventListener('click', () => {
      haptic();
      document.getElementById('lora-modal').classList.remove('hidden');
    });
    
    document.getElementById('webrtc-settings-btn').addEventListener('click', () => {
      haptic();
      this.openWebRTCModal();
    });
    
    document.getElementById('webrtc-disconnect').addEventListener('click', () => {
      haptic();
      this.disconnect();
    });
    
    document.querySelectorAll('#webrtc-modal .close-btn, #webrtc-modal .modal-overlay').forEach(el => {
      el.addEventListener('click', () => {
        document.getElementById('webrtc-modal').classList.add('hidden');
        this.currentPanel = 'menu';
      });
    });
  },
  
  openWebRTCModal() {
    const modal = document.getElementById('webrtc-modal');
    modal.classList.remove('hidden');
    this.showPanel('menu');
  },
  
  showPanel(panel) {
    this.currentPanel = panel;
    
    document.getElementById('webrtc-menu-panel').classList.add('hidden');
    document.getElementById('webrtc-create-panel').classList.add('hidden');
    document.getElementById('webrtc-join-panel').classList.add('hidden');
    
    document.getElementById(`webrtc-${panel}-panel`).classList.remove('hidden');
    
    const titles = {
      'menu': '◈ P2P WEBRTC CONNECT',
      'create': '◈ СОЗДАТЬ КОМНАТУ',
      'join': '◈ ПОДКЛЮЧИТЬСЯ'
    };
    document.querySelector('#webrtc-modal .modal-title').textContent = titles[panel];
    
    if (panel === 'menu') {
      document.getElementById('webrtc-create-action').onclick = () => {
        haptic();
        this.showPanel('create');
        this.startRoomCreation();
      };
      
      document.getElementById('webrtc-join-action').onclick = () => {
        haptic();
        this.showPanel('join');
        document.getElementById('webrtc-join-input').focus();
      };
    }
    
    if (panel === 'join') {
      document.getElementById('webrtc-confirm-join').onclick = () => {
        haptic();
        this.confirmJoin();
      };
    }
  },
  
  async startRoomCreation() {
    this.roomId = this.generateRoomId();
    this.isHost = true;
    
    document.getElementById('webrtc-room-id-display').textContent = this.roomId;
    document.getElementById('webrtc-room-status').textContent = 'Ожидание подключения...';
    
    this.generateQR(this.roomId);
    this.setupPeerConnection();
    
    this.dataChannel = this.peer.createDataChannel('chat', { ordered: true });
    this.setupDataChannel(this.dataChannel);
    
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    
    this.broadcastSignal({
      type: 'offer',
      roomId: this.roomId,
      offer: offer,
      from: AppState.user?.name || 'Unknown'
    });
    
    AudioEngine.play('success');
    showToast(`Комната ${this.roomId} создана`);
  },
  
  async confirmJoin() {
    const inputId = document.getElementById('webrtc-join-input').value.trim();
    
    if (!inputId || inputId.length !== 6) {
      showToast('Введите 6-значный ID комнаты', 'error');
      return;
    }
    
    this.roomId = inputId;
    this.isHost = false;
    
    this.setupPeerConnection();
    
    document.getElementById('webrtc-modal').classList.add('hidden');
    showToast('Ожидание хоста...');
    
    this.showChatInterface();
    this.updateConnectionStatus('connecting');
    
    setTimeout(() => {
      if (!this.connected) {
        showToast('Не удалось подключиться', 'error');
        this.updateConnectionStatus('offline');
      }
    }, 30000);
  },
  
  showChatInterface() {
    document.getElementById('chat-mode-selector').classList.add('hidden');
    document.getElementById('chat-interface').classList.remove('hidden');
    document.getElementById('webrtc-disconnect').classList.remove('hidden');
  },
  
  showModeSelector() {
    document.getElementById('chat-mode-selector').classList.remove('hidden');
    document.getElementById('chat-interface').classList.add('hidden');
    document.getElementById('webrtc-disconnect').classList.add('hidden');
    
    const statusEl = document.getElementById('chat-network-status');
    statusEl.textContent = 'OFFLINE';
    statusEl.style.color = '';
  },
  
  updateConnectionStatus(status) {
    const statusEl = document.getElementById('webrtc-status');
    const textEl = statusEl.querySelector('.status-text');
    const dotEl = statusEl.querySelector('.status-dot');
    
    statusEl.classList.remove('connecting', 'connected', 'offline');
    
    switch(status) {
      case 'connecting':
        statusEl.classList.add('connecting');
        textEl.textContent = 'ПОДКЛЮЧЕНИЕ...';
        break;
      case 'connected':
        statusEl.classList.add('connected');
        textEl.textContent = 'P2P CONNECTED';
        break;
      case 'offline':
      default:
        statusEl.classList.add('offline');
        textEl.textContent = 'OFFLINE';
    }
  },
  
  generateRoomId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },
  
  setupPeerConnection() {
    this.peer = new RTCPeerConnection(this.config);
    
    this.peer.onicecandidate = (e) => {
      if (e.candidate) {
        this.broadcastSignal({
          type: 'ice',
          roomId: this.roomId,
          candidate: e.candidate,
          isHost: this.isHost
        });
      }
    };
    
    this.peer.onconnectionstatechange = () => {
      const state = this.peer.connectionState;
      console.log('WebRTC state:', state);
      
      if (state === 'connected') {
        this.onConnected();
      } else if (state === 'disconnected' || state === 'failed') {
        this.onDisconnected();
      }
    };
    
    this.peer.ondatachannel = (e) => {
      this.dataChannel = e.channel;
      this.setupDataChannel(this.dataChannel);
    };
  },
  
  setupDataChannel(channel) {
    channel.onopen = () => {
      console.log('DataChannel открыт');
      this.onConnected();
    };
    
    channel.onclose = () => {
      console.log('DataChannel закрыт');
      this.onDisconnected();
    };
    
    channel.onmessage = (e) => {
      const data = JSON.parse(e.data);
      this.handleDataChannelMessage(data);
    };
  },
  
  initSignaling() {
    if ('BroadcastChannel' in window) {
      this.localChannel = new BroadcastChannel('ghost_hub_webrtc');
      this.localChannel.onmessage = (e) => this.handleSignal(e.data);
    }
    
    window.addEventListener('storage', (e) => {
      if (e.key === 'ghost_hub_signal') {
        const data = JSON.parse(e.newValue);
        this.handleSignal(data);
      }
    });
  },
  
  handleSignal(data) {
    if (data.roomId !== this.roomId) return;
    
    switch(data.type) {
      case 'offer':
        if (!this.isHost) {
          this.handleOffer(data.offer, data.from);
        }
        break;
      case 'answer':
        if (this.isHost) {
          this.handleAnswer(data.answer);
        }
        break;
      case 'ice':
        this.handleIceCandidate(data.candidate, data.isHost);
        break;
    }
  },
  
  async handleOffer(offer, from) {
    await this.peer.setRemoteDescription(offer);
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    
    this.broadcastSignal({
      type: 'answer',
      roomId: this.roomId,
      answer: answer
    });
    
    showToast(`Подключение к ${from}...`);
  },
  
  async handleAnswer(answer) {
    await this.peer.setRemoteDescription(answer);
  },
  
  async handleIceCandidate(candidate, fromHost) {
    if (fromHost !== this.isHost) {
      try {
        await this.peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch(e) {
        console.log('ICE error:', e);
      }
    }
  },
  
  broadcastSignal(data) {
    if (this.localChannel) {
      this.localChannel.postMessage(data);
    }
    
    const signalData = {
      ...data,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    };
    sessionStorage.setItem('ghost_hub_signal', JSON.stringify(signalData));
  },
  
  onConnected() {
    if (this.connected) return;
    this.connected = true;
    
    this.updateConnectionStatus('connected');
    
    const sysMsg = {
      id: Date.now(),
      author: 'SYSTEM',
      role: 'WEBRTC',
      text: `✓ P2P соединение установлено! Комната: ${this.roomId}`,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      outgoing: false,
      isSystem: true
    };
    addMessageToChat(sysMsg, true);
    
    document.getElementById('webrtc-modal').classList.add('hidden');
    
    AudioEngine.play('success');
    showToast('P2P соединение установлено!');
  },
  
  onDisconnected() {
    if (!this.connected) return;
    this.connected = false;
    
    this.updateConnectionStatus('offline');
    
    const sysMsg = {
      id: Date.now(),
      author: 'SYSTEM',
      role: 'WEBRTC',
      text: '✗ P2P соединение разорвано',
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      outgoing: false,
      isSystem: true
    };
    addMessageToChat(sysMsg, true);
    
    showToast('Соединение разорвано', 'error');
  },
  
  handleDataChannelMessage(data) {
    if (data.type === 'chat') {
      const msg = {
        ...data.payload,
        outgoing: false,
        isWebRTC: true
      };
      addMessageToChat(msg, true);
      AudioEngine.play('message');
      
      if (document.hidden) {
        showPushNotification('GHOST-HUB P2P', `${msg.author}: ${msg.text.substring(0, 50)}...`);
      }
    }
  },
  
  sendMessage(text) {
    if (!this.connected || !this.dataChannel || this.dataChannel.readyState !== 'open') {
      return false;
    }
    
    const msg = {
      type: 'chat',
      payload: {
        id: Date.now(),
        author: AppState.user?.name || 'Unknown',
        role: AppState.user?.role || 'Operator',
        text: text,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        isWebRTC: true
      }
    };
    
    this.dataChannel.send(JSON.stringify(msg));
    return true;
  },
  
  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    if (this.peer) {
      this.peer.close();
    }
    
    this.peer = null;
    this.dataChannel = null;
    this.roomId = null;
    this.isHost = false;
    this.connected = false;
    
    this.showModeSelector();
    showToast('Отключено от P2P сети');
  },
  
  generateQR(text) {
    const container = document.getElementById('webrtc-qr-code');
    container.innerHTML = '';
    
    if (typeof QRCode !== 'undefined') {
      QRCode.toCanvas(container, text, {
        width: 140,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } else {
      container.innerHTML = `<div style="font-size:20px; font-weight:800;">${text}</div>`;
    }
  }
};

// ==================== УТИЛИТЫ ====================
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showPushNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/icon.png',
      badge: '/icon.png',
      tag: 'ghost-hub',
      requireInteraction: true
    });
  }
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, {
        body,
        icon: '/icon.png',
        badge: '/icon.png',
        actions: [{ action: 'open', title: 'Открыть' }],
        data: { type: 'chat' }
      });
    });
  }
}

document.querySelectorAll('.modal .close-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    haptic();
    this.closest('.modal').classList.add('hidden');
  });
});

document.querySelectorAll('.modal .modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function() {
    this.closest('.modal').classList.add('hidden');
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(reg => console.log('SW registered:', reg))
    .catch(err => console.log('SW registration failed:', err));
}

console.log('GHOST-HUB v3.1 loaded');
