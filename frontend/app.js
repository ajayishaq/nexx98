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
    initializeTradingViewWidget();
});

// Event Listeners
function initializeEventListeners() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            const page = e.target.getAttribute('data-page');
            switchPage(page);
        });
    });

    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const period = e.target.getAttribute('data-period');
            updateChartPeriod(period);
        });
    });

    document.getElementById('marketFilter')?.addEventListener('change', (e) => {
        filterMarkets(e.target.value);
    });

    document.getElementById('addWatchlistBtn')?.addEventListener('click', () => {
        const coin = prompt('Enter coin ID (e.g., bitcoin, ethereum):');
        if (coin && !watchlist.includes(coin.toLowerCase())) {
            watchlist.push(coin.toLowerCase());
            localStorage.setItem('watchlist', JSON.stringify(watchlist));
            updateWatchlist();
        }
    });
}

// Fetch initial data
async function fetchInitialData() {
    try {
        await Promise.all([fetchMarkets(), fetchGlobalMetrics(), fetchFearGreed()]);
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

    tbody.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleWatchlist(btn.getAttribute('data-coin-id'));
        });
    });

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

    const signals = marketsData.slice(0, 3).map(coin => {
        const change = coin.price_change_percentage_24h;
        let signal, reasons;

        if (change > 5) {
            signal = 'strong-buy';
            reasons = ['• Strong upward momentum', '• High trading volume', '• Bullish market sentiment'];
        } else if (change > 2) {
            signal = 'buy';
            reasons = ['• Positive price action', '• Moderate volume increase', '• Market interest growing'];
        } else if (change < -5) {
            signal = 'sell';
            reasons = ['• Downward trend detected', '• Decreasing volume', '• Bearish indicators'];
        } else {
            signal = 'hold';
            reasons = ['• Consolidation phase', '• Neutral indicators', '• Await clearer signal'];
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
    
    const sparklineData = coin.sparkline_in_7d?.price || [];
    const rsi = calculateRSI(sparklineData);
    
    const momentum = (sparklineData.length > 1) ? 
        ((sparklineData[sparklineData.length - 1] - sparklineData[0]) / sparklineData[0] * 100) : change;
    
    const momentumSignal = momentum > 2 ? 'Strong' : momentum > 0 ? 'Moderate' : 'Weak';
    const momentumDirection = momentum > 0 ? 'Bullish' : 'Bearish';
    
    const marketCap = coin.market_cap || 0;
    const volume = coin.total_volume || 0;
    const volumeToMarketCap = volume > 0 && marketCap > 0 ? ((volume / marketCap) * 100) : 0;
    
    let rsiCondition = 'Neutral';
    if (rsi > 70) rsiCondition = 'Overbought';
    else if (rsi < 30) rsiCondition = 'Oversold';
    else if (rsi > 50) rsiCondition = 'Strong';
    else rsiCondition = 'Weak';
    
    const high7d = sparklineData.length > 0 ? Math.max(...sparklineData) : price;
    const low7d = sparklineData.length > 0 ? Math.min(...sparklineData) : price;
    const resistance = ((high7d - price) / price * 100).toFixed(2);
    const support = ((price - low7d) / price * 100).toFixed(2);
    
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
    const color = isPositive ? 'var(--purple-primary)' : 'var(--danger)';

    return `
        <svg class="sparkline-svg" viewBox="0 0 ${width} ${height}">
            <polyline 
                points="${points}" 
                fill="none" 
                stroke="${color}" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
            />
        </svg>
    `;
}

function initializeTradingViewWidget(period = '24H') {
    const container = document.getElementById('tradingview_widget');
    if (!container) return;

    container.innerHTML = '';

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.innerHTML = JSON.stringify({
        autosize: true,
        symbol: selectedCoin,
        interval: period === '1H' ? '60' : period === '24H' ? '240' : period === '7D' ? 'D' : period === '1M' ? 'W' : 'M',
        timezone: 'Etc/UTC',
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
        style: '1',
        locale: 'en',
        allow_symbol_change: true,
        support_host: 'https://www.tradingview.com'
    });

    container.appendChild(script);
}

function formatNumber(num) {
    if (num >= 1) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    }
}

function formatCurrency(num, format = 'full') {
    if (format === 'compact') {
        if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    }
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(num) {
    return `${num.toFixed(2)}%`;
}

function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function switchPage(page) {
    console.log('Switching to page:', page);
    
    document.querySelectorAll('.hero-section, .metrics-section, .market-overview, .two-column-layout, .chart-section, .vip-section, .vip-login-section, .vip-dashboard-section').forEach(section => {
        section.style.display = 'none';
    });
    
    if (page === 'dashboard') {
        document.querySelector('.hero-section').style.display = 'block';
        document.querySelector('.metrics-section').style.display = 'grid';
        document.querySelector('.market-overview').style.display = 'block';
        document.querySelector('.two-column-layout').style.display = 'grid';
        document.querySelector('.chart-section').style.display = 'block';
    } else if (page === 'markets') {
        document.querySelector('.two-column-layout').style.display = 'grid';
        document.querySelector('.chart-section').style.display = 'block';
    } else if (page === 'signals') {
        document.querySelector('.two-column-layout').style.display = 'grid';
        document.querySelector('.chart-section').style.display = 'block';
    } else if (page === 'vip') {
        const userEmail = localStorage.getItem('vipUserEmail');
        console.log('VIP page clicked. User email:', userEmail);
        if (userEmail) {
            console.log('Showing VIP dashboard for:', userEmail);
            const dashboardSection = document.querySelector('.vip-dashboard-section');
            if (dashboardSection) {
                dashboardSection.style.display = 'block';
                showVIPDashboard(userEmail);
            }
        } else {
            console.log('Showing VIP subscription page');
            const vipSection = document.querySelector('.vip-section');
            if (vipSection) {
                vipSection.style.display = 'block';
                initVIPPage();
                localStorage.setItem('vipPageVisited', 'true');
                console.log('VIP section should be visible now');
            } else {
                console.error('VIP section not found in DOM');
            }
        }
    }
}

function initVIPPage() {
    document.querySelectorAll('.crypto-pay-btn').forEach(btn => {
        btn.removeEventListener('click', handleCryptoPayment);
        btn.addEventListener('click', handleCryptoPayment);
    });
}

function handleCryptoPayment(e) {
    const plan = e.target.getAttribute('data-plan');
    const price = e.target.getAttribute('data-price');
    
    document.getElementById('paymentAmount').textContent = `$${price}`;
    document.getElementById('cryptoPaymentModal').classList.add('active');
    document.getElementById('cryptoPaymentModal').style.display = 'flex';
    
    window.currentPaymentPlan = { plan, price };
}

function showCryptoAddress(currency) {
    const addresses = {
        bitcoin: '1Mk3rVFG9goEHU44ykeBJwJb19kCUTfSBT',
        ethereum: '0x218ca75414eb618620c01d7435bea327ea0cc9e3',
        usdt: 'TCbJ2jifeo5yobQKSvu5By7ji82m7czgj3',
        bnb: '0x218ca75414eb618620c01d7435bea327ea0cc9e3'
    };
    
    document.getElementById('addressDisplay').style.display = 'block';
    document.getElementById('paymentAddress').value = addresses[currency] || '';
    
    generateQRCode(addresses[currency], currency);
}

function generateQRCode(address, currency) {
    const container = document.getElementById('qrCode');
    if (!container) return;
    
    container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(address)}" alt="QR Code" style="width: 150px; height: 150px; border-radius: 8px;">`;
}

function copyAddress() {
    const addressInput = document.getElementById('paymentAddress');
    addressInput.select();
    document.execCommand('copy');
    showNotification('Address copied to clipboard!', 'success');
}

function closeCryptoModal() {
    document.getElementById('cryptoPaymentModal').classList.remove('active');
    document.getElementById('cryptoPaymentModal').style.display = 'none';
    document.getElementById('addressDisplay').style.display = 'none';
}

function handleVIPLogin(event) {
    event.preventDefault();
    const email = document.getElementById('vipEmail').value;
    if (email) {
        localStorage.setItem('vipUserEmail', email);
        switchPage('vip');
    }
}

function showVIPDashboard(email) {
    document.querySelector('.vip-dashboard-section').style.display = 'block';
    document.getElementById('userEmail').textContent = `Welcome back, ${email}`;
    loadPremiumSignals();
}

async function loadPremiumSignals() {
    try {
        const response = await fetch(`${API_BASE}/api/vip/signals?t=${Date.now()}`);
        const data = await response.json();
        
        if (data.success && data.signals) {
            displayPremiumSignals(data.signals);
            if (data.top_signal) {
                updateSignalStats(data);
            }
        }
    } catch (error) {
        console.error('Error loading premium signals:', error);
    }
}

function updateSignalStats(data) {
    if (data.top_signal) {
        const topSignal = data.top_signal;
        const statsContainer = document.querySelector('.premium-stats');
        if (statsContainer) {
            const winRateCard = statsContainer.querySelector('.stat-card:nth-child(1)');
            if (winRateCard) {
                winRateCard.innerHTML = `<div class="stat-label">Win Rate (Today)</div><div class="stat-value">${topSignal.win_rate}%</div><div class="stat-change positive">↑ Live Trading</div>`;
            }
        }
    }
}

function displayPremiumSignals(signals) {
    const container = document.getElementById('premiumSignalsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!signals || signals.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Analyzing markets for premium signals...</div>';
        return;
    }
    
    signals.forEach((signal, idx) => {
        const signalEl = document.createElement('div');
        signalEl.className = 'premium-signal-item';
        
        signalEl.innerHTML = `
            <div class="signal-header-premium">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 12px; background: var(--purple-primary); color: white; padding: 2px 8px; border-radius: 4px;">#${idx + 1}</span>
                        <h3 style="margin: 0;">${signal.pair}</h3>
                    </div>
                    <p class="current-price">$${signal.current_price.toLocaleString('en-US', {maximumFractionDigits: 2})}</p>
                </div>
                <div style="text-align: right;">
                    <span class="signal-badge ${signal.signal.toLowerCase().replace(/\s+/g, '-')}">${signal.signal}</span>
                    <div style="margin-top: 4px; font-size: 11px; padding: 2px 6px; background: ${signal.risk_level.includes('LOW') ? 'rgba(16, 185, 129, 0.2)' : signal.risk_level.includes('HIGH') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; border-radius: 4px; color: ${signal.risk_level.includes('LOW') ? 'var(--success)' : signal.risk_level.includes('HIGH') ? 'var(--danger)' : 'var(--warning)'};">${signal.risk_level}</div>
                </div>
            </div>
            
            <div class="signal-analytics">
                <div class="analytics-row">
                    <span>RSI (14)</span>
                    <strong style="color: ${signal.rsi < 30 ? 'var(--success)' : signal.rsi > 70 ? 'var(--danger)' : 'var(--warning)'}">${signal.rsi.toFixed(1)}</strong>
                </div>
                <div class="analytics-row">
                    <span>24h Chg</span>
                    <strong style="color: ${signal.price_24h_change > 0 ? 'var(--success)' : 'var(--danger)'}">${signal.price_24h_change > 0 ? '+' : ''}${signal.price_24h_change.toFixed(2)}%</strong>
                </div>
                <div class="analytics-row">
                    <span>Confidence</span>
                    <strong>${signal.confidence}%</strong>
                </div>
                <div class="analytics-row">
                    <span>7d Trend</span>
                    <strong style="color: ${signal.trend_7d > 0 ? 'var(--success)' : 'var(--danger)'}">${signal.trend_7d > 0 ? '↑' : '↓'} ${Math.abs(signal.trend_7d).toFixed(1)}%</strong>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; margin: 12px 0; font-size: 12px;">
                <div><span style="color: var(--text-muted);">MACD</span><div style="margin-top: 4px; font-weight: 600; color: ${signal.macd_positive ? 'var(--success)' : 'var(--danger)'}">${signal.macd_positive ? '✓ Bull' : '✗ Bear'}</div></div>
                <div><span style="color: var(--text-muted);">Volume</span><div style="margin-top: 4px; font-weight: 600;">${signal.volume_trend}</div></div>
                <div><span style="color: var(--text-muted);">Win Rate</span><div style="margin-top: 4px; font-weight: 600; color: var(--purple-primary);">${signal.win_rate}%</div></div>
            </div>
            
            <div class="signal-levels">
                <div class="level-item">
                    <label>Support</label>
                    <div class="level-value">$${signal.support.toLocaleString('en-US', {maximumFractionDigits: 2})}</div>
                    <span style="font-size: 11px; color: var(--text-muted);">${((signal.support - signal.current_price) / signal.current_price * -100).toFixed(1)}% down</span>
                </div>
                <div class="level-item">
                    <label>Resistance</label>
                    <div class="level-value">$${signal.resistance.toLocaleString('en-US', {maximumFractionDigits: 2})}</div>
                    <span style="font-size: 11px; color: var(--text-muted);">${((signal.resistance - signal.current_price) / signal.current_price * 100).toFixed(1)}% up</span>
                </div>
            </div>
            
            <p class="signal-analysis">${signal.analysis}</p>
            <button onclick="selectCoin('${signal.symbol.toLowerCase()}'); showNotification('Chart loaded for ${signal.pair}');" style="margin-top: 12px; padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); cursor: pointer; font-size: 12px; width: 100%;">View Chart →</button>
        `;
        container.appendChild(signalEl);
    });
}

function logoutVIP() {
    localStorage.removeItem('vipUserEmail');
    switchPage('dashboard');
}

setInterval(() => {
    fetchGlobalMetrics();
    fetchFearGreed();
}, 60000);
