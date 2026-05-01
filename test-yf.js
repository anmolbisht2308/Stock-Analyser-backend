import YahooFinance from 'yahoo-finance2';

async function test() {
  const yf = new YahooFinance();
  const ticker = 'BAJAJHFL.NS';
  try {
    const quote = await yf.quote(ticker);
    console.log('Quote:', quote.regularMarketPrice);
    
    const chart = await yf.chart(ticker, { period1: '2023-01-01' });
    console.log('Chart points:', chart.quotes.length);
    
    const search = await yf.search('Bajaj Housing');
    console.log('Search:', search.quotes[0]);
    
    const news = await yf.search(ticker, { newsCount: 5 });
    console.log('News:', news.news.length);
    
    const summary = await yf.quoteSummary(ticker, {
      modules: ['financialData', 'defaultKeyStatistics', 'summaryProfile', 'recommendationTrend']
    });
    console.log('Summary Profile:', summary.summaryProfile?.sector);
  } catch (err) {
    console.error(err);
  }
}

test();
