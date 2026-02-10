
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import * as dotenv from 'dotenv';
import { MarketDataService } from './services/marketData';
import { TechnicalAnalysisService, AnalysisResult } from './services/technicalAnalysis';
import { ChartService } from './services/chartService';
import { PaperTradingService } from './services/paperTrading';

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
const chartService = new ChartService();
const paperTrading = new PaperTradingService();

/**
 * Creates a Discord Embed for the analysis result
 */
async function createAnalysisEmbed(pair: string, analysis: AnalysisResult, chartUrl: string): Promise<EmbedBuilder> {
    const setup = analysis.setup;
    if (!setup) throw new Error('Analysis setup is missing');

    const direction = setup.direction;
    let embedColor = 0x95a5a6; // Grey (Neutral)
    if (direction === 'LONG') embedColor = 0x2ecc71; // Green
    else if (direction === 'SHORT') embedColor = 0xe74c3c; // Red

    const setupEmoji = direction === 'LONG' ? '🟢' : direction === 'SHORT' ? '🔴' : '⚪';

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${pair} Analysis 📊`)
        .setDescription(`**Price:** $${analysis.currentPrice?.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
        .setImage(chartUrl) // Main Chart Image
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/cryptocurrency/cryptocurrency.png')
        .addFields(
            {
                name: '📈 Trend Check',
                value: `${setupEmoji} **${direction}**\n*${setup.reason}*`,
                inline: false
            },
            {
                name: '📊 Indicators',
                value: `**RSI:** ${analysis.rsi?.toFixed(2)}\n**MACD:** ${analysis.macd?.toFixed(2)}`,
                inline: true
            },
            {
                name: '📉 Volatility',
                value: `**ATR:** ${analysis.atr?.toFixed(2)}\n**EMA:** $${analysis.ema50?.toFixed(2)}`,
                inline: true
            },
            { name: '\u200b', value: '\u200b', inline: false },
            {
                name: '🎯 Setup',
                value: `\`\`\`yaml
Entry: $${setup.entry?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
TP:    $${setup.takeProfit?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
SL:    $${setup.stopLoss?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
R/R:   ${setup.riskRewardRatio}:1
\`\`\``,
                inline: false
            }
        )
        .setFooter({ text: `PID: ${process.pid} • Paper Trading with Leverage! 🚀` })
        .setTimestamp();

    return embed;
}

// Auto-Analysis Function (Hourly BTC Check)
async function runAutoAnalysis() {
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId) return;

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) return;

        console.log('Running hourly auto-analysis for BTC...');
        const candles = await marketData.getCandles('BTCUSDT', '1h');
        const analysis = technicalAnalysis.analyze(candles);

        if (!analysis.setup) return;

        const chartUrl = await chartService.generateChartUrl('BTC', candles);
        const embed = await createAnalysisEmbed('BTC/USDT', analysis, chartUrl);
        embed.setTitle(`Hourly BTC Update 🕒`);

        await (channel as any).send({ embeds: [embed] });
    } catch (error) {
        console.error('Auto-analysis failed:', error);
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    console.log('Bot is ready. Commands: !long, !short, !close, !portfolio, !reset');

    if (process.env.DISCORD_CHANNEL_ID) {
        // Schedule hourly updates (3600000 ms = 1 hour)
        setInterval(runAutoAnalysis, 3600000);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.trim();
    if (!content.startsWith('!')) return;

    const args = content.split(' ');
    const command = args[0].toLowerCase();

    // ANALYZE COMMAND: !analyze ETH or !btc
    if (command === '!analyze' || command === '!btc') {
        const symbolInput = (command === '!btc' && !args[1]) ? 'BTC' : (args[1] || 'BTC');
        const symbol = symbolInput.toUpperCase();
        const pair = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;

        const loadingMsg = await message.reply(`Analyzing ${symbol}... 🔍`);

        try {
            const candles = await marketData.getCandles(pair, '1h');
            const analysis = technicalAnalysis.analyze(candles);

            if (!analysis.setup) {
                await loadingMsg.edit('⚠️ Analysis failed. No clear setup found.');
                return;
            }

            const chartUrl = await chartService.generateChartUrl(symbol, candles);
            const embed = await createAnalysisEmbed(pair, analysis, chartUrl);

            await loadingMsg.edit({ content: '', embeds: [embed] });

        } catch (error) {
            console.error(error);
            await loadingMsg.edit(`❌ Failed to fetch data for ${symbol}. Is the symbol correct?`);
        }
    }

    // PAPER TRADING: LEVERAGED LONG/SHORT (!long BTC 100 10)
    else if (command === '!long' || command === '!short') {
        const type = command === '!long' ? 'LONG' : 'SHORT';
        const symbol = (args[1] || '').toUpperCase();
        const margin = parseFloat(args[2]);
        const leverage = parseFloat(args[3] || '1');

        if (!symbol || isNaN(margin) || isNaN(leverage)) {
            await message.reply(`Usage: \`${command} <SYMBOL> <MARGIN> <LEVERAGE>\`\nExample: \`!long BTC 100 10\` (Long BTC with $100 margin at 10x leverage)`);
            return;
        }

        const pair = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;

        try {
            const candles = await marketData.getCandles(pair, '1h');
            const currentPrice = candles[candles.length - 1].close;

            const resultMsg = paperTrading.openPosition(message.author.id, symbol, type, margin, leverage, currentPrice);
            await message.reply(resultMsg);
        } catch (error) {
            await message.reply(`❌ Could not fetch price for ${symbol}.`);
        }
    }

    // PAPER TRADING: CLOSE POSITION (!close BTC)
    else if (command === '!close') {
        const symbol = (args[1] || '').toUpperCase();

        if (!symbol) {
            await message.reply('Usage: `!close <SYMBOL>` (e.g. `!close BTC`)');
            return;
        }

        const pair = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
        try {
            const candles = await marketData.getCandles(pair, '1h');
            const currentPrice = candles[candles.length - 1].close;

            const resultMsg = paperTrading.closePosition(message.author.id, symbol, currentPrice);
            await message.reply(resultMsg);
        } catch (error) {
            await message.reply(`❌ Could not fetch price for ${symbol}.`);
        }
    }

    // PAPER TRADING: PORTFOLIO
    else if (command === '!portfolio' || command === '!p' || command === '!balance') {
        const user = paperTrading.getUser(message.author.id);

        let holdingsText = '';

        for (const [sym, pos] of Object.entries(user.holdings)) {
            // @ts-ignore
            const type = pos.type; // Direct access since we know the structure
            // @ts-ignore
            const leverage = pos.leverage;
            // @ts-ignore
            const entry = pos.averagePrice;
            // @ts-ignore
            const margin = pos.margin;

            const emoji = type === 'LONG' ? '🟢' : '🔴';
            holdingsText += `**${emoji} ${type} ${leverage}x ${sym}**\nEntry: $${entry.toFixed(2)} | Margin: $${margin.toFixed(2)}\n\n`;
        }

        if (!holdingsText) holdingsText = 'No open positions.';

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(`${message.author.username}'s Futures Portfolio 🚀`)
            .addFields(
                { name: '💵 Available Balance', value: `$${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, inline: true },
                { name: '📈 Open Positions', value: holdingsText, inline: false }
            )
            .setFooter({ text: 'Use !reset to restart with $10k' });

        await message.reply({ embeds: [embed] });
    }

    // PAPER TRADING: RESET
    else if (command === '!reset') {
        const result = paperTrading.reset(message.author.id);
        await message.reply(result);
    }

    // HELP
    else if (command === '!help') {
        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('🤖 Bot Commands')
            .addFields(
                { name: '🔍 Analysis', value: '`!analyze <COIN>` - Technical analysis & Chart' },
                { name: '💸 Trading', value: '`!long <COIN> <MARGIN> <LEV>` - Open Long (e.g. `!long BTC 100 10`)\n`!short <COIN> <MARGIN> <LEV>` - Open Short\n`!close <COIN>` - Close position' },
                { name: '💼 Account', value: '`!portfolio` - View positions\n`!reset` - Reset to $10k' }
            );
        await message.reply({ embeds: [embed] });
    }
});

client.login(process.env.DISCORD_TOKEN);
