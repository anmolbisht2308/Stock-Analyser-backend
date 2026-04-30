import {
  RSI,
  MACD,
  SMA,
  EMA,
  BollingerBands,
  ATR,
  ADX,
  Stochastic,
  OBV,
  VWAP,
  WilliamsR,
  CCI,
  MFI,
  IchimokuCloud,
  PSAR,
} from "technicalindicators";
import type { OHLCVBar } from "../services/marketDataService";

export type ComputedTechnicals = {
  rsi: number;
  macd: { value: number; signal: number; histogram: number };
  sma20: number;
  sma50: number;
  sma200: number;
  ema9: number;
  ema21: number;
  bollingerBands: { upper: number; middle: number; lower: number };
  atr: number;
  adx: number;
  stochastic: { k: number; d: number };
  obv: number;
  vwap: number;
  williamsR: number;
  cci: number;
  mfi: number;
  ichimoku: { conversion: number; base: number; spanA: number; spanB: number };
  parabolicSar: number;
  fibonacci: { level: number; price: number }[];
  volumeSma20: number;
};

function lastOr<T>(arr: T[], fallback: T): T {
  const v = arr[arr.length - 1];
  return v ?? fallback;
}

function toFixedNum(n: number, digits = 4): number {
  const x = Number(n.toFixed(digits));
  return Number.isFinite(x) ? x : 0;
}

export function computeTechnicals(bars: OHLCVBar[]): ComputedTechnicals {
  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const volumes = bars.map((b) => b.volume);

  const rsiArr = RSI.calculate({ values: closes, period: 14 });
  const rsi = toFixedNum(lastOr(rsiArr, 0), 2);

  const macdArr = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const macdLast = lastOr(macdArr, { MACD: 0, signal: 0, histogram: 0 });

  const sma20 = toFixedNum(lastOr(SMA.calculate({ values: closes, period: 20 }), 0), 4);
  const sma50 = toFixedNum(lastOr(SMA.calculate({ values: closes, period: 50 }), 0), 4);
  const sma200 = toFixedNum(lastOr(SMA.calculate({ values: closes, period: 200 }), 0), 4);

  const ema9 = toFixedNum(lastOr(EMA.calculate({ values: closes, period: 9 }), 0), 4);
  const ema21 = toFixedNum(lastOr(EMA.calculate({ values: closes, period: 21 }), 0), 4);

  const bbArr = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const bbLast = lastOr(bbArr, { upper: 0, middle: 0, lower: 0, pb: 0 });

  const atrArr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const atr = toFixedNum(lastOr(atrArr, 0), 4);

  const adxArr = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const adx = toFixedNum(lastOr(adxArr, { adx: 0, pdi: 0, mdi: 0 }).adx, 2);

  const stochArr = Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 });
  const stochLast = lastOr(stochArr, { k: 0, d: 0 });

  const obvArr = OBV.calculate({ close: closes, volume: volumes });
  const obv = toFixedNum(lastOr(obvArr, 0), 2);

  const vwapArr = VWAP.calculate({
    close: closes,
    high: highs,
    low: lows,
    volume: volumes,
  });
  const vwap = toFixedNum(lastOr(vwapArr, 0), 4);

  const willArr = WilliamsR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const williamsR = toFixedNum(lastOr(willArr, 0), 2);

  const cciArr = CCI.calculate({ high: highs, low: lows, close: closes, period: 20 });
  const cci = toFixedNum(lastOr(cciArr, 0), 2);

  const mfiArr = MFI.calculate({ high: highs, low: lows, close: closes, volume: volumes, period: 14 });
  const mfi = toFixedNum(lastOr(mfiArr, 0), 2);

  const ichArr = IchimokuCloud.calculate({
    high: highs,
    low: lows,
    conversionPeriod: 9,
    basePeriod: 26,
    spanPeriod: 52,
    displacement: 26,
  });
  const ichLast = lastOr(ichArr, { conversion: 0, base: 0, spanA: 0, spanB: 0 });

  const psarArr = PSAR.calculate({ high: highs, low: lows, step: 0.02, max: 0.2 });
  const parabolicSar = toFixedNum(lastOr(psarArr, 0), 4);

  const volSma20 = SMA.calculate({ values: volumes, period: 20 });
  const volumeSma20 = toFixedNum(lastOr(volSma20, 0), 2);

  const window = bars.slice(-252); // up to 1y trading days
  const high52w = Math.max(...window.map((b) => b.high));
  const low52w = Math.min(...window.map((b) => b.low));
  const diff = high52w - low52w;
  const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((lvl) => ({
    level: lvl,
    price: toFixedNum(high52w - diff * lvl, 4),
  }));

  return {
    rsi,
    macd: {
      value: toFixedNum(macdLast.MACD ?? 0, 4),
      signal: toFixedNum(macdLast.signal ?? 0, 4),
      histogram: toFixedNum(macdLast.histogram ?? 0, 4),
    },
    sma20,
    sma50,
    sma200,
    ema9,
    ema21,
    bollingerBands: { upper: toFixedNum(bbLast.upper, 4), middle: toFixedNum(bbLast.middle, 4), lower: toFixedNum(bbLast.lower, 4) },
    atr,
    adx,
    stochastic: { k: toFixedNum(stochLast.k, 2), d: toFixedNum(stochLast.d, 2) },
    obv,
    vwap,
    williamsR,
    cci,
    mfi,
    ichimoku: {
      conversion: toFixedNum(ichLast.conversion, 4),
      base: toFixedNum(ichLast.base, 4),
      spanA: toFixedNum(ichLast.spanA, 4),
      spanB: toFixedNum(ichLast.spanB, 4),
    },
    parabolicSar,
    fibonacci: fibLevels,
    volumeSma20: volumeSma20,
  };
}

