# Dataxis — US SVOD Market Analysis 2021–2022

## Quick Start
```bash
pip install -r requirements.txt
python backend/app.py
```
Open http://localhost:5000 (dashboard) or http://localhost:5000/report (one-page report).

## Structure
```
dataxis_svod/
├── backend/app.py          # Flask + ETL (pure csv + sqlite3, no pandas)
├── frontend/
│   ├── index.html          # Full Dataxis-branded dashboard
│   ├── report.html         # One-page analysis report
│   ├── css/styles.css      # Exact Dataxis brand design system
│   └── js/dashboard.js     # Chart.js 4.4 + explorer + filters
├── database/svod.db        # Auto-generated SQLite on first run
├── data/data.csv           # Source data (auto-downloaded if absent)
├── logs/pipeline.log       # ETL audit log
└── requirements.txt        # flask, flask-cors only
```

## API
| Endpoint | Description |
|---|---|
| `/api/kpis` | KPI cards |
| `/api/market_total` | Quarterly aggregate |
| `/api/top?n=15` | Top N platforms |
| `/api/growth` | YoY growth ranking |
| `/api/share` | Market share |
| `/api/segments` | Platform tiers |
| `/api/trends?actors=…` | Time-series |
| `/api/explorer` | Paginated table |
| `/api/actors` | Platform list |
