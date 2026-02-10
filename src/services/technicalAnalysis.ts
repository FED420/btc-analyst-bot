import { RSI, EMA, MACD, ATR } from 'technicalindicators';
import { Candle } from './marketData';

export interface TradeSetup {
    direction: 'LONG' | 'SHORT' | 'NEUTRAL';
    entry: number;
    stopLoss: number;
    takeProfit: number;
    riskRewardRatio: number;
    reason: string;
}

export interface AnalysisResult {
    currentPrice: number;
    rsi: number;
    ema50: number;
    macd: number;
    atr: number;
    support: number;
    resistance: number;
    setup: TradeSetup;
}

export class TechnicalAnalysisService {
    analyze(candles: Candle[]): AnalysisResult {
        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const currentPrice = closes[closes.length - 1];

        // RSI (14)
        const rsiValues = RSI.calculate({ values: closes, period: 14 });
        const currentRSI = rsiValues[rsiValues.length - 1] || 50;

        // EMA (50)
        const emaValues = EMA.calculate({ values: closes, period: 50 });
        const currentEMA = emaValues[emaValues.length - 1] || currentPrice;

        // MACD (12, 26, 9)
        const macdValues = MACD.calculate({
            values: closes,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false
        });
        const currentMACD = macdValues[macdValues.length - 1] || { MACD: 0, signal: 0, histogram: 0 };

        // ATR (14) - Volatility check
        const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
        const currentATR = atrValues[atrValues.length - 1] || 0;

        // Simple Support & Resistance (Last 20 candles min/max)
        const recentLows = lows.slice(-20);
        const recentHighs = highs.slice(-20);
        const support = Math.min(...recentLows) || currentPrice;
        const resistance = Math.max(...recentHighs) || currentPrice;

        // Generate Trade Setup
        let setup: TradeSetup = {
            direction: 'NEUTRAL',
            entry: 0,
            stopLoss: 0,
            takeProfit: 0,
            riskRewardRatio: 0,
            reason: "Market is ranging. Wait for a breakout."
        };

        const macdLine = currentMACD.MACD || 0;
        const macdSignal = currentMACD.signal || 0;

        // LONG Signal Logic
        if (currentPrice > currentEMA && currentRSI > 50 && macdLine > macdSignal) {
            const sl = Number((support - (currentATR * 0.5)).toFixed(2));
            const tp = Number((currentPrice + ((currentPrice - sl) * 1.5)).toFixed(2));
            setup = {
                direction: 'LONG',
                entry: currentPrice,
                stopLoss: sl,
                takeProfit: tp,
                riskRewardRatio: 1.5,
                reason: "Price > EMA, RSI Bullish, MACD Crossover."
            };
        }
        // SHORT Signal Logic
        else if (currentPrice < currentEMA && currentRSI < 50 && macdLine < macdSignal) {
            const sl = Number((resistance + (currentATR * 0.5)).toFixed(2));
            const tp = Number((currentPrice - ((sl - currentPrice) * 1.5)).toFixed(2));
            setup = {
                direction: 'SHORT',
                entry: currentPrice,
                stopLoss: sl,
                takeProfit: tp,
                riskRewardRatio: 1.5,
                reason: "Price < EMA, RSI Bearish, MACD Bearish Cross."
            };
        }
        // Mean Reversion - Oversold Bounce
        else if (currentRSI < 30) {
            const sl = Number((currentPrice - (currentATR * 2)).toFixed(2));
            const tp = Number(currentEMA.toFixed(2));
            setup = {
                direction: 'LONG',
                entry: currentPrice,
                stopLoss: sl,
                takeProfit: tp,
                riskRewardRatio: 2,
                reason: "RSI Oversold (Bounce Play to EMA)."
            };
        }
        // Mean Reversion - Overbought Pullback
        else if (currentRSI > 70) {
            const sl = Number((currentPrice + (currentATR * 2)).toFixed(2));
            const tp = Number(currentEMA.toFixed(2));
            setup = {
                direction: 'SHORT',
                entry: currentPrice,
                stopLoss: sl,
                takeProfit: tp,
                riskRewardRatio: 2,
                reason: "RSI Overbought (Pullback Play to EMA)."
            };
        }

        return {
            currentPrice,
            rsi: currentRSI,
            ema50: currentEMA,
            macd: macdLine,
            atr: currentATR,
            support,
            resistance,
            setup
        };
    }
}
