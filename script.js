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
        initNavigation();
        initQuickActions();
        initProtocols();
        initGeolocation();
        initAudioRecorder();
        initChat();
        initVoiceCommand();
        initEvidenceVault();
        initTremorWithPermission();
        initGhostEye();
        initSyncStart();
        initCerberAI();
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

    // Spectrogram
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
                const isHidden = !nightOverlay.classList.contains('hidden');
                nightOverlay.classList.toggle('hidden', isHidden);
                nightOpsBtn.classList.toggle('active', !isHidden);
                document.body.classList.toggle('night-mode', !isHidden);
            });
        }

        // Voice Command Button
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => {
                voiceBtn.classList.toggle('active');
                toggleVoiceRecognition();
            });
        }
    }

    // Audio Recorder (Ghost Box)
    function initAudioRecorder() {
        let mediaRecorder = null;
        let audioChunks = [];
        let audioBuffer = [];
        let isRecording = false;
        let bufferInterval = null;

        const recordBtn = document.getElementById('record-btn');
        const replayBtn = document.getElementById('replay-btn');
        const audioWaveform = document.getElementById('audio-waveform');
        const bufferWaveform = document.getElementById('buffer-waveform');
        const recorderTime = document.querySelector('.recorder-time');

        if (!recordBtn) return;

        // Canvas for waveform
        const ctx = audioWaveform ? audioWaveform.getContext('2d') : null;
        const bufCtx = bufferWaveform ? bufferWaveform.getContext('2d') : null;

        function drawWaveform(canvas, ctx, active = false) {
            if (!ctx) return;
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.strokeStyle = active ? '#FF3333' : '#00E5FF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            const time = Date.now() / 100;
            for (let x = 0; x < canvas.width; x += 2) {
                const amp = active ? 20 : 5;
                const y = canvas.height / 2 + 
                    Math.sin(x * 0.05 + time) * amp +
                    (Math.random() - 0.5) * (active ? 10 : 2);
                
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            if (active || isRecording) {
                requestAnimationFrame(() => drawWaveform(canvas, ctx, active));
            }
        }

        if (audioWaveform && ctx) {
            drawWaveform(audioWaveform, ctx, false);
        }

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
                        // Store in buffer (last 10 seconds)
                        audioBuffer.unshift({ url: audioUrl, time: Date.now() });
                        if (audioBuffer.length > 6) audioBuffer.pop(); // Keep last ~60 seconds
                        
                        replayBtn.disabled = audioBuffer.length === 0;
                    };
                    
                    mediaRecorder.start(1000); // Collect every second
                    isRecording = true;
                    recordBtn.classList.add('recording');
                    recordBtn.innerHTML = '<span>⏹ СТОП</span>';
                    
                    // Start buffer collection
                    let seconds = 0;
                    bufferInterval = setInterval(() => {
                        seconds++;
                        if (recorderTime) recorderTime.textContent = `00:${seconds.toString().padStart(2, '0')}`;
                        
                        // Visual buffer indicator
                        if (bufCtx && bufferWaveform) {
                            bufCtx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                            bufCtx.fillRect(0, 0, bufferWaveform.width, bufferWaveform.height);
                            bufCtx.fillStyle = '#FF8C00';
                            const barWidth = (bufferWaveform.width / 10) * (seconds % 10);
                            bufCtx.fillRect(0, bufferWaveform.height - 10, barWidth, 8);
                        }
                    }, 1000);
                    
                    drawWaveform(audioWaveform, ctx, true);
                    
                } catch (err) {
                    alert('Доступ к микрофону запрещен. Проверьте разрешения.');
                }
            } else {
                mediaRecorder.stop();
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
                isRecording = false;
                recordBtn.classList.remove('recording');
                recordBtn.innerHTML = '<span>● ЗАПИСЬ</span>';
                clearInterval(bufferInterval);
                if (recorderTime) recorderTime.textContent = '00:00';
                drawWaveform(audioWaveform, ctx, false);
            }
        });

        if (replayBtn) {
            replayBtn.addEventListener('click', () => {
                if (audioBuffer.length > 0) {
                    const lastRecording = audioBuffer[0];
                    const audio = new Audio(lastRecording.url);
                    audio.play();
                    
                    // Visual feedback
                    replayBtn.style.background = '#00E5FF';
                    setTimeout(() => {
                        replayBtn.style.background = '';
                    }, 1000);
                }
            });
            replayBtn.disabled = true;
        }
    }

    // Chat Simulation
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
            
            // Sound effect
            if (!isOutgoing && navigator.vibrate) {
                navigator.vibrate(50);
            }
        }

        // Auto messages every 30 seconds
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
    }

    // Voice Command
    let recognition = null;
    let isListening = false;

    function initVoiceCommand() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.log('Speech recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'ru-RU';
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
            processVoiceCommand(command);
        };

        recognition.onerror = (event) => {
            console.log('Speech recognition error:', event.error);
        };
    }

    function toggleVoiceRecognition() {
        if (!recognition) {
            alert('Голосовое управление не поддерживается в этом браузере');
            return;
        }

        const voiceStatus = document.getElementById('voice-status');
        
        if (!isListening) {
            recognition.start();
            isListening = true;
            if (voiceStatus) {
                voiceStatus.classList.add('active', 'listening');
                voiceStatus.textContent = 'СЛУШАЮ...';
            }
        } else {
            recognition.stop();
            isListening = false;
            if (voiceStatus) {
                voiceStatus.classList.remove('active', 'listening');
                voiceStatus.textContent = '';
            }
        }
    }

    function processVoiceCommand(command) {
        const voiceStatus = document.getElementById('voice-status');
        
        // Visual feedback
        if (voiceStatus) {
            voiceStatus.textContent = `РАСПОЗНАНО: "${command}"`;
            voiceStatus.classList.remove('listening');
        }

        // Commands
        if (command.includes('лог') || command.includes('запись') || command.includes('событие')) {
            document.getElementById('incident-btn').click();
            speakResponse('Событие зафиксировано');
        } else if (command.includes('ночь') || command.includes('темно') || command.includes('фильтр')) {
            document.getElementById('night-ops-btn').click();
            speakResponse('Ночной режим активирован');
        } else if (command.includes('статус') || command.includes('состояние')) {
            speakResponse('Все системы в норме. Группа на связи. Аномалий не обнаружено.');
        } else if (command.includes('карта') || command.includes('главная')) {
            document.querySelector('[data-view="map"]').click();
            speakResponse('Переход на тактическую карту');
        } else if (command.includes('чат') || command.includes('команда')) {
            document.querySelector('[data-view="team"]').click();
            speakResponse('Открыт командный чат');
        } else {
            speakResponse('Команда не распознана');
        }

        setTimeout(() => {
            if (voiceStatus && isListening) {
                voiceStatus.textContent = 'СЛУШАЮ...';
                voiceStatus.classList.add('listening');
            }
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

    // Evidence Vault with localStorage
    function initEvidenceVault() {
        loadEvidence();
        updateVaultCount();
    }

    function saveEvidence(data) {
        let evidence = JSON.parse(localStorage.getItem('ghostHubEvidence') || '[]');
        evidence.unshift({
            ...data,
            id: Date.now(),
            emf: (Math.random() * 5).toFixed(2) + ' μT',
            noise: Math.floor(Math.random() * 40 + 30) + ' dB'
        });
        // Keep only last 50
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
            vaultList.innerHTML = '<div class="incident-empty">Нет сохраненных улик</div>';
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
                    <button class="evidence-btn" onclick="playEvidence(${item.id})">▶</button>
                    <button class="evidence-btn" onclick="deleteEvidence(${item.id})">×</button>
                </div>
            `;
            vaultList.appendChild(card);
        });
    }

    function updateVaultCount() {
        const countEl = document.getElementById('vault-count');
        if (countEl) {
            const evidence = JSON.parse(localStorage.getItem('ghostHubEvidence') || '[]');
            countEl.textContent = evidence.length;
        }
    }

    window.playEvidence = function(id) {
        // Simulate playback
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        alert('Воспроизведение аудиозаписи...');
    };

    window.deleteEvidence = function(id) {
        let evidence = JSON.parse(localStorage.getItem('ghostHubEvidence') || '[]');
        evidence = evidence.filter(item => item.id !== id);
        localStorage.setItem('ghostHubEvidence', JSON.stringify(evidence));
        loadEvidence();
        updateVaultCount();
    };

    // Export functions
    window.exportEvidence = function(format) {
        const evidence = JSON.parse(localStorage.getItem('ghostHubEvidence') || '[]');
        
        if (format === 'txt') {
            const text = evidence.map(e => 
                `[${e.time}] ${e.gps || e.coords} | EMF: ${e.emf} | Шум: ${e.noise}`
            ).join('\n');
            
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ghost-hub-evidence-${Date.now()}.txt`;
            a.click();
        } else if (format === 'pdf') {
            // Simulate PDF export
            alert('PDF экспорт подготовлен. В реальной версии здесь будет генерация PDF.');
        }
    };

    // Tremor with permission
    function initTremorWithPermission() {
        const canvas = document.getElementById('seismograph');
        if (!canvas) return;

        if (typeof DeviceMotionEvent !== 'undefined' && 
            typeof DeviceMotionEvent.requestPermission === 'function') {
            
            const permissionBtn = document.createElement('button');
            permissionBtn.className = 'control-btn';
            permissionBtn.innerHTML = '<span>🔓 РАЗРЕШИТЬ ДАТЧИКИ</span>';
            permissionBtn.style.marginBottom = '10px';
            permissionBtn.style.width = '100%';
            
            const container = canvas.parentElement;
            container.insertBefore(permissionBtn, canvas);
            
            permissionBtn.addEventListener('click', () => {
                DeviceMotionEvent.requestPermission()
                    .then(permissionState => {
                        if (permissionState === 'granted') {
                            permissionBtn.remove();
                            initTremor(true);
                        } else {
                            permissionBtn.innerHTML = '<span>❌ ДОСТУП ЗАПРЕЩЕН</span>';
                            permissionBtn.style.background = '#FF3333';
                            setTimeout(() => {
                                permissionBtn.remove();
                                initTremor(false);
                            }, 1500);
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
        let lastUpdate = Date.now();
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
            
            const now = Date.now();
            if (now - lastUpdate > 50) {
                const baseNoise = () => (Math.random() - 0.5) * 0.5;
                const occasionalSpike = Math.random() > 0.98 ? (Math.random() - 0.5) * sensitivity : 0;
                
                updateTremorData(
                    baseNoise() + occasionalSpike,
                    baseNoise() + occasionalSpike * 0.5,
                    9.8 + baseNoise() + occasionalSpike * 0.3
                );
                lastUpdate = now;
            }
            requestAnimationFrame(simulateTremor);
        }
        
        if (isSimulating) {
            simulateTremor();
        }

        function updateTremorData(x, y, z) {
            x = x || 0;
            y = y || 0;
            z = z || 9.8;

            if (historyX.length >= maxHistory) {
                historyX.shift();
                historyY.shift();
                historyZ.shift();
            }
            historyX.push(x);
            historyY.push(y);
            historyZ.push(z);

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
            ctx.lineWidth = 1;
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
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            ctx.lineTo(canvas.width, centerY);
            ctx.stroke();

            requestAnimationFrame(draw);
        }
        draw();
    }

    // Ghost Eye Camera
    function initGhostEye() {
        const video = document.getElementById('ghost-eye-video');
        const toggleBtn = document.getElementById('ghost-eye-toggle');
        const gridBtn = document.getElementById('grid-toggle');
        const container = document.querySelector('.camera-container');
        
        if (!video || !toggleBtn) return;

        let stream = null;
        let showGrid = true;

        toggleBtn.addEventListener('click', async () => {
            if (!stream) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ 
                        video: { facingMode: 'environment' },
                        audio: false 
                    });
                    video.srcObject = stream;
                    video.play();
                    toggleBtn.textContent = 'ВЫКЛЮЧИТЬ';
                    toggleBtn.classList.add('active');
                } catch (err) {
                    alert('Доступ к камере запрещен');
                }
            } else {
                stream.getTracks().forEach(track => track.stop());
                video.srcObject = null;
                stream = null;
                toggleBtn.textContent = 'ВКЛЮЧИТЬ';
                toggleBtn.classList.remove('active');
            }
        });

        if (gridBtn) {
            gridBtn.addEventListener('click', () => {
                showGrid = !showGrid;
                const grid = document.querySelector('.grid-overlay');
                if (grid) grid.style.opacity = showGrid ? '1' : '0';
                gridBtn.classList.toggle('active', showGrid);
            });
        }

        // Histogram simulation
        const histogram = document.querySelector('.histogram');
        if (histogram) {
            function updateHistogram() {
                const bars = histogram.querySelectorAll('.histogram-bar');
                bars.forEach(bar => {
                    const height = Math.random() * 100;
                    bar.style.height = `${height}%`;
                });
                requestAnimationFrame(updateHistogram);
            }
            updateHistogram();
        }
    }

    // Sync Start
    function initSyncStart() {
        const syncBtn = document.getElementById('sync-start-btn');
        if (!syncBtn) return;

        let countdown = 5;
        let countdownInterval = null;

        syncBtn.addEventListener('click', () => {
            if (syncBtn.classList.contains('counting')) {
                // Cancel
                clearInterval(countdownInterval);
                syncBtn.classList.remove('counting');
                syncBtn.innerHTML = `
                    <span class="sync-icon">◈</span>
                    <span>SYNC START</span>
                `;
                return;
            }

            syncBtn.classList.add('counting');
            countdown = 5;
            
            countdownInterval = setInterval(() => {
                syncBtn.innerHTML = `
                    <span class="sync-countdown">${countdown}</span>
                    <span>СИНХРОНИЗАЦИЯ...</span>
                `;
                
                if (navigator.vibrate) navigator.vibrate(100);
                
                countdown--;
                
                if (countdown < 0) {
                    clearInterval(countdownInterval);
                    syncBtn.classList.remove('counting');
                    syncBtn.innerHTML = `
                        <span class="sync-icon">✓</span>
                        <span>ЗАПИСЬ АКТИВНА</span>
                    `;
                    
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    
                    // Trigger recording on all modules
                    document.getElementById('record-btn')?.click();
                    
                    setTimeout(() => {
                        syncBtn.innerHTML = `
                            <span class="sync-icon">◈</span>
                            <span>SYNC START</span>
                        `;
                    }, 3000);
                }
            }, 1000);
        });
    }

    // Cerber AI
    function initCerberAI() {
        const input = document.getElementById('cerber-input');
        const sendBtn = document.getElementById('cerber-send');
        const chat = document.getElementById('cerber-chat');
        
        if (!input || !sendBtn || !chat) return;

        const responses = {
            'статус': 'Все системы в норме. Группа на связи. Аномалий не обнаружено.',
            'связь': 'QUILL-MESH активен. 4 узла в сети. Задержка 12мс.',
            'радиация': 'Фон в норме. 0.03 μT. Датчики калиброваны.',
            'сударь': 'Сударь: сигнал 3/4, батарея 64%, пульс 68 BPM.',
            'полина': 'Полина: сигнал 4/4, батарея 92%, пульс 75 BPM.',
            'чернец': 'Чернец: сигнал 2/4, батарея 45%, пульс 70 BPM.',
            'дима': 'Командир: сигнал 4/4, батарея 87%, пульс 72 BPM.',
            'помощь': 'Доступные команды: статус, связь, радиация, [имя].'
        };

        function addCerberMessage(text, isUser = false) {
            const msg = document.createElement('div');
            msg.className = 'cerber-message';
            msg.style.color = isUser ? '#FF8C00' : '#00E5FF';
            msg.innerHTML = isUser ? `> ${text}` : `CERBER: ${text}`;
            chat.appendChild(msg);
            chat.scrollTop = chat.scrollHeight;
            
            if (!isUser) {
                speakResponse(text);
            }
        }

        sendBtn.addEventListener('click', () => {
            const text = input.value.trim().toLowerCase();
            if (!text) return;
            
            addCerberMessage(text, true);
            input.value = '';
            
            // Find response
            let response = 'Команда не распознана. Скажите "помощь" для списка команд.';
            for (const [key, value] of Object.entries(responses)) {
                if (text.includes(key)) {
                    response = value;
                    break;
                }
            }
            
            setTimeout(() => addCerberMessage(response), 500);
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendBtn.click();
        });

        // Initial greeting
        setTimeout(() => {
            addCerberMessage('Cerber AI активен. Готов к выполнению команд.');
        }, 1000);
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
