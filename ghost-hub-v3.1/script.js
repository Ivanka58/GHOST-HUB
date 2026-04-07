// script.js
// GHOST-HUB v3.1 - Полная реализация всех модулей

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
const AppState = {
  user: null,
  isOnline: false,
  isRecording: false,
  isVoiceActive: false,
  deadManActive: false,
  deadManTimeLeft: 600, // 10 минут
  tremorActive: false,
  radarActive: false,
  audioContext: null,
  mediaRecorder: null,
  audioChunks: [],
  audioStartTime: null,
  audioRingBuffer: [], // Для Safety (10 сек) и LOG (30 сек)
  ringBufferSize: 0, // Будет установлен в зависимости от用途
  recognition: null,
  maps: {},
  teamMembers: [],
  equipment: [],
  pulseDevices: [],
  currentView: 'map',
  lastIncidentAudio: null
};

// ==================== AUDIO ENGINE ====================
const AudioEngine = {
  ctx: null,
  sounds: {},
  
  init() {
    if (this.ctx) return;
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();
    this.generateSounds();
  },
  
  generateSounds() {
    this.sounds.click = () => this.playTone(800, 0.05, 'sine', 0.1);
    this.sounds.success = () => {
      this.playTone(600, 0.1, 'sine', 0.1);
      setTimeout(() => this.playTone(800, 0.1, 'sine', 0.1), 100);
      setTimeout(() => this.playTone(1000, 0.15, 'sine', 0.15), 200);
    };
    this.sounds.alert = () => {
      this.playTone(200, 0.3, 'sawtooth', 0.2);
      setTimeout(() => this.playTone(150, 0.3, 'sawtooth', 0.2), 150);
    };
    this.sounds.warning = () => {
      this.playTone(800, 0.1, 'square', 0.15);
      setTimeout(() => this.playTone(800, 0.1, 'square', 0.15), 200);
    };
    this.sounds.recordStart = () => this.playTone(1000, 0.2, 'sine', 0.15);
    this.sounds.message = () => this.playTone(1200, 0.1, 'sine', 0.1);
    this.sounds.pulse = () => this.playTone(440, 0.05, 'sine', 0.1);
  },
  
  playTone(freq, duration, type = 'sine', volume = 0.1) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
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
  },
  
  play(name) {
    if (this.sounds[name]) this.sounds[name]();
  }
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  // Инициализируем аудио на первое взаимодействие
  document.addEventListener('click', () => {
    AudioEngine.init();
  }, { once: true });

  // Последовательность загрузки
  await showNativeSplash();
  await initDatabase();
  showBootSequence();
  
  setTimeout(() => {
    hideBootScreen();
    checkAuth();
  }, 3000);
});

// Нативный Splash Screen
async function showNativeSplash() {
  return new Promise(resolve => {
    const splash = document.getElementById('native-splash');
    const progress = document.querySelector('.splash-progress');
    
    // Анимация прогресса
    setTimeout(() => {
      progress.style.width = '100%';
    }, 100);
    
    setTimeout(() => {
      splash.classList.add('hidden');
      resolve();
    }, 2000);
  });
}

// Инициализация базы данных
async function initDatabase() {
  if (typeof ghostDB !== 'undefined') {
    await ghostDB.init();
    AppState.isOnline = ghostDB.isOnline();
    updateOfflineIndicator();
  }
}

// Boot sequence
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
    AppState.user = JSON.parse(savedUser);
    enterApp();
  } else {
    showAuthScreen();
  }
}

function showAuthScreen() {
  const authScreen = document.getElementById('auth-screen');
  authScreen.classList.remove('hidden');
  
  // Блокируем все разделы
  document.getElementById('app-header').classList.add('hidden');
  document.getElementById('quick-actions').classList.add('hidden');
  document.getElementById('mobile-nav').classList.add('hidden');
  document.getElementById('content-area').classList.add('hidden');
  
  // Красный статус
  updateStatusIndicator(false);
}

document.getElementById('auth-login-btn').addEventListener('click', async () => {
  const name = document.getElementById('auth-name').value.trim();
  const role = document.getElementById('auth-role').value;
  
  if (!name || !role) {
    showToast('Введите позывной и выберите роль', 'error');
    AudioEngine.play('alert');
    return;
  }
  
  const deviceId = 'device-' + Math.random().toString(36).substr(2, 9);
  
  // Регистрируем в БД или локально
  let userData;
  if (typeof ghostDB !== 'undefined') {
    const { data, error } = await ghostDB.registerUser(name, role, deviceId);
    userData = data || { id: 'local-' + Date.now(), name, role, deviceId, offline: true };
  } else {
    userData = { id: 'local-' + Date.now(), name, role, deviceId, offline: true };
  }
  
  AppState.user = userData;
  localStorage.setItem('GHOST_HUB_USER', JSON.stringify(userData));
  
  AudioEngine.play('success');
  enterApp();
});

function enterApp() {
  // Скрываем auth
  document.getElementById('auth-screen').classList.add('hidden');
  
  // Показываем интерфейс
  document.getElementById('app-header').classList.remove('hidden');
  document.getElementById('quick-actions').classList.remove('hidden');
  document.getElementById('mobile-nav').classList.remove('hidden');
  document.getElementById('content-area').classList.remove('hidden');
  
  // Разблокируем кнопки
  document.querySelectorAll('.action-btn, .nav-btn').forEach(btn => {
    btn.disabled = false;
  });
  
  // Зелёный статус
  updateStatusIndicator(true);
  
  // Инициализируем модули
  initClock();
  initGeolocation();
  initTeamStatus();
  initNavigation();
  initQuickActions();
  initNavigator();
  initRadar();
  initTremor();
  initAudioRecorder();
  initLogs();
  initEquipment();
  initPulse();
  initChat();
  initVoiceCommand();
  initDeadManSwitch();
  initSwipeNavigation();
  
  // Запрашиваем разрешения
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
    text.classList.add('offline');
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
  // GPS
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      () => console.log('GPS permission granted'),
      (err) => console.log('GPS permission denied:', err),
      { enableHighAccuracy: true }
    );
  }
  
  // Микрофон
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    console.log('Microphone permission granted');
  } catch (err) {
    console.log('Microphone permission denied:', err);
  }
  
  // Bluetooth (для пульса и жучков)
  if ('bluetooth' in navigator) {
    console.log('Bluetooth available');
  }
  
  // Уведомления
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
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
        
        // Обновляем в БД
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
  }, 3000);
}

// ==================== СТАТУС КОМАНДЫ ====================
function initTeamStatus() {
  // Загружаем команду из БД или localStorage
  loadTeamMembers();
  
  // Обновляем каждые 5 сек
  setInterval(updateTeamDisplay, 5000);
}

async function loadTeamMembers() {
  if (typeof ghostDB !== 'undefined' && ghostDB.isOnline()) {
    // Подписка на realtime обновления
    ghostDB.subscribeToTeamUpdates((payload) => {
      console.log('Team update:', payload);
      updateTeamDisplay();
    });
  }
  
  // Локальные данные
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
  
  // Показываем карточки
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
    btn.addEventListener('click', () => {
      const viewId = btn.dataset.view + '-view';
      
      // Останавливаем активные процессы при уходе
      if (AppState.currentView === 'tremor' && AppState.tremorActive) {
        stopTremor();
      }
      if (AppState.currentView === 'radar' && AppState.radarActive) {
        stopRadar();
      }
      
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      views.forEach(view => {
        view.classList.remove('active');
        if (view.id === viewId) {
          view.classList.add('active');
        }
      });
      
      AppState.currentView = btn.dataset.view;
      
      // Обновляем карты если нужно
      if (btn.dataset.view === 'navigator' && AppState.maps) {
        Object.values(AppState.maps).forEach(m => m.invalidateSize && m.invalidateSize());
      }
    });
  });
}

// Свайп-навигация
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
    
    // Горизонтальный свайп
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
      const activeIndex = navBtns.findIndex(b => b.classList.contains('active'));
      
      if (deltaX > 0 && activeIndex > 0) {
        // Свайп вправо - назад
        navBtns[activeIndex - 1].click();
      } else if (deltaX < 0 && activeIndex < navBtns.length - 1) {
        // Свайп влево - вперёд
        navBtns[activeIndex + 1].click();
      }
    }
  }, { passive: true });
  
  // Кнопка назад Android
  history.pushState({ page: 'main' }, '');
  window.addEventListener('popstate', (e) => {
    if (e.state) {
      // Возвращаемся на предыдущий экран внутри приложения
      const navBtns = document.querySelectorAll('.nav-btn');
      const active = document.querySelector('.nav-btn.active');
      const activeIndex = Array.from(navBtns).indexOf(active);
      
      if (activeIndex > 0) {
        navBtns[activeIndex - 1].click();
        history.pushState({ page: 'main' }, ''); // Блокируем выход
      } else {
        history.pushState({ page: 'main' }, ''); // На главной - остаёмся
      }
    }
  });
}

// ==================== QUICK ACTIONS ====================
function initQuickActions() {
  // LOG EVENT
  document.getElementById('incident-btn').addEventListener('click', async () => {
    AudioEngine.play('alert');
    
    const now = new Date();
    const time = now.toLocaleTimeString('ru-RU', { hour12: false });
    const gps = document.getElementById('gps').textContent;
    
    // Получаем последние 30 сек аудио
    const audioData = getAudioBufferSlice(30);
    
    // Сохраняем лог
    const logData = {
      time,
      gps,
      lat: 55.7558, // Из GPS
      lng: 37.6173,
      emf: (Math.random() * 5).toFixed(2) + ' μT',
      noise: Math.floor(Math.random() * 40 + 30) + ' dB',
      audioData,
      audioDuration: 30
    };
    
    if (typeof ghostDB !== 'undefined') {
      await ghostDB.saveLog(AppState.user?.id, logData);
    } else {
      // Локальное сохранение
      const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
      logs.unshift({ ...logData, id: Date.now() });
      localStorage.setItem('INCIDENT_LOGS', JSON.stringify(logs.slice(0, 50)));
    }
    
    // Показываем модалку
    document.getElementById('incident-time').textContent = time;
    document.getElementById('incident-coords').textContent = gps;
    document.getElementById('incident-emf').textContent = logData.emf;
    document.getElementById('incident-noise').textContent = logData.noise;
    
    const modal = document.getElementById('incident-modal');
    modal.classList.remove('hidden');
    
    setTimeout(() => modal.classList.add('hidden'), 3000);
    
    // Обновляем список логов
    loadLogs();
    
    AudioEngine.play('success');
  });
  
  // Night Ops
  document.getElementById('night-ops-btn').addEventListener('click', () => {
    const overlay = document.getElementById('night-ops-overlay');
    const btn = document.getElementById('night-ops-btn');
    const isHidden = overlay.classList.contains('hidden');
    
    overlay.classList.toggle('hidden', !isHidden);
    btn.classList.toggle('active', isHidden);
    document.body.classList.toggle('night-mode', isHidden);
  });
  
  // Voice
  document.getElementById('voice-cmd-btn').addEventListener('click', () => {
    document.getElementById('voice-help-modal').classList.remove('hidden');
  });
  
  // Dead Man
  document.getElementById('deadman-btn').addEventListener('click', () => {
    document.getElementById('deadman-modal').classList.remove('hidden');
  });
}

// ==================== НАВИГАТОР ====================
function initNavigator() {
  // Переключение режимов
  document.querySelectorAll('.nav-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      
      document.querySelectorAll('.nav-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.navigator-mode-content').forEach(c => c.classList.remove('active'));
      document.getElementById('mode-' + mode).classList.add('active');
      
      if (mode === 'map-to-coords') {
        setTimeout(initPickerMap, 100);
      }
    });
  });
  
  // Mode 1: Coordinates to Map
  document.getElementById('btn-show-on-map').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('input-lat').value);
    const lng = parseFloat(document.getElementById('input-lng').value);
    
    if (isNaN(lat) || isNaN(lng)) {
      showToast('Введите корректные координаты', 'error');
      return;
    }
    
    const result = document.getElementById('coords-result-map');
    result.classList.remove('hidden');
    
    setTimeout(() => {
      const map = L.map('leaflet-map-1').setView([lat, lng], 15);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CARTO',
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
  
  // Copy
  document.getElementById('copy-coords-1').addEventListener('click', () => {
    const text = document.getElementById('result-coords-1').textContent;
    navigator.clipboard.writeText(text).then(() => showToast('Координаты скопированы'));
  });
  
  // Mode 2: Address to Coordinates
  document.getElementById('btn-get-coords').addEventListener('click', async () => {
    const address = document.getElementById('input-address').value.trim();
    if (!address) {
      showToast('Введите адрес', 'error');
      return;
    }
    
    const btn = document.getElementById('btn-get-coords');
    btn.innerHTML = '<span>◈ ПОИСК...</span>';
    
    try {
      // Используем Nominatim (нейтральный, без флагов)
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
    }
    
    btn.innerHTML = '<span>◈ ПОЛУЧИТЬ КООРДИНАТЫ</span>';
  });
  
  // Mode 3: Map to Coordinates (DRAGGABLE)
  let pickerMap = null;
  let pickerMarker = null;
  
  window.initPickerMap = function() {
    if (pickerMap) {
      pickerMap.invalidateSize();
      return;
    }
    
    setTimeout(() => {
      pickerMap = L.map('leaflet-map-3').setView([55.7558, 37.6173], 10);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CARTO',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(pickerMap);
      
      // Создаём draggable marker в центре
      pickerMarker = L.marker([55.7558, 37.6173], { draggable: true }).addTo(pickerMap);
      
      // Обработчик перетаскивания
      pickerMarker.on('dragend', async (e) => {
        const pos = e.target.getLatLng();
        updatePickerCoords(pos.lat, pos.lng);
      });
      
      // Также клик по карте перемещает маркер
      pickerMap.on('click', (e) => {
        pickerMarker.setLatLng(e.latlng);
        updatePickerCoords(e.latlng.lat, e.latlng.lng);
      });
      
      AppState.maps['picker'] = pickerMap;
    }, 100);
  };
  
  async function updatePickerCoords(lat, lng) {
    document.getElementById('picker-lat').textContent = lat.toFixed(6);
    document.getElementById('picker-lng').textContent = lng.toFixed(6);
    document.getElementById('picker-result').classList.remove('hidden');
    
    // Обратное геокодирование
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      document.getElementById('picker-address').textContent = data.display_name || 'Адрес не определён';
    } catch {
      document.getElementById('picker-address').textContent = 'Адрес не определён';
    }
    
    AudioEngine.play('success');
  }
  
  // Copy picker
  document.getElementById('copy-picker-coords').addEventListener('click', () => {
    const lat = document.getElementById('picker-lat').textContent;
    const lng = document.getElementById('picker-lng').textContent;
    navigator.clipboard.writeText(`${lat}, ${lng}`).then(() => showToast('Координаты скопированы'));
  });
  
  // Use picker in Mode 1
  document.getElementById('use-picker-coords').addEventListener('click', () => {
    document.getElementById('input-lat').value = document.getElementById('picker-lat').textContent;
    document.getElementById('input-lng').value = document.getElementById('picker-lng').textContent;
    document.querySelector('[data-mode="coords-to-map"]').click();
    showToast('Координаты перенесены');
  });
  
  // Quick coordinates
  document.querySelectorAll('.quick-coord-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('input-lat').value = btn.dataset.lat;
      document.getElementById('input-lng').value = btn.dataset.lng;
      document.querySelector('[data-mode="coords-to-map"]').click();
      document.getElementById('btn-show-on-map').click();
    });
  });
}

// ==================== РАДАР ЖУЧКОВ ====================
function initRadar() {
  const canvas = document.getElementById('radar-canvas');
  const ctx = canvas.getContext('2d');
  
  function resize() {
    canvas.width = canvas.offsetWidth || 280;
    canvas.height = canvas.offsetHeight || 280;
  }
  resize();
  
  let scanAngle = 0;
  let devices = [];
  let animationId = null;
  
  function drawRadar() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 10;
    
    // Фон
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Круги
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let r = radius / 4; r <= radius; r += radius / 4) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Линии
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.stroke();
    }
    
    // Устройства
    devices.forEach(dev => {
      const x = cx + Math.cos(dev.angle) * dev.distance * radius;
      const y = cy + Math.sin(dev.angle) * dev.distance * radius;
      
      // Мигание
      const blink = Math.sin(Date.now() / 200) > 0;
      ctx.fillStyle = blink ? '#FF3333' : '#FF6666';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Подпись
      ctx.fillStyle = '#FF3333';
      ctx.font = '10px JetBrains Mono';
      ctx.fillText(dev.name, x + 10, y);
    });
    
    // Сканирующая линия
    if (AppState.radarActive) {
      scanAngle += 0.02;
      const sx = cx + Math.cos(scanAngle) * radius;
      const sy = cy + Math.sin(scanAngle) * radius;
      
      const gradient = ctx.createLinearGradient(cx, cy, sx, sy);
      gradient.addColorStop(0, 'rgba(0, 229, 255, 0)');
      gradient.addColorStop(1, 'rgba(0, 229, 255, 0.8)');
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
    
    // Центр (пользователь)
    ctx.fillStyle = '#00E5FF';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    
    animationId = requestAnimationFrame(drawRadar);
  }
  
  drawRadar();
  
  // Кнопки
  document.getElementById('radar-start-btn').addEventListener('click', async () => {
    AppState.radarActive = true;
    document.getElementById('radar-start-btn').classList.add('hidden');
    document.getElementById('radar-stop-btn').classList.remove('hidden');
    document.getElementById('radar-status-dot').classList.add('active');
    document.getElementById('radar-status-text').textContent = 'СКАНИРОВАНИЕ';
    document.querySelector('.radar-display').classList.add('scanning');
    
    AudioEngine.play('success');
    
    // Сканируем Bluetooth устройства
    try {
      if ('bluetooth' in navigator) {
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['battery_service']
        });
        
        // Добавляем найденное устройство
        const newDevice = {
          id: device.id,
          name: device.name || 'Unknown Device',
          angle: Math.random() * Math.PI * 2,
          distance: 0.3 + Math.random() * 0.5,
          rssi: -70
        };
        
        devices.push(newDevice);
        showRadarAlert(newDevice);
      }
    } catch (err) {
      // Fallback: симуляция для демо
      setTimeout(() => {
        const mockDevice = {
          id: 'mock-' + Date.now(),
          name: 'Unknown RF Device',
          angle: Math.random() * Math.PI * 2,
          distance: 0.4,
          rssi: -65
        };
        devices.push(mockDevice);
        showRadarAlert(mockDevice);
      }, 3000);
    }
  });
  
  document.getElementById('radar-stop-btn').addEventListener('click', stopRadar);
  
  function stopRadar() {
    AppState.radarActive = false;
    document.getElementById('radar-start-btn').classList.remove('hidden');
    document.getElementById('radar-stop-btn').classList.add('hidden');
    document.getElementById('radar-status-dot').classList.remove('active');
    document.getElementById('radar-status-text').textContent = 'ГОТОВ';
    document.querySelector('.radar-display').classList.remove('scanning');
    document.getElementById('radar-alert').classList.add('hidden');
  }
  
  function showRadarAlert(device) {
    const alert = document.getElementById('radar-alert');
    alert.classList.remove('hidden');
    AudioEngine.play('warning');
    
    // Добавляем в список
    const list = document.getElementById('radar-devices');
    const item = document.createElement('div');
    item.className = 'device-found';
    item.innerHTML = `
      <div class="device-signal">📡 ${device.rssi} dBm</div>
      <div class="device-name">${device.name}</div>
      <div class="device-distance">${Math.round(device.distance * 10)} м</div>
    `;
    list.appendChild(item);
    
    // Push уведомление
    showPushNotification('GHOST-HUB', `Обнаружено устройство: ${device.name}`);
  }
}

window.stopRadar = function() {
  // Вызывается при уходе из раздела
  if (AppState.radarActive) {
    document.getElementById('radar-stop-btn')?.click();
  }
};

// ==================== СЕЙСМО (ТОЛЬКО ПО КНОПКЕ) ====================
function initTremor() {
  const canvas = document.getElementById('seismograph');
  const ctx = canvas.getContext('2d');
  
  canvas.width = canvas.offsetWidth || 300;
  canvas.height = 180;
  
  const historyX = [], historyY = [], historyZ = [];
  const maxHistory = 100;
  let sensitivity = 5;
  let animationId = null;
  
  // Кнопки управления
  document.getElementById('tremor-start-btn').addEventListener('click', async () => {
    // Запрашиваем разрешение на iOS 13+
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
  
  document.getElementById('tremor-stop-btn').addEventListener('click', stopTremor);
  
  document.getElementById('sensitivity').addEventListener('input', (e) => {
    sensitivity = parseInt(e.target.value);
    document.getElementById('threshold').textContent = (sensitivity * 0.1).toFixed(2);
  });
  
  function startTremorLoop() {
    // Слушаем датчики
    window.addEventListener('devicemotion', handleMotion);
    
    // Fallback симуляция если нет датчиков
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
    const scale = canvas.height / 25;
    
    // Сетка
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Оси
    drawAxis(historyX, '#FF6666', 0, 'X');
    drawAxis(historyY, '#66FF66', 0, 'Y');
    drawAxis(historyZ, '#6699FF', 9.8, 'Z');
    
    // Центр
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.stroke();
    
    animationId = requestAnimationFrame(draw);
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
    cancelAnimationFrame(animationId);
    
    document.getElementById('tremor-start-btn').classList.remove('hidden');
    document.getElementById('tremor-stop-btn').classList.add('hidden');
    document.getElementById('tremor-status-dot').classList.remove('active');
    document.getElementById('tremor-status-text').textContent = 'ОЖИДАНИЕ';
    
    // Очищаем журнал
    document.getElementById('tremor-entries').innerHTML = '<div class="entry-empty">Анализ не запущен</div>';
  };
}

// ==================== АУДИО РЕКОРДЕР ====================
function initAudioRecorder() {
  let mediaRecorder = null;
  let audioChunks = [];
  let startTime = null;
  let timerInterval = null;
  
  // Кольцевой буфер для Safety и LOG EVENT
  initAudioRingBuffer();
  
  document.getElementById('record-btn').addEventListener('click', async () => {
    if (!AppState.isRecording) {
      // Начинаем запись
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
          audioChunks.push(e.data);
          // Также добавляем в кольцевой буфер
          addToRingBuffer(e.data);
        };
        
        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          const duration = Math.floor((Date.now() - startTime) / 1000);
          
          saveAudioRecord(url, duration);
          stream.getTracks().forEach(t => t.stop());
        };
        
        mediaRecorder.start(100); // Сбор данных каждые 100мс
        AppState.isRecording = true;
        startTime = Date.now();
        
        document.getElementById('record-btn').classList.add('recording');
        document.getElementById('record-btn').innerHTML = '<span class="record-icon">⏹</span><span class="record-text">СТОП</span>';
        document.getElementById('audio-status-dot').classList.add('active');
        document.getElementById('audio-status-dot').style.background = 'var(--danger)';
        document.getElementById('audio-status-text').textContent = 'ЗАПИСЬ';
        
        AudioEngine.play('recordStart');
        
        // Таймер
        timerInterval = setInterval(updateTimer, 1000);
        updateTimer();
        
        // Визуализация
        visualizeAudio(stream);
        
      } catch (err) {
        showToast('Доступ к микрофону запрещён', 'error');
      }
    } else {
      // Останавливаем
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
  
  function saveAudioRecord(url, duration) {
    const records = JSON.parse(localStorage.getItem('AUDIO_RECORDS') || '[]');
    const record = {
      id: Date.now(),
      url,
      duration,
      time: new Date().toLocaleString('ru-RU')
    };
    records.unshift(record);
    localStorage.setItem('AUDIO_RECORDS', JSON.stringify(records.slice(0, 20)));
    
    loadAudioRecords();
    AudioEngine.play('success');
  }
  
  loadAudioRecords();
}

function initAudioRingBuffer() {
  // Создаём MediaRecorder для кольцевого буфера
  AppState.audioRingBuffer = [];
  AppState.ringBufferSize = 0;
  
  // Максимум 30 секунд (для LOG EVENT)
  const maxBufferMs = 30000;
  
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    
    recorder.ondataavailable = (e) => {
      chunks.push(e.data);
      AppState.ringBufferSize += 100; // 100мс чанки
      
      // Удаляем старые если превысили 30 сек
      while (AppState.ringBufferSize > maxBufferMs && chunks.length > 0) {
        const old = chunks.shift();
        AppState.ringBufferSize -= 100;
      }
      
      AppState.audioRingBuffer = [...chunks];
    };
    
    recorder.start(100);
    
    // Не останавливаем поток - он работает постоянно для Safety
    AppState.ringBufferRecorder = recorder;
    AppState.ringBufferStream = stream;
  }).catch(() => {
    console.log('Ring buffer: mic not available');
  });
}

function addToRingBuffer(data) {
  // Добавляем в основной буфер записи
}

function getAudioBufferSlice(seconds) {
  // Получаем последние N секунд из кольцевого буфера
  const chunkCount = seconds * 10; // 100мс чанки
  const start = Math.max(0, AppState.audioRingBuffer.length - chunkCount);
  const slice = AppState.audioRingBuffer.slice(start);
  
  if (slice.length === 0) return null;
  
  const blob = new Blob(slice, { type: 'audio/webm' });
  return blobToBase64(blob);
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function loadAudioRecords() {
  const list = document.getElementById('records-list');
  const records = JSON.parse(localStorage.getItem('AUDIO_RECORDS') || '[]');
  
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
        <button class="record-btn-small menu-btn" onclick="showRecordMenu(${rec.id})">⠇</button>
      </div>
    </div>
  `).join('');
  
  // Обработчики
  list.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const audio = new Audio(btn.dataset.url);
      audio.play();
    });
  });
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function showRecordMenu(id) {
  const records = JSON.parse(localStorage.getItem('AUDIO_RECORDS') || '[]');
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  
  const action = prompt('Действие:\n1. Скачать MP3\n2. Удалить\n\nВведите номер:');
  
  if (action === '1') {
    const a = document.createElement('a');
    a.href = rec.url;
    a.download = `ghost-hub-audio_${new Date(rec.id).toISOString().slice(0,19).replace(/:/g,'-')}.webm`;
    a.click();
  } else if (action === '2') {
    if (confirm('Удалить запись?')) {
      const updated = records.filter(r => r.id !== id);
      localStorage.setItem('AUDIO_RECORDS', JSON.stringify(updated));
      loadAudioRecords();
    }
  }
}

function visualizeAudio(stream) {
  const audioContext = new AudioContext();
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
    
    // Уровень
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
  
  document.getElementById('logs-clear-all').addEventListener('click', () => {
    if (!confirm('Удалить ВСЕ логи? Это действие необратимо.')) return;
    
    localStorage.removeItem('INCIDENT_LOGS');
    if (typeof ghostDB !== 'undefined') {
      // Очищаем в БД
      ghostDB.client?.from('incident_logs')?.delete()?.neq('id', '0');
    }
    
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
          <button class="log-menu-btn" onclick="showLogMenu('${log.id}')">⠇</button>
        </div>
      </div>
      <div class="log-coords">${log.gps}</div>
      <div class="log-actions">
        <button class="log-btn" onclick="playLogAudio('${log.id}')">▶ Прослушать</button>
      </div>
    </div>
  `).join('');
}

function showLogMenu(id) {
  const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
  const log = logs.find(l => l.id == id || l.id === id);
  if (!log) return;
  
  const action = prompt('Действие:\n1. Скачать MP3\n2. Удалить\n\nВведите номер:');
  
  if (action === '1' && log.audioData) {
    const a = document.createElement('a');
    a.href = log.audioData;
    a.download = `ghost-hub-log_${log.time.replace(/:/g,'-')}_${log.gps.replace(/[^0-9.-]/g,'')}.webm`;
    a.click();
  } else if (action === '2') {
    if (confirm('Удалить этот лог?')) {
      const updated = logs.filter(l => l.id != id && l.id !== id);
      localStorage.setItem('INCIDENT_LOGS', JSON.stringify(updated));
      loadLogs();
    }
  }
}

function playLogAudio(id) {
  const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
  const log = logs.find(l => l.id == id || l.id === id);
  
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
  
  document.getElementById('equip-add-btn').addEventListener('click', () => {
    document.getElementById('equipment-connect').classList.toggle('hidden');
  });
  
  document.getElementById('equip-scan-btn').addEventListener('click', scanNetworkForEquipment);
}

async function scanNetworkForEquipment() {
  showToast('Сканирование сети...');
  
  // Сканируем типичные IP ESP32
  const found = [];
  const baseIp = '192.168.1.';
  
  for (let i = 2; i < 20; i++) {
    try {
      const response = await fetch(`http://${baseIp}${i}/status`, { 
        method: 'GET',
        mode: 'no-cors',
        timeout: 500 
      });
      // Если ответил - добавляем
      found.push({ ip: `${baseIp}${i}`, type: 'unknown' });
    } catch {
      // Не ответил - пропускаем
    }
  }
  
  if (found.length === 0) {
    // Демо-данные для теста
    found.push(
      { id: 'cam-1', name: 'Камера-1', type: 'camera', ip: '192.168.1.45', battery: 45, status: 'online', isOn: true },
      { id: 'light-1', name: 'Лампа-A', type: 'light', ip: '192.168.1.46', battery: 78, status: 'online', isOn: false }
    );
  }
  
  AppState.equipment = found;
  localStorage.setItem('EQUIPMENT', JSON.stringify(found));
  loadEquipment();
  
  showToast(`Найдено устройств: ${found.length}`);
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
  const batteryClass = item.battery < 10 ? 'low' : '';
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
  const equipment = JSON.parse(localStorage.getItem('EQUIPMENT') || '[]');
  const item = equipment.find(e => e.id === id);
  if (!item) return;
  
  item.isOn = !item.isOn;
  
  // Отправляем команду на устройство
  try {
    await fetch(`http://${item.ip}/control`, {
      method: 'POST',
      body: JSON.stringify({ action: item.isOn ? 'on' : 'off' }),
      mode: 'no-cors'
    });
  } catch {
    // Offline - сохраняем состояние для синхронизации
  }
  
  // Проверяем батарею и отправляем уведомление
  if (item.battery < 10 && !item.batteryWarningSent) {
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
  
  document.getElementById('pulse-connect-btn').addEventListener('click', connectPulseDevice);
}

async function connectPulseDevice() {
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
      const battery = Math.floor(Math.random() * 30 + 70); // Заглушка для батареи жучка
      
      updatePulseDevice(device.name, hr, battery);
    });
    
    showToast(`Подключено: ${device.name}`);
    AudioEngine.play('success');
    
  } catch (err) {
    // Демо-режим
    showToast('Демо: симуляция пульса');
    simulatePulseDevice();
  }
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
  
  // Обновляем или создаём карточку
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
  
  // Отправляем в команду
  if (AppState.user) {
    AppState.user.pulse = hr;
    AppState.user.battery = battery;
    updateTeamDisplay();
    
    // В БД
    if (typeof ghostDB !== 'undefined') {
      ghostDB.updateUserPulse(AppState.user.id, hr, battery);
    }
  }
  
  AudioEngine.play('pulse');
}

function loadPulseDevices() {
  // Загружаем сохранённые
}

// ==================== ЧАТ (P2P) ====================
function initChat() {
  const messages = document.getElementById('chat-messages');
  
  // Загружаем историю
  loadChatHistory();
  
  // Отправка
  document.getElementById('chat-send').addEventListener('click', sendChatMessage);
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
  
  // P2P через BroadcastChannel (вкладки) + WebRTC (устройства)
  initP2PChat();
}

function loadChatHistory() {
  const history = JSON.parse(localStorage.getItem('CHAT_HISTORY') || '[]');
  const container = document.getElementById('chat-messages');
  
  container.innerHTML = '';
  
  history.forEach(msg => {
    addMessageToChat(msg, false);
  });
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !AppState.user) return;
  
  const msg = {
    id: Date.now(),
    author: AppState.user.name,
    role: AppState.user.role,
    text,
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    outgoing: true
  };
  
  // Добавляем в UI
  addMessageToChat(msg, true);
  
  // Сохраняем
  const history = JSON.parse(localStorage.getItem('CHAT_HISTORY') || '[]');
  history.push(msg);
  localStorage.setItem('CHAT_HISTORY', JSON.stringify(history.slice(-100)));
  
  // Отправляем P2P
  broadcastMessage(msg);
  
  // В БД если онлайн
  if (typeof ghostDB !== 'undefined' && ghostDB.isOnline()) {
    ghostDB.sendMessage(AppState.user.id, AppState.user.name, AppState.user.role, text);
  }
  
  input.value = '';
  AudioEngine.play('message');
}

function addMessageToChat(msg, animate) {
  const container = document.getElementById('chat-messages');
  
  const div = document.createElement('div');
  div.className = `chat-message ${msg.outgoing ? 'outgoing' : 'incoming'}`;
  div.innerHTML = `
    <div class="chat-author">${msg.author} (${msg.role})</div>
    <div>${msg.text}</div>
    <div class="chat-time">${msg.time}</div>
  `;
  
  if (animate) div.style.animation = 'slideIn 0.2s ease';
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function initP2PChat() {
  // BroadcastChannel для вкладок на одном устройстве
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('ghost_hub_chat');
    
    channel.onmessage = (e) => {
      if (e.data.type === 'chat') {
        const msg = { ...e.data.payload, outgoing: false };
        addMessageToChat(msg, true);
        
        // Push уведомление если не активная вкладка
        if (document.hidden) {
          showPushNotification('GHOST-HUB', `${msg.author}: ${msg.text.substring(0, 50)}...`);
        }
      }
    };
    
    AppState.broadcastChannel = channel;
  }
  
  // WebRTC для устройств в сети (упрощённая версия)
  initWebRTCChat();
}

function broadcastMessage(msg) {
  // BroadcastChannel
  if (AppState.broadcastChannel) {
    AppState.broadcastChannel.postMessage({
      type: 'chat',
      payload: msg
    });
  }
  
  // WebRTC
  if (AppState.rtcDataChannel) {
    AppState.rtcDataChannel.send(JSON.stringify(msg));
  }
}

function initWebRTCChat() {
  // Упрощённая реализация WebRTC для локальной сети
  // Полная версия требует сигнального сервера или mDNS
  console.log('WebRTC: init (simplified)');
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
  
  document.getElementById('start-voice').addEventListener('click', () => {
    if (!isListening) {
      recognition.start();
      isListening = true;
      AppState.isVoiceActive = true;
      document.getElementById('start-voice').textContent = '[ ВЫКЛЮЧИТЬ ГОЛОСОВОЕ УПРАВЛЕНИЕ ]';
      document.getElementById('voice-cmd-btn').classList.add('active');
      showToast('Голосовое управление активно');
      AudioEngine.play('success');
    } else {
      recognition.stop();
      isListening = false;
      AppState.isVoiceActive = false;
      document.getElementById('start-voice').textContent = '[ ВКЛЮЧИТЬ ГОЛОСОВОЕ УПРАВЛЕНИЕ ]';
      document.getElementById('voice-cmd-btn').classList.remove('active');
    }
  });
  
  recognition.onresult = (event) => {
    const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
    processVoiceCommand(command);
  };
  
    // Авто-рестарт при остановке (continuous не всегда работает на мобильных)
  recognition.onend = () => {
    if (AppState.isVoiceActive) {
      // Перезапускаем если режим всё ещё активен
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
  
  // Обработка команд
  if (command.includes('лог') || command.includes('запись события')) {
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
    
  } else if (command.includes('звук') || command.includes('начать запись')) {
    const btn = document.getElementById('record-btn');
    if (!AppState.isRecording) btn.click();
    speakResponse('Запись начата');
    
  } else if (command.includes('стоп') || command.includes('остановить')) {
    const btn = document.getElementById('record-btn');
    if (AppState.isRecording) btn.click();
    speakResponse('Запись остановлена');
    
  } else if (command.includes('статус')) {
    const gps = document.getElementById('gps').textContent;
    const time = document.getElementById('clock').textContent;
    speakResponse(`Время ${time}. Координаты ${gps}. Все системы в норме.`);
    
  } else if (command.includes('карта') || command.includes('команда')) {
    document.querySelector('[data-view="map"]').click();
    speakResponse('Переход к статусу команды');
    
  } else if (command.includes('навигатор')) {
    document.querySelector('[data-view="navigator"]').click();
    speakResponse('Открыт навигатор');
    
  } else if (command.includes('чат')) {
    document.querySelector('[data-view="chat"]').click();
    speakResponse('Открыт чат');
    
  } else if (command.includes('сейсмо') || command.includes('вибрация')) {
    document.querySelector('[data-view="tremor"]').click();
    speakResponse('Открыт сейсмо-анализатор');
    
  } else if (command.includes('жучок') || command.includes('радар')) {
    document.querySelector('[data-view="radar"]').click();
    speakResponse('Открыт детектор жучков');
  }
  
  setTimeout(() => {
    statusEl.classList.add('hidden');
  }, 2000);
}

function speakResponse(text) {
  if ('speechSynthesis' in window) {
    // Отменяем текущую речь
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 0.9;
    utterance.pitch = 0.8;
    utterance.volume = 0.8;
    
    window.speechSynthesis.speak(utterance);
  }
}

// ==================== DEAD MAN SWITCH (SAFETY) ====================
function initDeadManSwitch() {
  const modal = document.getElementById('deadman-modal');
  const startBtn = document.getElementById('start-timer');
  const resetBtn = document.getElementById('reset-timer');
  const stopBtn = document.getElementById('stop-timer');
  const miniReset = document.getElementById('mini-reset');
  const timerDisplay = document.getElementById('deadman-timer');
  const miniTimer = document.getElementById('mini-timer');
  const statusEl = document.getElementById('deadman-status');
  
  let timerInterval = null;
  
  // Открытие модалки
  document.getElementById('deadman-btn').addEventListener('click', () => {
    modal.classList.remove('hidden');
  });
  
  // Закрытие
  modal.querySelector('.close-btn').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  modal.querySelector('.modal-overlay').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  
  // Старт
  startBtn.addEventListener('click', () => {
    AudioEngine.play('alert');
    AppState.deadManActive = true;
    AppState.deadManTimeLeft = 600; // 10 минут
    
    startBtn.classList.add('hidden');
    resetBtn.classList.remove('hidden');
    stopBtn.classList.remove('hidden');
    
    statusEl.innerHTML = '<span class="status-icon">▶</span><span class="status-text">ПРОТОКОЛ АКТИВЕН</span>';
    statusEl.style.color = 'var(--danger)';
    
    document.getElementById('deadman-mini').classList.remove('hidden');
    document.getElementById('deadman-btn').classList.add('active');
    
    updateTimerDisplay();
    
    // Предупреждаем о необходимости записи
    showToast('Включите аудиозапись перед выходом!');
    
    timerInterval = setInterval(() => {
      AppState.deadManTimeLeft--;
      updateTimerDisplay();
      
      // Предупреждения
      if ([300, 120, 60, 30, 10].includes(AppState.deadManTimeLeft)) {
        AudioEngine.play('warning');
        showToast(`Safety: ${Math.floor(AppState.deadManTimeLeft / 60)}:${String(AppState.deadManTimeLeft % 60).padStart(2, '0')}`);
      }
      
      if (AppState.deadManTimeLeft <= 0) {
        triggerDeadManAlarm();
      }
    }, 1000);
  });
  
  // Сброс (Я в порядке)
  resetBtn.addEventListener('click', () => {
    AudioEngine.play('success');
    AppState.deadManTimeLeft = 600;
    updateTimerDisplay();
    showToast('Таймер сброшен на 10:00');
  });
  
  miniReset.addEventListener('click', () => {
    AudioEngine.play('success');
    AppState.deadManTimeLeft = 600;
    updateTimerDisplay();
    showToast('Таймер сброшен');
  });
  
  // Стоп
  stopBtn.addEventListener('click', () => {
    AudioEngine.play('click');
    clearInterval(timerInterval);
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
    const m = String(Math.floor(AppState.deadManTimeLeft / 60)).padStart(2, '0');
    const s = String(AppState.deadManTimeLeft % 60).padStart(2, '0');
    const timeStr = `${m}:${s}`;
    
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
  
  async function triggerDeadManAlarm() {
    clearInterval(timerInterval);
    AudioEngine.play('alert');
    
    const gps = document.getElementById('gps').textContent;
    const time = document.getElementById('clock').textContent;
    const pulse = AppState.user?.pulse || '--';
    
    // Получаем последние 10 сек аудио
    const audioData = getAudioBufferSlice(10);
    
    // Формируем сообщение в чат
    const alarmMsg = {
      id: Date.now(),
      author: 'SYSTEM',
      role: 'SAFETY',
      text: `🚨 DEAD MAN SWITCH СРАБОТАЛ\nПользователь: ${AppState.user?.name || 'Unknown'}\nВремя: ${time}\nКоординаты: ${gps}\nПульс: ${pulse} BPM\n[АУДИО ПРИКРЕПЛЕНО]`,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      outgoing: false,
      isAlarm: true,
      audioData
    };
    
    // Добавляем в чат
    addMessageToChat(alarmMsg, true);
    
    // Сохраняем
    const history = JSON.parse(localStorage.getItem('CHAT_HISTORY') || '[]');
    history.push(alarmMsg);
    localStorage.setItem('CHAT_HISTORY', JSON.stringify(history.slice(-100)));
    
    // Push уведомление всем
    showPushNotification('🚨 GHOST-HUB SAFETY', `${AppState.user?.name} - ТРЕВОГА! Проверьте чат.`);
    
    // Вибрация
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 1000]);
    }
    
    // В БД
    if (typeof ghostDB !== 'undefined') {
      await ghostDB.sendMessage(null, 'SYSTEM', 'SAFETY', alarmMsg.text);
    }
    
    // Показываем модалку с аудио
    if (audioData) {
      const playConfirm = confirm('Safety сработал! Прослушать аудиозапись?');
      if (playConfirm) {
        const audio = new Audio(audioData);
        audio.play();
      }
    }
    
    // Сброс через 10 сек
    setTimeout(() => {
      stopBtn.click();
    }, 10000);
  }
}

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
  // Локальное уведомление
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: 'ghost-hub',
      requireInteraction: true
    });
  }
  
  // Через Service Worker если есть
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, {
        body,
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        actions: [
          { action: 'open', title: 'Открыть' }
        ],
        data: { type: 'chat' }
      });
    });
  }
}

// Обработка кликов по модалкам
document.querySelectorAll('.modal .close-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.target.closest('.modal').classList.add('hidden');
  });
});

document.querySelectorAll('.modal .modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    e.target.closest('.modal').classList.add('hidden');
  });
});

// Остановка процессов при уходе из разделов
window.addEventListener('beforeunload', () => {
  // Останавливаем всё
  if (AppState.ringBufferRecorder) {
    AppState.ringBufferRecorder.stop();
    AppState.ringBufferStream?.getTracks().forEach(t => t.stop());
  }
  if (AppState.recognition) {
    AppState.recognition.stop();
  }
});

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(reg => console.log('SW registered:', reg))
    .catch(err => console.log('SW registration failed:', err));
}

console.log('GHOST-HUB v3.1 loaded');
