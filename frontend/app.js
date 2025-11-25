// Krypticks - Main Application JavaScript

// Configuration
const API_BASE = window.location.origin;
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws/prices`;

// State management
let marketsData = [];
let globalData = {};
let fearGreedData = {};
let watchlist = JSON.parse(localStorage.getItem('watchlist') || '["bitcoin", "ethereum", "solana"]');
let selectedCoin = 'BTCUSD';

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeEventListeners();
    fetchInitialData();
    initializeWebSocket();
    initializeTradingViewWidget();
});

// Theme Management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

document.getElementById('themeToggle')?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Reinitialize TradingView widget with new theme
    initializeTradingViewWidget();
});

// Admin Configuration
const ADMIN_PASSWORD = "krypticks2025";
const ADMIN_SECRET_KEY = "krypticks_admin_access";

// Event Listeners
function initializeEventListeners() {
    // Admin Access: Ctrl+K shortcut
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openAdminModal();
        }
    });
    
    // Navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            
            const page = e.target.getAttribute('data-page');
            switchPage(page);
        });
    });

    // Time selector for chart
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const period = e.target.getAttribute('data-period');
            updateChartPeriod(period);
        });
    });

    // Market filter
    document.getElementById('marketFilter')?.addEventListener('change', (e) => {
        filterMarkets(e.target.value);
    });

    // Add to watchlist
    document.getElementById('addWatchlistBtn')?.addEventListener('click', () => {
        const coin = prompt('Enter coin ID (e.g., bitcoin, ethereum):');
        if (coin && !watchlist.includes(coin.toLowerCase())) {
            watchlist.push(coin.toLowerCase());
            localStorage.setItem('watchlist', JSON.stringify(watchlist));
            updateWatchlist();
        }
    });

    // Crypto payment buttons
    document.querySelectorAll('.crypto-pay-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const price = e.target.getAttribute('data-price');
            document.getElementById('paymentAmount').textContent = '$' + price;
            const modal = document.getElementById('cryptoPaymentModal');
            if (modal) modal.style.display = 'flex';
        });
    });
}

// Fetch initial data
async function fetchInitialData() {
    try {
        await Promise.all([
            fetchMarkets(),
            fetchGlobalMetrics(),
            fetchFearGreed()
        ]);
        
        updateUI();
    } catch (error) {
        console.error('Error fetching initial data:', error);
        showNotification('Unable to fetch market data. Using cached data.', 'warning');
    }
}

// API Calls
async function fetchMarkets() {
    try {
        const response = await fetch(`${API_BASE}/api/markets`);
        if (!response.ok) throw new Error('Failed to fetch markets');
        marketsData = await response.json();
        return marketsData;
    } catch (error) {
        console.error('Error fetching markets:', error);
        marketsData = [];
    }
}

async function fetchGlobalMetrics() {
    try {
        const response = await fetch(`${API_BASE}/api/global`);
        if (!response.ok) throw new Error('Failed to fetch global metrics');
        globalData = await response.json();
        return globalData;
    } catch (error) {
        console.error('Error fetching global metrics:', error);
        globalData = {};
    }
}

async function fetchFearGreed() {
    try {
        const response = await fetch(`${API_BASE}/api/fear-greed`);
        if (!response.ok) throw new Error('Failed to fetch fear & greed');
        fearGreedData = await response.json();
        return fearGreedData;
    } catch (error) {
        console.error('Error fetching fear & greed:', error);
        fearGreedData = {};
    }
}

// WebSocket for real-time updates
function initializeWebSocket() {
    let ws;
    let reconnectInterval = 5000;

    function connect() {
        try {
            ws = new WebSocket(WS_URL);

            ws.onopen = () => {
                console.log('WebSocket connected');
                reconnectInterval = 5000;
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'price_update' && data.data) {
                        marketsData = data.data;
                        updateUI();
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected. Reconnecting...');
                setTimeout(connect, reconnectInterval);
                reconnectInterval = Math.min(reconnectInterval * 1.5, 30000);
            };
        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            setTimeout(connect, reconnectInterval);
        }
    }

    connect();
}

// UI Update Functions
function updateUI() {
    updateGlobalMetrics();
    updateCoinGrid();
    updatePriceTable();
    updateWatchlist();
    updateAISignals();
}

function updateGlobalMetrics() {
    if (globalData.total_market_cap) {
        document.getElementById('totalMarketCap').textContent = formatCurrency(globalData.total_market_cap, 'compact');
        const change = globalData.market_cap_change_24h || 0;
        const changeEl = document.getElementById('marketCapChange');
        if (changeEl) {
            changeEl.textContent = formatPercent(change);
            changeEl.className = `metric-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    }

    if (globalData.btc_dominance) {
        document.getElementById('btcDominance').textContent = formatPercent(globalData.btc_dominance);
    }

    if (globalData.total_volume) {
        document.getElementById('totalVolume').textContent = formatCurrency(globalData.total_volume, 'compact');
    }

    if (fearGreedData.value) {
        document.getElementById('fearGreedValue').textContent = fearGreedData.value;
        const classification = fearGreedData.classification || 'Neutral';
        const labelEl = document.getElementById('fearGreedLabel');
        if (labelEl) {
            labelEl.textContent = classification;
            labelEl.className = `metric-badge ${classification.toLowerCase()}`;
        }
    }
}

function updateCoinGrid() {
    const grid = document.getElementById('coinGrid');
    if (!grid || !marketsData.length) return;

    const topCoins = marketsData.slice(0, 6);
    
    grid.innerHTML = topCoins.map(coin => `
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
            <div class="sparkline">
                ${generateSparklineSVG(coin.sparkline_in_7d?.price || [])}
            </div>
        </div>
    `).join('');

    // Add click listeners
    grid.querySelectorAll('.coin-card').forEach(card => {
        card.addEventListener('click', () => {
            const coinId = card.getAttribute('data-coin-id');
            selectCoin(coinId);
        });
    });
}

function updatePriceTable() {
    const tbody = document.getElementById('priceTableBody');
    if (!tbody || !marketsData.length) return;

    tbody.innerHTML = marketsData.slice(0, 20).map(coin => {
        const isWatchlisted = watchlist.includes(coin.id);
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
                <td>$${formatCurrency(coin.total_volume, 'compact')}</td>
                <td>$${formatCurrency(coin.market_cap, 'compact')}</td>
                <td>
                    <button class="star-btn ${isWatchlisted ? 'active' : ''}" data-coin-id="${coin.id}">
                        ${isWatchlisted ? '⭐' : '☆'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Add star button listeners
    tbody.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleWatchlist(btn.getAttribute('data-coin-id'));
        });
    });

    // Add row click listeners
    tbody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', () => {
            const coinId = row.getAttribute('data-coin-id');
            selectCoin(coinId);
        });
    });
}

function updateWatchlist() {
    const container = document.getElementById('watchlistItems');
    if (!container) return;

    const watchlistCoins = marketsData.filter(coin => watchlist.includes(coin.id));

    if (watchlistCoins.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 14px; text-align: center;">No coins in watchlist</p>';
        return;
    }

    container.innerHTML = watchlistCoins.map(coin => `
        <div class="watchlist-item" data-coin-id="${coin.id}">
            <div class="watchlist-coin">
                <img src="${coin.image}" alt="${coin.symbol}" class="coin-icon-sm" onerror="this.src='https://via.placeholder.com/32'">
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

    // Add click listeners
    container.querySelectorAll('.watchlist-item').forEach(item => {
        item.addEventListener('click', () => {
            const coinId = item.getAttribute('data-coin-id');
            selectCoin(coinId);
        });
    });
}

function updateAISignals() {
    const container = document.getElementById('signalCards');
    if (!container || !marketsData.length) return;

    // Generate AI signals based on market data
    const signals = marketsData.slice(0, 3).map(coin => {
        const change = coin.price_change_percentage_24h;
        let signal, reasons;

        if (change > 5) {
            signal = 'strong-buy';
            reasons = [
                '• Strong upward momentum',
                '• High trading volume',
                '• Bullish market sentiment'
            ];
        } else if (change > 2) {
            signal = 'buy';
            reasons = [
                '• Positive price action',
                '• Moderate volume increase',
                '• Market interest growing'
            ];
        } else if (change < -5) {
            signal = 'sell';
            reasons = [
                '• Downward trend detected',
                '• Decreasing volume',
                '• Bearish indicators'
            ];
        } else {
            signal = 'hold';
            reasons = [
                '• Consolidation phase',
                '• Neutral indicators',
                '• Await clearer signal'
            ];
        }

        return { coin, signal, reasons, change };
    });

    container.innerHTML = signals.map(({ coin, signal, reasons, change }) => {
        const rank = coin.market_cap_rank || 1;
        const coinName = coin.name.replace(/'/g, "\\'");
        return `
        <div class="signal-card-item">
            <div class="signal-header">
                <div class="signal-coin">
                    <img src="${coin.image}" alt="${coin.symbol}" class="coin-icon-sm" onerror="this.src='https://via.placeholder.com/32'">
                    <span>${coin.symbol.toUpperCase()}/USD</span>
                </div>
                <span class="signal-badge ${signal}">${signal.toUpperCase().replace('-', ' ')}</span>
            </div>
            <div class="signal-reasons">
                ${reasons.map(reason => `<div class="signal-reason">${reason}</div>`).join('')}
            </div>
            <button class="btn-primary btn-sm" onclick="showAnalysisModal('${coin.id}', '${coinName}', '${coin.symbol.toUpperCase()}', ${coin.current_price}, ${change}, ${rank})">View Analysis →</button>
        </div>
    `;
    }).join('');
}

// Helper Functions
function toggleWatchlist(coinId) {
    const index = watchlist.indexOf(coinId);
    if (index > -1) {
        watchlist.splice(index, 1);
    } else {
        watchlist.push(coinId);
    }
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    updateUI();
}

function selectCoin(coinId) {
    const coin = marketsData.find(c => c.id === coinId);
    if (coin) {
        selectedCoin = `${coin.symbol.toUpperCase()}USD`;
        initializeTradingViewWidget();
        showNotification(`Viewing ${coin.name} (${coin.symbol.toUpperCase()})`, 'info');
    }
}

function calculateRSI(prices) {
    if (!prices || prices.length < 2) return 50;
    
    let gains = 0, losses = 0;
    for (let i = 1; i < Math.min(prices.length, 15); i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function showAnalysisModal(coinId, coinName, symbol, price, change, rank) {
    const modal = document.getElementById('analysisModal');
    if (!modal) return;
    
    const coin = marketsData.find(c => c.id === coinId);
    if (!coin) return;
    
    // Calculate real metrics based on actual data
    const sparklineData = coin.sparkline_in_7d?.price || [];
    const rsi = calculateRSI(sparklineData);
    
    // Calculate momentum
    const momentum = (sparklineData.length > 1) ? 
        ((sparklineData[sparklineData.length - 1] - sparklineData[0]) / sparklineData[0] * 100) : change;
    
    // Determine momentum signal
    const momentumSignal = momentum > 2 ? 'Strong' : momentum > 0 ? 'Moderate' : 'Weak';
    const momentumDirection = momentum > 0 ? 'Bullish' : 'Bearish';
    
    // Calculate market strength
    const marketCap = coin.market_cap || 0;
    const volume = coin.total_volume || 0;
    const volumeToMarketCap = volume > 0 && marketCap > 0 ? ((volume / marketCap) * 100) : 0;
    
    // Determine RSI condition
    let rsiCondition = 'Neutral';
    if (rsi > 70) rsiCondition = 'Overbought';
    else if (rsi < 30) rsiCondition = 'Oversold';
    else if (rsi > 50) rsiCondition = 'Strong';
    else rsiCondition = 'Weak';
    
    // Calculate support/resistance based on 7d data
    const high7d = sparklineData.length > 0 ? Math.max(...sparklineData) : price;
    const low7d = sparklineData.length > 0 ? Math.min(...sparklineData) : price;
    const resistance = ((high7d - price) / price * 100).toFixed(2);
    const support = ((price - low7d) / price * 100).toFixed(2);
    
    // Detailed analysis text
    let analysis = '';
    if (change > 8) analysis = `Exceptional bullish strength! ${momentumSignal} ${momentumDirection} momentum with ${rsiCondition.toLowerCase()} RSI (${rsi.toFixed(1)}). Volume/MarketCap ratio of ${volumeToMarketCap.toFixed(1)}% indicates strong trading activity. Resistance at +${resistance}%, Support at -${support}%.`;
    else if (change > 3) analysis = `Positive momentum detected. ${momentumDirection} RSI at ${rsi.toFixed(1)} (${rsiCondition}). Volume activity at ${volumeToMarketCap.toFixed(1)}% of market cap. Watch for breakout above resistance at ${resistance}%.`;
    else if (change > 0) analysis = `Slight positive bias with ${rsiCondition.toLowerCase()} RSI (${rsi.toFixed(1)}). Consolidating near support at -${support}%. Moderate volume at ${volumeToMarketCap.toFixed(1)}% of cap.`;
    else if (change > -3) analysis = `Mild downward pressure. RSI ${rsiCondition.toLowerCase()} at ${rsi.toFixed(1)}. Price holding above ${support}% support level. Monitor for stabilization.`;
    else if (change > -8) analysis = `Bearish trend with ${rsiCondition.toLowerCase()} RSI (${rsi.toFixed(1)}). ${momentumDirection} momentum showing weakness. Support-seeking price action. Volume/cap ratio: ${volumeToMarketCap.toFixed(1)}%.`;
    else analysis = `Strong bearish pressure! Severe downtrend with ${rsiCondition.toLowerCase()} RSI. ${momentumDirection} momentum confirmed. Trading volume significant at ${volumeToMarketCap.toFixed(1)}% of market cap. Critical support at -${support}%.`;
    
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close" onclick="closeAnalysisModal()">×</button>
            <div class="modal-header">
                <img src="https://assets.coingecko.com/coins/images/${rank}/small/${coinId}.png" alt="${symbol}" class="modal-coin-icon" onerror="this.src='https://via.placeholder.com/48'">
                <h2>${coinName} (${symbol})</h2>
            </div>
            
            <div class="analysis-grid">
                <div class="analysis-metric">
                    <div class="metric-name">Current Price</div>
                    <div class="metric-value">$${formatNumber(price)}</div>
                </div>
                <div class="analysis-metric">
                    <div class="metric-name">24h Change</div>
                    <div class="metric-value ${change >= 0 ? 'positive' : 'negative'}">${change >= 0 ? '+' : ''}${formatPercent(change)}%</div>
                </div>
                <div class="analysis-metric">
                    <div class="metric-name">RSI (14)</div>
                    <div class="metric-value ${rsi > 70 ? 'positive' : rsi < 30 ? 'negative' : ''}">${rsi.toFixed(1)}</div>
                </div>
                <div class="analysis-metric">
                    <div class="metric-name">7d Momentum</div>
                    <div class="metric-value ${momentum >= 0 ? 'positive' : 'negative'}">${momentum >= 0 ? '+' : ''}${momentum.toFixed(2)}%</div>
                </div>
                <div class="analysis-metric">
                    <div class="metric-name">Volume/Cap</div>
                    <div class="metric-value">${volumeToMarketCap.toFixed(1)}%</div>
                </div>
                <div class="analysis-metric">
                    <div class="metric-name">Market Rank</div>
                    <div class="metric-value">#${rank}</div>
                </div>
            </div>
            
            <div class="analysis-section">
                <h3>📊 Technical Analysis</h3>
                <p><strong>Status:</strong> ${rsiCondition} | ${momentumDirection} Trend | 7d Range: $${formatNumber(low7d)} - $${formatNumber(high7d)}</p>
                <p style="margin-top: 8px;">${analysis}</p>
            </div>
            
            <div class="analysis-section">
                <h3>💡 Key Levels</h3>
                <p>Resistance: $${formatNumber(high7d)} (+${resistance}%) | Support: $${formatNumber(low7d)} (-${support}%)</p>
            </div>
            
            <div class="analysis-actions">
                <button class="btn-primary" onclick="selectCoin('${coinId}'); closeAnalysisModal();">View Chart</button>
                <button class="btn-secondary" onclick="closeAnalysisModal()">Close</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

function closeAnalysisModal() {
    const modal = document.getElementById('analysisModal');
    if (modal) modal.style.display = 'none';
}

function filterMarkets(filter) {
    console.log('Filtering by:', filter);
}

function updateChartPeriod(period) {
    console.log('Updating chart period:', period);
    initializeTradingViewWidget(period);
}

function generateSparklineSVG(prices) {
    if (!prices || prices.length === 0) {
        return '<svg class="sparkline-svg"></svg>';
    }

    const width = 280;
    const height = 50;
    const padding = 5;
    
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    const range = max - min || 1;
    
    const points = prices.map((price, i) => {
        const x = (i / (prices.length - 1)) * (width - 2 * padding) + padding;
        const y = height - padding - ((price - min) / range) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');

    const isPositive = prices[prices.length - 1] >= prices[0];
    const strokeColor = isPositive ? 'var(--success)' : 'var(--danger)';

    return `
        <svg class="sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <polyline points="${points}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
}

// Utility Functions
function formatNumber(num) {
    if (num >= 1) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
        return num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
    }
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

function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// TradingView Widget
function initializeTradingViewWidget(period = '24H') {
    const container = document.getElementById('tradingview_widget');
    if (!container) return;

    const periodMap = {
        '1H': '60',
        '24H': '240',
        '7D': 'D',
        '1M': 'W',
        '1Y': 'M'
    };

    const tradingViewPeriod = periodMap[period] || '240';

    container.innerHTML = `
        <iframe src="https://s.tradingview.com/chart/${selectedCoin}/?symbol=${selectedCoin}&interval=${tradingViewPeriod}&theme=${document.documentElement.getAttribute('data-theme')}" 
            style="width: 100%; height: 100%; border: none; border-radius: 12px;" 
            allow="clipboard-write" allowFullScreen></iframe>
    `;
}

// Page Navigation
function switchPage(page) {
    // Hide all sections
    document.getElementById('vipLoginSection').style.display = 'none';
    document.getElementById('vipDashboardSection').style.display = 'none';
    document.getElementById('vipSection').style.display = 'none';

    if (page === 'dashboard') {
        document.querySelectorAll('.hero-section, .metrics-section, .market-overview, .two-column-layout, .chart-section').forEach(el => {
            el.style.display = 'block';
        });
    } else if (page === 'markets') {
        document.querySelector('.market-overview').style.display = 'block';
        document.querySelector('.two-column-layout').style.display = 'grid';
    } else if (page === 'signals') {
        document.querySelector('.ai-signal-panel')?.parentElement.style.display = 'block';
    } else if (page === 'vip') {
        if (isAdminAccessActive()) {
            document.getElementById('vipDashboardSection').style.display = 'block';
            loadVIPDashboard();
        } else {
            document.getElementById('vipSection').style.display = 'block';
        }
    }
}

// VIP Functions
function handleVIPLogin(event) {
    event.preventDefault();
    const email = document.getElementById('vipEmail').value;
    localStorage.setItem('vipUserEmail', email);
    localStorage.setItem('vipUser', 'true');
    
    document.getElementById('vipLoginSection').style.display = 'none';
    document.getElementById('vipDashboardSection').style.display = 'block';
    document.getElementById('userEmail').textContent = `Logged in as: ${email}`;
    
    loadVIPDashboard();
}

function logoutVIP() {
    localStorage.removeItem('vipUser');
    localStorage.removeItem('vipUserEmail');
    
    document.getElementById('vipDashboardSection').style.display = 'none';
    document.getElementById('vipSection').style.display = 'block';
}

function loadVIPDashboard() {
    const container = document.getElementById('premiumSignalsContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="premium-signal">
            <h4>BTC/USD - STRONG BUY</h4>
            <p>RSI: 28 (Oversold) | Volume: +45%</p>
            <p>Target: $45,200 | Stop: $42,800</p>
        </div>
        <div class="premium-signal">
            <h4>ETH/USD - BUY</h4>
            <p>MACD Crossover | Support: $2,400</p>
            <p>Target: $2,650 | Stop: $2,350</p>
        </div>
    `;
}

// Admin Functions
function openAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('adminPassword').focus();
        document.getElementById('adminPassword').value = '';
    }
}

function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('adminPassword').value = '';
    }
}

function verifyAdminPassword() {
    const inputPassword = document.getElementById('adminPassword').value;
    
    if (inputPassword === ADMIN_PASSWORD) {
        localStorage.setItem(ADMIN_SECRET_KEY, 'true');
        localStorage.setItem('vipUserEmail', 'admin@krypticks.io');
        showNotification('✅ Admin access granted! Preview: You see exactly what your VIP users see.', 'success');
        closeAdminModal();
        switchPage('vip');
    } else {
        showNotification('❌ Incorrect admin password', 'error');
        document.getElementById('adminPassword').value = '';
    }
}

function isAdminAccessActive() {
    return localStorage.getItem(ADMIN_SECRET_KEY) === 'true';
}

// Forex Education Data
const forexData = {
    eur_usd: {
        title: 'EUR/USD Analysis',
        content: 'EUR/USD is showing strong technical setup with breakout potential.\n\nKey Levels:\n• Resistance: 1.0850\n• Current: 1.0800\n• Support: 1.0750\n\nStrategy: Wait for confirmation above 1.0850 for bullish continuation. Entry after breakout with stop loss below 1.0800.\n\nRisk/Reward: 1:2.5 minimum'
    },
    gbp_usd: {
        title: 'GBP/USD Trends',
        content: 'GBP/USD is in a recovery phase after recent pullback.\n\nKey Levels:\n• Resistance: 1.2650\n• Current: 1.2600\n• Support: 1.2550\n\nStrategy: Bullish bias on break above 1.2650. Confirmation with volume increase and RSI above 50. Potential targets: 1.2700-1.2750.\n\nStop loss at 1.2550'
    },
    risk_management: {
        title: 'Risk Management Guide',
        content: 'Professional Risk Management Rules:\n\n1. Position Sizing: Risk only 1-2% per trade\n2. Stop Loss: Always place below support/above resistance\n3. Profit Targets: Use 1:3 or better risk/reward ratios\n4. Maximum Risk Per Day: Don\'t risk more than 5% of account\n5. Entry Confirmation: Wait for 2+ indicators alignment\n6. Exit Strategy: Scale out at resistance levels\n\nExample: $10,000 account → Risk $100-200 per trade\nIf stop loss is 50 pips, each pip = $2, so position = 1 micro lot'
    }
};

// Forex Education Modal Functions
function showForexDetails(key) {
    const modal = document.getElementById('forexModal');
    const titleEl = document.getElementById('forexTitle');
    const contentEl = document.getElementById('forexContent');
    
    const data = forexData[key];
    if (data && modal && titleEl && contentEl) {
        titleEl.textContent = data.title;
        contentEl.textContent = data.content;
        modal.style.display = 'flex';
    }
}

function closeForexModal() {
    const modal = document.getElementById('forexModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Crypto Payment Functions
function showCryptoAddress(crypto) {
    const addresses = {
        'bitcoin': 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        'ethereum': '0x1234567890123456789012345678901234567890',
        'usdt': '0xdac17f958d2ee523a2206206994597c13d831ec7',
        'bnb': 'bnb1grpf0955h0ykzq3ar5nmum2tjjxwgdanp3fsn5'
    };

    const address = addresses[crypto];
    if (address) {
        document.getElementById('paymentAddress').value = address;
        document.querySelector('.crypto-options').style.display = 'none';
        document.getElementById('addressDisplay').style.display = 'block';
    }
}

function copyAddress() {
    const input = document.getElementById('paymentAddress');
    input.select();
    document.execCommand('copy');
    showNotification('Address copied to clipboard!', 'info');
}

function closeCryptoModal() {
    document.getElementById('cryptoPaymentModal').style.display = 'none';
    document.querySelector('.crypto-options').style.display = 'grid';
    document.getElementById('addressDisplay').style.display = 'none';
}

// Auto-refresh data every 60 seconds
setInterval(() => {
    fetchGlobalMetrics();
    fetchFearGreed();
}, 60000);
