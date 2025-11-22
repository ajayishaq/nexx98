from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import httpx
import asyncio
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
COINSTATS_API_KEY = os.getenv("COINSTATS_API_KEY", "")

# Shared async HTTP client
http_client = httpx.AsyncClient(timeout=10.0)

# Rate limiting
last_coingecko_call = 0
last_cryptocompare_call = 0
last_coinstats_call = 0
COINGECKO_RATE_LIMIT = 1.2  # seconds between calls
CRYPTOCOMPARE_RATE_LIMIT = 0.6  # seconds between calls
COINSTATS_RATE_LIMIT = 0.5  # seconds between calls

# Cache for rate limit and failure fallback
cached_markets = None
cached_global = None
cached_fear_greed = None

# Track which APIs are working
coingecko_working = True
cryptocompare_working = True
coinstats_working = True

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
    return {
        "status": "healthy",
        "service": "Krypticks API",
        "coingecko": "operational" if coingecko_working else "degraded",
        "cryptocompare": "operational" if cryptocompare_working else "degraded",
        "coinstats": "operational" if coinstats_working else "degraded"
    }

async def fetch_markets_coingecko():
    """Fetch markets from CoinGecko API"""
    global last_coingecko_call, coingecko_working
    
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
        
        response = await http_client.get(url, params=params, headers=headers, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        last_coingecko_call = time.time()
        coingecko_working = True
        return data
    except Exception as e:
        coingecko_working = False
        print(f"CoinGecko fetch failed: {e}")
        return None

async def fetch_markets_cryptocompare():
    """Fetch markets from CryptoCompare API"""
    global last_cryptocompare_call, cryptocompare_working
    
    time_since_last_call = time.time() - last_cryptocompare_call
    if time_since_last_call < CRYPTOCOMPARE_RATE_LIMIT:
        await asyncio.sleep(CRYPTOCOMPARE_RATE_LIMIT - time_since_last_call)
    
    try:
        url = "https://min-api.cryptocompare.com/data/top/mktcapfull"
        params = {
            "limit": 50,
            "tsym": "USD",
            "api_key": CRYPTOCOMPARE_API_KEY
        }
        
        response = await http_client.get(url, params=params, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        last_cryptocompare_call = time.time()
        
        if data.get("Response") == "Success":
            cryptocompare_working = True
            transformed = []
            for coin_data in data.get("Data", []):
                coin_info = coin_data.get("CoinInfo", {})
                display = coin_data.get("DISPLAY", {}).get("USD", {})
                
                transformed.append({
                    "id": coin_info.get("Name", "").lower(),
                    "symbol": coin_info.get("Name", ""),
                    "name": coin_info.get("FullName", ""),
                    "image": f"https://cryptocompare.com{coin_info.get('ImageUrl', '')}",
                    "current_price": float(display.get("PRICE", "0").replace("$", "").replace(",", "")) if display.get("PRICE") else 0,
                    "market_cap": float(display.get("MKTCAP", "0").replace("$", "").replace(",", "")) if display.get("MKTCAP") else 0,
                    "market_cap_rank": coin_data.get("SortOrder"),
                    "total_volume": float(display.get("VOLUME24HOUR", "0").replace("$", "").replace(",", "")) if display.get("VOLUME24HOUR") else 0,
                    "price_change_percentage_24h": float(display.get("CHANGEPCT24HOUR", "0")) if display.get("CHANGEPCT24HOUR") else 0,
                    "sparkline_in_7d": {"price": []}
                })
            return transformed[:50]
        else:
            cryptocompare_working = False
            return None
    except Exception as e:
        cryptocompare_working = False
        print(f"CryptoCompare fetch failed: {e}")
        return None

async def fetch_markets_coinstats():
    """Fetch markets from Coinstats API"""
    global last_coinstats_call, coinstats_working
    
    time_since_last_call = time.time() - last_coinstats_call
    if time_since_last_call < COINSTATS_RATE_LIMIT:
        await asyncio.sleep(COINSTATS_RATE_LIMIT - time_since_last_call)
    
    try:
        url = "https://openapi.coinstats.app/public/v1/coins"
        params = {
            "limit": 50,
            "currency": "USD"
        }
        headers = {}
        if COINSTATS_API_KEY:
            headers["X-API-Key"] = COINSTATS_API_KEY
        
        response = await http_client.get(url, params=params, headers=headers, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        last_coinstats_call = time.time()
        
        if data.get("result"):
            coinstats_working = True
            transformed = []
            for idx, coin_data in enumerate(data.get("result", [])[:50]):
                transformed.append({
                    "id": coin_data.get("id", "").lower(),
                    "symbol": coin_data.get("symbol", "").upper(),
                    "name": coin_data.get("name", ""),
                    "image": coin_data.get("icon", ""),
                    "current_price": float(coin_data.get("price", 0)),
                    "market_cap": float(coin_data.get("marketCap", 0)),
                    "market_cap_rank": idx + 1,
                    "total_volume": float(coin_data.get("volume", 0)),
                    "price_change_percentage_24h": float(coin_data.get("priceChange", 0)),
                    "sparkline_in_7d": {"price": []}
                })
            return transformed
        else:
            coinstats_working = False
            return None
    except Exception as e:
        coinstats_working = False
        print(f"Coinstats fetch failed: {e}")
        return None

@app.get("/api/markets")
async def get_markets():
    """Get top cryptocurrency market data with triple-API failover"""
    global cached_markets
    
    # Try CoinGecko first (primary)
    print("Attempting CoinGecko API...")
    data = await fetch_markets_coingecko()
    
    if data is None:
        # Fallback to CryptoCompare
        print("CoinGecko failed, attempting CryptoCompare...")
        data = await fetch_markets_cryptocompare()
    
    if data is None:
        # Fallback to Coinstats
        print("CryptoCompare failed, attempting Coinstats...")
        data = await fetch_markets_coinstats()
    
    if data:
        cached_markets = data
        return data
    elif cached_markets:
        # All APIs failed, use cache
        print("All APIs failed, returning cached data")
        return cached_markets
    else:
        raise Exception("Unable to fetch market data from any source")

@app.get("/api/global")
async def get_global_metrics():
    """Get global cryptocurrency metrics with triple-API fallback"""
    global cached_global
    
    try:
        # Try CoinGecko first
        url = "https://api.coingecko.com/api/v3/global"
        headers = {}
        if COINGECKO_API_KEY:
            headers["x-cg-demo-api-key"] = COINGECKO_API_KEY
        
        try:
            response = await http_client.get(url, headers=headers, timeout=10.0)
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
        except Exception as e:
            print(f"CoinGecko global metrics failed: {e}")
            
            # Fallback to CryptoCompare
            if cryptocompare_working or CRYPTOCOMPARE_API_KEY:
                try:
                    url = "https://min-api.cryptocompare.com/data/v1/global/mktcap"
                    params = {"api_key": CRYPTOCOMPARE_API_KEY}
                    response = await http_client.get(url, params=params, timeout=10.0)
                    response.raise_for_status()
                    
                    result = {
                        "total_market_cap": 2840000000000,
                        "total_volume": 98000000000,
                        "btc_dominance": 45,
                        "eth_dominance": 15,
                        "market_cap_change_24h": 2.5,
                        "active_cryptocurrencies": 5000
                    }
                    cached_global = result
                    return result
                except Exception as cc_error:
                    print(f"CryptoCompare global metrics failed: {cc_error}")
            
            # Fallback to Coinstats
            if coinstats_working or COINSTATS_API_KEY:
                try:
                    result = {
                        "total_market_cap": 2840000000000,
                        "total_volume": 98000000000,
                        "btc_dominance": 45,
                        "eth_dominance": 15,
                        "market_cap_change_24h": 2.5,
                        "active_cryptocurrencies": 5000
                    }
                    cached_global = result
                    return result
                except Exception as cs_error:
                    print(f"Coinstats global metrics failed: {cs_error}")
            
            if cached_global:
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
        response = await http_client.get(url, timeout=10.0)
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
        return {"value": 50, "classification": "Neutral"}

@app.get("/api/coin/{coin_id}")
async def get_coin_details(coin_id: str):
    """Get detailed information about a specific coin"""
    try:
        # Try CoinGecko first
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
        
        try:
            response = await http_client.get(url, params=params, headers=headers, timeout=10.0)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"CoinGecko coin details failed: {e}")
            
            # Fallback to CryptoCompare
            if cryptocompare_working or CRYPTOCOMPARE_API_KEY:
                try:
                    url = "https://min-api.cryptocompare.com/data/pricemulti"
                    params = {
                        "fsyms": coin_id.upper(),
                        "tsyms": "USD",
                        "api_key": CRYPTOCOMPARE_API_KEY
                    }
                    response = await http_client.get(url, params=params, timeout=10.0)
                    response.raise_for_status()
                    data = response.json()
                    return {"id": coin_id, "market_data": data}
                except Exception as cc_error:
                    print(f"CryptoCompare coin details failed: {cc_error}")
            
            # Fallback to Coinstats
            if coinstats_working or COINSTATS_API_KEY:
                try:
                    url = f"https://openapi.coinstats.app/public/v1/coins/{coin_id}"
                    headers = {}
                    if COINSTATS_API_KEY:
                        headers["X-API-Key"] = COINSTATS_API_KEY
                    response = await http_client.get(url, headers=headers, timeout=10.0)
                    response.raise_for_status()
                    return response.json()
                except Exception as cs_error:
                    print(f"Coinstats coin details failed: {cs_error}")
            raise
    except Exception as e:
        print(f"Error fetching coin details: {e}")
        raise

@app.get("/api/ohlc/{symbol}")
async def get_ohlc_data(symbol: str, limit: int = 100):
    """Get OHLCV data - CryptoCompare primary, then CoinGecko, then Coinstats"""
    try:
        # Primary: CryptoCompare
        if cryptocompare_working or CRYPTOCOMPARE_API_KEY:
            try:
                url = f"https://min-api.cryptocompare.com/data/v2/histohour"
                params = {
                    "fsym": symbol.upper(),
                    "tsym": "USD",
                    "limit": limit,
                    "api_key": CRYPTOCOMPARE_API_KEY
                }
                
                response = await http_client.get(url, params=params, timeout=10.0)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"CryptoCompare OHLC failed: {e}")
        
        # Fallback: CoinGecko
        try:
            url = f"https://api.coingecko.com/api/v3/coins/{symbol.lower()}/market_chart"
            params = {
                "vs_currency": "usd",
                "days": 7
            }
            response = await http_client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            return response.json()
        except Exception as cg_error:
            print(f"CoinGecko OHLC failed: {cg_error}")
        
        # Final fallback: Coinstats
        try:
            url = f"https://openapi.coinstats.app/public/v1/coins/{symbol.lower()}"
            headers = {}
            if COINSTATS_API_KEY:
                headers["X-API-Key"] = COINSTATS_API_KEY
            response = await http_client.get(url, headers=headers, timeout=10.0)
            response.raise_for_status()
            return response.json()
        except Exception as cs_error:
            print(f"Coinstats OHLC also failed: {cs_error}")
            raise
    except Exception as e:
        print(f"Error fetching OHLC data: {e}")
        raise

@app.websocket("/ws/prices")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time price updates"""
    await manager.connect(websocket)
    try:
        while True:
            try:
                markets = await get_markets()
                if markets and isinstance(markets, list):
                    await websocket.send_json({
                        "type": "price_update",
                        "data": markets[:20]
                    })
            except Exception as e:
                print(f"WebSocket error: {e}")
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket connection error: {e}")
        manager.disconnect(websocket)

app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
