// script.js
document.addEventListener('DOMContentLoaded', () => {
    // ==================== AUDIO SYSTEM ====================
    const AudioEngine = {
        ctx: null,
        sounds: {},
        
        init() {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.generateSounds();
        },
        
        // Generate procedural sounds
        generateSounds() {
            // Click sound - short beep
            this.sounds.click = () => this.playTone(800, 0.05, 'sine', 0.1);
            
            // Success sound - ascending
            this.sounds.success = () => {
                this.playTone(600, 0.1, 'sine', 0.1);
                setTimeout(() => this.playTone(800, 0.1, 'sine', 0.1), 100);
                setTimeout(() => this.playTone(1000, 0.15, 'sine', 0.15), 200);
            };
            
            // Error/Alert - low buzz
            this.sounds.alert = () => {
                this.playTone(200, 0.3, 'sawtooth', 0.2);
                setTimeout(() => this.playTone(150, 0.3, 'sawtooth', 0.2), 150);
            };
            
            // Anomaly detected - eerie sound
            this.sounds.anomaly = () => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.5);
                gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.5);
            };
            
            // Dead man warning - urgent beeping
            this.sounds.warning = () => {
                this.playTone(800, 0.1, 'square', 0.15);
                setTimeout(() => this.playTone(800, 0.1, 'square', 0.15), 200);
            };
            
            // Recording start
            this.sounds.recordStart = () => {
                this.playTone(1000, 0.2, 'sine', 0.15);
            };
            
            // Message sent
            this.sounds.message = () => this.playTone(1200, 0.1, 'sine', 0.1);
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

    // Initialize audio on first user interaction
    let audioInitialized = false;
    function initAudio() {
        if (!audioInitialized) {
            AudioEngine.init();
            audioInitialized = true;
        }
    }

    // Add click listeners to all buttons for sound
    document.addEventListener('click', (e) => {
        initAudio();
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            AudioEngine.play('click');
        }
    }, { once: true });

    // Boot sequence
    setTimeout(() => {
        const bootScreen = document.getElementById('boot-screen');
        bootScreen.style.opacity = '0';
        setTimeout(() => {
            bootScreen.classList.add('hidden');
            document.getElementById('main-interface').classList.remove('hidden');
            initSystems();
        }, 300);
    }, 2500);

    function initSystems() {
        initClock();
        initMap();
        initWaveform();
        initSpectrogram();
        initNavigation();
        initQuickActions();
        initGeolocation();
        initAudioRecorder();
        initChat();
        initVoiceCommand();
        initEvidenceVault();
        initTremorWithPermission();
        initNavigator(); // NEW
        initDeadManSwitch(); // FIXED
    }

    // Clock
    function initClock() {
        function updateClock() {
            const now = new Date();
            const mskTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
            const hours = String(mskTime.getHours()).padStart(2, '0');
            const minutes = String(mskTime.getMinutes()).padStart(2, '0');
            const seconds = String(mskTime.getSeconds()).padStart(2, '0');
            document.getElementById('clock').textContent = `${hours}:${minutes}:${seconds}`;
        }
        updateClock();
        setInterval(updateClock, 1000);
    }

    // Geolocation
    function initGeolocation() {
        const gpsEl = document.getElementById('gps');
        
        if ("geolocation" in navigator) {
            navigator.geolocation.watchPosition(
                (position) => {
                    const lat = position.coords.latitude.toFixed(4);
                    const lon = position.coords.longitude.toFixed(4);
                    gpsEl.textContent = `${lat}°N ${lon}°E`;
                },
                (error) => {
                    console.log('GPS error:', error);
                    simulateGPS();
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            simulateGPS();
        }
        
        function simulateGPS() {
            let baseLat = 55.7558;
            let baseLon = 37.6173;
            setInterval(() => {
                const drift = (Math.random() - 0.5) * 0.0002;
                baseLat += drift;
                baseLon += drift;
                gpsEl.textContent = `${baseLat.toFixed(4)}°N ${baseLon.toFixed(4)}°E`;
            }, 3000);
        }
    }

    // Tactical Map (Canvas)
    function initMap() {
        const canvas = document.getElementById('tactical-map');
        const ctx = canvas.getContext('2d');
        
        function resize() {
            const container = canvas.parentElement;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        const points = [];
        for (let i = 0; i < 15; i++) {
            points.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                size: Math.random() * 2 + 1
            });
        }

        let scanY = 0;
        
        function draw() {
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.03)';
            ctx.lineWidth = 1;
            const gridSize = 40;
            for (let x = 0; x < canvas.width; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }
            
            points.forEach((point, i) => {
                point.x += point.vx;
                point.y += point.vy;
                
                if (point.x < 0 || point.x > canvas.width) point.vx *= -1;
                if (point.y < 0 || point.y > canvas.height) point.vy *= -1;
                
                ctx.fillStyle = i % 3 === 0 ? '#FF8C00' : '#00E5FF';
                ctx.beginPath();
                ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
                ctx.fill();
                
                points.forEach((other, j) => {
                    if (i >= j) return;
                    const dx = point.x - other.x;
                    const dy = point.y - other.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < 80) {
                        ctx.strokeStyle = `rgba(0, 229, 255, ${0.15 * (1 - dist/80)})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(point.x, point.y);
                        ctx.lineTo(other.x, other.y);
                        ctx.stroke();
                    }
                });
            });
            
            scanY = (scanY + 1) % canvas.height;
            ctx.strokeStyle = 'rgba(255, 140, 0, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, scanY);
            ctx.lineTo(canvas.width, scanY);
            ctx.stroke();
            
            const gradient = ctx.createLinearGradient(0, scanY - 10, 0, scanY + 10);
            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(0.5, 'rgba(255, 140, 0, 0.1)');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, scanY - 10, canvas.width, 20);
            
            requestAnimationFrame(draw);
        }
        draw();
    }

    // Waveform
    function initWaveform() {
        const canvas = document.getElementById('audio-waveform');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        function resize() {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        function draw() {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.strokeStyle = '#00E5FF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            const time = Date.now() / 150;
            for (let x = 0; x < canvas.width; x += 2) {
                const y = canvas.height / 2 + 
                    Math.sin(x * 0.08 + time) * 15 * Math.sin(time * 0.3) +
                    Math.sin(x * 0.15 + time * 1.5) * 8 +
                    (Math.random() - 0.5) * 4;
                
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            requestAnimationFrame(draw);
        }
        draw();
    }

    // Spectrogram
    function initSpectrogram() {
        const canvas = document.getElementById('spectrogram');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.offsetWidth || 300;
        const height = 200;
        canvas.width = width;
        canvas.height = height;

        const bins = 30;
        const history = [];
        const maxHistory = 60;
        let anomalyCount = 0;
        
        function generateFreqData() {
            const data = [];
            for (let i = 0; i < bins; i++) {
                let value = Math.random() * 0.3;
                
                if (i < 10 && Math.random() > 0.95) {
                    value = 0.8 + Math.random() * 0.2;
                    // Trigger anomaly sound
                    if (audioInitialized && Math.random() > 0.7) {
                        AudioEngine.play('anomaly');
                    }
                }
                
                if (i > 15 && i < 25 && Math.random() > 0.98) {
                    value = 0.9;
                }
                
                data.push(value);
            }
            return data;
        }

        function draw() {
            if (history.length >= maxHistory) {
                history.shift();
            }
            history.push(generateFreqData());

            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);

            const binWidth = width / bins;
            const rowHeight = height / maxHistory;

            for (let t = 0; t < history.length; t++) {
                const row = history[t];
                const y = height - (t * rowHeight) - rowHeight;
                
                for (let f = 0; f < bins; f++) {
                    const value = row[f];
                    const x = f * binWidth;
                    
                    let r, g, b;
                    if (value < 0.3) {
                        r = 0;
                        g = Math.floor(255 * (value / 0.3));
                        b = 136;
                    } else if (value < 0.7) {
                        r = 255;
                        g = Math.floor(170 * ((0.7 - value) / 0.4));
                        b = 0;
                    } else {
                        r = 255;
                        g = Math.floor(51 * ((1 - value) / 0.3));
                        b = 51;
                        
                        if (f < 10 && t === history.length - 1) {
                            anomalyCount++;
                            document.getElementById('anomaly-count').textContent = anomalyCount;
                            updateCerberStatus('АНОМАЛИЯ В ИНФРАЗВУКЕ!', 'Обнаружен пик в диапазоне 20-50Гц. Возможно присутствие субъекта.');
                        }
                    }
                    
                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    ctx.fillRect(x, y, binWidth - 1, rowHeight - 1);
                }
            }

            ctx.fillStyle = '#888';
            ctx.font = '8px JetBrains Mono';
            ctx.fillText('20Hz', 2, height - 4);
            ctx.fillText('50Hz', width - 25, height - 4);
            
            requestAnimationFrame(draw);
        }

        function updateCerberStatus(status, detail) {
            const statusEl = document.getElementById('cerber-status');
            const detailEl = document.getElementById('cerber-detail');
            if (statusEl) statusEl.textContent = status;
            if (detailEl) detailEl.textContent = detail;
        }

        draw();
    }

    // Navigation
    function initNavigation() {
        const navBtns = document.querySelectorAll('.nav-btn');
        const views = document.querySelectorAll('.view-section');
        
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const viewId = btn.dataset.view + '-view';
                
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                views.forEach(view => {
                    view.classList.remove('active');
                    if (view.id === viewId) {
                        view.classList.add('active');
                    }
                });

                // Resize leaflet maps if navigator is opened
                if (viewId === 'navigator-view' && window.leafletMaps) {
                    setTimeout(() => {
                        Object.values(window.leafletMaps).forEach(map => map.invalidateSize());
                    }, 100);
                }
            });
        });
    }

    // Quick Actions
    function initQuickActions() {
        // Incident Marker
        const incidentBtn = document.getElementById('incident-btn');
        const incidentModal = document.getElementById('incident-modal');
        
        if (incidentBtn && incidentModal) {
            incidentBtn.addEventListener('click', () => {
                AudioEngine.play('alert');
                const now = new Date();
                const time = now.toLocaleTimeString('ru-RU', {hour12: false});
                const gps = document.getElementById('gps').textContent;
                
                document.getElementById('incident-time').textContent = time;
                document.getElementById('incident-coords').textContent = gps;
                document.getElementById('incident-emf').textContent = (Math.random() * 5).toFixed(2) + ' μT';
                document.getElementById('incident-noise').textContent = Math.floor(Math.random() * 40 + 30) + ' dB';
                
                incidentModal.classList.remove('hidden');
                addIncidentToLog(time, gps);
                saveEvidence({time, gps, type: 'incident'});
                
                setTimeout(() => {
                    incidentModal.classList.add('hidden');
                }, 3000);
            });
            
            incidentModal.querySelector('.close-btn').addEventListener('click', () => {
                incidentModal.classList.add('hidden');
            });
            incidentModal.querySelector('.modal-overlay').addEventListener('click', () => {
                incidentModal.classList.add('hidden');
            });
        }

        // Night Ops
        const nightOpsBtn = document.getElementById('night-ops-btn');
        const nightOverlay = document.getElementById('night-ops-overlay');
        
        if (nightOpsBtn && nightOverlay) {
            nightOpsBtn.addEventListener('click', () => {
                const isHidden = nightOverlay.classList.contains('hidden');
                nightOverlay.classList.toggle('hidden', !isHidden);
                nightOpsBtn.classList.toggle('active', isHidden);
                document.body.classList.toggle('night-mode', isHidden);
            });
        }

        // Voice Command Button
        const voiceBtn = document.getElementById('voice-cmd-btn');
        const voiceModal = document.getElementById('voice-help-modal');
        
        if (voiceBtn && voiceModal) {
            voiceBtn.addEventListener('click', () => {
                voiceModal.classList.remove('hidden');
            });
            
            voiceModal.querySelector('.close-btn').addEventListener('click', () => {
                voiceModal.classList.add('hidden');
            });
            voiceModal.querySelector('.modal-overlay').addEventListener('click', () => {
                voiceModal.classList.add('hidden');
            });
        }
    }

    // ==================== NAVIGATOR MODULE ====================
    function initNavigator() {
        window.leafletMaps = {};
        
        // Mode switching
        const modeBtns = document.querySelectorAll('.nav-mode-btn');
        const modeContents = document.querySelectorAll('.navigator-mode-content');
        
        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                
                modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                modeContents.forEach(c => c.classList.remove('active'));
                document.getElementById('mode-' + mode).classList.add('active');
                
                // Init map if needed
                if (mode === 'map-to-coords') {
                    setTimeout(() => initPickerMap(), 100);
                }
            });
        });

        // Mode 1: Coordinates to Map
        const btnShowOnMap = document.getElementById('btn-show-on-map');
        if (btnShowOnMap) {
            btnShowOnMap.addEventListener('click', () => {
                const lat = parseFloat(document.getElementById('input-lat').value);
                const lng = parseFloat(document.getElementById('input-lng').value);
                
                if (isNaN(lat) || isNaN(lng)) {
                    showToast('Введите корректные координаты', 'error');
                    AudioEngine.play('alert');
                    return;
                }
                
                const resultContainer = document.getElementById('coords-result-map');
                resultContainer.classList.remove('hidden');
                
                setTimeout(() => {
                    const map = L.map('leaflet-map-1').setView([lat, lng], 15);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap'
                    }).addTo(map);
                    
                    L.marker([lat, lng]).addTo(map)
                        .bindPopup(`Широта: ${lat}<br>Долгота: ${lng}`)
                        .openPopup();
                    
                    window.leafletMaps['map1'] = map;
                    document.getElementById('result-coords-1').textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                }, 100);
                
                AudioEngine.play('success');
            });
        }

        // Copy coordinates
        const copyBtn1 = document.getElementById('copy-coords-1');
        if (copyBtn1) {
            copyBtn1.addEventListener('click', () => {
                const text = document.getElementById('result-coords-1').textContent;
                navigator.clipboard.writeText(text).then(() => {
                    showToast('Координаты скопированы');
                    AudioEngine.play('success');
                });
            });
        }

        // Mode 2: Address to Coordinates (using Nominatim)
        const btnGetCoords = document.getElementById('btn-get-coords');
        if (btnGetCoords) {
            btnGetCoords.addEventListener('click', async () => {
                const address = document.getElementById('input-address').value.trim();
                if (!address) {
                    showToast('Введите адрес', 'error');
                    AudioEngine.play('alert');
                    return;
                }
                
                AudioEngine.play('click');
                btnGetCoords.innerHTML = '<span>◈ ПОИСК...</span>';
                
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
                    const data = await response.json();
                    
                    if (data && data.length > 0) {
                        const result = data[0];
                        const lat = parseFloat(result.lat);
                        const lng = parseFloat(result.lon);
                        
                        document.getElementById('result-lat').textContent = lat.toFixed(6);
                        document.getElementById('result-lng').textContent = lng.toFixed(6);
                        document.getElementById('result-full-address').textContent = result.display_name;
                        document.getElementById('address-result').classList.remove('hidden');
                        
                        AudioEngine.play('success');
                    } else {
                        showToast('Адрес не найден', 'error');
                        AudioEngine.play('alert');
                    }
                } catch (err) {
                    showToast('Ошибка поиска', 'error');
                    AudioEngine.play('alert');
                }
                
                btnGetCoords.innerHTML = '<span>◈ ПОЛУЧИТЬ КООРДИНАТЫ</span>';
            });
        }

        // Show address on map
        const showAddressMap = document.getElementById('show-address-on-map');
        if (showAddressMap) {
            showAddressMap.addEventListener('click', () => {
                const lat = parseFloat(document.getElementById('result-lat').textContent);
                const lng = parseFloat(document.getElementById('result-lng').textContent);
                
                const mapDiv = document.getElementById('leaflet-map-2');
                mapDiv.classList.remove('hidden');
                
                setTimeout(() => {
                    const map = L.map('leaflet-map-2').setView([lat, lng], 15);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                    L.marker([lat, lng]).addTo(map);
                    window.leafletMaps['map2'] = map;
                }, 100);
            });
        }

        // Mode 3: Map to Coordinates (Picker)
        let pickerMap = null;
        function initPickerMap() {
            if (pickerMap) {
                pickerMap.invalidateSize();
                return;
            }
            
            setTimeout(() => {
                pickerMap = L.map('leaflet-map-3').setView([55.7558, 37.6173], 10);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(pickerMap);
                
                let marker = null;
                
                pickerMap.on('click', async (e) => {
                    const { lat, lng } = e.latlng;
                    
                    if (marker) marker.remove();
                    marker = L.marker([lat, lng]).addTo(pickerMap);
                    
                    document.getElementById('picker-lat').textContent = lat.toFixed(6);
                    document.getElementById('picker-lng').textContent = lng.toFixed(6);
                    document.getElementById('picker-result').classList.remove('hidden');
                    
                    // Reverse geocoding
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                        const data = await response.json();
                        document.getElementById('picker-address').textContent = data.display_name || 'Адрес не определен';
                    } catch {
                        document.getElementById('picker-address').textContent = 'Адрес не определен';
                    }
                    
                    AudioEngine.play('success');
                });
                
                window.leafletMaps['picker'] = pickerMap;
            }, 100);
        }

        // Copy picker coordinates
        const copyPicker = document.getElementById('copy-picker-coords');
        if (copyPicker) {
            copyPicker.addEventListener('click', () => {
                const lat = document.getElementById('picker-lat').textContent;
                const lng = document.getElementById('picker-lng').textContent;
                navigator.clipboard.writeText(`${lat}, ${lng}`).then(() => {
                    showToast('Координаты скопированы');
                    AudioEngine.play('success');
                });
            });
        }

        // Use picker coordinates in Mode 1
        const usePicker = document.getElementById('use-picker-coords');
        if (usePicker) {
            usePicker.addEventListener('click', () => {
                const lat = document.getElementById('picker-lat').textContent;
                const lng = document.getElementById('picker-lng').textContent;
                
                document.getElementById('input-lat').value = lat;
                document.getElementById('input-lng').value = lng;
                
                // Switch to mode 1
                document.querySelector('[data-mode="coords-to-map"]').click();
                showToast('Координаты перенесены');
                AudioEngine.play('success');
            });
        }

        // Quick coordinates buttons
        document.querySelectorAll('.quick-coord-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lat = btn.dataset.lat;
                const lng = btn.dataset.lng;
                
                document.getElementById('input-lat').value = lat;
                document.getElementById('input-lng').value = lng;
                
                // Switch to mode 1 and trigger
                document.querySelector('[data-mode="coords-to-map"]').click();
                document.getElementById('btn-show-on-map').click();
            });
        });
    }

    // Toast notification
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // ==================== DEAD MAN SWITCH - FIXED ====================
    function initDeadManSwitch() {
        const deadmanBtn = document.getElementById('deadman-btn');
        const deadmanModal = document.getElementById('deadman-modal');
        const deadmanMini = document.getElementById('deadman-mini');
        const startBtn = document.getElementById('start-timer');
        const resetBtn = document.getElementById('reset-timer');
        const stopBtn = document.getElementById('stop-timer');
        const miniReset = document.getElementById('mini-reset');
        const timerDisplay = document.getElementById('deadman-timer');
        const miniTimer = document.getElementById('mini-timer');
        const statusEl = document.getElementById('deadman-status');
        
        let timeLeft = 1800; // 30 minutes in seconds
        let timerInterval = null;
        let isRunning = false;

        // Open modal
        if (deadmanBtn && deadmanModal) {
            deadmanBtn.addEventListener('click', () => {
                deadmanModal.classList.remove('hidden');
            });

            // Close handlers
            deadmanModal.querySelector('.close-btn').addEventListener('click', () => {
                deadmanModal.classList.add('hidden');
            });
            deadmanModal.querySelector('.modal-overlay').addEventListener('click', () => {
                deadmanModal.classList.add('hidden');
            });
        }

        // Start timer
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                AudioEngine.play('alert');
                isRunning = true;
                timeLeft = 1800;
                
                // Update UI
                startBtn.classList.add('hidden');
                resetBtn.classList.remove('hidden');
                stopBtn.classList.remove('hidden');
                
                // Update status
                statusEl.innerHTML = '<span class="status-icon">▶</span><span class="status-text">ПРОТОКОЛ АКТИВЕН</span>';
                statusEl.style.color = 'var(--danger)';
                
                // Show mini display
                deadmanMini.classList.remove('hidden');
                deadmanBtn.classList.add('active');
                
                updateTimerDisplay();
                
                // Start countdown
                timerInterval = setInterval(() => {
                    timeLeft--;
                    updateTimerDisplay();
                    
                    // Warning sounds at 5, 2, 1 minutes
                    if ([300, 120, 60].includes(timeLeft)) {
                        AudioEngine.play('warning');
                    }
                    
                    if (timeLeft <= 0) {
                        triggerAlarm();
                    }
                }, 1000);
            });
        }

        // Reset timer (I'm OK)
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                AudioEngine.play('success');
                timeLeft = 1800;
                updateTimerDisplay();
                
                // Visual feedback
                resetBtn.style.transform = 'scale(0.95)';
                setTimeout(() => resetBtn.style.transform = '', 100);
                
                showToast('Таймер сброшен на 30:00');
            });
        }

        // Mini reset (same function)
        if (miniReset) {
            miniReset.addEventListener('click', () => {
                AudioEngine.play('success');
                timeLeft = 1800;
                updateTimerDisplay();
                showToast('Таймер сброшен');
            });
        }

        // Stop timer
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                AudioEngine.play('click');
                clearInterval(timerInterval);
                isRunning = false;
                
                // Reset UI
                startBtn.classList.remove('hidden');
                resetBtn.classList.add('hidden');
                stopBtn.classList.add('hidden');
                
                statusEl.innerHTML = '<span class="status-icon">⏸</span><span class="status-text">ОЖИДАНИЕ АКТИВАЦИИ</span>';
                statusEl.style.color = '';
                
                deadmanMini.classList.add('hidden');
                deadmanBtn.classList.remove('active');
                
                timeLeft = 1800;
                updateTimerDisplay();
            });
        }

        function updateTimerDisplay() {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            
            timerDisplay.textContent = timeStr;
            miniTimer.textContent = timeStr;
            
            // Warning colors
            if (timeLeft < 300) { // Less than 5 minutes
                timerDisplay.classList.add('warning');
                miniTimer.style.color = 'var(--warning)';
            } else {
                timerDisplay.classList.remove('warning');
                miniTimer.style.color = '';
            }
        }

        function triggerAlarm() {
            clearInterval(timerInterval);
            AudioEngine.play('alert');
            
            // Simulate sending data
            const gps = document.getElementById('gps').textContent;
            console.log('ALARM! Sending:', { gps, time: new Date().toISOString() });
            
            showToast('ТРЕВОГА! Данные отправлены', 'error');
            
            // Reset after alarm
            setTimeout(() => {
                stopBtn.click();
            }, 3000);
        }
    }

    // Audio Recorder
    function initAudioRecorder() {
        let mediaRecorder = null;
        let audioChunks = [];
        let isRecording = false;

        const recordBtn = document.getElementById('record-btn');
        const replayBtn = document.getElementById('replay-btn');
        const levelFill = document.getElementById('level-fill');
        const levelText = document.getElementById('level-text');
        const statusDot = document.getElementById('audio-status-dot');
        const statusText = document.getElementById('audio-status-text');

        if (!recordBtn) return;

        recordBtn.addEventListener('click', async () => {
            if (!isRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];
                    
                    mediaRecorder.ondataavailable = (e) => {
                        audioChunks.push(e.data);
                    };
                    
                    mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        const audioUrl = URL.createObjectURL(audioBlob);
                        window.lastRecording = audioUrl;
                        replayBtn.disabled = false;
                        
                        if (statusDot) statusDot.classList.remove('active');
                        if (statusText) statusText.textContent = 'ГОТОВ';
                    };
                    
                    mediaRecorder.start();
                    isRecording = true;
                    recordBtn.classList.add('recording');
                    recordBtn.innerHTML = '<span class="record-icon">⏹</span><span class="record-text">СТОП</span>';
                    
                    AudioEngine.play('recordStart');
                    
                    if (statusDot) {
                        statusDot.classList.add('active');
                        statusDot.style.background = 'var(--danger)';
                    }
                    if (statusText) statusText.textContent = 'ЗАПИСЬ';
                    
                    // Simulate level meter
                    const levelInterval = setInterval(() => {
                        if (!isRecording) {
                            clearInterval(levelInterval);
                            return;
                        }
                        const level = Math.random() * 80 + 20;
                        if (levelFill) levelFill.style.width = level + '%';
                        if (levelText) levelText.textContent = '-' + Math.floor(Math.random() * 20 + 20) + ' dB';
                    }, 100);
                    
                } catch (err) {
                    showToast('Доступ к микрофону запрещен', 'error');
                    AudioEngine.play('alert');
                }
            } else {
                mediaRecorder.stop();
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
                isRecording = false;
                recordBtn.classList.remove('recording');
                recordBtn.innerHTML = '<span class="record-icon">●</span><span class="record-text">ЗАПИСЬ</span>';
                
                if (levelFill) levelFill.style.width = '0%';
                if (levelText) levelText.textContent = '-∞ dB';
            }
        });

        if (replayBtn) {
            replayBtn.addEventListener('click', () => {
                if (window.lastRecording) {
                    const audio = new Audio(window.lastRecording);
                    audio.play();
                    AudioEngine.play('success');
                }
            });
        }
    }

    // Chat
    function initChat() {
        const chatMessages = document.getElementById('chat-messages');
        const chatInput = document.getElementById('chat-input');
        const chatSend = document.getElementById('chat-send');

        if (!chatMessages) return;

        const teamMembers = [
            { name: 'Сударь', role: 'Техник' },
            { name: 'Полина', role: 'Аналитик' },
            { name: 'Чернец', role: 'Связист' }
        ];

        const autoMessages = [
            'Сектор чист. Движения не наблюдаю.',
            'Вижу движение в конце коридора.',
            'Пульс в норме. Давление стабильно.',
            'EMF фон повысился на 0.2 μT.',
            'Связь стабильна. Шифрование активно.',
            'Аудио-фон тихий. Шумов нет.',
            'Батарея 67%. Заряд держится.',
            'Температура упала на 2 градуса.'
        ];

        function addMessage(text, author, isOutgoing = false) {
            const msg = document.createElement('div');
            msg.className = `chat-message ${isOutgoing ? 'outgoing' : 'incoming'}`;
            
            const time = new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
            
            if (!isOutgoing) {
                msg.innerHTML = `
                    <div class="chat-author">${author}</div>
                    <div>${text}</div>
                    <div class="chat-time">${time}</div>
                `;
            } else {
                msg.innerHTML = `
                    <div class="chat-author">Вы</div>
                    <div>${text}</div>
                    <div class="chat-time">${time}</div>
                `;
            }
            
            chatMessages.appendChild(msg);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            if (isOutgoing) {
                AudioEngine.play('message');
            }
        }

        // Auto messages
        setInterval(() => {
            const member = teamMembers[Math.floor(Math.random() * teamMembers.length)];
            const message = autoMessages[Math.floor(Math.random() * autoMessages.length)];
            addMessage(message, `${member.name} (${member.role})`);
        }, 30000);

        // Send message
        if (chatSend && chatInput) {
            chatSend.addEventListener('click', () => {
                const text = chatInput.value.trim();
                if (text) {
                    addMessage(text, 'Вы', true);
                    chatInput.value = '';
                }
            });

            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    chatSend.click();
                }
            });
        }

        // Shortcuts
        document.querySelectorAll('.shortcut-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                chatInput.value = btn.dataset.msg;
                chatSend.click();
            });
        });
    }

    // Voice Command
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

        let isListening = false;

        const startVoiceBtn = document.getElementById('start-voice');
        if (startVoiceBtn) {
            startVoiceBtn.addEventListener('click', () => {
                if (!isListening) {
                    recognition.start();
                    isListening = true;
                    startVoiceBtn.textContent = '[ ВЫКЛЮЧИТЬ ГОЛОСОВОЕ УПРАВЛЕНИЕ ]';
                    AudioEngine.play('success');
                    showToast('Голосовое управление активно');
                } else {
                    recognition.stop();
                    isListening = false;
                    startVoiceBtn.textContent = '[ ВКЛЮЧИТЬ ГОЛОСОВОЕ УПРАВЛЕНИЕ ]';
                }
            });
        }

        recognition.onresult = (event) => {
            const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
            processVoiceCommand(command);
        };

        function processVoiceCommand(command) {
            const voiceStatus = document.getElementById('voice-status');
            
            if (voiceStatus) {
                voiceStatus.classList.remove('hidden');
                voiceStatus.classList.add('active');
                voiceStatus.querySelector('.voice-text').textContent = `РАСПОЗНАНО: "${command}"`;
            }

            if (command.includes('лог') || command.includes('запись')) {
                document.getElementById('incident-btn').click();
                speakResponse('Событие зафиксировано');
            } else if (command.includes('ночь') || command.includes('темно')) {
                document.getElementById('night-ops-btn').click();
                speakResponse('Ночной режим активирован');
            } else if (command.includes('статус')) {
                speakResponse('Все системы в норме');
            } else if (command.includes('карта')) {
                document.querySelector('[data-view="map"]').click();
                speakResponse('Переход на карту');
            } else if (command.includes('навигатор')) {
                document.querySelector('[data-view="navigator"]').click();
                speakResponse('Открыт навигатор');
            }

            setTimeout(() => {
                if (voiceStatus) voiceStatus.classList.add('hidden');
            }, 2000);
        }

        function speakResponse(text) {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'ru-RU';
                utterance.rate = 0.9;
                utterance.pitch = 0.8;
                window.speechSynthesis.speak(utterance);
            }
        }
    }

    // Evidence Vault
    function initEvidenceVault() {
        loadEvidence();
        updateVaultCount();

        // Export buttons
        const exportTxt = document.getElementById('export-txt');
        const exportPdf = document.getElementById('export-pdf');
        const clearVault = document.getElementById('clear-vault');

        if (exportTxt) {
            exportTxt.addEventListener('click', () => {
                const evidence = JSON.parse(localStorage.getItem('ghostHubEvidence') || '[]');
                const text = evidence.map(e => 
                    `[${e.time}] ${e.gps || e.coords} | EMF: ${e.emf} | Шум: ${e.noise}`
                ).join('\n');
                
                const blob = new Blob([text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ghost-hub-evidence-${Date.now()}.txt`;
                a.click();
                
                AudioEngine.play('success');
                showToast('Экспорт завершен');
            });
        }

        if (exportPdf) {
            exportPdf.addEventListener('click', () => {
                AudioEngine.play('click');
                showToast('PDF генерация... (демо)');
            });
        }

        if (clearVault) {
            clearVault.addEventListener('click', () => {
                if (confirm('Очистить все улики?')) {
                    localStorage.removeItem('ghostHubEvidence');
                    loadEvidence();
                    updateVaultCount();
                    AudioEngine.play('alert');
                    showToast('Хранилище очищено');
                }
            });
        }
    }

    function saveEvidence(data) {
        let evidence = JSON.parse(localStorage.getItem('ghostHubEvidence') || '[]');
        evidence.unshift({
            ...data,
            id: Date.now(),
            emf: (Math.random() * 5).toFixed(2) + ' μT',
            noise: Math.floor(Math.random() * 40 + 30) + ' dB'
        });
        evidence = evidence.slice(0, 50);
        localStorage.setItem('ghostHubEvidence', JSON.stringify(evidence));
        loadEvidence();
        updateVaultCount();
    }

    function loadEvidence() {
        const vaultList = document.getElementById('vault-list');
        if (!vaultList) return;

        const evidence = JSON.parse(localStorage.getItem('ghostHubEvidence') || '[]');
        vaultList.innerHTML = '';
        
        if (evidence.length === 0) {
            vaultList.innerHTML = '<div class="vault-empty">Хранилище пусто</div>';
            return;
        }

        evidence.forEach(item => {
            const card = document.createElement('div');
            card.className = 'evidence-card';
            card.innerHTML = `
                <div class="evidence-icon">🎙</div>
                <div class="evidence-info">
                    <div class="evidence-time">${item.time}</div>
                    <div class="evidence-coords">${item.gps || item.coords}</div>
                    <div class="evidence-data">EMF: ${item.emf} | Шум: ${item.noise}</div>
                </div>
                <div class="evidence-actions">
                    <button class="evidence-btn play-btn" data-id="${item.id}">▶</button>
                    <button class="evidence-btn delete-btn" data-id="${item.id}">×</button>
                </div>
            `;
            vaultList.appendChild(card);
        });

        // Add event listeners to new buttons
        vaultList.querySelectorAll('.play-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                AudioEngine.play('click');
                showToast('Воспроизведение...');
            });
        });

        vaultList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                deleteEvidence(id);
            });
        });
    }

    function deleteEvidence(id) {
        let evidence = JSON.parse(localStorage.getItem('ghostHubEvidence') || '[]');
        evidence = evidence.filter(item => item.id !== id);
        localStorage.setItem('ghostHubEvidence', JSON.stringify(evidence));
        loadEvidence();
        updateVaultCount();
        AudioEngine.play('click');
    }

    function updateVaultCount() {
        const countEl = document.getElementById('evidence-count');
        const audioEl = document.getElementById('audio-count');
        if (countEl) {
            const evidence = JSON.parse(localStorage.getItem('ghostHubEvidence') || '[]');
            countEl.textContent = evidence.length;
            if (audioEl) audioEl.textContent = evidence.length;
        }
    }

    // Tremor
    function initTremorWithPermission() {
        const canvas = document.getElementById('seismograph');
        if (!canvas) return;

        if (typeof DeviceMotionEvent !== 'undefined' && 
            typeof DeviceMotionEvent.requestPermission === 'function') {
            
            const permissionBtn = document.createElement('button');
            permissionBtn.className = 'navigator-action-btn primary';
            permissionBtn.innerHTML = '<span>🔓 РАЗРЕШИТЬ ДАТЧИКИ</span>';
            permissionBtn.style.marginBottom = '10px';
            
            const container = canvas.parentElement;
            container.parentElement.insertBefore(permissionBtn, container);
            
            permissionBtn.addEventListener('click', () => {
                DeviceMotionEvent.requestPermission()
                    .then(permissionState => {
                        if (permissionState === 'granted') {
                            permissionBtn.remove();
                            initTremor(true);
                        } else {
                            showToast('Доступ запрещен', 'error');
                            permissionBtn.remove();
                            initTremor(false);
                        }
                    })
                    .catch(console.error);
            });
        } else {
            initTremor(true);
        }
    }

    function initTremor(useRealSensors) {
        const canvas = document.getElementById('seismograph');
        const ctx = canvas.getContext('2d');
        
        canvas.width = canvas.offsetWidth || 300;
        canvas.height = canvas.offsetHeight || 180;

        const historyX = [];
        const historyY = [];
        const historyZ = [];
        const maxHistory = 100;
        let sensitivity = 5;
        let isSimulating = !useRealSensors;

        if (useRealSensors && window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', (event) => {
                const acc = event.accelerationIncludingGravity;
                if (acc && acc.x !== null) {
                    isSimulating = false;
                    updateTremorData(acc.x, acc.y, acc.z || 9.8);
                }
            });
        }

        function simulateTremor() {
            if (!isSimulating) return;
            
            const baseNoise = () => (Math.random() - 0.5) * 0.5;
            const occasionalSpike = Math.random() > 0.98 ? (Math.random() - 0.5) * sensitivity : 0;
            
            updateTremorData(
                baseNoise() + occasionalSpike,
                baseNoise() + occasionalSpike * 0.5,
                9.8 + baseNoise() + occasionalSpike * 0.3
            );
            
            requestAnimationFrame(simulateTremor);
        }
        
        if (isSimulating) simulateTremor();

        function updateTremorData(x, y, z) {
            if (historyX.length >= maxHistory) {
                historyX.shift();
                historyY.shift();
                historyZ.shift();
            }
            historyX.push(x || 0);
            historyY.push(y || 0);
            historyZ.push(z || 9.8);

            const mag = Math.sqrt(x*x + y*y + (z-9.8)*(z-9.8));
            const magEl = document.getElementById('magnitude');
            if (magEl) magEl.textContent = mag.toFixed(2);

            const threshold = sensitivity * 0.15;
            const thresholdEl = document.getElementById('threshold');
            if (thresholdEl) thresholdEl.textContent = threshold.toFixed(2);
            
            const alertEl = document.getElementById('tremor-alert');
            if (mag > threshold && alertEl) {
                if (!alertEl.classList.contains('active')) {
                    alertEl.classList.add('active');
                    addTremorLog(mag.toFixed(2));
                    AudioEngine.play('warning');
                }
            } else if (alertEl) {
                alertEl.classList.remove('active');
            }
        }

        function addTremorLog(mag) {
            const logContainer = document.getElementById('tremor-entries');
            if (!logContainer) return;
            
            const emptyEl = logContainer.querySelector('.entry-empty');
            if (emptyEl) emptyEl.remove();

            const time = new Date().toLocaleTimeString('ru-RU', {hour12: false});
            const entry = document.createElement('div');
            entry.className = 'tremor-entry';
            entry.innerHTML = `<span style="color: #888">[${time}]</span> Вибрация ${mag} м/с²`;
            
            logContainer.insertBefore(entry, logContainer.firstChild);
            
            if (logContainer.children.length > 20) {
                logContainer.removeChild(logContainer.lastChild);
            }
        }

        const slider = document.getElementById('sensitivity');
        if (slider) {
            slider.addEventListener('input', (e) => {
                sensitivity = parseInt(e.target.value);
            });
        }

        function draw() {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const centerY = canvas.height / 2;
            const scale = canvas.height / 25;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            for (let y = 0; y < canvas.height; y += 20) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }

            function drawAxis(history, color, offset, label) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                
                for (let i = 0; i < history.length; i++) {
                    const x = (i / maxHistory) * canvas.width;
                    const val = history[i] - offset;
                    const y = centerY + val * scale;
                    
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();

                if (history.length > 0) {
                    ctx.fillStyle = color;
                    ctx.font = '10px JetBrains Mono';
                    const lastVal = history[history.length - 1] - offset;
                    const yPos = centerY + lastVal * scale;
                    ctx.fillText(label, canvas.width - 20, yPos - 5);
                }
            }

            drawAxis(historyX, '#FF6666', 0, 'X');
            drawAxis(historyY, '#66FF66', 0, 'Y');
            drawAxis(historyZ, '#6699FF', 9.8, 'Z');

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            ctx.lineTo(canvas.width, centerY);
            ctx.stroke();

            requestAnimationFrame(draw);
        }
        draw();
    }

    // Add incident to log
    function addIncidentToLog(time, coords) {
        const list = document.getElementById('incident-list');
        if (!list) return;
        
        const empty = list.querySelector('.incident-empty');
        if (empty) empty.remove();
        
        const item = document.createElement('div');
        item.className = 'incident-item';
        item.innerHTML = `
            <div>
                <span class="incident-time">[${time}]</span>
                <span class="incident-coords">${coords}</span>
            </div>
            <button class="incident-audio">▶</button>
        `;
        
        list.insertBefore(item, list.firstChild);
        
        if (list.children.length > 5) {
            list.removeChild(list.lastChild);
        }
    }
});
