const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());

const EUR_USD = 1.083;
const USD_SET = new Set(["BKNG","MELI","CRWD","BABA","UBER","AMZN","IREN","PATH"]);
const FH_KEY = "d7fc4h1r01qpjqqk9c6gd7fc4h1r01qpjqqk9c70";

// Map ticker -> symbole Finnhub
const FH_MAP = {
  WPEA:"EURONEXT:WPEA", AEEM:"EURONEXT:AEEM", CPOL:"EURONEXT:CPOL",
  BMAT:"EURONEXT:BMAT", ISUN:"EURONEXT:ISUN", URAN:"EURONEXT:URAN",
  SU:"EURONEXT:SU",     EL:"EURONEXT:EL",     VIE:"EURONEXT:VIE",
  CA:"EURONEXT:CA",     COFA:"EURONEXT:COFA", VU:"EURONEXT:VU",
  VDN:"EURONEXT:VDN",   FDJ:"EURONEXT:FDJ",   VAC:"EURONEXT:VAC",
  EMEIS:"EURONEXT:EMEIS", ALMDT:"EURONEXT:ALMDT",
  BKNG:"BKNG", MELI:"MELI", CRWD:"CRWD",
  BABA:"BABA", UBER:"UBER", AMZN:"AMZN",
  IREN:"IREN", PATH:"PATH",
  BTC:"BINANCE:BTCEUR",
};

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      timeout: 8000
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchFinnhub(symbol) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FH_KEY}`;
  const body = await httpsGet(url);
  const d = JSON.parse(body);
  // c = current price, pc = previous close (fallback si marche ferme)
  const price = (d.c && d.c > 0) ? d.c : (d.pc && d.pc > 0 ? d.pc : null);
  return price;
}

app.get('/prices', async (req, res) => {
  console.log(`[${new Date().toISOString()}] Fetching ${Object.keys(FH_MAP).length} prices via Finnhub...`);
  const prices = {};

  // Finnhub : max 60 appels/min sur plan gratuit
  // On fetch par batch de 10 avec pause entre batches
  const entries = Object.entries(FH_MAP);
  const BATCH = 10;

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    await Promise.all(batch.map(async ([ticker, fhSym]) => {
      try {
        const raw = await fetchFinnhub(fhSym);
        if (raw && raw > 0) {
          prices[ticker] = USD_SET.has(ticker) ? raw / EUR_USD : raw;
          console.log(`OK ${ticker}: ${prices[ticker].toFixed(2)}`);
        } else {
          console.log(`MISS ${ticker} (${fhSym})`);
        }
      } catch(e) {
        console.log(`ERR ${ticker}: ${e.message}`);
      }
    }));
    // Petite pause entre batches pour respecter le rate limit
    if (i + BATCH < entries.length) await new Promise(r => setTimeout(r, 600));
  }

  const count = Object.keys(prices).length;
  console.log(`Done: ${count}/${entries.length} prices fetched`);
  res.json({ success: true, count, timestamp: new Date().toISOString(), prices });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Portfolio Price API - Finnhub', endpoint: '/prices' });
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
