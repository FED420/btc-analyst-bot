
import * as fs from 'fs';
import * as path from 'path';

interface UserPortfolio {
    balance: number; // USDT
    holdings: { [symbol: string]: Position };
    trades: Trade[];
}

interface Position {
    amount: number;      // Coin Amount
    averagePrice: number; // Avg Entry
    leverage: number;    // 1x, 10x, etc.
    margin: number;      // USDT Margin Locked
    type: 'LONG' | 'SHORT';
}

interface Trade {
    type: 'BUY' | 'SELL' | 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT';
    symbol: string;
    amount: number;
    price: number;
    total: number;
    leverage: number;
    pnl?: number;       // Profit/Loss in USDT
    timestamp: number;
}

export class PaperTradingService {
    private dataPath = path.join(__dirname, '../data/users.json');
    private users: { [id: string]: UserPortfolio } = {};

    constructor() {
        this.loadUsers();
    }

    private loadUsers() {
        try {
            if (fs.existsSync(this.dataPath)) {
                this.users = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'));
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            this.users = {};
        }
    }

    private saveUsers() {
        try {
            fs.writeFileSync(this.dataPath, JSON.stringify(this.users, null, 2));
        } catch (error) {
            console.error('Error saving user data:', error);
        }
    }

    getUser(userId: string): UserPortfolio {
        if (!this.users[userId]) {
            this.users[userId] = {
                balance: 10000,
                holdings: {},
                trades: []
            };
            this.saveUsers();
        }
        return this.users[userId];
    }

    openPosition(userId: string, symbol: string, type: 'LONG' | 'SHORT', margin: number, leverage: number, currentPrice: number): string {
        const user = this.getUser(userId);

        if (user.balance < margin) return `❌ Insufficient balance ($${user.balance.toFixed(2)}).`;
        if (leverage < 1 || leverage > 125) return `❌ Invalid leverage (1-125x).`;

        // Check if position exists? For simplicity, allow one position per symbol per side or just one per symbol.
        if (user.holdings[symbol]) return `⚠️ You already have a position in ${symbol}. Close it first!`;

        const positionSize = margin * leverage;
        const amount = positionSize / currentPrice;

        user.balance -= margin; // Lock margin
        user.holdings[symbol] = {
            type,
            amount: type === 'LONG' ? amount : -amount, // Negative amount for shorts conceptually, but we store absolute
            averagePrice: currentPrice,
            leverage,
            margin
        };

        user.trades.push({
            type: type === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT',
            symbol,
            amount,
            price: currentPrice,
            total: positionSize,
            leverage,
            timestamp: Date.now()
        });

        this.saveUsers();
        return `✅ Opened ${leverage}x ${type} on ${symbol}.\nEntry: $${currentPrice.toFixed(2)}\nMargin: $${margin.toFixed(2)}\nSize: ${amount.toFixed(4)} ${symbol}`;
    }

    closePosition(userId: string, symbol: string, currentPrice: number): string {
        const user = this.getUser(userId);
        const position = user.holdings[symbol];

        if (!position) return `❌ No open position for ${symbol}.`;

        // Calculate PnL
        // Long PnL = (Exit - Entry) * Amount
        // Short PnL = (Entry - Exit) * Amount (Absolute amount)

        let pnl = 0;
        const amount = Math.abs(position.amount);

        if (position.type === 'LONG') {
            pnl = (currentPrice - position.averagePrice) * amount;
        } else {
            pnl = (position.averagePrice - currentPrice) * amount;
        }

        const payout = position.margin + pnl;
        user.balance += payout;

        delete user.holdings[symbol];

        user.trades.push({
            type: position.type === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT',
            symbol,
            amount,
            price: currentPrice,
            total: payout,
            leverage: position.leverage,
            pnl,
            timestamp: Date.now()
        });

        this.saveUsers();
        const pnlEmoji = pnl >= 0 ? '🟢' : '🔴';
        return `${pnlEmoji} Closed ${position.leverage}x ${position.type} on ${symbol}.\nExit: $${currentPrice.toFixed(2)}\nPnL: $${pnl.toFixed(2)}\nNew Balance: $${user.balance.toFixed(2)}`;
    }

    reset(userId: string): string {
        this.users[userId] = {
            balance: 10000,
            holdings: {},
            trades: []
        };
        this.saveUsers();
        return `🔄 Account reset to $10,000.`;
    }
}
