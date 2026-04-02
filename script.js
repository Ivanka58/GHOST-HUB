// script.js
document.addEventListener('DOMContentLoaded', () => {
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
        initTremor();
        initNavigation();
        initQuickActions();
        initProtocols();
        initGeolocation();
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

    // Tactical Map
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
        const canvas = document.getElementById('waveform');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

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
            
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)';
            ctx.lineWidth = 1;
            for (let x = 0; x < canvas.width; x += 20) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            
            requestAnimationFrame(draw);
        }
        draw();
    }

    // Spectrogram (SPECTRO-SCAN)
    function initSpectrogram() {
        const canvas = document.getElementById('spectrogram');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = 300;
        const height = 200;
        canvas.width = width;
        canvas.height = height;

        const bins = 30;
        const history = [];
        const maxHistory = 60;
        let anomalyCount = 0;
        let isRecording = false;
        
        function generateFreqData() {
            const data = [];
            for (let i = 0; i < bins; i++) {
                let value = Math.random() * 0.3;
                
                if (i < 10 && Math.random() > 0.95) {
                    value = 0.8 + Math.random() * 0.2;
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
                        
                        if (f < 10 && t === history.length - 1 && isRecording) {
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

        const toggleBtn = document.getElementById('toggle-audio');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                isRecording = !isRecording;
                toggleBtn.classList.toggle('recording', isRecording);
                toggleBtn.innerHTML = isRecording ? 
                    '<span>⏹ ОСТАНОВИТЬ</span>' : 
                    '<span>▶ НАЧАТЬ ЗАПИСЬ</span>';
                
                if (isRecording) {
                    updateCerberStatus('Сканирование активно...', 'Ожидание входных данных с микрофона...');
                } else {
                    updateCerberStatus('Ожидание...', 'Нажмите НАЧАТЬ ЗАПИСЬ для анализа');
                }
            });
        }

        function updateCerberStatus(status, detail) {
            const statusEl = document.getElementById('cerber-status');
            const detailEl = document.getElementById('cerber-detail');
            if (statusEl) statusEl.textContent = status;
            if (detailEl) detailEl.textContent = detail;
        }

        draw();
    }

    // Tremor (ACCEL-TREMOR)
    function initTremor() {
        const canvas = document.getElementById('seismograph');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth || 300;
        canvas.height = canvas.offsetHeight || 180;

        const historyX = [];
        const historyY = [];
        const historyZ = [];
        const maxHistory = 100;
        let sensitivity = 5;
        let lastUpdate = Date.now();

        // Try to get real accelerometer data
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', (event) => {
                const acc = event.accelerationIncludingGravity;
                if (acc) {
                    updateTremorData(acc.x || 0, acc.y || 0, acc.z || 0);
                }
            });
        }

        // Simulate data if no real sensor
        function simulateTremor() {
            const now = Date.now();
            if (now - lastUpdate > 100) {
                const noise = () => (Math.random() - 0.5) * sensitivity * 0.5;
                updateTremorData(noise(), noise(), noise() + 9.8);
                lastUpdate = now;
            }
            requestAnimationFrame(simulateTremor);
        }
        simulateTremor();

        function updateTremorData(x, y, z) {
            if (historyX.length >= maxHistory) {
                historyX.shift();
                historyY.shift();
                historyZ.shift();
            }
            historyX.push(x);
            historyY.push(y);
            historyZ.push(z);

            // Calculate magnitude
            const mag = Math.sqrt(x*x + y*y + z*z);
            const magEl = document.getElementById('magnitude');
            if (magEl) magEl.textContent = mag.toFixed(2);

            // Check threshold
            const threshold = sensitivity * 0.3;
            document.getElementById('threshold').textContent = threshold.toFixed(2);
            
            const alertEl = document.getElementById('tremor-alert');
            if (mag > threshold && alertEl) {
                alertEl.classList.add('active');
                addTremorLog(mag.toFixed(2));
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

        // Sensitivity slider
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
            const scale = canvas.height / 20;

            // Draw grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            for (let y = 0; y < canvas.height; y += 20) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }

            // Draw axes
            function drawAxis(history, color, offset) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                
                for (let i = 0; i < history.length; i++) {
                    const x = (i / maxHistory) * canvas.width;
                    const y = centerY + (history[i] - offset) * scale;
                    
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            drawAxis(historyX, '#FF6666', 0);
            drawAxis(historyY, '#66FF66', 0);
            drawAxis(historyZ, '#6699FF', 9.8);

            requestAnimationFrame(draw);
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
                const now = new Date();
                const time = now.toLocaleTimeString('ru-RU', {hour12: false});
                const gps = document.getElementById('gps').textContent;
                
                document.getElementById('incident-time').textContent = time;
                document.getElementById('incident-coords').textContent = gps;
                document.getElementById('incident-emf').textContent = (Math.random() * 5).toFixed(2) + ' μT';
                document.getElementById('incident-noise').textContent = Math.floor(Math.random() * 40 + 30) + ' dB';
                
                incidentModal.classList.remove('hidden');
                addIncidentToLog(time, gps);
                
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
                const isActive = nightOverlay.classList.toggle('hidden');
                nightOpsBtn.classList.toggle('active', !isActive);
                document.body.classList.toggle('night-mode', !isActive);
            });
        }

        // Dead Man Switch
        const deadmanBtn = document.getElementById('deadman-btn');
        const deadmanModal = document.getElementById('deadman-modal');
        let timerInterval = null;
        let timeLeft = 1800; // 30 minutes in seconds
        
        if (deadmanBtn && deadmanModal) {
            deadmanBtn.addEventListener('click', () => {
                deadmanModal.classList.remove('hidden');
                updateTimerDisplay();
            });
            
            deadmanModal.querySelector('.close-btn').addEventListener('click', () => {
                deadmanModal.classList.add('hidden');
            });
            deadmanModal.querySelector('.modal-overlay').addEventListener('click', () => {
                deadmanModal.classList.add('hidden');
            });
            
            const resetBtn = document.getElementById('reset-timer');
            const startBtn = document.getElementById('start-timer');
            
            if (startBtn) {
                startBtn.addEventListener('click', () => {
                    startBtn.classList.add('hidden');
                    resetBtn.classList.remove('hidden');
                    startTimer();
                });
            }
            
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    timeLeft = 1800;
                    updateTimerDisplay();
                });
            }
        }
        
        function startTimer() {
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                timeLeft--;
                updateTimerDisplay();
                
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    triggerDeadManAlert();
                }
            }, 1000);
        }
        
        function updateTimerDisplay() {
            const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            const secs = (timeLeft % 60).toString().padStart(2, '0');
            const display = document.getElementById('deadman-timer');
            if (display) display.textContent = `${mins}:${secs}`;
        }
        
        function triggerDeadManAlert() {
            alert('DEAD MAN SWITCH ACTIVATED!\nОтправка координат команде...');
        }
    }

    // Add incident to log on main screen
    function addIncidentToLog(time, coords) {
        const list = document.getElementById('incident-list');
        if (!list) return;
        
        const empty = list.querySelector('.incident-empty');
        if (empty) empty.remove();
        
        const item = document.createElement('div');
        item.className = 'incident-item';
        item.innerHTML = `
            <span class="incident-time">[${time}]</span>
            <span class="incident-coords">${coords}</span>
        `;
        
        list.insertBefore(item, list.firstChild);
        
        if (list.children.length > 5) {
            list.removeChild(list.lastChild);
        }
    }

    // Protocol toggles
    function initProtocols() {
        document.querySelectorAll('.protocol-card').forEach(card => {
            const header = card.querySelector('.protocol-header');
            const toggle = card.querySelector('.protocol-toggle');
            const icon = card.querySelector('.protocol-icon');
            
            header.addEventListener('click', () => {
                card.classList.toggle('active');
                const isActive = card.classList.contains('active');
                
                toggle.textContent = isActive ? 'ON' : 'OFF';
                icon.style.color = isActive ? 'var(--success)' : 'var(--danger)';
                
                if (isActive) {
                    toggle.style.color = 'var(--success)';
                    toggle.style.background = 'rgba(0, 255, 136, 0.1)';
                } else {
                    toggle.style.color = 'var(--danger)';
                    toggle.style.background = 'rgba(255, 51, 51, 0.1)';
                }
            });
        });
    }
});
