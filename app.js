/* ==========================================
   SMART COMMUNICATION - INTERACTIVE MASTERPIECE
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Global Theme & Accents Tracker ---
    let currentPrimaryRGB = '0, 229, 255';
    
    function updateCachedThemeColor() {
        // Wait a tick for styles to compute correctly
        setTimeout(() => {
            const rgb = getComputedStyle(document.body).getPropertyValue('--theme-primary-rgb').trim();
            if (rgb) {
                currentPrimaryRGB = rgb;
            }
        }, 50);
    }

    // Apply saved theme on page load (Default is Dark Mode)
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        updateCachedThemeColor();
    } else {
        updateCachedThemeColor();
    }

    // --- 0. [NEW] Populate Name list Dropdown, Auto-Populate & Seating Map Generation ---
    const nameSelect = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const deptInput = document.getElementById('department');
    const seatingGrid = document.getElementById('seatingGrid');
    const selectedSeatInput = document.getElementById('selectedSeatInput');

    // 0.1 Generate U-Shape coordinates (Exactly 31 VIP seats)
    const U_COORDINATES = [];
    // Left Arm: 12 seats (L1 to L12) -> Row 1 to 12, Column 1
    for (let i = 1; i <= 12; i++) {
        U_COORDINATES.push({ id: `L${i}`, row: i, col: 1, label: `L${i}` });
    }
    // Bottom Base: 7 seats (B1 to B7) -> Row 12, Column 2 to 8
    for (let i = 1; i <= 7; i++) {
        U_COORDINATES.push({ id: `B${i}`, row: 12, col: i + 1, label: `B${i}` });
    }
    // Right Arm: 12 seats (R1 to R12) -> Row 1 to 12, Column 10
    for (let i = 1; i <= 12; i++) {
        U_COORDINATES.push({ id: `R${i}`, row: i, col: 10, label: `R${i}` });
    }

    // Storage Key (v2 = fresh start, all seats empty)
    const STORAGE_KEY = 'smart_communication_seats_v2';

    // Google Sheets Apps Script Web App URL (Paste your URL here once deployed)
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxg9pvwtJbN4pfV4jdZTBFXHd1e9OQbC3IxfDTkXFNw6SZlVs_VBT7IWuMxXrcNINo5/exec';
    
    let cachedBookings = [];

    // Helper to fetch latest bookings from Google Sheet (falls back to localStorage if URL is not configured)
    async function fetchLatestBookings() {
        if (!SCRIPT_URL || SCRIPT_URL.includes('YOUR_GOOGLE_APPS_SCRIPT_URL')) {
            const data = localStorage.getItem(STORAGE_KEY);
            cachedBookings = data ? JSON.parse(data) : [];
            return;
        }
        try {
            const response = await fetch(`${SCRIPT_URL}?action=get`);
            const resJson = await response.json();
            if (resJson.status === 'success') {
                cachedBookings = resJson.data;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedBookings));
            }
        } catch (err) {
            console.error('Failed to fetch bookings from Google Sheets:', err);
            const data = localStorage.getItem(STORAGE_KEY);
            cachedBookings = data ? JSON.parse(data) : [];
        }
    }

    // Helper to get bookings list (returns cached list synchronously)
    window.getBookings = function() {
        return cachedBookings;
    };

    // Helper to save a booking (async updates backend Google Sheet)
    window.saveBooking = async function(booking) {
        const bookings = window.getBookings();
        const filtered = bookings.filter(b => b.name !== booking.name);
        filtered.push(booking);
        cachedBookings = filtered;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedBookings));
        
        if (typeof window.updateSeatDisplay === 'function') {
            window.updateSeatDisplay();
        }
        if (typeof window.renderAdminBookingsList === 'function') {
            window.renderAdminBookingsList();
        }
        
        if (SCRIPT_URL && !SCRIPT_URL.includes('YOUR_GOOGLE_APPS_SCRIPT_URL')) {
            try {
                const queryParams = new URLSearchParams({
                    action: 'save',
                    name: booking.name,
                    email: booking.email,
                    company: booking.company,
                    seatId: booking.seatId,
                    serial: booking.serial
                });
                const response = await fetch(`${SCRIPT_URL}?${queryParams.toString()}`);
                const resJson = await response.json();
                if (resJson.status !== 'success') {
                    console.error('Failed to save to Google Sheets:', resJson.message);
                    alert(`เกิดข้อผิดพลาดในการบันทึกที่นั่ง: ${resJson.message}`);
                } else {
                    await fetchLatestBookings();
                    window.renderSeatingGrid();
                    window.updateSeatDisplay();
                }
            } catch (err) {
                console.error('Network error saving booking:', err);
            }
        }
    };

    // Render Seating Grid
    window.renderSeatingGrid = function() {
        if (!seatingGrid) return;
        seatingGrid.innerHTML = '';
        seatingGrid.className = 'seating-grid u-seating-grid';
        
        const bookings = window.getBookings();
        const selectedName = nameSelect ? nameSelect.value : '';
        const currentBooking = bookings.find(b => b.name === selectedName);
        const currentSelectedSeatId = selectedSeatInput ? selectedSeatInput.value : '';

        // If the logged-in user is not an admin/tester, do not show admin/tester bookings on the grid
        const bookingsToShow = isAdminOrTester(selectedName) 
            ? bookings 
            : bookings.filter(b => !isAdminOrTester(b.name));

        U_COORDINATES.forEach((coord) => {
            const booking = bookingsToShow.find(b => b.seatId === coord.id);
            const node = document.createElement('div');
            node.style.gridRow = coord.row;
            node.style.gridColumn = coord.col;
            node.setAttribute('data-seat-id', coord.id);
            
            const seatLabel = document.createElement('span');
            seatLabel.className = 'seat-label-text';
            seatLabel.textContent = coord.id;
            node.appendChild(seatLabel);

            // Determine state of the seat
            if (currentBooking && currentBooking.seatId === coord.id) {
                // This is the active user's already confirmed seat
                node.className = 'seat-node active-user-seat';
                node.setAttribute('data-attendee-name', currentBooking.name);
                node.setAttribute('data-tooltip', `🔥 ที่นั่งของคุณ: ${coord.id} - ${currentBooking.name} (${currentBooking.company})`);
            } else if (currentSelectedSeatId === coord.id) {
                // This is the seat the active user is currently selecting (not yet submitted)
                node.className = 'seat-node active-user-seat';
                node.setAttribute('data-tooltip', `🔥 ที่นั่งที่คุณเลือก: ${coord.id}`);
            } else if (booking) {
                // Already booked by someone else
                node.className = 'seat-node confirmed';
                node.setAttribute('data-attendee-name', booking.name);
                node.setAttribute('data-tooltip', `ที่นั่ง ${coord.id}: ${booking.name} (${booking.company})`);
            } else {
                // Available seat
                node.className = 'seat-node available';
                node.setAttribute('data-tooltip', `ที่นั่ง ${coord.id}: ว่าง (คลิกเพื่อเลือก)`);
                
                // Add click handler for selecting
                node.addEventListener('click', () => {
                    handleSeatClick(coord.id);
                });
            }
            seatingGrid.appendChild(node);
        });
    };

    const ADMIN_LIST = [
        { name: "Krittiya Chalermtiragool (Admin)", email: "krittiya.c@bafs.co.th", company: "BAFS", pi: "Admin" },
        { name: "Prapavadee Kanasuwan (Admin)", email: "prapavadee.k@bafs.co.th", company: "BAFS", pi: "Admin" },
        { name: "Thanakrit Nimidhathai (Admin)", email: "thanakrit@bafs.co.th", company: "BAFS", pi: "Admin" }
    ];

    // Check if name belongs to admin or tester
    function isAdminOrTester(name) {
        if (!name) return false;
        const lower = name.toLowerCase();
        return lower.includes('thanakrit') || lower.includes('krittiya') || lower.includes('prapavadee') || lower.includes('(admin)') || lower.includes('(test)') || lower.includes('(tester)');
    }

    let adminLoggedIn = sessionStorage.getItem('admin_logged_in') === 'true';

    // Handle seat click
    function handleSeatClick(seatId) {
        const selectedName = nameSelect.value;
        if (!selectedName) {
            alert('กรุณาเลือกรายชื่อของคุณก่อนเลือกที่นั่ง');
            return;
        }

        const bookings = window.getBookings();
        const currentBooking = bookings.find(b => b.name === selectedName);
        if (currentBooking && !adminLoggedIn && !isAdminOrTester(selectedName)) {
            alert('คุณได้ยืนยันสิทธิ์ที่นั่งเรียบร้อยแล้ว หากต้องการเปลี่ยนที่นั่ง กรุณาติดต่อทีมงานผู้ดูแลระบบ (HOD)');
            return;
        }

        // Set value in form input
        selectedSeatInput.value = seatId;
        
        // Re-render seating grid to update active user seat highlights
        window.renderSeatingGrid();
    }

    // Populate dropdown dynamically based on Admin state
    function populateNameDropdown() {
        if (!nameSelect || typeof ATTENDEE_LIST === 'undefined') return;
        
        const currentValue = nameSelect.value;
        nameSelect.innerHTML = '<option value="" disabled selected>--- กรุณาเลือกรายชื่อเพื่อเช็กสิทธิ์ ---</option>';
        
        let listToShow = [...ATTENDEE_LIST];
        if (adminLoggedIn) {
            listToShow = [...listToShow, ...ADMIN_LIST];
        }
        
        // Sort alphabetically
        listToShow.sort((a, b) => a.name.localeCompare(b.name));
        
        listToShow.forEach(attendee => {
            const opt = document.createElement('option');
            opt.value = attendee.name;
            opt.textContent = attendee.name;
            nameSelect.appendChild(opt);
        });

        // Restore value if still present in the list
        if (currentValue && listToShow.some(a => a.name === currentValue)) {
            nameSelect.value = currentValue;
        } else {
            nameSelect.value = "";
            emailInput.value = "";
            deptInput.value = "";
            selectedSeatInput.value = "";
            
            const submitBtn = document.getElementById('submitBtn');
            const viewTicketBtn = document.getElementById('viewTicketBtn');
            if (submitBtn) submitBtn.style.display = 'flex';
            if (viewTicketBtn) viewTicketBtn.style.display = 'none';
        }
    }

    // Update Admin UI panel and toggle button states
    function updateAdminUI() {
        const adminPanel = document.getElementById('adminControlPanel');
        const adminLoginTrigger = document.getElementById('adminLoginTrigger');
        const adminPasswordInputArea = document.getElementById('adminPasswordInputArea');
        const adminLoginBtn = document.getElementById('adminLoginBtn');
        const resetCurrentBtn = document.getElementById('adminResetCurrentUserBtn');
        
        if (adminLoggedIn) {
            if (adminPanel) adminPanel.style.display = 'block';
            if (adminLoginTrigger) adminLoginTrigger.style.display = 'block';
            if (adminPasswordInputArea) adminPasswordInputArea.style.display = 'none';
            if (adminLoginBtn) {
                adminLoginBtn.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> <span>ออกจากระบบผู้ดูแลระบบ (Log out Admin)</span>`;
                adminLoginBtn.style.opacity = '1';
                adminLoginBtn.style.background = 'rgba(244, 67, 54, 0.1)';
                adminLoginBtn.style.borderColor = 'rgba(244, 67, 54, 0.3)';
            }
            if (resetCurrentBtn) {
                const selectedName = nameSelect ? nameSelect.value : '';
                const bookings = window.getBookings();
                const booking = bookings.find(b => b.name === selectedName);
                resetCurrentBtn.disabled = !booking;
            }
            if (typeof window.renderAdminBookingsList === 'function') {
                window.renderAdminBookingsList();
            }
        } else {
            if (adminPanel) adminPanel.style.display = 'none';
            if (adminLoginTrigger) adminLoginTrigger.style.display = 'block';
            if (adminPasswordInputArea) adminPasswordInputArea.style.display = 'none';
            if (adminLoginBtn) {
                adminLoginBtn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> <span>เข้าสู่ระบบผู้ดูแลระบบ (Admin Login)</span>`;
                adminLoginBtn.style.opacity = '0.6';
                adminLoginBtn.style.background = 'rgba(255,255,255,0.02)';
                adminLoginBtn.style.borderColor = 'rgba(255,255,255,0.08)';
            }
        }
        
        populateNameDropdown();
        window.renderSeatingGrid();
        window.updateSeatDisplay();
    }

    // Setup Select Change Listener
    if (nameSelect && typeof ATTENDEE_LIST !== 'undefined') {
        nameSelect.addEventListener('change', () => {
            const selectedName = nameSelect.value;
            
            // Fetch latest bookings in background when name is changed
            fetchLatestBookings().then(() => {
                window.renderSeatingGrid();
                window.updateSeatDisplay();
                
                const attendee = ATTENDEE_LIST.find(a => a.name === selectedName) || ADMIN_LIST.find(a => a.name === selectedName);
                
                const adminPanel = document.getElementById('adminControlPanel');
                const resetCurrentBtn = document.getElementById('adminResetCurrentUserBtn');
                const submitBtn = document.getElementById('submitBtn');
                const viewTicketBtn = document.getElementById('viewTicketBtn');
            
            if (attendee) {
                emailInput.value = attendee.email;
                deptInput.value = attendee.company;
                
                // Check if they already have a booking
                const bookings = window.getBookings();
                const booking = bookings.find(b => b.name === selectedName);
                if (booking) {
                    selectedSeatInput.value = booking.seatId;
                    
                    if (adminLoggedIn) {
                        if (submitBtn) submitBtn.style.display = 'flex';
                        if (viewTicketBtn) viewTicketBtn.style.display = 'flex';
                    } else {
                        if (submitBtn) submitBtn.style.display = 'none';
                        if (viewTicketBtn) viewTicketBtn.style.display = 'flex';
                    }
                } else {
                    selectedSeatInput.value = '';
                    if (submitBtn) submitBtn.style.display = 'flex';
                    if (viewTicketBtn) viewTicketBtn.style.display = 'none';
                }

                // Show/hide admin panel based on login state
                if (adminPanel) {
                    if (adminLoggedIn || isAdminOrTester(selectedName)) {
                        adminPanel.style.display = 'block';
                        if (resetCurrentBtn) {
                            resetCurrentBtn.disabled = !booking;
                        }
                    } else {
                        adminPanel.style.display = 'none';
                    }
                }
            } else {
                emailInput.value = '';
                deptInput.value = '';
                selectedSeatInput.value = '';
                if (submitBtn) submitBtn.style.display = 'flex';
                if (viewTicketBtn) viewTicketBtn.style.display = 'none';
                if (adminPanel && !adminLoggedIn) adminPanel.style.display = 'none';
            }
            window.renderSeatingGrid();
            });
        });
    }

    // Setup Admin Action Listeners
    const adminResetCurrentBtn = document.getElementById('adminResetCurrentUserBtn');
    const adminResetAllBtn = document.getElementById('adminResetAllBtn');

    if (adminResetCurrentBtn) {
        adminResetCurrentBtn.addEventListener('click', () => {
            const selectedName = nameSelect.value;
            if (!selectedName || (!adminLoggedIn && !isAdminOrTester(selectedName))) return;

            const bookings = window.getBookings();
            const filtered = bookings.filter(b => b.name !== selectedName);
            cachedBookings = filtered;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedBookings));
            
            selectedSeatInput.value = '';
            adminResetCurrentBtn.disabled = true;
            
            alert(`ล้างข้อมูลการเลือกที่นั่งสำหรับคุณ ${selectedName} เรียบร้อยแล้ว`);
            
            const submitBtn = document.getElementById('submitBtn');
            const viewTicketBtn = document.getElementById('viewTicketBtn');
            if (submitBtn) submitBtn.style.display = 'flex';
            if (viewTicketBtn) viewTicketBtn.style.display = 'none';

            window.renderSeatingGrid();
            window.updateSeatDisplay();
            if (typeof window.renderAdminBookingsList === 'function') {
                window.renderAdminBookingsList();
            }

            if (SCRIPT_URL && !SCRIPT_URL.includes('YOUR_GOOGLE_APPS_SCRIPT_URL')) {
                fetch(`${SCRIPT_URL}?action=delete&name=${encodeURIComponent(selectedName)}`)
                    .then(res => res.json())
                    .then(resJson => {
                        if (resJson.status === 'success') {
                            fetchLatestBookings().then(() => {
                                window.renderSeatingGrid();
                                window.updateSeatDisplay();
                            });
                        }
                    })
                    .catch(err => console.error('Error deleting booking:', err));
            }
        });
    }

    if (adminResetAllBtn) {
        adminResetAllBtn.addEventListener('click', () => {
            if (confirm('คุณต้องการล้างข้อมูลแผนผังที่นั่งทั้งหมดใช่หรือไม่? ข้อมูลผู้เข้าร่วมงานที่จองไว้จะถูกลบทั้งหมด!')) {
                cachedBookings = [];
                localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
                
                selectedSeatInput.value = '';
                if (adminResetCurrentBtn) adminResetCurrentBtn.disabled = true;
                
                alert('ล้างข้อมูลแผนผังที่นั่งทั้งหมดเรียบร้อยแล้ว');
                
                const submitBtn = document.getElementById('submitBtn');
                const viewTicketBtn = document.getElementById('viewTicketBtn');
                if (submitBtn) submitBtn.style.display = 'flex';
                if (viewTicketBtn) viewTicketBtn.style.display = 'none';

                window.renderSeatingGrid();
                window.updateSeatDisplay();
                if (typeof window.renderAdminBookingsList === 'function') {
                    window.renderAdminBookingsList();
                }

                if (SCRIPT_URL && !SCRIPT_URL.includes('YOUR_GOOGLE_APPS_SCRIPT_URL')) {
                    fetch(`${SCRIPT_URL}?action=clearAll`)
                        .then(res => res.json())
                        .then(resJson => {
                            if (resJson.status === 'success') {
                                fetchLatestBookings().then(() => {
                                    window.renderSeatingGrid();
                                    window.updateSeatDisplay();
                                });
                            }
                        })
                        .catch(err => console.error('Error clearing bookings:', err));
                }
            }
        });
    }

    // Admin Login/Logout Setup
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const adminLoginTrigger = document.getElementById('adminLoginTrigger');
    const adminPasswordInputArea = document.getElementById('adminPasswordInputArea');
    const adminPasswordInput = document.getElementById('adminPassword');
    const adminSubmitPasswordBtn = document.getElementById('adminSubmitPasswordBtn');
    const adminCancelPasswordBtn = document.getElementById('adminCancelPasswordBtn');

    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', () => {
            if (adminLoggedIn) {
                adminLoggedIn = false;
                sessionStorage.removeItem('admin_logged_in');
                updateAdminUI();
                alert('ออกจากระบบผู้ดูแลระบบเรียบร้อยแล้ว');
            } else {
                if (adminLoginTrigger) adminLoginTrigger.style.display = 'none';
                if (adminPasswordInputArea) adminPasswordInputArea.style.display = 'flex';
                if (adminPasswordInput) {
                    adminPasswordInput.value = '';
                    adminPasswordInput.focus();
                }
            }
        });
    }

    if (adminCancelPasswordBtn) {
        adminCancelPasswordBtn.addEventListener('click', () => {
            if (adminLoginTrigger) adminLoginTrigger.style.display = 'block';
            if (adminPasswordInputArea) adminPasswordInputArea.style.display = 'none';
        });
    }

    function handleAdminPasswordSubmit() {
        if (!adminPasswordInput) return;
        const enteredPassword = adminPasswordInput.value;
        if (enteredPassword === 'HOD2026') {
            adminLoggedIn = true;
            sessionStorage.setItem('admin_logged_in', 'true');
            updateAdminUI();
            alert('เข้าสู่ระบบผู้ดูแลระบบ (Admin) สำเร็จ! รายชื่อทดสอบ Admin จะปรากฏในดรอปดาวน์');
        } else {
            alert('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
            adminPasswordInput.value = '';
            adminPasswordInput.focus();
        }
    }

    if (adminSubmitPasswordBtn) {
        adminSubmitPasswordBtn.addEventListener('click', handleAdminPasswordSubmit);
    }

    if (adminPasswordInput) {
        adminPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleAdminPasswordSubmit();
            }
        });
    }

    // (Initial load call moved to the bottom of the file)

    // --- 1. Countdown Timer (Target: 10 June 2026 09:00:00) ---
    const targetDate = new Date('June 10, 2026 09:00:00').getTime();
    
    const updateCountdown = () => {
        const now = new Date().getTime();
        const difference = targetDate - now;
        
        if (difference < 0) {
            document.getElementById('countdown').innerHTML = `<div class="time-block" style="min-width: 100%;"><span class="time-number" style="font-size: 1.4rem;">ยินดีต้อนรับเข้าสู่หลักสูตรแล้วสัมมนาในขณะนี้</span></div>`;
            return;
        }
        
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        document.getElementById('days').textContent = String(days).padStart(2, '0');
        document.getElementById('hours').textContent = String(hours).padStart(2, '0');
        document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
        document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
    };
    
    updateCountdown();
    setInterval(updateCountdown, 1000);

    // --- 2. Interactive Ambient Glow & Dynamic Waveform Interactivity ---
    const ambientGlow = document.getElementById('ambientGlow');
    const waveBars = document.querySelectorAll('.wave-bar');
    
    window.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        
        // Ambient glow tracks the mouse
        ambientGlow.style.left = `${50 + (x - 50) * 0.12}%`;
        ambientGlow.style.top = `${50 + (y - 50) * 0.12}%`;

        // Waveform bars dynamic scale modulation on mouse movement
        waveBars.forEach((bar, idx) => {
            const mod = Math.sin((x * 0.05) + idx) * 30 + 40;
            bar.style.height = `${Math.max(10, Math.min(95, mod))}%`;
        });
    });

    // --- 3. Interactive 3D Card Tilt Effect for Episode Visuals ---
    const tiltCards = document.querySelectorAll('.tilt-card');
    
    tiltCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left; // x position within element
            const y = e.clientY - rect.top;  // y position within element
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // Calculate tilt angle (max 10 degrees)
            const rotateX = ((centerY - y) / centerY) * 8;
            const rotateY = ((x - centerX) / centerX) * 8;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
        });
    });

    // --- 4. Dynamic Episode Theme & Panel Toggling ---
    const epButtons = document.querySelectorAll('.ep-nav-btn');
    const epPanels = document.querySelectorAll('.ep-panel');
    
    epButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const epNum = btn.getAttribute('data-ep');
            
            // Toggle active state on buttons
            epButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Toggle active state on panels
            epPanels.forEach(panel => {
                panel.classList.remove('active');
            });
            document.getElementById(`ep-panel-${epNum}`).classList.add('active');
            
            // Smoothly morph the entire website body theme without removing other classes
            document.body.classList.remove('theme-ep1', 'theme-ep2', 'theme-ep3');
            document.body.classList.add(`theme-ep${epNum}`);
            updateCachedThemeColor();
        });
    });

    // --- 4b. Theme Toggle Button Setup (Light / Dark Mode Switcher with View Transitions) ---
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const toggleTheme = () => {
                const isLight = document.body.classList.toggle('light-mode');
                localStorage.setItem('theme', isLight ? 'light' : 'dark');
                updateCachedThemeColor();
            };

            if (document.startViewTransition) {
                document.startViewTransition(toggleTheme);
            } else {
                toggleTheme();
            }
        });
    }



    // --- 6. Seat Booking Status (Fixed at 78/100 confirmed registrations lorg-term) ---
    const progressMaxOffset = 251.2;
    
    window.updateSeatDisplay = function() {
        const bookings = window.getBookings();
        // Filter out admin and tester bookings when calculating counts
        const nonAdminBookings = bookings.filter(b => !isAdminOrTester(b.name));
        const seatsBooked = nonAdminBookings.length;
        const seatsLeft = 31 - seatsBooked;
        
        const seatsLeftEl = document.getElementById('seatsLeft');
        const seatsBookedEl = document.getElementById('seatsBooked');
        const seatProgressEl = document.getElementById('seatProgress');
        const dynamicSeatingCountEl = document.getElementById('dynamicSeatingCount');
        
        if (seatsLeftEl) seatsLeftEl.textContent = seatsLeft;
        if (seatsBookedEl) seatsBookedEl.textContent = seatsBooked;
        if (dynamicSeatingCountEl) {
            dynamicSeatingCountEl.textContent = `จองแล้ว ${seatsBooked}/31 ที่นั่ง`;
        }
        
        if (seatProgressEl) {
            const percentage = seatsBooked / 31;
            const offset = progressMaxOffset - (percentage * progressMaxOffset);
            seatProgressEl.style.strokeDashoffset = offset;
        }
    };
    
    window.updateSeatDisplay();

    // --- 7. RSVP Form Submission (Random seat assignment and digital delivery animation) ---
    const rsvpForm = document.getElementById('rsvpForm');
    const successOverlay = document.getElementById('successOverlay');
    const scanPhase = document.getElementById('scanPhase');
    const ticketPhase = document.getElementById('ticketPhase');
    const scanProgressFill = document.getElementById('scanProgressFill');
    const scanPercent = document.getElementById('scanPercent');
    
    // Ticket fields
    const ticketAttendeeName = document.getElementById('ticketAttendeeName');
    const ticketSeatNumber = document.getElementById('ticketSeatNumber');
    const ticketAttendeeEmail = document.getElementById('ticketAttendeeEmail');
    const ticketAttendeeCompany = document.getElementById('ticketAttendeeCompany');
    const ticketSerial = document.getElementById('ticketSerial');

    rsvpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const selectedName = nameSelect.value;
        if (!selectedName) return;
        
        const attendee = ATTENDEE_LIST.find(a => a.name === selectedName) || ADMIN_LIST.find(a => a.name === selectedName);
        if (!attendee) return;

        const chosenSeatId = selectedSeatInput.value;
        if (!chosenSeatId) {
            alert('กรุณาคลิกเลือกที่นั่งที่ว่าง (เส้นประ) บนแผนผังด้านขวาก่อนตรวจสอบสิทธิ์');
            return;
        }

        const runSubmit = () => {
            // Start Scanning/Allocating
            scanPhase.style.display = 'flex';
            ticketPhase.style.display = 'none';
            successOverlay.classList.add('active');
            
            let progress = 0;
            scanProgressFill.style.width = '0%';
            scanPercent.textContent = '0%';
            
            // Flash seats randomly in background to look like a high-tech selector
            const allSeats = document.querySelectorAll('.seat-node');
            const flashInterval = setInterval(() => {
                allSeats.forEach(s => s.classList.remove('active-user-seat'));
                const randomSeat = allSeats[Math.floor(Math.random() * allSeats.length)];
                if (randomSeat) randomSeat.classList.add('active-user-seat');
            }, 100);
            
            const progressInterval = setInterval(() => {
                progress += 4;
                if (progress > 100) progress = 100;
                
                scanProgressFill.style.width = `${progress}%`;
                scanPercent.textContent = `${progress}%`;
                
                if (progress >= 100) {
                    clearInterval(progressInterval);
                    clearInterval(flashInterval);
                    
                    // Save this booking to localStorage
                    const bookings = window.getBookings();
                    let existingBooking = bookings.find(b => b.name === selectedName);
                    let finalSerial;
                    
                    if (existingBooking) {
                        finalSerial = existingBooking.serial;
                        // If they somehow selected a different seat, update it
                        existingBooking.seatId = chosenSeatId;
                        window.saveBooking(existingBooking);
                    } else {
                        finalSerial = `SC2026-${Math.floor(1000 + Math.random() * 9000)}`;
                        const newBooking = {
                            name: attendee.name,
                            email: attendee.email,
                            company: attendee.company,
                            seatId: chosenSeatId,
                            serial: finalSerial
                        };
                        window.saveBooking(newBooking);
                    }

                    // --- Send confirmation email via EmailJS ---
                    if (typeof emailjs !== 'undefined') {
                        emailjs.send('service_smartcomm', 'template_seat_confirm', {
                            to_email: attendee.email,
                            attendee_name: attendee.name,
                            seat_id: chosenSeatId,
                            company: attendee.company,
                            serial: finalSerial,
                            event_date: '10-11 มิถุนายน 2569',
                            venue: 'BAFS Grand Hall'
                        }).then(() => {
                            console.log('✅ Email sent to:', attendee.email);
                        }).catch((err) => {
                            console.warn('⚠️ EmailJS send failed:', err);
                        });
                    }
                    
                    // Re-render seating grid to permanently register this seat and disable it for others
                    window.renderSeatingGrid();
                    
                    // Update Ticket fields
                    ticketAttendeeName.textContent = attendee.name;
                    ticketSeatNumber.textContent = chosenSeatId;
                    ticketAttendeeEmail.textContent = attendee.email;
                    ticketAttendeeCompany.textContent = attendee.company;
                    ticketSerial.textContent = finalSerial;
                    
                    // Update PI study button state
                    updatePiStudyButton(attendee);
                    
                    const dispatchText = document.getElementById('dispatchText');
                    if (dispatchText) {
                        dispatchText.innerHTML = `ระบบได้ส่งข้อมูลบัตรสิทธิ์ที่นั่งอย่างเป็นทางการไปยังอีเมล <strong style="color: var(--theme-primary); text-decoration: underline;">${attendee.email}</strong> เรียบร้อยแล้ว!`;
                    }

                    // Transition to Ticket view
                    scanPhase.style.display = 'none';
                    ticketPhase.style.display = 'flex';
                    
                    // Find node on the map representing user's seat to launch animation
                    const finalSeatNode = Array.from(allSeats).find(s => s.getAttribute('data-seat-id') === chosenSeatId);
                    
                    // Trigger digital paper plane / email flight animation!
                    triggerEmailFlightAnimation(finalSeatNode, attendee.email);
                }
            }, 100);
        };

        // Server-side check before booking
        if (SCRIPT_URL && !SCRIPT_URL.includes('YOUR_GOOGLE_APPS_SCRIPT_URL') && !isAdminOrTester(selectedName)) {
            fetchLatestBookings().then(() => {
                const taken = cachedBookings.find(b => b.seatId === chosenSeatId && b.name !== selectedName);
                if (taken) {
                    alert(`ขออภัย ที่นั่ง ${chosenSeatId} เพิ่งถูกจองโดยคุณ ${taken.name} เมื่อสักครู่ กรุณาเลือกที่นั่งใหม่อีกครั้ง`);
                    selectedSeatInput.value = '';
                    window.renderSeatingGrid();
                    window.updateSeatDisplay();
                } else {
                    runSubmit();
                }
            }).catch(err => {
                console.error("Error during submit validation:", err);
                runSubmit(); // Fallback if network fails
            });
        } else {
            runSubmit();
        }
    });

    // High fidelity email flying message animation
    const triggerEmailFlightAnimation = (startNode, targetEmail) => {
        // Create digital envelope element
        const plane = document.createElement('div');
        plane.className = 'digital-flight-plane';
        plane.innerHTML = `<i class="fa-solid fa-paper-plane"></i><span class="plane-pulse-trail"></span>`;
        document.body.appendChild(plane);
        
        // Find starting position (either the seat node or the boarding ticket)
        let startX = window.innerWidth / 2;
        let startY = window.innerHeight / 2;
        
        if (startNode) {
            const rect = startNode.getBoundingClientRect();
            startX = rect.left + rect.width / 2 + window.scrollX;
            startY = rect.top + rect.height / 2 + window.scrollY;
        }
        
        // Target: Let's make it fly towards the ticket email element
        const ticketEmailEl = document.getElementById('ticketAttendeeEmail');
        let targetX = window.innerWidth - 100;
        let targetY = 100;
        
        if (ticketEmailEl) {
            const rect = ticketEmailEl.getBoundingClientRect();
            targetX = rect.left + rect.width / 2 + window.scrollX;
            targetY = rect.top + rect.height / 2 + window.scrollY;
        }
        
        // Position initially
        plane.style.left = `${startX}px`;
        plane.style.top = `${startY}px`;
        plane.style.opacity = '1';
        
        // Animate
        setTimeout(() => {
            plane.style.transition = 'all 1.6s cubic-bezier(0.19, 1, 0.22, 1)';
            plane.style.left = `${targetX}px`;
            plane.style.top = `${targetY}px`;
            plane.style.transform = 'scale(1.8) rotate(45deg)';
            plane.style.filter = 'drop-shadow(0 0 20px #00e5ff)';
        }, 50);
        
        // Particle burst
        setTimeout(() => {
            plane.style.opacity = '0';
            plane.style.transform = 'scale(0) rotate(90deg)';
            
            // Sparkle effects
            for (let i = 0; i < 15; i++) {
                const sparkle = document.createElement('div');
                sparkle.className = 'digital-sparkle';
                sparkle.style.left = `${targetX + (Math.random() - 0.5) * 60}px`;
                sparkle.style.top = `${targetY + (Math.random() - 0.5) * 60}px`;
                sparkle.style.backgroundColor = '#00e5ff';
                document.body.appendChild(sparkle);
                
                setTimeout(() => {
                    sparkle.style.transition = 'all 0.8s ease';
                    sparkle.style.transform = `translate(${(Math.random() - 0.5) * 100}px, ${(Math.random() - 0.5) * 100}px) scale(0)`;
                    sparkle.style.opacity = '0';
                    setTimeout(() => sparkle.remove(), 800);
                }, 20);
            }
            
            // Clean up plane
            setTimeout(() => plane.remove(), 1000);
        }, 1650);
    };

    window.closeSuccess = () => {
        successOverlay.classList.remove('active');
        rsvpForm.reset();
        
        // Reset form inputs
        if (nameSelect) nameSelect.value = '';
        if (emailInput) emailInput.value = '';
        if (deptInput) deptInput.value = '';
        if (selectedSeatInput) selectedSeatInput.value = '';
        
        // Reset buttons display
        const submitBtn = document.getElementById('submitBtn');
        const viewTicketBtn = document.getElementById('viewTicketBtn');
        if (submitBtn) submitBtn.style.display = 'flex';
        if (viewTicketBtn) viewTicketBtn.style.display = 'none';
        
        // Re-render seating grid to clear active seat highlights and show latest bookings
        window.renderSeatingGrid();
        window.updateSeatDisplay();
    };

    // --- 8. Header Background Shift on Scroll ---
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // --- 9. Smooth Scroll Fade-in (Intersection Observer) ---
    const revealElements = document.querySelectorAll('.ep-nav-btn, .ep-grid, .venue-grid, .rsvp-grid, .meta-card');
    
    const observerOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-active');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    revealElements.forEach(el => {
        el.classList.add('reveal-on-scroll');
        revealObserver.observe(el);
    });

    // --- 10. Floating Back-to-Top Button Control ---
    const backToTopBtn = document.getElementById('backToTop');

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // --- 11. Interactive Canvas Particles Background (Neural Network) ---
    const canvas = document.getElementById('particlesCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        let mouse = { x: null, y: null, radius: 150 };

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        window.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });

        window.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
        });

        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * 0.8;
                this.vy = (Math.random() - 0.5) * 0.8;
                this.size = Math.random() * 2 + 1;
                this.alpha = Math.random() * 0.5 + 0.2;
            }



            draw() {
                ctx.fillStyle = `rgba(${currentPrimaryRGB}, ${this.alpha})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                if (this.x < 0 || this.x > canvas.width) this.vx = -this.vx;
                if (this.y < 0 || this.y > canvas.height) this.vy = -this.vy;

                if (mouse.x && mouse.y) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < mouse.radius) {
                        let force = (mouse.radius - dist) / mouse.radius;
                        this.x -= dx / dist * force * 1.5;
                        this.y -= dy / dist * force * 1.5;
                    }
                }
            }
        }

        const initParticles = () => {
            particles = [];
            const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 15000));
            for (let i = 0; i < count; i++) {
                particles.push(new Particle());
            }
        };
        initParticles();

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });

            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    let dx = particles[i].x - particles[j].x;
                    let dy = particles[i].y - particles[j].y;

                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 100) {
                        ctx.strokeStyle = `rgba(${currentPrimaryRGB}, ${0.15 * (1 - dist/100)})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }

            requestAnimationFrame(animate);
        };
        animate();
    }

    // --- 12. PI Profiles Filter & Search Toggling ---
    const filterButtons = document.querySelectorAll('.pi-filter-btn');
    const piCards = document.querySelectorAll('.pi-card');
    const searchInput = document.getElementById('piSearchInput');
    const searchClear = document.getElementById('piSearchClear');

    function filterPiCards() {
        const activeFilterBtn = document.querySelector('.pi-filter-btn.active');
        const filter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'all';
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

        piCards.forEach(card => {
            const category = card.getAttribute('data-category');
            const name = card.querySelector('.pi-name').textContent.toLowerCase();
            const badge = card.querySelector('.pi-badge').textContent.toLowerCase();
            const bodyText = card.querySelector('.pi-card-body').textContent.toLowerCase();

            const matchesCategory = (filter === 'all' || category === filter);
            const matchesSearch = !query || name.includes(query) || badge.includes(query) || bodyText.includes(query);

            if (matchesCategory && matchesSearch) {
                if (card.classList.contains('hidden-card')) {
                    card.classList.remove('hidden-card');
                    card.style.animation = 'none';
                    card.offsetHeight; // force reflow
                    card.style.animation = '';
                }
            } else {
                card.classList.add('hidden-card');
            }
        });
    }

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterPiCards();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (searchInput.value.trim()) {
                if (searchClear) searchClear.style.display = 'flex';
            } else {
                if (searchClear) searchClear.style.display = 'none';
            }
            filterPiCards();
        });
    }

    if (searchClear) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.style.display = 'none';
            searchInput.focus();
            filterPiCards();
        });
    }

    // --- 12b. PI Interactive Modal Logic ---
    const piModal = document.getElementById('piModal');
    const closePiModalBtn = document.getElementById('closePiModal');
    const piModalPrev = document.getElementById('piModalPrev');
    const piModalNext = document.getElementById('piModalNext');
    let activeCardIndex = -1;
    let visibleCardsList = [];

    // Inject "ดูรายละเอียด" button and set click listener
    piCards.forEach(card => {
        const cardInner = card.querySelector('.pi-card-inner');
        if (cardInner) {
            const btn = document.createElement('button');
            btn.className = 'btn-pi-detail';
            btn.innerHTML = 'ดูรายละเอียด <i class="fa-solid fa-arrow-right"></i>';
            btn.setAttribute('type', 'button');
            cardInner.appendChild(btn);

            cardInner.addEventListener('click', (e) => {
                if (e.target.closest('a') || e.target.closest('.btn-pi-study') || e.target.closest('.btn-pi-detail')) {
                    if (e.target.closest('.btn-pi-detail')) {
                        openModalForCard(card);
                    }
                    return;
                }
                openModalForCard(card);
            });
        }
    });

    function getVisibleCards() {
        return Array.from(piCards).filter(card => !card.classList.contains('hidden-card'));
    }

    function openModalForCard(card) {
        if (!piModal) return;

        visibleCardsList = getVisibleCards();
        activeCardIndex = visibleCardsList.indexOf(card);

        const name = card.querySelector('.pi-name').textContent.trim();
        const badge = card.querySelector('.pi-badge').textContent.trim();
        const category = card.getAttribute('data-category');

        const modalName = document.getElementById('piModalName');
        const modalBadge = document.getElementById('piModalBadge');
        const modalHeader = piModal.querySelector('.pi-modal-header');

        if (modalName) modalName.textContent = name;
        if (modalBadge) {
            modalBadge.textContent = badge;
            modalBadge.className = `pi-modal-badge ${category}`;
        }
        if (modalHeader) {
            modalHeader.className = `pi-modal-header ${category}`;
        }

        const iconWrap = document.getElementById('piModalIconWrap');
        if (iconWrap) {
            iconWrap.className = `pi-modal-icon-wrap ${category}`;
            const cardImg = card.querySelector('.pi-profile-icon-img');
            if (cardImg) {
                iconWrap.innerHTML = `<img src="${cardImg.src}" alt="${name}">`;
            } else {
                iconWrap.innerHTML = '';
            }
        }

        const detailItems = card.querySelectorAll('.pi-detail-item');
        const modalDesc = document.getElementById('piModalDesc');
        if (modalDesc && detailItems[0]) {
            const descText = detailItems[0].querySelector('.pi-detail-text').textContent.trim();
            modalDesc.textContent = descText;
        }

        function extractListItems(pElement) {
            if (!pElement) return [];
            const html = pElement.innerHTML;
            const rawItems = html.split(/<br\s*\/?>|\n/gi);
            return rawItems
                .map(item => {
                    let cleaned = item.replace(/<[^>]*>/g, '').trim();
                    if (cleaned.startsWith('•') || cleaned.startsWith('-') || cleaned.startsWith('*')) {
                        cleaned = cleaned.substring(1).trim();
                    }
                    return cleaned;
                })
                .filter(item => item.length > 0);
        }

        const modalNeeds = document.getElementById('piModalNeeds');
        if (modalNeeds && detailItems[1]) {
            const needsP = detailItems[1].querySelector('.pi-detail-text');
            const items = extractListItems(needsP);
            modalNeeds.innerHTML = items
                .map(item => `<li><i class="fa-solid fa-clipboard-check"></i> <span>${item}</span></li>`)
                .join('');
        }

        const modalBehaviors = document.getElementById('piModalBehaviors');
        if (modalBehaviors && detailItems[2]) {
            const behaviorsP = detailItems[2].querySelector('.pi-detail-text');
            const items = extractListItems(behaviorsP);
            modalBehaviors.innerHTML = items
                .map(item => `<li><i class="fa-solid fa-circle-check"></i> <span>${item}</span></li>`)
                .join('');
        }

        const indicator = document.getElementById('piModalIndicator');
        if (indicator) {
            indicator.textContent = `${activeCardIndex + 1} / ${visibleCardsList.length}`;
        }

        piModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closePiModal() {
        if (!piModal) return;
        piModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function navigateModal(direction) {
        if (visibleCardsList.length === 0 || activeCardIndex === -1) return;

        let newIndex = activeCardIndex;
        if (direction === 'next') {
            newIndex = (activeCardIndex + 1) % visibleCardsList.length;
        } else if (direction === 'prev') {
            newIndex = (activeCardIndex - 1 + visibleCardsList.length) % visibleCardsList.length;
        }

        const nextCard = visibleCardsList[newIndex];
        if (nextCard) {
            openModalForCard(nextCard);
        }
    }

    if (closePiModalBtn) {
        closePiModalBtn.addEventListener('click', closePiModal);
    }

    const modalBackdrop = piModal ? piModal.querySelector('.pi-modal-backdrop') : null;
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', closePiModal);
    }

    document.addEventListener('keydown', (e) => {
        if (piModal && piModal.classList.contains('active')) {
            if (e.key === 'Escape') {
                closePiModal();
            } else if (e.key === 'ArrowRight') {
                navigateModal('next');
            } else if (e.key === 'ArrowLeft') {
                navigateModal('prev');
            }
        }
    });

    if (piModalPrev) {
        piModalPrev.addEventListener('click', () => navigateModal('prev'));
    }

    if (piModalNext) {
        piModalNext.addEventListener('click', () => navigateModal('next'));
    }

    // Expose openModalForCard globally or to target redirection
    window.openPiModalForCard = openModalForCard;


    // --- 13. Boarding Ticket Download as Image ---
    const downloadTicketBtn = document.getElementById('downloadTicketBtn');
    if (downloadTicketBtn) {
        downloadTicketBtn.addEventListener('click', () => {
            const ticketElement = document.getElementById('downloadableTicket');
            const attendeeNameEl = document.getElementById('ticketAttendeeName');
            const attendeeName = attendeeNameEl ? attendeeNameEl.textContent : 'Attendee';
            
            if (ticketElement && typeof html2canvas !== 'undefined') {
                // Show loading state on button
                const originalContent = downloadTicketBtn.innerHTML;
                downloadTicketBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>กำลังสร้างรูปภาพ...</span>`;
                downloadTicketBtn.disabled = true;
                
                // Add border radius and overflow hide temporarily for html2canvas rendering correctly
                ticketElement.style.borderRadius = '16px';
                ticketElement.style.transform = 'scale(1)';
                
                // Render ticket using html2canvas
                html2canvas(ticketElement, {
                    backgroundColor: '#0a0a0f',
                    scale: 3, // Premium quality scaling
                    useCORS: true,
                    logging: false,
                    allowTaint: false,
                    scrollX: 0,
                    scrollY: 0,
                    x: 0,
                    y: 0
                }).then(canvas => {
                    // Reset button and temp styles
                    downloadTicketBtn.innerHTML = originalContent;
                    downloadTicketBtn.disabled = false;
                    ticketElement.style.borderRadius = '';
                    ticketElement.style.transform = '';
                    
                    // Download the PNG file
                    const link = document.createElement('a');
                    const safeName = attendeeName.trim().replace(/[^a-zA-Z0-9ก-๙]/g, '_');
                    link.download = `Smart_Communication_Boarding_Pass_${safeName}.png`;
                    link.href = canvas.toDataURL('image/png');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }).catch(err => {
                    console.error('Error generating ticket image:', err);
                    downloadTicketBtn.innerHTML = originalContent;
                    downloadTicketBtn.disabled = false;
                    ticketElement.style.borderRadius = '';
                    ticketElement.style.transform = '';
                    alert('เกิดข้อผิดพลาดในการดาวน์โหลดรูปภาพ กรุณาลองดาวน์โหลดใหม่อีกครั้ง');
                });
            } else {
                alert('ระบบดาวน์โหลดไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่อีกครั้ง');
            }
        });
    }

    // --- 14. Admin Bookings List Rendering & Ticket Viewing ---
    const viewTicketBtn = document.getElementById('viewTicketBtn');
    if (viewTicketBtn) {
        viewTicketBtn.addEventListener('click', () => {
            const selectedName = nameSelect.value;
            if (!selectedName) return;
            
            const attendee = ATTENDEE_LIST.find(a => a.name === selectedName) || ADMIN_LIST.find(a => a.name === selectedName);
            if (!attendee) return;
            
            const bookings = window.getBookings();
            const booking = bookings.find(b => b.name === selectedName);
            if (!booking) {
                alert('ไม่พบข้อมูลการจองสำหรับชื่อนี้');
                return;
            }
            
            // Populate Ticket fields
            ticketAttendeeName.textContent = booking.name;
            ticketSeatNumber.textContent = booking.seatId;
            ticketAttendeeEmail.textContent = booking.email;
            ticketAttendeeCompany.textContent = booking.company;
            ticketSerial.textContent = booking.serial || `SC2026-${Math.floor(1000 + Math.random() * 9000)}`;
            
            // Update PI study button state
            updatePiStudyButton(attendee);
            

            
            const dispatchText = document.getElementById('dispatchText');
            if (dispatchText) {
                dispatchText.innerHTML = `ข้อมูลบัตรสิทธิ์ที่นั่งอย่างเป็นทางการสำหรับคุณ <strong style="color: var(--theme-primary); text-decoration: underline;">${booking.email}</strong>`;
            }

            // Show overlay directly in ticket phase (skip scanning animation)
            scanPhase.style.display = 'none';
            ticketPhase.style.display = 'flex';
            successOverlay.classList.add('active');
        });
    }

    window.renderAdminBookingsList = function() {
        const container = document.getElementById('adminBookingsContainer');
        const countSpan = document.getElementById('adminBookingCount');
        if (!container) return;
        
        const bookings = window.getBookings();
        if (countSpan) countSpan.textContent = bookings.length;
        
        if (bookings.length === 0) {
            container.innerHTML = '<p style="color: rgba(255,255,255,0.4); text-align: center; margin: 10px 0;">ยังไม่มีการจองที่นั่ง</p>';
            return;
        }
        
        // Sort by seat ID (e.g. L1, L2, B1...)
        const sortedBookings = [...bookings].sort((a, b) => {
            return a.seatId.localeCompare(b.seatId, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        container.innerHTML = '';
        sortedBookings.forEach(b => {
            const isTest = isAdminOrTester(b.name);
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justify = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '8px 6px';
            row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
            
            const info = document.createElement('div');
            info.innerHTML = `<strong class="admin-booking-seat">[ที่นั่ง ${b.seatId}]</strong> ${b.name} <span class="admin-booking-company">(${b.company})</span> ${isTest ? '<span class="admin-booking-test">[TEST]</span>' : ''}`;
            
            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '8px';
            
            const dlBtn = document.createElement('button');
            dlBtn.type = 'button';
            dlBtn.className = 'btn';
            dlBtn.style.padding = '4px 8px';
            dlBtn.style.fontSize = '0.7rem';
            dlBtn.style.borderRadius = '4px';
            dlBtn.style.background = 'rgba(var(--theme-primary-rgb), 0.1)';
            dlBtn.style.border = '1px solid rgba(var(--theme-primary-rgb), 0.3)';
            dlBtn.style.color = 'var(--theme-primary)';
            dlBtn.style.cursor = 'pointer';
            dlBtn.innerHTML = '<i class="fa-solid fa-download"></i> โหลดตั๋ว';
            dlBtn.addEventListener('click', () => {
                // Populate ticket details
                ticketAttendeeName.textContent = b.name;
                ticketSeatNumber.textContent = b.seatId;
                ticketAttendeeEmail.textContent = b.email;
                ticketAttendeeCompany.textContent = b.company;
                ticketSerial.textContent = b.serial || `SC2026-${Math.floor(1000 + Math.random() * 9000)}`;
                
                // Update PI study button state
                const attendee = typeof ATTENDEE_LIST !== 'undefined' ? (ATTENDEE_LIST.find(a => a.name === b.name) || ADMIN_LIST.find(a => a.name === b.name)) : null;
                updatePiStudyButton(attendee);
                
                const dispatchText = document.getElementById('dispatchText');
                if (dispatchText) {
                    dispatchText.innerHTML = `ข้อมูลบัตรสิทธิ์ที่นั่งสำหรับคุณ <strong style="color: var(--theme-primary); text-decoration: underline;">${b.email}</strong>`;
                }
                
                scanPhase.style.display = 'none';
                ticketPhase.style.display = 'flex';
                successOverlay.classList.add('active');
            });
            
            actions.appendChild(dlBtn);
            row.appendChild(info);
            row.appendChild(actions);
            container.appendChild(row);
        });
    };

    // Helper to normalize and match PI profile name to the DOM card
    function getNormalizedPi(piName) {
        if (!piName) return null;
        let name = piName.trim();
        if (name.toLowerCase() === 'idividualist') {
            name = 'Individualist';
        }
        const allCards = document.querySelectorAll('.pi-card');
        let matchedName = null;
        allCards.forEach(card => {
            const titleEl = card.querySelector('.pi-name');
            if (titleEl && titleEl.textContent.trim().toLowerCase() === name.toLowerCase()) {
                matchedName = titleEl.textContent.trim();
            }
        });
        return matchedName;
    }

    // Show/hide and configure the PI study button based on attendee profile
    function updatePiStudyButton(attendee) {
        const container = document.getElementById('studyPiBtnContainer');
        if (!container) return;
        
        if (!attendee) {
            container.style.display = 'none';
            return;
        }
        
        const matchedPi = getNormalizedPi(attendee.pi);
        if (matchedPi) {
            container.style.display = 'block';
            container.setAttribute('data-target-pi', matchedPi);
            
            const btnText = document.getElementById('studyPiBtnText');
            if (btnText) {
                btnText.textContent = `ศึกษา PI Profile (${matchedPi}) ของคุณ`;
            }
        } else {
            container.style.display = 'none';
            container.removeAttribute('data-target-pi');
        }
    }

    // PI Study Button Click Event Listener
    const studyPiBtn = document.getElementById('studyPiBtn');
    if (studyPiBtn) {
        studyPiBtn.addEventListener('click', () => {
            const container = document.getElementById('studyPiBtnContainer');
            if (!container) return;
            
            const targetPi = container.getAttribute('data-target-pi');
            if (!targetPi) return;
            
            // 1. Close success overlay modal
            window.closeSuccess();
            
            // 2. Find matching card and its category filter
            const allCards = document.querySelectorAll('.pi-card');
            let targetCard = null;
            let category = null;
            
            allCards.forEach(card => {
                const titleEl = card.querySelector('.pi-name');
                if (titleEl && titleEl.textContent.trim().toLowerCase() === targetPi.toLowerCase()) {
                    targetCard = card;
                    category = card.getAttribute('data-category');
                }
            });
            
            if (targetCard) {
                // 3. Clear search filter first to avoid card being hidden
                const searchInput = document.getElementById('piSearchInput');
                const searchClear = document.getElementById('piSearchClear');
                if (searchInput) {
                    searchInput.value = '';
                }
                if (searchClear) {
                    searchClear.style.display = 'none';
                }

                // 4. Click the matching category filter button to make it visible
                if (category) {
                    const filterBtn = document.querySelector(`.pi-filter-btn[data-filter="${category}"]`);
                    if (filterBtn) {
                        filterBtn.click();
                    }
                }
                
                // 5. Smooth scroll, highlight, and auto-open details modal
                setTimeout(() => {
                    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    const cardInner = targetCard.querySelector('.pi-card-inner');
                    if (cardInner) {
                        cardInner.classList.add('highlight-flash');
                        setTimeout(() => {
                            cardInner.classList.remove('highlight-flash');
                        }, 2000);

                        // Auto-open modal after scroll finishes
                        setTimeout(() => {
                            if (typeof window.openPiModalForCard === 'function') {
                                window.openPiModalForCard(targetCard);
                            }
                        }, 600);
                    }
                }, 300);
            }
        });
    }

    // Initial Dropdown and Admin UI state loading
    if (typeof ATTENDEE_LIST !== 'undefined') {
        fetchLatestBookings().then(() => {
            updateAdminUI();
        });
    }
});
