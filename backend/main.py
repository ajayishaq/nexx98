from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import httpx
import asyncio
import json
from typing import List
import os
from dotenv import load_dotenv
import time

load_dotenv()

app = FastAPI(title="Krypticks API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Keys (using environment variables)
COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY", "")
CRYPTOCOMPARE_API_KEY = os.getenv("CRYPTOCOMPARE_API_KEY", "")

# Shared async HTTP client
http_client = httpx.AsyncClient(timeout=10.0)

# Rate limiting
last_coingecko_call = 0
COINGECKO_RATE_LIMIT = 1.2  # seconds between calls

# Cache for rate limit fallback
cached_markets = None
cached_global = None
cached_fear_greed = None

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Krypticks API"}

@app.get("/api/markets")
async def get_markets():
    """Get top cryptocurrency market data from CoinGecko"""
    global last_coingecko_call, cached_markets
    
    # Rate limiting
    time_since_last_call = time.time() - last_coingecko_call
    if time_since_last_call < COINGECKO_RATE_LIMIT:
        await asyncio.sleep(COINGECKO_RATE_LIMIT - time_since_last_call)
    
    try:
        url = "https://api.coingecko.com/api/v3/coins/markets"
        params = {
            "vs_currency": "usd",
            "order": "market_cap_desc",
            "per_page": 50,
            "page": 1,
            "sparkline": True,
            "price_change_percentage": "24h,7d"
        }
        
        headers = {}
        if COINGECKO_API_KEY:
            headers["x-cg-demo-api-key"] = COINGECKO_API_KEY
        
        response = await http_client.get(url, params=params, headers=headers)
        last_coingecko_call = time.time()
        response.raise_for_status()
        data = response.json()
        cached_markets = data  # Cache successful response
        return data
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429 and cached_markets:
            print("Rate limit hit, using cached markets data")
            return cached_markets
        raise
    except Exception as e:
        print(f"Error fetching markets: {e}")
        if cached_markets:
            print("Using cached markets data")
            return cached_markets
        raise

@app.get("/api/global")
async def get_global_metrics():
    """Get global cryptocurrency metrics"""
    global cached_global
    
    try:
        url = "https://api.coingecko.com/api/v3/global"
        headers = {}
        if COINGECKO_API_KEY:
            headers["x-cg-demo-api-key"] = COINGECKO_API_KEY
        
        response = await http_client.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        result = {
            "total_market_cap": data["data"]["total_market_cap"]["usd"],
            "total_volume": data["data"]["total_volume"]["usd"],
            "btc_dominance": data["data"]["market_cap_percentage"]["btc"],
            "eth_dominance": data["data"]["market_cap_percentage"].get("eth", 0),
            "market_cap_change_24h": data["data"]["market_cap_change_percentage_24h_usd"],
            "active_cryptocurrencies": data["data"]["active_cryptocurrencies"]
        }
        cached_global = result
        return result
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429 and cached_global:
            print("Rate limit hit, using cached global metrics")
            return cached_global
        raise
    except Exception as e:
        print(f"Error fetching global metrics: {e}")
        if cached_global:
            print("Using cached global metrics")
            return cached_global
        raise

@app.get("/api/fear-greed")
async def get_fear_greed_index():
    """Get Fear & Greed Index"""
    global cached_fear_greed
    
    try:
        url = "https://api.alternative.me/fng/"
        response = await http_client.get(url)
        response.raise_for_status()
        data = response.json()
        result = {
            "value": int(data["data"][0]["value"]),
            "classification": data["data"][0]["value_classification"]
        }
        cached_fear_greed = result
        return result
    except Exception as e:
        print(f"Error fetching fear & greed: {e}")
        if cached_fear_greed:
            print("Using cached fear & greed data")
            return cached_fear_greed
        raise

@app.get("/api/coin/{coin_id}")
async def get_coin_details(coin_id: str):
    """Get detailed information about a specific coin"""
    try:
        url = f"https://api.coingecko.com/api/v3/coins/{coin_id}"
        params = {
            "localization": False,
            "tickers": False,
            "market_data": True,
            "community_data": False,
            "developer_data": False
        }
        headers = {}
        if COINGECKO_API_KEY:
            headers["x-cg-demo-api-key"] = COINGECKO_API_KEY
        
        response = await http_client.get(url, params=params, headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching coin details: {e}")
        raise

@app.get("/api/ohlc/{symbol}")
async def get_ohlc_data(symbol: str, limit: int = 100):
    """Get OHLCV data from CryptoCompare"""
    try:
        url = f"https://min-api.cryptocompare.com/data/v2/histohour"
        params = {
            "fsym": symbol.upper(),
            "tsym": "USD",
            "limit": limit
        }
        if CRYPTOCOMPARE_API_KEY:
            params["api_key"] = CRYPTOCOMPARE_API_KEY
        
        response = await http_client.get(url, params=params)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching OHLC data: {e}")
        raise

@app.websocket("/ws/prices")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time price updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Fetch latest prices every 30 seconds
            try:
                markets = await get_markets()
                if markets and isinstance(markets, list):
                    await websocket.send_json({
                        "type": "price_update",
                        "data": markets[:20]
                    })
            except Exception as e:
                print(f"WebSocket error: {e}")
                # Continue loop even on error
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket connection error: {e}")
        manager.disconnect(websocket)

# Mount static files - must be last to not interfere with API routes
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
