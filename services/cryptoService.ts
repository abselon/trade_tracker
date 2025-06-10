export interface CryptoCurrency {
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    price_change_percentage_24h: number;
    market_cap_rank: number;
    image: string;
}

export interface CoinGeckoResponse {
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    price_change_percentage_24h: number;
    market_cap_rank: number;
    image: string;
}

const BASE_URL = 'https://api.coingecko.com/api/v3';

// Popular cryptocurrencies that are commonly traded
const POPULAR_CRYPTO_IDS = [
    'bitcoin',
    'ethereum',
    'binancecoin',
    'cardano',
    'solana',
    'polkadot',
    'polygon',
    'avalanche-2',
    'chainlink',
    'dogecoin',
    'litecoin',
    'uniswap',
    'cosmos',
    'algorand',
    'stellar'
];

// Rate limiting and caching
class RateLimiter {
    private lastRequestTime = 0;
    private minInterval = 1000; // 1 second between requests
    private cache = new Map<string, { data: any; timestamp: number }>();
    private cacheTimeout = 30000; // 30 seconds cache

    async makeRequest(url: string, cacheKey?: string): Promise<any> {
        // Check cache first
        if (cacheKey && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey)!;
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        // Rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minInterval) {
            await new Promise(resolve =>
                setTimeout(resolve, this.minInterval - timeSinceLastRequest)
            );
        }

        this.lastRequestTime = Date.now();

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Cache the result
        if (cacheKey) {
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
        }

        return data;
    }
}

const rateLimiter = new RateLimiter();

export class CryptoService {
    static async getPopularCryptocurrencies(): Promise<CryptoCurrency[]> {
        try {
            const url = `${BASE_URL}/coins/markets?vs_currency=usd&ids=${POPULAR_CRYPTO_IDS.join(',')}&order=market_cap_desc&per_page=15&page=1&sparkline=false&price_change_percentage=24h`;
            const data: CoinGeckoResponse[] = await rateLimiter.makeRequest(url, 'popular_cryptos');

            return data.map(coin => ({
                id: coin.id,
                symbol: coin.symbol.toUpperCase(),
                name: coin.name,
                current_price: coin.current_price,
                price_change_percentage_24h: coin.price_change_percentage_24h,
                market_cap_rank: coin.market_cap_rank,
                image: coin.image
            }));
        } catch (error) {
            console.error('Error fetching crypto data:', error);
            throw error;
        }
    }

    static async getCryptocurrencyPrice(coinId: string): Promise<number> {
        try {
            const url = `${BASE_URL}/simple/price?ids=${coinId}&vs_currencies=usd`;
            const data = await rateLimiter.makeRequest(url, `price_${coinId}`);
            return data[coinId]?.usd || 0;
        } catch (error) {
            console.error('Error fetching crypto price:', error);
            throw error;
        }
    }

    static async searchCryptocurrencies(query: string): Promise<CryptoCurrency[]> {
        try {
            const searchUrl = `${BASE_URL}/search?query=${encodeURIComponent(query)}`;
            const data = await rateLimiter.makeRequest(searchUrl, `search_${query}`);

            // Get detailed info for first 10 search results
            const coinIds = data.coins.slice(0, 10).map((coin: any) => coin.id);

            if (coinIds.length === 0) return [];

            const detailUrl = `${BASE_URL}/coins/markets?vs_currency=usd&ids=${coinIds.join(',')}&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h`;
            const detailData: CoinGeckoResponse[] = await rateLimiter.makeRequest(detailUrl, `detail_${coinIds.join(',')}`);

            return detailData.map(coin => ({
                id: coin.id,
                symbol: coin.symbol.toUpperCase(),
                name: coin.name,
                current_price: coin.current_price,
                price_change_percentage_24h: coin.price_change_percentage_24h,
                market_cap_rank: coin.market_cap_rank,
                image: coin.image
            }));
        } catch (error) {
            console.error('Error searching cryptocurrencies:', error);
            return [];
        }
    }

    // Convert symbol to CoinGecko ID for price fetching
    static getSymbolToCoinIdMap(): { [key: string]: string } {
        return {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'BNB': 'binancecoin',
            'ADA': 'cardano',
            'SOL': 'solana',
            'DOT': 'polkadot',
            'MATIC': 'polygon',
            'AVAX': 'avalanche-2',
            'LINK': 'chainlink',
            'DOGE': 'dogecoin',
            'LTC': 'litecoin',
            'UNI': 'uniswap',
            'ATOM': 'cosmos',
            'ALGO': 'algorand',
            'XLM': 'stellar'
        };
    }

    static getCoinIdFromSymbol(symbol: string): string {
        const symbolMap = this.getSymbolToCoinIdMap();
        return symbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
    }
} 