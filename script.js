// script.js
document.addEventListener('DOMContentLoaded', () => {
    // Boot sequence
    setTimeout(() => {
        document.getElementById('boot-screen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('boot-screen').classList.add('hidden');
            document.getElementById('main-interface').classList.remove('hidden');
            initSystems();
        }, 500);
    }, 3000);

    function initSystems() {
        initClock();
        initMap();
        initWaveform();
        initNavigation();
        initContactModal();
        initGPS();
    }

    // Clock
    function initClock() {
        function updateClock() {
            const now = new Date();
            const mskTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
            const timeString = mskTime.toTimeString().split(' ')[0];
            document.getElementById('clock').textContent = `${timeString} MSK`;
        }
        updateClock();
        setInterval(updateClock, 1000);
    }

    // GPS Coordinates simulation
    function initGPS() {
        const gpsEl = document.getElementById('gps');
        let baseLat = 55.7558;
        let baseLon = 37.6173;
        
        setInterval(() => {
            // Simulate minor GPS drift
            const drift = (Math.random() - 0.5) * 0.0001;
            baseLat += drift;
            baseLon += drift;
            gpsEl.textContent = `${baseLat.toFixed(4)}° N, ${baseLon.toFixed(4)}° E`;
        }, 5000);
    }

    // Tactical Map Canvas
    function initMap() {
        const canvas = document.getElementById('tactical-map');
        const ctx = canvas.getContext('2d');
        let width = canvas.width = canvas.offsetWidth;
        let height = canvas.height = canvas.offsetHeight;
        
        // Resize handler
        window.addEventListener('resize', () => {
            width = canvas.width = canvas.offsetWidth;
            height = canvas.height = canvas.offsetHeight;
        });

        const points = [];
        const numPoints = 20;
        
        // Initialize random points
        for (let i = 0; i < numPoints; i++) {
            points.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 1
            });
        }

        function drawMap() {
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, width, height);
            
            // Draw grid
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.05)';
            ctx.lineWidth = 1;
            const gridSize = 50;
            
            for (let x = 0; x < width; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y < height; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
            
            // Update and draw points
            points.forEach((point, i) => {
                point.x += point.vx;
                point.y += point.vy;
                
                // Bounce off edges
                if (point.x < 0 || point.x > width) point.vx *= -1;
                if (point.y < 0 || point.y > height) point.vy *= -1;
                
                // Draw point
                ctx.fillStyle = i % 3 === 0 ? '#FF8C00' : '#00E5FF';
                ctx.beginPath();
                ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw connections
                points.forEach((other, j) => {
                    if (i >= j) return;
                    const dx = point.x - other.x;
                    const dy = point.y - other.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < 100) {
                        ctx.strokeStyle = `rgba(0, 229, 255, ${0.2 * (1 - dist/100)})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(point.x, point.y);
                        ctx.lineTo(other.x, other.y);
                        ctx.stroke();
                    }
                });
            });
            
            // Draw scanning line
            const scanY = (Date.now() / 20) % height;
            ctx.strokeStyle = 'rgba(255, 140, 0, 0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, scanY);
            ctx.lineTo(width, scanY);
            ctx.stroke();
            
            requestAnimationFrame(drawMap);
        }
        
        drawMap();
    }

    // Waveform Animation
    function initWaveform() {
        const canvas = document.getElementById('waveform');
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        function drawWaveform() {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
            
            ctx.strokeStyle = '#00E5FF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            const time = Date.now() / 200;
            for (let x = 0; x < width; x++) {
                const y = height / 2 + 
                    Math.sin(x * 0.05 + time) * 20 * Math.sin(time * 0.5) +
                    Math.sin(x * 0.1 + time * 2) * 10 +
                    (Math.random() - 0.5) * 5;
                
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Draw grid overlay
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)';
            ctx.lineWidth = 1;
            for (let x = 0; x < width; x += 20) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            
            requestAnimationFrame(drawWaveform);
        }
        
        drawWaveform();
    }

    // Navigation
    function initNavigation() {
        const navBtns = document.querySelectorAll('.nav-btn');
        const views = document.querySelectorAll('.view-section');
        
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const viewId = btn.dataset.view + '-view';
                
                // Update buttons
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update views
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
        
        openBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
        });
        
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }

    // Protocol interactions
    document.querySelectorAll('.protocol-item').forEach(item => {
        item.addEventListener('click', function() {
            this.classList.toggle('active');
            const status = this.querySelector('.protocol-status');
            if (this.classList.contains('active')) {
                status.textContent = 'ONLINE';
                status.style.color = 'var(--success-green)';
            } else {
                status.textContent = 'OFFLINE';
                status.style.color = 'var(--alert-red)';
            }
        });
    });

    // Mesh node hover effects
    document.querySelectorAll('.mesh-node').forEach(node => {
        node.addEventListener('mouseenter', function() {
            const battery = this.querySelector('.battery');
            const originalText = battery.textContent;
            battery.textContent = 'SCANNING...';
            setTimeout(() => {
                battery.textContent = originalText;
            }, 1000);
        });
    });
});
