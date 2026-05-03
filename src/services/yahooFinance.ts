import YahooFinance from 'yahoo-finance2';

YahooFinance.setGlobalConfig({
  suppressNotices: ['yahooSurvey'],
  queue: { concurrency: 1, timeout: 60000 },
});

export const yf = YahooFinance;
