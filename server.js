const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const EUR_USD = 1.083;
const USD_SET = new Set(["BKNG","MELI","CRWD","BABA","UBER","AMZN","IREN","PATH"]);

const STOOQ = {
  WPEA:"wpea.pa", AEEM:"aeem.pa", CPOL:"cpol.pa", BMAT:"bmat.pa",
  ISUN:"isun.pa", URAN:"uran.pa",
  SU:"su.pa",     EL:"ml.pa",     VIE:"vie.pa",   CA:"ca.pa",
  COFA:"cofa.pa", VU:"vu.pa",     VDN:"vdn.pa",   FDJ:"fdj.pa",
  VAC:"vac.pa",   EMEIS:"emeis.pa", ALMDT:"almdt.pa",
  BKNG:"bkng.us", MELI:"meli.us", CRWD:"crwd.us",
  BABA:"baba.us", UBER:"uber.us", AMZN:"amzn.us",
  IREN:"iren.us", PATH:"path.us",
};

async function fetchBTC() {
  const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur', { timeout: 8000 });
  const d = await r.json();
  return d?.bitcoin?.eur || null;
}

async function fetchStooq(symbol) {
  const url = `https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&h&e=csv`;
  const r = await fetch(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const text = await r.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;
  const cols = lines[1].split(',');
  const close = parseFloat(cols[4]);
  return (!isNaN(close) && close > 0) ? close : null;
}

app.get('/prices', async (req, res) => {
  console.log(`[${new Date().toISOString()}] Fetching prices...`);
  const prices = {};

  try {
    const btc = await fetchBTC();
    if (btc) prices['BTC'] = btc;
  } catch(e) {}

  await Promise.all(
    Object.entries(STOOQ).map(async ([ticker, sym]) => {
      try {
        const p = await fetchStooq(sym);
        if (p) prices[ticker] = USD_SET.has(ticker) ? p / EUR_USD : p;
      } catch(e) {}
    })
  );

  const count = Object.keys(prices).length;
  console.log(`Done: ${count} prices`);
  res.json({ success: true, count, timestamp: new Date().toISOString(), prices });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Portfolio Price API' });
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
