// dashboard.js
let refreshTimer = null;
let apiCallCount = 0;
const MAX_API_CALLS_PER_MINUTE = 45; // Conservative limit for free tier
let callTimestamps = [];

class RateLimiter {
    constructor(maxCalls, timeWindow) {
        this.maxCalls = maxCalls;
        this.timeWindow = timeWindow;
        this.calls = [];
    }

    canMakeCall() {
        const now = Date.now();
        // Remove calls outside the time window
        this.calls = this.calls.filter(time => now - time < this.timeWindow);
        
        return this.calls.length < this.maxCalls;
    }

    recordCall() {
        this.calls.push(Date.now());
        apiCallCount = this.calls.length;
        document.getElementById('apiCallCount').textContent = apiCallCount;
    }

    getTimeUntilNextCall() {
        if (this.calls.length < this.maxCalls) return 0;
        
        const oldestCall = this.calls[0];
        return Math.ceil((oldestCall + this.timeWindow - Date.now()) / 1000);
    }
}

const rateLimiter = new RateLimiter(MAX_API_CALLS_PER_MINUTE, 60000); // 45 calls per minute

function updateStatus() {
    const now = new Date();
    document.getElementById('lastUpdated').textContent = now.toLocaleTimeString();
    
    if (refreshTimer) {
        const nextUpdate = new Date(now.getTime() + getRefreshInterval());
        document.getElementById('nextUpdate').textContent = nextUpdate.toLocaleTimeString();
    } else {
        document.getElementById('nextUpdate').textContent = 'Stopped';
    }
}

function getRefreshInterval() {
    return parseInt(document.getElementById('refreshInterval').value) * 1000;
}

async function manualRefresh() {
    await updateDashboard();
}

async function updateDashboard() {
    // Check rate limit
    if (!rateLimiter.canMakeCall()) {
        const waitTime = rateLimiter.getTimeUntilNextCall();
        console.log(`Rate limit reached. Waiting ${waitTime} seconds...`);
        document.getElementById('nextUpdate').textContent = `Rate limited - wait ${waitTime}s`;
        return;
    }

    const positionSize = parseFloat(document.getElementById('positionSize').value);
    const positionPrice = parseFloat(document.getElementById('positionPrice').value);
    const collateral = parseFloat(document.getElementById('collateral').value);

    try {
        rateLimiter.recordCall();
        
        // Fetch current ETH price from CoinGecko
        const markPrice = await fetchETHPrice();
        document.getElementById('markPrice').textContent = `$${markPrice}`;

        // Calculate liquidation price
        const liquidationPrice = calculateLiquidationPrice(
            positionSize,
            positionPrice,
            collateral,
            markPrice
        );

        document.getElementById('liquidationPrice').textContent = `$${liquidationPrice.toFixed(2)}`;
        updateStatus();
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('markPrice').textContent = 'Error fetching price';
        document.getElementById('liquidationPrice').textContent = 'Calculation failed';
        updateStatus();
    }
}

async function fetchETHPrice() {
    const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    );
    
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.ethereum.usd;
}

function calculateLiquidationPrice(positionSize, positionPrice, collateral, markPrice) {
    const maintenanceMargin = 0.10;
    const liquidationValue = (positionSize * positionPrice) - collateral;
    return liquidationValue / (positionSize * (1 - maintenanceMargin));
}

function startAutoRefresh() {
    stopAutoRefresh(); // Clear any existing timer
    
    const interval = getRefreshInterval();
    if (interval < 30000) {
        alert('Minimum refresh interval is 30 seconds to respect API limits');
        document.getElementById('refreshInterval').value = 30;
        return;
    }
    
    refreshTimer = setInterval(updateDashboard, interval);
    updateDashboard(); // Immediate update
    updateStatus();
}

function stopAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    updateStatus();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    updateDashboard();
    updateStatus();
});

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
});