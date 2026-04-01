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
        initNavigation();
        initContactModal();
        initGPS();
        initProtocols();
        initLogFilters();
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

    // GPS simulation
    function initGPS() {
        const gpsEl = document.getElementById('gps');
        let baseLat = 55.7558;
        let baseLon = 37.6173;
        
        setInterval(() => {
            const drift = (Math.random() - 0.5) * 0.0002;
            baseLat += drift;
            baseLon += drift;
            gpsEl.textContent = `${baseLat.toFixed(4)}°N ${baseLon.toFixed(4)}°E`;
        }, 3000);
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
            
            // Grid
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
            
            // Points and connections
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
            
            // Scan line
            scanY = (scanY + 1) % canvas.height;
            ctx.strokeStyle = 'rgba(255, 140, 0, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, scanY);
            ctx.lineTo(canvas.width, scanY);
            ctx.stroke();
            
            // Scan line glow
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
            
            // Grid
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

    // Contact Modal
    function initContactModal() {
        const modal = document.getElementById('contact-modal');
        const openBtn = document.getElementById('initiate-contact');
        const closeBtn = modal.querySelector('.close-btn');
        const overlay = modal.querySelector('.modal-overlay');
        
        function open() {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
        
        function close() {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
        
        openBtn.addEventListener('click', open);
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', close);
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
                
                // Simulate data update
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

    // Log filters
    function initLogFilters() {
        const filterBtns = document.querySelectorAll('.filter-btn');
        const logEntries = document.querySelectorAll('.log-entry');
        
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                logEntries.forEach(entry => {
                    if (filter === 'all' || entry.dataset.type === filter) {
                        entry.style.display = 'block';
                    } else {
                        entry.style.display = 'none';
                    }
                });
            });
        });
    }

    // Team member expand
    document.querySelectorAll('.team-member').forEach(member => {
        const main = member.querySelector('.member-main');
        const details = member.querySelector('.member-details');
        
        main.addEventListener('click', () => {
            const isExpanded = details.style.display !== 'none';
            details.style.display = isExpanded ? 'none' : 'flex';
        });
        
        // Expand by default
        details.style.display = 'flex';
    });
});
