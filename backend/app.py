"""Dataxis SVOD Analysis — Flask Backend"""
import csv, sqlite3, logging, sys, urllib.request
from datetime import datetime
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

ROOT  = Path(__file__).resolve().parent.parent
CSV   = ROOT / "data"     / "data.csv"
DB    = ROOT / "database" / "svod.db"
LOG   = ROOT / "logs"     / "pipeline.log"
FRONT = ROOT / "frontend"
DROPBOX = ("https://www.dropbox.com/scl/fi/a0m7c4h4jwg0lpnnvcp5y/data.csv"
           "?rlkey=5gffw5lzjf2h45cgr7xrwrrgy&st=d16jyq5v&dl=1")

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG), logging.StreamHandler(sys.stdout)])
log = logging.getLogger(__name__)

app = Flask(__name__, static_folder=str(FRONT))
CORS(app)

def run_etl():
    if not CSV.exists():
        log.info("Downloading CSV…"); urllib.request.urlretrieve(DROPBOX, CSV)
    con = sqlite3.connect(DB); cur = con.cursor()
    cur.execute("DROP TABLE IF EXISTS svod")
    cur.execute("""CREATE TABLE svod(actor TEXT,fact_date TEXT,value INTEGER,year INTEGER,quarter TEXT)""")
    cur.execute("CREATE INDEX IF NOT EXISTS ia ON svod(actor)")
    cur.execute("CREATE INDEX IF NOT EXISTS id ON svod(fact_date)")
    n = 0
    with open(CSV, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            try:
                d = row["Fact_date"].strip()
                dt = datetime.strptime(d, "%Y-%m-%d")
                cur.execute("INSERT INTO svod VALUES(?,?,?,?,?)",
                    (row["Actor_label"].strip(), d, int(float(row["Kpi_value"].strip())),
                     dt.year, f"Q{(dt.month-1)//3+1} {dt.year}"))
                n += 1
            except: pass
    con.commit(); con.close(); log.info("ETL: %d rows", n)

def db():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; return c

@app.route("/api/kpis")
def api_kpis():
    con = db(); cur = con.cursor()
    cur.execute("""SELECT SUM(s.value) t, COUNT(DISTINCT s.actor) p FROM svod s
        JOIN (SELECT actor,MAX(fact_date) m FROM svod GROUP BY actor) x
        ON s.actor=x.actor AND s.fact_date=x.m""")
    r = cur.fetchone()
    cur.execute("SELECT SUM(value) v FROM svod WHERE fact_date='2021-12-31'"); y21=cur.fetchone()["v"] or 0
    cur.execute("SELECT SUM(value) v FROM svod WHERE fact_date='2022-12-31'"); y22=cur.fetchone()["v"] or 0
    con.close()
    return jsonify({"total":r["t"]or 0,"platforms":r["p"]or 0,"eoy21":y21,"eoy22":y22,
                    "growth":round((y22-y21)/y21*100,1) if y21 else 0})

@app.route("/api/market_total")
def api_market():
    con=db();cur=con.cursor()
    cur.execute("SELECT fact_date,SUM(value) total FROM svod GROUP BY fact_date ORDER BY fact_date")
    data=[dict(r) for r in cur.fetchall()]; con.close(); return jsonify(data)

@app.route("/api/top")
def api_top():
    n=min(int(request.args.get("n",15)),50)
    con=db();cur=con.cursor()
    cur.execute("""SELECT s.actor,s.value subs,s.fact_date FROM svod s
        JOIN (SELECT actor,MAX(fact_date) m FROM svod GROUP BY actor) x
        ON s.actor=x.actor AND s.fact_date=x.m ORDER BY subs DESC LIMIT ?""",(n,))
    data=[dict(r) for r in cur.fetchall()]; con.close(); return jsonify(data)

@app.route("/api/trends")
def api_trends():
    raw=request.args.get("actors","Netflix,Amazon Prime Video,Disney+,Hulu,Paramount+,HBO Max (2020-2023),ESPN D2C,Apple TV+,Peacock Premium")
    actors=[a.strip() for a in raw.split(",") if a.strip()]
    ph=",".join("?"*len(actors))
    con=db();cur=con.cursor()
    cur.execute(f"SELECT actor,fact_date,value FROM svod WHERE actor IN ({ph}) ORDER BY actor,fact_date",actors)
    out={}
    for r in cur.fetchall(): out.setdefault(r["actor"],[]).append({"date":r["fact_date"],"value":r["value"]})
    con.close(); return jsonify(out)

@app.route("/api/share")
def api_share():
    date=request.args.get("date","2022-12-31")
    con=db();cur=con.cursor()
    cur.execute("SELECT actor,value FROM svod WHERE fact_date=? ORDER BY value DESC",(date,))
    rows=[dict(r) for r in cur.fetchall()]; con.close()
    total=sum(r["value"] for r in rows)
    for r in rows: r["pct"]=round(r["value"]/total*100,2) if total else 0
    return jsonify({"date":date,"total":total,"platforms":rows})

@app.route("/api/growth")
def api_growth():
    con=db();cur=con.cursor()
    cur.execute("""SELECT a.actor,a.value v21,b.value v22,
        ROUND((CAST(b.value AS REAL)-a.value)/a.value*100,1) pct,(b.value-a.value) added
        FROM (SELECT actor,value FROM svod WHERE fact_date='2021-12-31') a
        JOIN (SELECT actor,value FROM svod WHERE fact_date='2022-12-31') b ON a.actor=b.actor
        WHERE a.value>=50000 ORDER BY pct DESC LIMIT 20""")
    data=[dict(r) for r in cur.fetchall()]; con.close(); return jsonify(data)

@app.route("/api/segments")
def api_segments():
    con=db();cur=con.cursor()
    cur.execute("""SELECT s.actor,s.value FROM svod s
        JOIN (SELECT actor,MAX(fact_date) m FROM svod GROUP BY actor) x
        ON s.actor=x.actor AND s.fact_date=x.m ORDER BY s.value DESC""")
    segs={"Mega (50M+)":[],"Large (10–50M)":[],"Mid (1–10M)":[],"Small (100K–1M)":[],"Niche (<100K)":[]}
    for r in cur.fetchall():
        v=r["value"]
        if v>=50_000_000: segs["Mega (50M+)"].append(r["actor"])
        elif v>=10_000_000: segs["Large (10–50M)"].append(r["actor"])
        elif v>=1_000_000: segs["Mid (1–10M)"].append(r["actor"])
        elif v>=100_000: segs["Small (100K–1M)"].append(r["actor"])
        else: segs["Niche (<100K)"].append(r["actor"])
    con.close()
    return jsonify({k:{"count":len(v),"actors":v} for k,v in segs.items()})

@app.route("/api/explorer")
def api_explorer():
    page=max(1,int(request.args.get("page",1))); lim=min(int(request.args.get("limit",25)),100)
    q=request.args.get("q","").strip(); sort=request.args.get("sort","v22")
    order="ASC" if request.args.get("order","desc")=="asc" else "DESC"
    valid={"actor","v21","v22","added","pct"}
    if sort not in valid: sort="v22"
    wh="WHERE actor LIKE ?" if q else ""; params=[f"%{q}%"] if q else []
    con=db();cur=con.cursor()
    # Use first and last available date per platform — shows ALL 131 platforms
    cur.execute(f"""
        SELECT actor, first_val v21, last_val v22,
               (last_val - first_val) added,
               CASE WHEN first_val > 0
                    THEN ROUND((CAST(last_val AS REAL) - first_val) / first_val * 100, 1)
                    ELSE NULL END pct
        FROM (
            SELECT s.actor,
                   (SELECT value FROM svod WHERE actor=s.actor ORDER BY fact_date ASC  LIMIT 1) first_val,
                   (SELECT value FROM svod WHERE actor=s.actor ORDER BY fact_date DESC LIMIT 1) last_val
            FROM (SELECT DISTINCT actor FROM svod {wh}) s
        )
        ORDER BY {sort} {order}
        LIMIT ? OFFSET ?
    """, params + [lim, (page-1)*lim])
    rows=[dict(r) for r in cur.fetchall()]
    cur.execute(f"SELECT COUNT(DISTINCT actor) n FROM svod {wh}", params)
    total=cur.fetchone()["n"]; con.close()
    return jsonify({"data":rows,"total":total,"page":page,"pages":-(-total//lim)})

@app.route("/api/declining")
def api_declining():
    """Platforms with net subscriber loss over their full tracked period."""
    con=db();cur=con.cursor()
    cur.execute("""
        SELECT actor,
          (SELECT value    FROM svod WHERE actor=s.actor ORDER BY fact_date ASC  LIMIT 1) v_first,
          (SELECT value    FROM svod WHERE actor=s.actor ORDER BY fact_date DESC LIMIT 1) v_last,
          (SELECT fact_date FROM svod WHERE actor=s.actor ORDER BY fact_date ASC  LIMIT 1) d_first,
          (SELECT fact_date FROM svod WHERE actor=s.actor ORDER BY fact_date DESC LIMIT 1) d_last
        FROM (SELECT DISTINCT actor FROM svod) s
    """)
    result=[]
    for actor,v_first,v_last,d_first,d_last in cur.fetchall():
        if v_first and v_first>0:
            pct=round((v_last-v_first)/v_first*100,1)
            if pct<0:
                result.append({'actor':actor,'v_first':v_first,'v_last':v_last,
                                'd_first':d_first,'d_last':d_last,'pct':pct})
    result.sort(key=lambda x: x['pct'])
    con.close()
    return jsonify(result)


    con=db();cur=con.cursor()
    cur.execute("SELECT DISTINCT actor FROM svod ORDER BY actor")
    actors=[r["actor"] for r in cur.fetchall()]; con.close(); return jsonify(actors)

@app.route("/")
def index(): return send_from_directory(FRONT,"report.html")
@app.route("/report")
def report(): return send_from_directory(FRONT,"report.html")
@app.route("/<path:p>")
def static_f(p): return send_from_directory(FRONT,p)

if __name__=="__main__":
    run_etl()
    log.info("http://localhost:5000")
    app.run(host="0.0.0.0",port=5000,debug=False)
