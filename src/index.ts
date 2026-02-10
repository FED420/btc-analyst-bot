import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
import { MarketDataService } from './services/marketData';
import { TechnicalAnalysisService } from './services/technicalAnalysis';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const marketData = new MarketDataService(); // Will implement
const technicalAnalysis = new TechnicalAnalysisService(); // Will implement

client.once('ready', () => {
    console.log(`Logged in as ${client.user?.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!analyze' || message.content === '!btc') {
        const loadingMsg = await message.reply('Analyzing BTC market data... 🔍');

        try {
            const candles = await marketData.getCandles('BTCUSDT', '1h');
            const analysis = technicalAnalysis.analyze(candles);

            console.log('Analysis Result:', JSON.stringify(analysis, null, 2));

            // Format the response
            const setup = analysis.setup;

            if (!setup) {
                console.error('Setup object is missing!', analysis);
                await loadingMsg.edit('⚠️ Error: Analysis failed to generate a trade setup. Please try again.');
                return;
            }

            const setupEmoji = setup.direction === 'LONG' ? '🟢' : setup.direction === 'SHORT' ? '🔴' : '⚪';

            const response = `
**Bitcoin (BTC/USDT) Analysis** 📊
Current Price: **$${analysis.currentPrice?.toFixed(2) || '0.00'}**

**Technical Indicators (1H Chart):**
• RSI (14): ${analysis.rsi?.toFixed(2) || '0'} (${(analysis.rsi || 0) > 70 ? 'Overbought 🔴' : (analysis.rsi || 0) < 30 ? 'Oversold 🟢' : 'Neutral ⚪'})
• MACD: ${analysis.macd?.toFixed(2) || '0'}
• EMA (50): $${analysis.ema50?.toFixed(2) || '0'}
• ATR (14): ${analysis.atr?.toFixed(2) || '0'} (High Volatility: ${(analysis.atr || 0) > 500 ? 'Yes' : 'No'})

**Trade Setup:** ${setupEmoji} **${setup.direction}**
• Entry: $${setup.entry?.toFixed(2) || '0.00'}
• **Stop Loss:** $${setup.stopLoss?.toFixed(2) || '0.00'}
• **Take Profit:** $${setup.takeProfit?.toFixed(2) || '0.00'}
• R/R Ratio: ${setup.riskRewardRatio}:1
• Reason: *${setup.reason}*

*Disclaimer: Not financial advice. Analyzed based on technical data.*
            `;

            await loadingMsg.edit(response);
        } catch (error) {
            console.error(error);
            await loadingMsg.edit('Failed to fetch market data. Please try again later.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
