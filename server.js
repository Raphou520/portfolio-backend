const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS ouvert pour autoriser ton site GitHub Pages
app.use(cors());
app.use(express.json());

const EUR_USD = 1.083;
const USD_TICKERS = new Set(["BKNG","MELI","CRWD","BABA","UBER","AMZN","IREN","PATH"]);

// Mapping ticker interne -> symbole Yahoo Finance
const YF_MAP = {
  WPEA:"WPEA.PA", AEEM:"AEEM.PA", CPOL:"CPOL.PA", BMAT:"BMAT.PA",
  ISUN:"ISUN.PA", URAN:"URAN.PA",
  SU:"SU.PA",     EL:"EL.PA",     VIE:"VIE.PA",   CA:"CA.PA",
  COFA:"COFA.PA", VU:"VU.PA",     VDN:"VDN.PA",   FDJ:"FDJ.PA",
  VAC:"VAC.PA",   EMEIS:"EMEIS.PA", ALMDT:"ALMDT.PA",
  BKNG:"BKNG",    MELI:"MELI",    CRWD:"CRWD",
  BABA:"BABA",    UBER:"UBER",    AMZN:"AMZN",
  IREN:"IREN",    PATH:"PATH",
  BTC:"BTC-EUR"
};

// Fetch un prix via Yahoo Finance v7 (depuis serveur = pas de CORS)
async function fetchYahoo(symbols) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=regularMarketPrice,previousClose`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  const r = await fetch(url, { headers, timeout: 10000 });
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
  const data = await r.json();
  return data?.quoteResponse?.result || [];
}

// Route principale : GET /prices
app.get('/prices', async (req, res) => {
  try {
    const yfSymbols = Object.values(YF_MAP);
    const quotes = await fetchYahoo(yfSymbols);

    // Construire map yfSymbol -> prix
    const yfPriceMap = {};
    quotes.forEach(q => {
      const price = q.regularMarketPrice ?? q.previousClose;
      if (price && price > 0) yfPriceMap[q.symbol] = price;
    });

    // Convertir en map ticker interne -> prix EUR
    const prices = {};
    Object.entries(YF_MAP).forEach(([ticker, yfSym]) => {
      const raw = yfPriceMap[yfSym];
      if (raw == null) return;
      prices[ticker] = USD_TICKERS.has(ticker) ? raw / EUR_USD : raw;
    });

    const count = Object.keys(prices).length;
    console.log(`[${new Date().toISOString()}] Prices fetched: ${count}`);

    res.json({
      success: true,
      count,
      timestamp: new Date().toISOString(),
      prices
    });

  } catch (err) {
    console.error('Error:', err.message);
    // Essayer query2 si query1 echoue
    try {
      const yfSymbols = Object.values(YF_MAP);
      const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${yfSymbols.join(',')}&fields=regularMarketPrice,previousClose`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
        },
        timeout: 10000
      });
      const data = await r.json();
      const quotes = data?.quoteResponse?.result || [];
      const prices = {};
      quotes.forEach(q => {
        const raw = q.regularMarketPrice ?? q.previousClose;
        if (!raw || raw <= 0) return;
        const ticker = Object.entries(YF_MAP).find(([,v]) => v === q.symbol)?.[0];
        if (ticker) prices[ticker] = USD_TICKERS.has(ticker) ? raw / EUR_USD : raw;
      });
      res.json({ success: true, count: Object.keys(prices).length, timestamp: new Date().toISOString(), prices });
    } catch (err2) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Portfolio price API running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
