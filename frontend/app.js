// Krypticks - Main Application JavaScript
const API_BASE = window.location.origin;
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws/prices`;

let marketsData = [];
let globalData = {};
let fearGreedData = {};
let watchlist = JSON.parse(localStorage.getItem('watchlist') || '["bitcoin", "ethereum", "solana"]');
let selectedCoin = 'BTCUSD';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('✓ Page loaded, initializing...');
    initializeTheme();
    attachEventListeners();
    loadAllData();
    initializeWebSocket();
    initializeTradingViewWidget();
    initializeVIPPayment();
    checkVIPLogin();
});

// Theme Management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const newTheme = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            initializeTradingViewWidget();
        });
    }
}

// Admin Setup
const ADMIN_PASSWORD = "krypticks2025";
const ADMIN_SECRET_KEY = "krypticks_admin_access";

function attachEventListeners() {
    console.log('✓ Attaching event listeners...');
    
    // Admin hotkey
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openAdminModal();
        }
    });
    
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            console.log('✓ Navigation clicked:', page);
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            switchPage(page);
        });
    });
    
    // Chart time buttons
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const period = e.target.getAttribute('data-period');
            updateChartPeriod(period);
        });
    });
    
    // Market filter
    const filter = document.getElementById('marketFilter');
    if (filter) filter.addEventListener('change', (e) => filterMarkets(e.target.value));
    
    // Add watchlist button
    const addBtn = document.getElementById('addWatchlistBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const coin = prompt('Enter coin ID (e.g., bitcoin, ethereum):');
            if (coin && !watchlist.includes(coin.toLowerCase())) {
                watchlist.push(coin.toLowerCase());
                localStorage.setItem('watchlist', JSON.stringify(watchlist));
                updateWatchlist();
            }
        });
    }
    
    // Crypto payment buttons
    document.querySelectorAll('.crypto-pay-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const price = e.target.getAttribute('data-price');
            const modal = document.getElementById('cryptoPaymentModal');
            const amount = document.getElementById('paymentAmount');
            if (amount) amount.textContent = '$' + price;
            if (modal) modal.style.display = 'flex';
        });
    });
}

// Data Loading
async function loadAllData() {
    console.log('✓ Loading market data...');
    try {
        const [markets, global, fearGreed] = await Promise.all([
            fetch(`${API_BASE}/api/markets`).then(r => r.json()),
            fetch(`${API_BASE}/api/global`).then(r => r.json()),
            fetch(`${API_BASE}/api/fear-greed`).then(r => r.json())
        ]);
        
        if (markets) marketsData = markets;
        if (global) globalData = global;
        if (fearGreed) fearGreedData = fearGreed;
        
        renderAllUI();
    } catch (error) {
        console.error('✗ Failed to load data:', error);
    }
}

function renderAllUI() {
    console.log('✓ Rendering UI...');
    renderMetrics();
    renderCoinGrid();
    renderPriceTable();
    renderWatchlist();
    renderSignals();
}

// Render Functions
function renderMetrics() {
    if (globalData.total_market_cap) {
        const cap = document.getElementById('totalMarketCap');
        if (cap) cap.textContent = formatCurrency(globalData.total_market_cap, 'compact');
    }
    
    if (globalData.market_cap_change_24h !== undefined) {
        const change = document.getElementById('marketCapChange');
        if (change) {
            change.textContent = formatPercent(globalData.market_cap_change_24h);
            change.className = `metric-change ${globalData.market_cap_change_24h >= 0 ? 'positive' : 'negative'}`;
        }
    }
    
    if (globalData.btc_dominance) {
        const btc = document.getElementById('btcDominance');
        if (btc) btc.textContent = formatPercent(globalData.btc_dominance);
    }
    
    if (globalData.total_volume) {
        const vol = document.getElementById('totalVolume');
        if (vol) vol.textContent = formatCurrency(globalData.total_volume, 'compact');
    }
    
    if (fearGreedData.value) {
        const val = document.getElementById('fearGreedValue');
        if (val) val.textContent = fearGreedData.value;
        
        const label = document.getElementById('fearGreedLabel');
        if (label) {
            const classification = fearGreedData.classification || 'Neutral';
            label.textContent = classification;
            label.className = `metric-badge ${classification.toLowerCase()}`;
        }
    }
}

function renderCoinGrid() {
    const grid = document.getElementById('coinGrid');
    if (!grid || !marketsData.length) return;
    
    grid.innerHTML = marketsData.slice(0, 6).map(coin => `
        <div class="coin-card" data-coin-id="${coin.id}">
            <div class="coin-header">
                <img src="${coin.image}" alt="${coin.symbol}" class="coin-icon" onerror="this.src='https://via.placeholder.com/40'">
                <div class="coin-info">
                    <div class="coin-symbol">${coin.symbol.toUpperCase()}</div>
                    <div class="coin-name">${coin.name}</div>
                </div>
            </div>
            <div class="coin-price">$${formatNumber(coin.current_price)}</div>
            <div class="coin-change ${coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}">
                ${coin.price_change_percentage_24h >= 0 ? '↑' : '↓'} ${formatPercent(Math.abs(coin.price_change_percentage_24h))}
            </div>
            <div class="sparkline">${generateSparkline(coin.sparkline_in_7d?.price || [])}</div>
        </div>
    `).join('');
    
    grid.querySelectorAll('.coin-card').forEach(card => {
        card.addEventListener('click', () => selectCoin(card.getAttribute('data-coin-id')));
    });
}

function renderPriceTable() {
    const tbody = document.getElementById('priceTableBody');
    if (!tbody || !marketsData.length) return;
    
    tbody.innerHTML = marketsData.slice(0, 20).map(coin => {
        const isWatched = watchlist.includes(coin.id);
        return `
            <tr data-coin-id="${coin.id}">
                <td>
                    <div class="coin-cell">
                        <img src="${coin.image}" alt="${coin.symbol}" class="coin-icon-sm" onerror="this.src='https://via.placeholder.com/32'">
                        <div class="coin-name-cell">
                            <div class="coin-symbol-cell">${coin.symbol.toUpperCase()}</div>
                            <div class="coin-name-sub">${coin.name}</div>
                        </div>
                    </div>
                </td>
                <td>$${formatNumber(coin.current_price)}</td>
                <td class="${coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}">
                    ${coin.price_change_percentage_24h >= 0 ? '↑' : '↓'} ${formatPercent(Math.abs(coin.price_change_percentage_24h))}
                </td>
                <td>$${formatCurrency(coin.total_volume || 0, 'compact')}</td>
                <td>$${formatCurrency(coin.market_cap || 0, 'compact')}</td>
                <td>
                    <button class="star-btn ${isWatched ? 'active' : ''}" data-coin-id="${coin.id}">
                        ${isWatched ? '⭐' : '☆'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleWatchlist(btn.getAttribute('data-coin-id'));
        });
    });
    
    tbody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', () => selectCoin(row.getAttribute('data-coin-id')));
    });
}

function renderWatchlist() {
    const container = document.getElementById('watchlistItems');
    if (!container) return;
    
    const watched = marketsData.filter(c => watchlist.includes(c.id));
    
    if (!watched.length) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No coins in watchlist</p>';
        return;
    }
    
    container.innerHTML = watched.map(coin => `
        <div class="watchlist-item" data-coin-id="${coin.id}">
            <div class="watchlist-coin">
                <img src="${coin.image}" alt="${coin.symbol}" class="coin-icon-sm">
                <div>
                    <div class="coin-symbol-cell">${coin.symbol.toUpperCase()}</div>
                    <div class="watchlist-price">$${formatNumber(coin.current_price)}</div>
                </div>
            </div>
            <div class="watchlist-change ${coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}">
                ${coin.price_change_percentage_24h >= 0 ? '↑' : '↓'}${formatPercent(Math.abs(coin.price_change_percentage_24h))}
            </div>
        </div>
    `).join('');
    
    container.querySelectorAll('.watchlist-item').forEach(item => {
        item.addEventListener('click', () => selectCoin(item.getAttribute('data-coin-id')));
    });
}

function renderSignals() {
    const container = document.getElementById('signalCards');
    if (!container || !marketsData.length) return;
    
    container.innerHTML = marketsData.slice(0, 3).map(coin => {
        const change = coin.price_change_percentage_24h;
        let signal, color;
        
        if (change > 5) { signal = 'STRONG BUY'; color = 'strong-buy'; }
        else if (change > 2) { signal = 'BUY'; color = 'buy'; }
        else if (change < -5) { signal = 'SELL'; color = 'sell'; }
        else { signal = 'HOLD'; color = 'hold'; }
        
        return `
            <div class="signal-card-item">
                <div class="signal-header">
                    <div class="signal-coin">
                        <img src="${coin.image}" alt="${coin.symbol}" class="coin-icon-sm">
                        <span>${coin.symbol.toUpperCase()}/USD</span>
                    </div>
                    <span class="signal-badge ${color}">${signal}</span>
                </div>
                <div class="signal-reasons">
                    <div class="signal-reason">• Price Change: ${change > 0 ? '+' : ''}${change.toFixed(2)}%</div>
                    <div class="signal-reason">• Volume: ${formatCurrency(coin.total_volume || 0, 'compact')}</div>
                    <div class="signal-reason">• Market Cap: ${formatCurrency(coin.market_cap || 0, 'compact')}</div>
                </div>
                <button class="btn-primary btn-sm" onclick="selectCoin('${coin.id}')">View Chart →</button>
            </div>
        `;
    }).join('');
}

// Helpers
function toggleWatchlist(coinId) {
    const idx = watchlist.indexOf(coinId);
    if (idx > -1) watchlist.splice(idx, 1);
    else watchlist.push(coinId);
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    renderPriceTable();
    renderWatchlist();
}

function selectCoin(coinId) {
    const coin = marketsData.find(c => c.id === coinId);
    if (coin) {
        selectedCoin = `${coin.symbol.toUpperCase()}USD`;
        initializeTradingViewWidget();
    }
}

function generateSparkline(prices) {
    if (!prices || !prices.length) return '<svg class="sparkline-svg"></svg>';
    
    const width = 280, height = 50, padding = 5;
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    const range = max - min || 1;
    
    const points = prices.map((p, i) => {
        const x = (i / (prices.length - 1)) * (width - 2 * padding) + padding;
        const y = height - padding - ((p - min) / range) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');
    
    const color = prices[prices.length - 1] >= prices[0] ? 'var(--success)' : 'var(--danger)';
    
    return `
        <svg class="sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
}

function formatNumber(num) {
    if (num >= 1) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
}

function formatCurrency(num, format = 'full') {
    if (!num) return '$0';
    if (format === 'compact') {
        if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return '$' + (num / 1e3).toFixed(2) + 'K';
    }
    return '$' + formatNumber(num);
}

function formatPercent(num) {
    return (Math.abs(num) >= 0.01 ? num.toFixed(2) : num.toFixed(4)) + '%';
}

// WebSocket
function initializeWebSocket() {
    let reconnectInterval = 5000;
    
    function connect() {
        try {
            const ws = new WebSocket(WS_URL);
            
            ws.onopen = () => {
                console.log('✓ WebSocket connected');
                reconnectInterval = 5000;
            };
            
            ws.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data.type === 'price_update' && data.data) {
                        marketsData = data.data;
                        renderAllUI();
                    }
                } catch (err) {
                    console.error('✗ WebSocket parse error:', err);
                }
            };
            
            ws.onerror = (e) => console.error('✗ WebSocket error:', e);
            ws.onclose = () => {
                console.log('⚠ WebSocket closed, reconnecting...');
                setTimeout(connect, reconnectInterval);
                reconnectInterval = Math.min(reconnectInterval * 1.5, 30000);
            };
        } catch (error) {
            console.error('✗ WebSocket connection failed:', error);
            setTimeout(connect, reconnectInterval);
        }
    }
    
    connect();
}

// TradingView Widget - Using CoinGecko Chart Images
function initializeTradingViewWidget(period = '24H') {
    const container = document.getElementById('tradingview_widget');
    if (!container) {
        console.log('⚠ TradingView widget container not found');
        return;
    }
    
    // Extract coin ID from selected coin symbol
    const coin = marketsData.find(c => `${c.symbol.toUpperCase()}USD` === selectedCoin);
    if (!coin) {
        container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);">Select a coin to view chart</div>';
        return;
    }
    
    const coinId = coin.id;
    const daysMap = { '1H': '1', '24H': '1', '7D': '7', '1M': '30', '1Y': '365' };
    const days = daysMap[period] || '1';
    
    console.log('✓ Loading chart for:', coinId, 'Period:', period);
    
    // Use CoinGecko's chart image URL (public API)
    container.innerHTML = `
        <img 
            src="https://www.coingecko.com/coins/${coinId}/sparkline.svg?days=${days}" 
            alt="${coinId} chart"
            style="width: 100%; height: 100%; object-fit: contain; display: block; border-radius: 12px;"
            onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted)\\'>Chart loading...</div>'">
    `;
}

function updateChartPeriod(period) {
    initializeTradingViewWidget(period);
}

function filterMarkets(filter) {
    console.log('Filtering by:', filter);
}

// Page Navigation
function switchPage(page) {
    console.log('Switching to page:', page);
    
    // Hide all main sections
    const dashboard = document.getElementById('dashboardSection');
    const markets = document.getElementById('marketsSection');
    const signals = document.getElementById('signalsSection');
    const vipSection = document.getElementById('vipSection');
    const vipDash = document.getElementById('vipDashboardSection');
    
    if (dashboard) dashboard.style.display = 'none';
    if (markets) markets.style.display = 'none';
    if (signals) signals.style.display = 'none';
    if (vipSection) vipSection.style.display = 'none';
    if (vipDash) vipDash.style.display = 'none';
    
    // Show selected page
    if (page === 'dashboard') {
        if (dashboard) dashboard.style.display = 'block';
    } else if (page === 'markets') {
        if (markets) markets.style.display = 'block';
    } else if (page === 'signals') {
        if (signals) signals.style.display = 'block';
        renderSignalsPage();
    } else if (page === 'vip') {
        // Check if user is admin or already logged in
        const isAdmin = isAdminAccessActive();
        const isLoggedIn = localStorage.getItem('vipLoggedIn') === 'true';
        
        if (isAdmin || isLoggedIn) {
            // Show dashboard
            if (vipDash) vipDash.style.display = 'block';
            loadVIPDashboard();
        } else {
            // Show subscription page
            if (vipSection) vipSection.style.display = 'block';
        }
    }
}

function renderSignalsPage() {
    const container = document.getElementById('signalCardsPage');
    if (!container || !marketsData.length) return;
    
    container.innerHTML = marketsData.slice(0, 9).map(coin => {
        const change = coin.price_change_percentage_24h;
        let signal, color;
        
        if (change > 5) { signal = 'STRONG BUY'; color = 'strong-buy'; }
        else if (change > 2) { signal = 'BUY'; color = 'buy'; }
        else if (change < -5) { signal = 'SELL'; color = 'sell'; }
        else { signal = 'HOLD'; color = 'hold'; }
        
        return `
            <div class="signal-card-item">
                <div class="signal-header">
                    <div class="signal-coin">
                        <img src="${coin.image}" alt="${coin.symbol}" class="coin-icon-sm">
                        <span>${coin.symbol.toUpperCase()}/USD</span>
                    </div>
                    <span class="signal-badge ${color}">${signal}</span>
                </div>
                <div class="signal-reasons">
                    <div class="signal-reason">• Price Change: ${change > 0 ? '+' : ''}${change.toFixed(2)}%</div>
                    <div class="signal-reason">• Volume: ${formatCurrency(coin.total_volume || 0, 'compact')}</div>
                    <div class="signal-reason">• Market Cap: ${formatCurrency(coin.market_cap || 0, 'compact')}</div>
                </div>
                <button class="btn-primary btn-sm" onclick="selectCoin('${coin.id}')">View Chart →</button>
            </div>
        `;
    }).join('');
}

function loadVIPDashboard() {
    const container = document.getElementById('premiumSignalsContainer');
    if (!container) return;
    container.innerHTML = '<div style="padding: 20px; text-align: center;">Loading premium signals...</div>';
}

// Admin
function openAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) modal.style.display = 'flex';
}

function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) modal.style.display = 'none';
}

function verifyAdminPassword() {
    const input = document.getElementById('adminPassword');
    if (!input) return;
    
    if (input.value === ADMIN_PASSWORD) {
        localStorage.setItem(ADMIN_SECRET_KEY, 'true');
        closeAdminModal();
        switchPage('vip');
    } else {
        alert('Incorrect password');
    }
}

function isAdminAccessActive() {
    return localStorage.getItem(ADMIN_SECRET_KEY) === 'true';
}

// Forex Education
const forexData = {
    eur_usd: {
        title: 'EUR/USD Analysis',
        content: 'EUR/USD is showing strong technical setup with breakout potential.\n\nKey Levels:\n• Resistance: 1.0850\n• Current: 1.0800\n• Support: 1.0750'
    },
    gbp_usd: {
        title: 'GBP/USD Trends',
        content: 'GBP/USD is in a recovery phase after recent pullback.\n\nKey Levels:\n• Resistance: 1.2650\n• Current: 1.2600\n• Support: 1.2550'
    },
    risk_management: {
        title: 'Risk Management Guide',
        content: 'Professional Risk Management Rules:\n\n1. Position Sizing: Risk only 1-2% per trade\n2. Stop Loss: Always place below support/above resistance\n3. Profit Targets: Use 1:3 or better risk/reward ratios'
    }
};

function showForexDetails(key) {
    const modal = document.getElementById('forexModal');
    if (!modal) return;
    const data = forexData[key];
    if (!data) return;
    
    const titleEl = document.getElementById('forexTitle');
    const contentEl = document.getElementById('forexContent');
    if (titleEl) titleEl.textContent = data.title;
    if (contentEl) contentEl.textContent = data.content;
    
    modal.style.display = 'flex';
}

function closeForexModal() {
    const modal = document.getElementById('forexModal');
    if (modal) modal.style.display = 'none';
}

// Crypto Payments
function showCryptoAddress(crypto) {
    const addresses = {
        'bitcoin': 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        'ethereum': '0x1234567890123456789012345678901234567890',
        'usdt': '0xdac17f958d2ee523a2206206994597c13d831ec7',
        'bnb': 'bnb1grpf0955h0ykzq3ar5nmum2tjjxwgdanp3fsn5'
    };
    
    const address = addresses[crypto];
    if (address) {
        const input = document.getElementById('paymentAddress');
        if (input) input.value = address;
        const opts = document.querySelector('.crypto-options');
        if (opts) opts.style.display = 'none';
        const disp = document.getElementById('addressDisplay');
        if (disp) disp.style.display = 'block';
    }
}

function copyAddress() {
    const input = document.getElementById('paymentAddress');
    if (input) {
        input.select();
        document.execCommand('copy');
        alert('Address copied!');
    }
}

function closeCryptoModal() {
    const modal = document.getElementById('cryptoPaymentModal');
    if (modal) modal.style.display = 'none';
    const opts = document.querySelector('.crypto-options');
    if (opts) opts.style.display = 'grid';
    const disp = document.getElementById('addressDisplay');
    if (disp) disp.style.display = 'none';
}

// VIP Payment System
function openCryptoModal(plan, price) {
    const modal = document.getElementById('cryptoPaymentModal');
    if (modal) {
        modal.style.display = 'flex';
        const amountEl = document.getElementById('paymentAmount');
        if (amountEl) amountEl.textContent = `$${price}`;
        
        // Store current plan info
        modal.dataset.plan = plan;
        modal.dataset.price = price;
    }
}

// VIP Login & Dashboard
function handleVIPLogin(event) {
    event.preventDefault();
    const emailInput = document.getElementById('vipEmail');
    if (!emailInput) return;
    
    const email = emailInput.value.trim();
    if (!email) {
        alert('Please enter your email');
        return;
    }
    
    console.log('✓ VIP Login attempt:', email);
    
    // Store email and switch to dashboard
    localStorage.setItem('vipEmail', email);
    localStorage.setItem('vipLoggedIn', 'true');
    
    // Switch to VIP dashboard
    const loginSection = document.getElementById('vipLoginSection');
    const dashSection = document.getElementById('vipDashboardSection');
    if (loginSection) loginSection.style.display = 'none';
    if (dashSection) dashSection.style.display = 'block';
    
    // Update user email display
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = `Logged in as: ${email}`;
    
    // Load VIP signals
    loadVIPDashboard();
}

function logoutVIP() {
    console.log('✓ VIP Logout');
    localStorage.removeItem('vipEmail');
    localStorage.removeItem('vipLoggedIn');
    
    const loginSection = document.getElementById('vipLoginSection');
    const dashSection = document.getElementById('vipDashboardSection');
    if (loginSection) loginSection.style.display = 'block';
    if (dashSection) dashSection.style.display = 'none';
    
    // Clear form
    const emailInput = document.getElementById('vipEmail');
    if (emailInput) emailInput.value = '';
}

function loadVIPDashboard() {
    const container = document.getElementById('premiumSignalsContainer');
    if (!container) return;
    
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted);">Loading premium signals...</div>';
    
    // Fetch VIP signals from API
    fetch(`${API_BASE}/api/vip/signals`)
        .then(res => res.json())
        .then(data => {
            if (!data.success || !data.signals) {
                container.innerHTML = '<div style="padding: 20px; color: red;">Failed to load signals</div>';
                return;
            }
            
            console.log('✓ Loaded', data.signals.length, 'VIP signals');
            
            // Render premium signals
            container.innerHTML = data.signals.slice(0, 8).map(signal => `
                <div class="vip-signal-card">
                    <div class="vip-signal-header">
                        <div class="vip-signal-coin">
                            <strong>${signal.symbol}</strong>
                            <span class="signal-pair">${signal.pair}</span>
                        </div>
                        <span class="vip-signal-badge" style="background: ${
                            signal.signal === 'STRONG BUY' ? '#10b981' : 
                            signal.signal === 'BUY' ? '#3b82f6' :
                            signal.signal === 'SELL' ? '#ef4444' :
                            signal.signal === 'STRONG SELL' ? '#991b1b' :
                            '#f59e0b'
                        };">${signal.signal}</span>
                    </div>
                    
                    <div class="vip-signal-price">
                        <div>Price: <strong>$${signal.current_price.toFixed(2)}</strong></div>
                        <div>24h Change: <span style="color: ${signal.price_24h_change >= 0 ? '#10b981' : '#ef4444'}">${signal.price_24h_change > 0 ? '+' : ''}${signal.price_24h_change.toFixed(2)}%</span></div>
                    </div>
                    
                    <div class="vip-signal-analysis">
                        <div>RSI: ${signal.rsi.toFixed(1)}</div>
                        <div>Volume Trend: ${signal.volume_trend}</div>
                        <div>Confidence: ${signal.confidence}%</div>
                    </div>
                    
                    <div class="vip-signal-levels">
                        <div>🎯 Target: $${signal.target_price.toFixed(2)}</div>
                        <div>🛑 Stop Loss: $${signal.stop_loss.toFixed(2)}</div>
                        <div>📊 Risk/Reward: ${signal.risk_reward_ratio.toFixed(2)}</div>
                    </div>
                    
                    <div class="vip-signal-analysis-text">${signal.analysis}</div>
                    <div style="margin-top: 10px; font-size: 12px; color: var(--text-muted);">
                        Win Rate: ${signal.win_rate}% | Accuracy: ${signal.accuracy_score}%
                    </div>
                </div>
            `).join('');
        })
        .catch(err => {
            console.error('Error loading VIP signals:', err);
            container.innerHTML = '<div style="padding: 20px; color: red;">Error loading signals</div>';
        });
}

function handleCryptoPayment(event) {
    const btn = event.target.closest('.crypto-pay-btn');
    if (!btn) return;
    
    const plan = btn.getAttribute('data-plan');
    const price = btn.getAttribute('data-price');
    
    console.log('✓ Opening crypto payment for:', plan, `($${price})`);
    openCryptoModal(plan, price);
}

// Initialize VIP payment buttons
function initializeVIPPayment() {
    document.querySelectorAll('.crypto-pay-btn').forEach(btn => {
        btn.addEventListener('click', handleCryptoPayment);
    });
}

// Check if VIP user is already logged in
function checkVIPLogin() {
    const isLoggedIn = localStorage.getItem('vipLoggedIn') === 'true';
    const email = localStorage.getItem('vipEmail');
    
    if (isLoggedIn && email) {
        const loginSection = document.getElementById('vipLoginSection');
        const dashSection = document.getElementById('vipDashboardSection');
        if (loginSection) loginSection.style.display = 'none';
        if (dashSection) dashSection.style.display = 'block';
        
        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = `Logged in as: ${email}`;
        
        loadVIPDashboard();
    }
}

// Auto-refresh
setInterval(() => {
    loadAllData();
}, 60000);
