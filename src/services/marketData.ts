import axios from 'axios';

export interface Candle {
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime: number;
}

export class MarketDataService {
    private binanceUrl = 'https://api.binance.com/api/v3';
    private coingeckoUrl = 'https://api.coingecko.com/api/v3';

    async getCandles(symbol: string = 'BTCUSDT', interval: string = '1h'): Promise<Candle[]> {
        try {
            // Try Binance First
            return await this.fetchBinanceCandles(symbol, interval);
        } catch (error) {
            console.warn('Binance API failed, trying CoinGecko fallback...');
            try {
                // Try CoinGecko Fallback
                return await this.fetchCoingeckoCandles(symbol, interval);
            } catch (cgError) {
                console.error('All APIs failed:', cgError);
                throw new Error('Failed to fetch market data from all sources');
            }
        }
    }

    private async fetchBinanceCandles(symbol: string, interval: string): Promise<Candle[]> {
        const response = await axios.get(`${this.binanceUrl}/klines`, {
            params: {
                symbol: symbol.toUpperCase(),
                interval: interval,
                limit: 100
            },
            timeout: 5000
        });

        return response.data.map((k: any[]) => ({
            openTime: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            closeTime: k[6]
        }));
    }

    private async fetchCoingeckoCandles(symbol: string, interval: string): Promise<Candle[]> {
        // CoinGecko only supports days, so we normalize '1h' logic best we can or fetch last 24h
        // Actually, CoinGecko public API 'ohlc' endpoint returns 4-day data for '1' (which is 30m) or 30-day for 'max'.
        // It's less flexible. Let's try 'coins/bitcoin/ohlc?vs_currency=usd&days=1' -> gives 30m candles

        const coinId = 'bitcoin'; // Simplified for BTC
        const response = await axios.get(`${this.coingeckoUrl}/coins/${coinId}/ohlc`, {
            params: {
                vs_currency: 'usd',
                days: '1' // 1 day = 30 minute intervals usually
            },
            timeout: 5000
        });

        // Response: [ [ time, open, high, low, close ], ... ]
        // Note: No volume in OHLC endpoint
        return response.data.map((k: any[]) => ({
            openTime: k[0],
            open: k[1],
            high: k[2],
            low: k[3],
            close: k[4],
            volume: 0, // Mock volume
            closeTime: k[0] + 1800000 // +30 mins
        }));
    }
}

