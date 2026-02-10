
import { MarketDataService } from './services/marketData';
import { TechnicalAnalysisService } from './services/technicalAnalysis';

async function test() {
    console.log("Starting manual test...");
    try {
        const marketData = new MarketDataService();
        const technicalAnalysis = new TechnicalAnalysisService();

        console.log("Fetching candles...");
        const candles = await marketData.getCandles('BTCUSDT', '1h');
        console.log(`Fetched ${candles.length} candles.`);
        
        if (candles.length > 0) {
            console.log("First candle:", candles[0]);
            console.log("Last candle:", candles[candles.length - 1]);
        }

        console.log("Analyzing...");
        const analysis = technicalAnalysis.analyze(candles);
        console.log("Analysis Result:", JSON.stringify(analysis, null, 2));

    } catch (error) {
        console.error("Test failed:", error);
    }
}

test();
