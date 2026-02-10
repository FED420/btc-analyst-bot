
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import * as dotenv from 'dotenv';
import { MarketDataService } from './services/marketData';
import { TechnicalAnalysisService, AnalysisResult } from './services/technicalAnalysis';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const marketData = new MarketDataService();
const technicalAnalysis = new TechnicalAnalysisService();

/**
 * Creates a Discord Embed for the analysis result
 */
function createAnalysisEmbed(analysis: AnalysisResult): EmbedBuilder {
    const setup = analysis.setup;
    if (!setup) {
        throw new Error('Analysis setup is missing');
    }

    // Determine Color based on Direction
    let embedColor = 0x95a5a6; // Grey (Neutral)
    if (setup.direction === 'LONG') embedColor = 0x2ecc71; // Green
    else if (setup.direction === 'SHORT') embedColor = 0xe74c3c; // Red

    const setupEmoji = setup.direction === 'LONG' ? '🟢' : setup.direction === 'SHORT' ? '🔴' : '⚪';

    // RSI Logic
    let rsiStatus = 'Neutral';
    if (analysis.rsi > 70) rsiStatus = 'Overbought 🔴';
    if (analysis.rsi < 30) rsiStatus = 'Oversold 🟢';

    // MACD Logic
    let macdStatus = 'Neutral';
    if (analysis.macd > (analysis.macdSignal || 0)) macdStatus = 'Bullish 🟢';
    if (analysis.macd < (analysis.macdSignal || 0)) macdStatus = 'Bearish 🔴';

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`Bitcoin (BTC/USDT) Analysis 📊`)
        .setThumbnail('https://cryptologos.cc/logos/bitcoin-btc-logo.png')
        .setDescription(`**Current Price:** $${analysis.currentPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
        .addFields(
            {
                name: '📈 Trend Check',
                value: `${setupEmoji} **${setup.direction}**\n*${setup.reason}*`,
                inline: false
            },
            {
                name: '📊 Indicators',
                value: `**RSI (14):** ${analysis.rsi?.toFixed(2)} (${rsiStatus})\n**MACD:** ${analysis.macd?.toFixed(2)} (${macdStatus})`,
                inline: true
            },
            {
                name: '📉 Volatility',
                value: `**ATR (14):** ${analysis.atr?.toFixed(2)}\n**EMA (50):** $${analysis.ema50?.toFixed(2)}`,
                inline: true
            },
            {
                name: '\u200b',
                value: '\u200b',
                inline: false
            }, // Spacer
            {
                name: '🎯 Trade Setup',
                value: `\`\`\`yaml
Entry:   $${setup.entry?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
TP:      $${setup.takeProfit?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
SL:      $${setup.stopLoss?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
R/R:     ${setup.riskRewardRatio}:1
\`\`\``,
                inline: false
            }
        )
        .setFooter({
            // Add process ID to identify if multiple bots are running (Debug Feature)
            text: `Not Financial Advice • Price Action Bot (PID: ${process.pid})`,
            iconURL: 'https://cdn-icons-png.flaticon.com/512/4712/4712109.png'
        })
        .setTimestamp();

    return embed;
}

// Auto-Analysis Function
async function runAutoAnalysis() {
    const channelId = process.env.DISCORD_CHANNEL_ID;

    if (!channelId) {
        console.warn('⚠️ No DISCORD_CHANNEL_ID set in .env. Skipping auto-analysis.');
        return;
    }

    try {
        const channel = await client.channels.fetch(channelId);

        if (!channel || !channel.isTextBased()) {
            console.error(`❌ Channel ${channelId} not found or not text-based.`);
            return;
        }

        console.log('Running hourly auto-analysis...');
        const candles = await marketData.getCandles('BTCUSDT', '1h');
        const analysis = technicalAnalysis.analyze(candles);

        if (!analysis.setup) return;

        const embed = createAnalysisEmbed(analysis);
        embed.setTitle(`Hourly Bitcoin Update 🕒`); // Override title for auto-update

        await (channel as any).send({ embeds: [embed] });
    } catch (error) {
        console.error('Auto-analysis failed:', error);
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    console.log('Bot is ready to receive commands.');

    if (!process.env.DISCORD_CHANNEL_ID) {
        console.log('ℹ️  Tip: Add DISCORD_CHANNEL_ID to your .env file to enable hourly updates.');
    } else {
        // Schedule hourly updates (3600000 ms = 1 hour)
        console.log('📅 Hourly analysis scheduled.');
        setInterval(runAutoAnalysis, 3600000);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (!message.content && message.attachments.size === 0 && message.embeds.length === 0) {
        console.log(`⚠️ Received message from ${message.author.tag} with NO CONTENT. Check 'Message Content Intent' in Dev Portal.`);
        return;
    }

    const content = message.content.toLowerCase();

    if (content === '!analyze' || content === '!btc') {
        const loadingMsg = await message.reply('Analyzing BTC market data... 🔍');

        try {
            const candles = await marketData.getCandles('BTCUSDT', '1h');
            const analysis = technicalAnalysis.analyze(candles);

            console.log('Analysis Result:', JSON.stringify(analysis, null, 2));

            if (!analysis.setup) {
                console.error('Setup object is missing!', analysis);
                await loadingMsg.edit('⚠️ Error: Analysis failed to generate a trade setup. Please try again.');
                return;
            }

            const embed = createAnalysisEmbed(analysis);
            await loadingMsg.edit({ content: '', embeds: [embed] });

        } catch (error) {
            console.error(error);
            await loadingMsg.edit('Failed to fetch market data. Please try again later.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
