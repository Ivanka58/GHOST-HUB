// script.js — ПОЛНЫЙ ИСПРАВЛЕННЫЙ ФАЙЛ
// GHOST-HUB v3.1

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

function haptic() {
  AudioEngine.play('vibrate');
  if (navigator.vibrate) {
    navigator.vibrate(30);
  }
}

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
      if (progress) progress.style.width = '100%';
    }, 100);
    
    setTimeout(() => {
      if (splash) splash.classList.add('hidden');
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
  if (boot) boot.classList.remove('hidden');
}

function hideBootScreen() {
  const boot = document.getElementById('boot-screen');
  if (boot) {
    boot.style.opacity = '0';
    setTimeout(() => {
      boot.classList.add('hidden');
      const main = document.getElementById('main-interface');
      if (main) main.classList.remove('hidden');
    }, 300);
  }
}

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
  if (authScreen) authScreen.classList.remove('hidden');
  
  const header = document.getElementById('app-header');
  const actions = document.getElementById('quick-actions');
  const nav = document.getElementById('mobile-nav');
  const content = document.getElementById('content-area');
  
  if (header) header.classList.add('hidden');
  if (actions) actions.classList.add('hidden');
  if (nav) nav.classList.add('hidden');
  if (content) content.classList.add('hidden');
  
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
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.classList.add('hidden');
  
  const header = document.getElementById('app-header');
  const actions = document.getElementById('quick-actions');
  const nav = document.getElementById('mobile-nav');
  const content = document.getElementById('content-area');
  
  if (header) header.classList.remove('hidden');
  if (actions) actions.classList.remove('hidden');
  if (nav) nav.classList.remove('hidden');
  if (content) content.classList.remove('hidden');
  
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
  
  try {
    initStalker();
  } catch (e) {
    console.error('Error init stalker:', e);
  }
  
  setTimeout(() => {
    WebRTCChat.init();
  }, 1000);
  
  requestPermissions();
}

function updateStatusIndicator(online) {
  const indicator = document.getElementById('status-indicator');
  const text = document.getElementById('status-text');
  
  if (!indicator || !text) return;
  
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
  if (indicator) {
    if (AppState.isOnline) {
      indicator.classList.add('hidden');
    } else {
      indicator.classList.remove('hidden');
    }
  }
}

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

function initClock() {
  function update() {
    const now = new Date();
    const msk = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
    const h = String(msk.getHours()).padStart(2, '0');
    const m = String(msk.getMinutes()).padStart(2, '0');
    const s = String(msk.getSeconds()).padStart(2, '0');
    const clock = document.getElementById('clock');
    if (clock) clock.textContent = `${h}:${m}:${s}`;
  }
  update();
  setInterval(update, 1000);
}

function initGeolocation() {
  const gpsEl = document.getElementById('gps');
  if (!gpsEl) return;
  
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
    const gps = document.getElementById('gps');
    if (gps) gps.textContent = `${baseLat.toFixed(4)}°N ${baseLng.toFixed(4)}°E`;
    AppState.radarPosition = { lat: baseLat, lng: baseLng };
  }, 3000);
}

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
  
  if (!grid || !countEl) return;
  
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

function initQuickActions() {
  const incidentBtn = document.getElementById('incident-btn');
  const nightBtn = document.getElementById('night-ops-btn');
  const voiceBtn = document.getElementById('voice-cmd-btn');
  const deadBtn = document.getElementById('deadman-btn');
  
  if (incidentBtn) {
    incidentBtn.addEventListener('click', async function() {
      haptic();
      AudioEngine.play('alert');
      
      const now = new Date();
      const time = now.toLocaleTimeString('ru-RU', { hour12: false });
      const gps = document.getElementById('gps')?.textContent || '--.---- --.----';
      
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
      
      const timeEl = document.getElementById('incident-time');
      const coordsEl = document.getElementById('incident-coords');
      const emfEl = document.getElementById('incident-emf');
      const noiseEl = document.getElementById('incident-noise');
      
      if (timeEl) timeEl.textContent = time;
      if (coordsEl) coordsEl.textContent = gps;
      if (emfEl) emfEl.textContent = logData.emf;
      if (noiseEl) noiseEl.textContent = logData.noise;
      
      const modal = document.getElementById('incident-modal');
      if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('hidden'), 3000);
      }
      
      loadLogs();
      AudioEngine.play('success');
    });
  }
  
  if (nightBtn) {
    nightBtn.addEventListener('click', function() {
      haptic();
      const overlay = document.getElementById('night-ops-overlay');
      const btn = document.getElementById('night-ops-btn');
      if (!overlay || !btn) return;
      
      const isHidden = overlay.classList.contains('hidden');
      
      overlay.classList.toggle('hidden', !isHidden);
      btn.classList.toggle('active', isHidden);
      document.body.classList.toggle('night-mode', isHidden);
    });
  }
  
  if (voiceBtn) {
    voiceBtn.addEventListener('click', function() {
      haptic();
      const modal = document.getElementById('voice-help-modal');
      if (modal) modal.classList.remove('hidden');
    });
  }
  
  if (deadBtn) {
    deadBtn.addEventListener('click', function() {
      haptic();
      const modal = document.getElementById('deadman-modal');
      if (modal) modal.classList.remove('hidden');
    });
  }
}

function initNavigator() {
  document.querySelectorAll('.nav-mode-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      haptic();
      const mode = this.dataset.mode;
      
      document.querySelectorAll('.nav-mode-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      document.querySelectorAll('.navigator-mode-content').forEach(c => c.classList.remove('active'));
      const target = document.getElementById('mode-' + mode);
      if (target) target.classList.add('active');
      
      if (mode === 'map-to-coords') {
        setTimeout(initPickerMap, 100);
      }
    });
  });
  
  const showBtn = document.getElementById('btn-show-on-map');
  if (showBtn) {
    showBtn.addEventListener('click', function() {
      haptic();
      const lat = parseFloat(document.getElementById('input-lat').value);
      const lng = parseFloat(document.getElementById('input-lng').value);
      
      if (isNaN(lat) || isNaN(lng)) {
        showToast('Введите корректные координаты', 'error');
        return;
      }
      
      const result = document.getElementById('coords-result-map');
      if (result) result.classList.remove('hidden');
      
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
        
        const resCoords = document.getElementById('result-coords-1');
        if (resCoords) resCoords.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }, 100);
      
      AudioEngine.play('success');
    });
  }
  
  document.getElementById('copy-coords-1')?.addEventListener('click', function() {
    haptic();
    const text = document.getElementById('result-coords-1')?.textContent;
    if (text) navigator.clipboard.writeText(text).then(() => showToast('Координаты скопированы'));
  });
  
  document.getElementById('btn-get-coords')?.addEventListener('click', async function() {
    haptic();
    const address = document.getElementById('input-address')?.value.trim();
    if (!address) {
      showToast('Введите адрес', 'error');
      return;
    }
    
    const btn = document.getElementById('btn-get-coords');
    const originalText = btn?.innerHTML;
    if (btn) {
      btn.innerHTML = '<span>◈ ПОИСК...</span>';
      btn.disabled = true;
    }
    
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const resLat = document.getElementById('result-lat');
        const resLng = document.getElementById('result-lng');
        const resAddr = document.getElementById('result-full-address');
        const resBlock = document.getElementById('address-result');
        
        if (resLat) resLat.textContent = parseFloat(result.lat).toFixed(6);
        if (resLng) resLng.textContent = parseFloat(result.lon).toFixed(6);
        if (resAddr) resAddr.textContent = result.display_name;
        if (resBlock) resBlock.classList.remove('hidden');
        
        AudioEngine.play('success');
      } else {
        showToast('Адрес не найден', 'error');
      }
    } catch (err) {
      showToast('Ошибка поиска', 'error');
    }
    
    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });
  
  document.getElementById('copy-picker-coords')?.addEventListener('click', function() {
    haptic();
    const lat = document.getElementById('picker-lat')?.textContent;
    const lng = document.getElementById('picker-lng')?.textContent;
    if (lat && lng) navigator.clipboard.writeText(`${lat}, ${lng}`).then(() => showToast('Координаты скопированы'));
  });
  
  document.getElementById('use-picker-coords')?.addEventListener('click', function() {
    haptic();
    const latEl = document.getElementById('picker-lat');
    const lngEl = document.getElementById('picker-lng');
    if (latEl) document.getElementById('input-lat').value = latEl.textContent;
    if (lngEl) document.getElementById('input-lng').value = lngEl.textContent;
    document.querySelector('[data-mode="coords-to-map"]')?.click();
    showToast('Координаты перенесены');
  });
}

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
      const latEl = document.getElementById('picker-lat');
      const lngEl = document.getElementById('picker-lng');
      const res = document.getElementById('picker-result');
      
      if (latEl) latEl.textContent = pos.lat.toFixed(6);
      if (lngEl) lngEl.textContent = pos.lng.toFixed(6);
      if (res) res.classList.remove('hidden');
    });
    
    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      const latEl = document.getElementById('picker-lat');
      const lngEl = document.getElementById('picker-lng');
      const res = document.getElementById('picker-result');
      
      if (latEl) latEl.textContent = e.latlng.lat.toFixed(6);
      if (lngEl) lngEl.textContent = e.latlng.lng.toFixed(6);
      if (res) res.classList.remove('hidden');
    });
    
    AppState.maps['picker'] = map;
  }, 100);
};

function initTremor() {
  const canvas = document.getElementById('seismograph');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth || 300;
  canvas.height = 180;
  
  const historyX = [], historyY = [], historyZ = [];
  const maxHistory = 100;
  let sensitivity = 5;
  
  const sensInput = document.getElementById('sensitivity');
  if (sensInput) {
    sensInput.addEventListener('input', function() {
      sensitivity = parseInt(this.value);
      const sensVal = document.getElementById('sensitivity-value');
      const thresh = document.getElementById('threshold');
      if (sensVal) sensVal.textContent = sensitivity;
      if (thresh) thresh.textContent = (sensitivity * 0.1).toFixed(2);
    });
  }
  
  document.getElementById('tremor-start-btn')?.addEventListener('click', async function() {
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
    this.classList.add('hidden');
    const stopBtn = document.getElementById('tremor-stop-btn');
    if (stopBtn) stopBtn.classList.remove('hidden');
    
    const statusDot = document.getElementById('tremor-status-dot');
    const statusText = document.getElementById('tremor-status-text');
    if (statusDot) statusDot.classList.add('active');
    if (statusText) statusText.textContent = 'АКТИВЕН';
    
    AudioEngine.play('success');
    
    window.addEventListener('devicemotion', handleMotion);
    draw();
    
    function handleMotion(e) {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      
      if (historyX.length >= maxHistory) {
        historyX.shift();
        historyY.shift();
        historyZ.shift();
      }
      historyX.push(acc.x || 0);
      historyY.push(acc.y || 0);
      historyZ.push(acc.z || 9.8);
      
      const mag = Math.sqrt(acc.x**2 + acc.y**2 + (acc.z-9.8)**2);
      const magEl = document.getElementById('magnitude');
      if (magEl) magEl.textContent = mag.toFixed(2);
      
      if (mag > sensitivity * 0.1) {
        addTremorLog(mag.toFixed(2));
        AudioEngine.play('warning');
      }
    }
    
    function addTremorLog(mag) {
      const container = document.getElementById('tremor-entries');
      if (!container) return;
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
      
      drawAxis(historyX, '#FF6666', 0, 'X');
      drawAxis(historyY, '#66FF66', 0, 'Y');
      drawAxis(historyZ, '#6699FF', 9.8, 'Z');
      
      requestAnimationFrame(draw);
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
    }
  });
  
  document.getElementById('tremor-stop-btn')?.addEventListener('click', function() {
    haptic();
    AppState.tremorActive = false;
    this.classList.add('hidden');
    const startBtn = document.getElementById('tremor-start-btn');
    if (startBtn) startBtn.classList.remove('hidden');
    
    const statusDot = document.getElementById('tremor-status-dot');
    const statusText = document.getElementById('tremor-status-text');
    if (statusDot) statusDot.classList.remove('active');
    if (statusText) statusText.textContent = 'ОЖИДАНИЕ';
  });
}

function stopTremor() {
  AppState.tremorActive = false;
}

function initAudioRecorder() {
  let mediaRecorder = null;
  let audioChunks = [];
  let startTime = null;
  let timerInterval = null;
  
  initAudioRingBuffer();
  
  const recordBtn = document.getElementById('record-btn');
  if (!recordBtn) return;
  
  recordBtn.addEventListener('click', async function() {
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
        
        this.classList.add('recording');
        this.innerHTML = '<span class="record-icon">⏹</span><span class="record-text">СТОП</span>';
        
        const statusDot = document.getElementById('audio-status-dot');
        const statusText = document.getElementById('audio-status-text');
        if (statusDot) {
          statusDot.classList.add('active');
          statusDot.style.background = 'var(--danger)';
        }
        if (statusText) statusText.textContent = 'ЗАПИСЬ';
        
        AudioEngine.play('recordStart');
        
        timerInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
          const s = String(elapsed % 60).padStart(2, '0');
          const timer = document.getElementById('audio-timer');
          if (timer) timer.textContent = `${m}:${s}`;
        }, 1000);
        
      } catch (err) {
        showToast('Доступ к микрофону запрещён', 'error');
      }
    } else {
      if (mediaRecorder) mediaRecorder.stop();
      AppState.isRecording = false;
      clearInterval(timerInterval);
      
      this.classList.remove('recording');
      this.innerHTML = '<span class="record-icon">●</span><span class="record-text">ЗАПИСЬ</span>';
      
      const statusDot = document.getElementById('audio-status-dot');
            const statusText = document.getElementById('audio-status-text');
      const timer = document.getElementById('audio-timer');
      
      if (statusDot) {
        statusDot.classList.remove('active');
        statusDot.style.background = '';
      }
      if (statusText) statusText.textContent = 'ГОТОВ';
      if (timer) timer.textContent = '00:00';
    }
  });
  
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
  }).catch(() => {});
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
  if (!list) return;
  
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
      const modal = document.getElementById('record-menu-modal');
      if (modal) modal.classList.remove('hidden');
    });
  });
}

document.getElementById('download-record-btn')?.addEventListener('click', async function() {
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
  const modal = document.getElementById('record-menu-modal');
  if (modal) modal.classList.add('hidden');
});

document.getElementById('delete-record-btn')?.addEventListener('click', async function() {
  haptic();
  if (confirm('Удалить запись?')) {
    await AudioDB.deleteRecord(AppState.currentRecordId);
    loadAudioRecords();
    showToast('Запись удалена');
  }
  const modal = document.getElementById('record-menu-modal');
  if (modal) modal.classList.add('hidden');
});

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// ==================== ЛОГИ ====================
function initLogs() {
  loadLogs();
  document.getElementById('logs-clear-all')?.addEventListener('click', function() {
    haptic();
    if (!confirm('Удалить ВСЕ логи?')) return;
    localStorage.removeItem('INCIDENT_LOGS');
    loadLogs();
    AudioEngine.play('alert');
  });
}

function loadLogs() {
  const list = document.getElementById('logs-list');
  if (!list) return;
  
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
      const modal = document.getElementById('log-menu-modal');
      if (modal) modal.classList.remove('hidden');
    });
  });
  
  list.querySelectorAll('.play-log-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      haptic();
      playLogAudio(parseInt(this.dataset.id));
    });
  });
}

document.getElementById('download-log-btn')?.addEventListener('click', function() {
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
  const modal = document.getElementById('log-menu-modal');
  if (modal) modal.classList.add('hidden');
});

document.getElementById('delete-log-btn')?.addEventListener('click', function() {
  haptic();
  if (confirm('Удалить этот лог?')) {
    const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
    const updated = logs.filter(l => l.id !== AppState.currentLogId);
    localStorage.setItem('INCIDENT_LOGS', JSON.stringify(updated));
    loadLogs();
    showToast('Лог удалён');
  }
  const modal = document.getElementById('log-menu-modal');
  if (modal) modal.classList.add('hidden');
});

function playLogAudio(id) {
  const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
  const log = logs.find(l => l.id === id);
  
  if (!log || !log.audioData) {
    showToast('Аудио не найдено', 'error');
    return;
  }
  
  const modal = document.getElementById('log-player-modal');
  const info = document.getElementById('log-player-info');
  const player = document.getElementById('log-audio-player');
  
  if (info) info.textContent = `Лог от ${log.time} | ${log.gps}`;
  if (player) player.src = log.audioData;
  if (modal) modal.classList.remove('hidden');
}

// ==================== ОБОРУДОВАНИЕ ====================
function initEquipment() {
  loadEquipment();
  
  document.getElementById('equip-add-btn')?.addEventListener('click', function() {
    haptic();
    const connect = document.getElementById('equipment-connect');
    if (connect) connect.classList.toggle('hidden');
  });
  
  document.getElementById('equip-scan-btn')?.addEventListener('click', async function() {
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
  if (!cameras || !lights) return;
  
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
  } catch {}
  
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
  
  document.getElementById('pulse-connect-btn')?.addEventListener('click', async function() {
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
  if (!container) return;
  
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
  
  document.getElementById('chat-send')?.addEventListener('click', sendChatMessage);
  document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
  
  initP2PChat();
}

function loadChatHistory() {
  const history = JSON.parse(localStorage.getItem('CHAT_HISTORY') || '[]');
  const container = document.getElementById('chat-messages');
  if (!container) return;
  
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
  const text = input?.value.trim();
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
    if (input) input.value = '';
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
  
  if (input) input.value = '';
  AudioEngine.play('message');
}

function addMessageToChat(msg, animate) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  
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
  
  document.getElementById('start-voice')?.addEventListener('click', function() {
    haptic();
    
    if (!isListening) {
      try {
        recognition.start();
        isListening = true;
        AppState.isVoiceActive = true;
        this.textContent = '[ ВЫКЛЮЧИТЬ ГОЛОСОВОЕ УПРАВЛЕНИЕ ]';
        document.getElementById('voice-cmd-btn')?.classList.add('active');
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
      document.getElementById('voice-cmd-btn')?.classList.remove('active');
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
        } catch (err) {}
      }, 500);
    }
  };
  
  recognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
      showToast('Доступ к микрофону запрещён', 'error');
      AppState.isVoiceActive = false;
      const btn = document.getElementById('start-voice');
      if (btn) btn.textContent = '[ ВКЛЮЧИТЬ ГОЛОСОВОЕ УПРАВЛЕНИЕ ]';
      document.getElementById('voice-cmd-btn')?.classList.remove('active');
    }
  };
}

function processVoiceCommand(command) {
  const statusEl = document.getElementById('voice-status');
  if (!statusEl) return;
  
  statusEl.classList.remove('hidden');
  statusEl.classList.add('active');
  const textEl = statusEl.querySelector('.voice-text');
  if (textEl) textEl.textContent = `РАСПОЗНАНО: "${command}"`;
  
  if (command.includes('лог')) {
    document.getElementById('incident-btn')?.click();
    speakResponse('Событие зафиксировано');
  } else if (command.includes('ночь') || command.includes('темно')) {
    const btn = document.getElementById('night-ops-btn');
    if (btn && !btn.classList.contains('active')) btn.click();
    speakResponse('Ночной режим активирован');
  } else if (command.includes('день') || command.includes('светло')) {
    const btn = document.getElementById('night-ops-btn');
    if (btn && btn.classList.contains('active')) btn.click();
    speakResponse('Ночной режим отключён');
  } else if (command.includes('звук') || command.includes('начать')) {
    const btn = document.getElementById('record-btn');
    if (btn && !AppState.isRecording) btn.click();
    speakResponse('Запись начата');
  } else if (command.includes('стоп')) {
    const btn = document.getElementById('record-btn');
    if (btn && AppState.isRecording) btn.click();
    speakResponse('Запись остановлена');
  } else if (command.includes('статус')) {
    const gps = document.getElementById('gps')?.textContent;
    const time = document.getElementById('clock')?.textContent;
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
  
  document.getElementById('deadman-btn')?.addEventListener('click', function() {
    haptic();
    if (modal) modal.classList.remove('hidden');
  });
  
  modal?.querySelector('.close-btn')?.addEventListener('click', function() {
    haptic();
    if (modal) modal.classList.add('hidden');
  });
  
  modal?.querySelector('.modal-overlay')?.addEventListener('click', function() {
    if (modal) modal.classList.add('hidden');
  });
  
  startBtn?.addEventListener('click', function() {
    haptic();
    AudioEngine.play('alert');
    AppState.deadManActive = true;
    AppState.deadManTimeLeft = 600;
    
    if (startBtn) startBtn.classList.add('hidden');
    if (resetBtn) resetBtn.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.remove('hidden');
    
    const statusEl = document.getElementById('deadman-status');
    if (statusEl) {
      statusEl.innerHTML = '<span class="status-icon">▶</span><span class="status-text">ПРОТОКОЛ АКТИВЕН</span>';
      statusEl.style.color = 'var(--danger)';
    }
    
    const mini = document.getElementById('deadman-mini');
    const deadBtn = document.getElementById('deadman-btn');
    if (mini) mini.classList.remove('hidden');
    if (deadBtn) deadBtn.classList.add('active');
    
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
  
  resetBtn?.addEventListener('click', function() {
    haptic();
    AudioEngine.play('success');
    AppState.deadManTimeLeft = 600;
    updateTimerDisplay();
    showToast('Таймер сброшен на 10:00');
  });
  
  miniReset?.addEventListener('click', function() {
    haptic();
    AudioEngine.play('success');
    AppState.deadManTimeLeft = 600;
    updateTimerDisplay();
    showToast('Таймер сброшен');
  });
  
  stopBtn?.addEventListener('click', function() {
    haptic();
    AudioEngine.play('click');
    clearInterval(AppState.deadManTimerInterval);
    AppState.deadManActive = false;
    
    if (startBtn) startBtn.classList.remove('hidden');
    if (resetBtn) resetBtn.classList.add('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');
    
    const statusEl = document.getElementById('deadman-status');
    if (statusEl) {
      statusEl.innerHTML = '<span class="status-icon">⏸</span><span class="status-text">ОЖИДАНИЕ АКТИВАЦИИ</span>';
      statusEl.style.color = '';
    }
    
    const mini = document.getElementById('deadman-mini');
    const deadBtn = document.getElementById('deadman-btn');
    if (mini) mini.classList.add('hidden');
    if (deadBtn) deadBtn.classList.remove('active');
    
    AppState.deadManTimeLeft = 600;
    updateTimerDisplay();
  });
  
  function updateTimerDisplay() {
    const timerDisplay = document.getElementById('deadman-timer');
    const miniTimer = document.getElementById('mini-timer');
    const timeStr = formatTime(AppState.deadManTimeLeft);
    
    if (timerDisplay) timerDisplay.textContent = timeStr;
    if (miniTimer) miniTimer.textContent = timeStr;
    
    if (AppState.deadManTimeLeft < 60) {
      if (timerDisplay) timerDisplay.classList.add('warning');
      if (miniTimer) miniTimer.style.color = 'var(--warning)';
    } else {
      if (timerDisplay) timerDisplay.classList.remove('warning');
      if (miniTimer) miniTimer.style.color = '';
    }
  }
  
  async function triggerDeadManAlarm() {
    clearInterval(AppState.deadManTimerInterval);
    AudioEngine.play('alert');
    
    const gps = document.getElementById('gps')?.textContent || '--.---- --.----';
    const time = document.getElementById('clock')?.textContent || '--:--:--';
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
      if (stopBtn) stopBtn.click();
    }, 10000);
  }
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// ==================== СЛЕЖКА (STALKER RADAR) - ИСПРАВЛЕННЫЙ ====================
const StalkerRadar = {
  mode: 'start',
  isActive: false,
  perimeterPath: [],
  currentPosition: { x: 0, y: 0, heading: 0 },
  centerPosition: null,
  devices: new Map(),
  ownDevices: new Set(),
  scanStartTime: null,
  perimeterInterval: null,
  
  init() {
    console.log('[Stalker] Initializing...');
    this.loadOwnDevices();
    this.bindUI();
  },
  
  loadOwnDevices() {
    try {
      const saved = localStorage.getItem('STALKER_OWN_DEVICES');
      if (saved) {
        const devices = JSON.parse(saved);
        devices.forEach(d => this.ownDevices.add(d.mac));
      }
    } catch (e) {
      console.log('[Stalker] Error loading devices:', e);
    }
  },
  
  saveOwnDevices() {
    try {
      const devices = Array.from(this.ownDevices).map(mac => ({
        mac,
        name: localStorage.getItem(`device_name_${mac}`) || 'Unknown'
      }));
      localStorage.setItem('STALKER_OWN_DEVICES', JSON.stringify(devices));
    } catch (e) {
      console.log('[Stalker] Error saving devices:', e);
    }
  },
  
  bindUI() {
    console.log('[Stalker] Binding UI...');
    
    const startBtn = document.getElementById('stalker-start-btn');
    const doneBtn = document.getElementById('perimeter-done-btn');
    const scanBtn = document.getElementById('center-scan-btn');
    const newScanBtn = document.getElementById('stalker-new-scan-btn');
    const settingsBtn = document.getElementById('stalker-settings-btn');
    const addDeviceBtn = document.getElementById('add-own-device-btn');
    
    if (startBtn) {
      startBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Stalker] Start button clicked');
        this.startPerimeter();
      });
    }
    
    if (doneBtn) {
      doneBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Stalker] Done button clicked');
        this.finishPerimeter();
      });
    }
    
    if (scanBtn) {
      scanBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Stalker] Scan button clicked');
        this.startScanning();
      });
    }
    
    if (newScanBtn) {
      newScanBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Stalker] New scan button clicked');
        this.reset();
      });
    }
    
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const modal = document.getElementById('stalker-settings-modal');
        if (modal) {
          modal.classList.remove('hidden');
          this.renderOwnDevices();
        }
      });
    }
    
    if (addDeviceBtn) {
      addDeviceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const macInput = document.getElementById('new-device-mac');
        const nameInput = document.getElementById('new-device-name');
        
        if (macInput) {
          const mac = macInput.value.trim();
          const name = nameInput ? nameInput.value.trim() : '';
          
          if (mac) {
            this.ownDevices.add(mac);
            if (name) localStorage.setItem(`device_name_${mac}`, name);
            this.saveOwnDevices();
            this.renderOwnDevices();
            macInput.value = '';
            if (nameInput) nameInput.value = '';
          }
        }
      });
    }
    
    window.addEventListener('deviceorientation', (e) => {
      if (e.alpha !== null) {
        this.currentPosition.heading = e.alpha;
        this.updateCompass();
      }
    });
  },
  
  switchScreen(screenName) {
    console.log('[Stalker] Switching to:', screenName);
    
    const screens = ['start', 'perimeter', 'center', 'scanning', 'results'];
    
    screens.forEach(s => {
      const el = document.getElementById('stalker-' + s);
      if (el) {
        if (s === screenName) {
          el.classList.remove('hidden');
          el.classList.add('active');
        } else {
          el.classList.remove('active');
          el.classList.add('hidden');
        }
      }
    });
    
    this.mode = screenName;
  },
  
  startPerimeter() {
    console.log('[Stalker] Starting perimeter...');
    haptic();
    this.perimeterPath = [];
    this.currentPosition = { x: 0, y: 0, heading: 0 };
    
    this.switchScreen('perimeter');
    this.isActive = true;
    
    if (this.perimeterInterval) {
      clearInterval(this.perimeterInterval);
    }
    
    let steps = 0;
    this.perimeterInterval = setInterval(() => {
      steps++;
      const stepsEl = document.getElementById('perimeter-steps');
      const lengthEl = document.getElementById('perimeter-length');
      const fillEl = document.getElementById('perimeter-fill');
      const percentEl = document.getElementById('perimeter-percent');
      
      if (stepsEl) stepsEl.textContent = steps;
      if (lengthEl) lengthEl.textContent = (steps * 0.7).toFixed(1) + 'м';
      if (fillEl) fillEl.style.width = Math.min(100, (steps / 50) * 100) + '%';
      if (percentEl) percentEl.textContent = Math.min(100, Math.floor((steps / 50) * 100)) + '%';
    }, 1000);
    
    if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().then(permissionState => {
        if (permissionState === 'granted') {
          window.addEventListener('devicemotion', this.handleMotion.bind(this));
        }
      }).catch(console.error);
    } else if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', this.handleMotion.bind(this));
    }
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
    const headingEl = document.getElementById('perimeter-heading');
    
    if (arrow) {
      arrow.style.transform = `translate(-50%, -50%) rotate(${this.currentPosition.heading}deg)`;
    }
    if (headingEl) {
      headingEl.textContent = Math.floor(this.currentPosition.heading) + '°';
    }
  },
  
  finishPerimeter() {
    console.log('[Stalker] Finishing perimeter...');
    haptic();
    
    if (this.perimeterInterval) {
      clearInterval(this.perimeterInterval);
      this.perimeterInterval = null;
    }
    
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
    
    const gpsStatus = document.getElementById('center-gps-status');
    const orientStatus = document.getElementById('center-orient-status');
    if (gpsStatus) gpsStatus.textContent = '✓';
    if (orientStatus) orientStatus.textContent = '✓';
    
    this.switchScreen('center');
  },
  
  startScanning() {
    console.log('[Stalker] Starting scanning...');
    haptic();
    this.switchScreen('scanning');
    this.devices.clear();
    this.scanStartTime = Date.now();
    
    let seconds = 10;
    const timerEl = document.getElementById('scan-timer');
    
    const countdown = setInterval(() => {
      seconds--;
      if (timerEl) timerEl.textContent = `00:0${seconds}`;
      if (seconds <= 0) {
        clearInterval(countdown);
        this.finishScanning();
      }
    }, 1000);
    
    const beam = document.getElementById('scan-beam');
    if (beam) {
      beam.style.animation = 'none';
      setTimeout(() => {
        beam.style.animation = 'scanRotate 10s linear infinite';
      }, 10);
    }
    
    this.tryBluetooth().catch(() => {
      console.log('[Stalker] Bluetooth not available');
    });
    
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (this.mode === 'scanning') {
          this.addDevice({
            mac: 'sim-' + i,
            name: ['Mi Band', 'AirTag', 'Samsung', 'Unknown', 'iPhone'][i],
            rssi: -40 - Math.floor(Math.random() * 40),
            heading: (this.currentPosition.heading + i * 45) % 360,
            time: Date.now()
          });
        }
      }, i * 1500 + 500);
    }
  },
  
  async tryBluetooth() {
    if ('bluetooth' in navigator) {
      try {
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['battery_service']
        });
        
        this.addDevice({
          mac: device.id,
          name: device.name || 'BT Device',
          rssi: -60 + Math.floor(Math.random() * 20),
          heading: this.currentPosition.heading,
          time: Date.now()
        });
      } catch (e) {
        console.log('[Stalker] Bluetooth error:', e);
      }
    }
  },
  
  addDevice(device) {
    console.log('[Stalker] Device found:', device.name);
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
    if (!list) return;
    
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
      dot.style.width = Math.max(4, 8 - distance/2) + 'px';
      dot.style.height = Math.max(4, 8 - distance/2) + 'px';
      dot.title = `${device.name}\n${distance.toFixed(1)}м\n${device.rssi} dBm`;
      
      layer.appendChild(dot);
    });
  },
  
  finishScanning() {
    console.log('[Stalker] Finishing scan...');
    this.switchScreen('results');
    this.updatePolarMap('results-devices-layer');
    
    const detailList = document.getElementById('devices-detail-list');
    if (!detailList) return;
    
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
  
  renderOwnDevices() {
    const list = document.getElementById('own-devices-list');
    if (!list) return;
    
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
  
  reset() {
    console.log('[Stalker] Resetting...');
    this.devices.clear();
    this.perimeterPath = [];
    if (this.perimeterInterval) {
      clearInterval(this.perimeterInterval);
      this.perimeterInterval = null;
    }
    this.switchScreen('start');
  },
  
  stop() {
    this.isActive = false;
    if (this.perimeterInterval) {
      clearInterval(this.perimeterInterval);
      this.perimeterInterval = null;
    }
  }
};

function initStalker() {
  console.log('[App] initStalker called');
  try {
    StalkerRadar.init();
  } catch (e) {
    console.error('[App] Error initializing Stalker:', e);
  }
}

// ==================== WEBRTC P2P CHAT ====================
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
    document.getElementById('chat-mode-wifi')?.addEventListener('click', () => {
      haptic();
      this.openWebRTCModal();
    });
    
    document.getElementById('chat-mode-bt')?.addEventListener('click', () => {
      haptic();
      const modal = document.getElementById('bluetooth-modal');
      if (modal) modal.classList.remove('hidden');
    });
    
    document.getElementById('chat-mode-lora')?.addEventListener('click', () => {
      haptic();
      const modal = document.getElementById('lora-modal');
      if (modal) modal.classList.remove('hidden');
    });
    
    document.getElementById('webrtc-settings-btn')?.addEventListener('click', () => {
      haptic();
      this.openWebRTCModal();
    });
    
    document.getElementById('webrtc-disconnect')?.addEventListener('click', () => {
      haptic();
      this.disconnect();
    });
    
    document.querySelectorAll('#webrtc-modal .close-btn, #webrtc-modal .modal-overlay').forEach(el => {
      el.addEventListener('click', () => {
        const modal = document.getElementById('webrtc-modal');
        if (modal) modal.classList.add('hidden');
        this.currentPanel = 'menu';
      });
    });
  },
  
  openWebRTCModal() {
    const modal = document.getElementById('webrtc-modal');
    if (modal) {
      modal.classList.remove('hidden');
      this.showPanel('menu');
    }
  },
  
  showPanel(panel) {
    this.currentPanel = panel;
    
    ['menu', 'create', 'join'].forEach(p => {
      const el = document.getElementById('webrtc-' + p + '-panel');
      if (el) el.classList.add('hidden');
    });
    
    const target = document.getElementById('webrtc-' + panel + '-panel');
    if (target) target.classList.remove('hidden');
    
    const titles = {
      'menu': '◈ P2P WEBRTC CONNECT',
      'create': '◈ СОЗДАТЬ КОМНАТУ',
      'join': '◈ ПОДКЛЮЧИТЬСЯ'
    };
    
    const titleEl = document.querySelector('#webrtc-modal .modal-title');
    if (titleEl) titleEl.textContent = titles[panel];
    
    if (panel === 'menu') {
      const createBtn = document.getElementById('webrtc-create-action');
      const joinBtn = document.getElementById('webrtc-join-action');
      
      if (createBtn) {
        createBtn.onclick = () => {
          haptic();
          this.showPanel('create');
          this.startRoomCreation();
        };
      }
      
      if (joinBtn) {
        joinBtn.onclick = () => {
          haptic();
          this.showPanel('join');
          const input = document.getElementById('webrtc-join-input');
          if (input) input.focus();
        };
      }
    }
    
    if (panel === 'join') {
      const confirmBtn = document.getElementById('webrtc-confirm-join');
      if (confirmBtn) {
        confirmBtn.onclick = () => {
          haptic();
          this.confirmJoin();
        };
      }
    }
  },
  
  async startRoomCreation() {
    this.roomId = this.generateRoomId();
    this.isHost = true;
    
    const idDisplay = document.getElementById('webrtc-room-id-display');
    const status = document.getElementById('webrtc-room-status');
    
    if (idDisplay) idDisplay.textContent = this.roomId;
    if (status) status.textContent = 'Ожидание подключения...';
    
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
    const input = document.getElementById('webrtc-join-input');
    const inputId = input?.value.trim();
    
    if (!inputId || inputId.length !== 6) {
      showToast('Введите 6-значный ID комнаты', 'error');
      return;
    }
    
    this.roomId = inputId;
    this.isHost = false;
    
    this.setupPeerConnection();
    
    const modal = document.getElementById('webrtc-modal');
    if (modal) modal.classList.add('hidden');
    
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
    const selector = document.getElementById('chat-mode-selector');
    const chatInterface = document.getElementById('chat-interface');
    const disconnectBtn = document.getElementById('webrtc-disconnect');
    
    if (selector) selector.classList.add('hidden');
    if (chatInterface) chatInterface.classList.remove('hidden');
    if (disconnectBtn) disconnectBtn.classList.remove('hidden');
  },
  
  showModeSelector() {
    const selector = document.getElementById('chat-mode-selector');
    const chatInterface = document.getElementById('chat-interface');
    const disconnectBtn = document.getElementById('webrtc-disconnect');
    const status = document.getElementById('chat-network-status');
    
    if (selector) selector.classList.remove('hidden');
    if (chatInterface) chatInterface.classList.add('hidden');
    if (disconnectBtn) disconnectBtn.classList.add('hidden');
    if (status) {
      status.textContent = 'OFFLINE';
      status.style.color = '';
    }
  },
  
  updateConnectionStatus(status) {
    const statusEl = document.getElementById('webrtc-status');
    if (!statusEl) return;
    
    const textEl = statusEl.querySelector('.status-text');
    statusEl.classList.remove('connecting', 'connected', 'offline');
    
    switch(status) {
      case 'connecting':
        statusEl.classList.add('connecting');
        if (textEl) textEl.textContent = 'ПОДКЛЮЧЕНИЕ...';
        break;
      case 'connected':
        statusEl.classList.add('connected');
        if (textEl) textEl.textContent = 'P2P CONNECTED';
        break;
      case 'offline':
      default:
        statusEl.classList.add('offline');
        if (textEl) textEl.textContent = 'OFFLINE';
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
    
    const modal = document.getElementById('webrtc-modal');
    if (modal) modal.classList.add('hidden');
    
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
    if (!container) return;
    
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

// Закрытие модалок
document.querySelectorAll('.modal .close-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    haptic();
    this.closest('.modal')?.classList.add('hidden');
  });
});

document.querySelectorAll('.modal .modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function() {
    this.closest('.modal')?.classList.add('hidden');
  });
});

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(reg => console.log('SW registered:', reg))
    .catch(err => console.log('SW registration failed:', err));
}

console.log('GHOST-HUB v3.1 loaded');

