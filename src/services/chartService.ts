
import axios from 'axios';

export class ChartService {
    async generateChartUrl(symbol: string, candles: any[]): Promise<string> {
        // Limit candles to last 50 for clarity
        const recentCandles = candles.slice(-50);

        const labels = recentCandles.map((c: any) => new Date(c.closeTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        const closePrices = recentCandles.map((c: any) => c.close);

        // Simple line chart configuration for QuickChart
        const chartConfig = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${symbol} Price`,
                    data: closePrices,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                title: {
                    display: true,
                    text: `${symbol} - Last 50 Hours`
                },
                scales: {
                    xAxes: [{
                        display: false // Hide x-axis labels to save space
                    }]
                }
            }
        };

        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
        return chartUrl;
    }
}
