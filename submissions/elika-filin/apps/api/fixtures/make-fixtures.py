# Builds the two adapter fixtures for change add-catalog from the 2026-10-04 captures.
#  karashynyard.html : real Tilda markup — 3 heading records (type 43) + 3 store records (type 776) kept whole,
#                      with every product card removed except 2 + 2 + 1 (the last one repeats lid 1498486363994,
#                      because Tilda reuses lids across records). Records stay structurally intact (balanced divs).
#  osio.json         : the real GET /v1/products response trimmed to its first 12 items
# Usage: SCRAPE=<dir with karashynyard/page.html and osio/products.json> python3 make-fixtures.py
import re, json, os
S = os.environ.get("SCRAPE", "/private/tmp/claude-501/-Users-elikafilin-Documents-home-projects-organic-shop-orchestrator/364dc8be-543d-4eb4-afd8-6b19b67b4f42/scratchpad/scrape")
OUT = os.path.dirname(os.path.abspath(__file__))
raw = open(S + "/karashynyard/page.html", encoding="utf-8", errors="ignore").read()
recs = [(m.group(1), m.start()) for m in re.finditer(r'<div id="(rec\d+)" class="r t-rec[^"]*"[^>]*data-record-type="\d+"', raw)]
bounds = {rid: (pos, (recs[i + 1][1] if i + 1 < len(recs) else len(raw))) for i, (rid, pos) in enumerate(recs)}
KEEP = {"rec638772397": ["1498486363994", "1628604400123"], "rec638782031": ["1781040705497", "1652947963962"], "rec638793505": ["1498486363994"]}
TAG = re.compile(r'<div\b|</div>')
def element_end(s, start):
    depth = 0
    for m in TAG.finditer(s, start):
        depth += 1 if m.group(0) != "</div>" else -1
        if depth == 0:
            return m.end()
    raise ValueError("unbalanced")
def record(rid):
    a, b = bounds[rid]; return raw[a:b]
def trim_store(rid, lids):
    block = record(rid)
    cards = []
    # every element that carries a lid: the grid card (t776__col … js-product) and the product popup block
    for m in re.finditer(r'<div\b[^>]*\bdata-product-lid="(\d+)"[^>]*>', block):
        cards.append((m.start(), element_end(block, m.start()), m.group(1)))
    out, cursor, kept = [], 0, 0
    for a, b, lid in cards:
        if a < cursor:  # nested inside an element already handled
            continue
        out.append(block[cursor:a])
        if lid in lids:
            out.append(block[a:b]); kept += 1
        cursor = b
    out.append(block[cursor:])
    assert kept >= len(lids), (rid, kept)
    return "".join(out)
html = ('<!DOCTYPE html>\n<html lang="uk"><head><meta charset="utf-8"><title>Карашин Яр — fixture (trimmed capture of https://karashynyard.com.ua/, 2026-10-04)</title></head>\n<body>\n<div id="allrecords" class="t-records">\n'
        + record("rec2364055923") + "\n" + trim_store("rec638772397", KEEP["rec638772397"]) + "\n"
        + record("rec2366129053") + "\n" + trim_store("rec638782031", KEEP["rec638782031"]) + "\n"
        + record("rec2375538863") + "\n" + trim_store("rec638793505", KEEP["rec638793505"]) + "\n"
        + "</div>\n</body></html>\n")
open(OUT + "/karashynyard.html", "w", encoding="utf-8").write(html)
products = json.load(open(S + "/osio/products.json", encoding="utf-8"))
json.dump(products[:12], open(OUT + "/osio.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("karashynyard.html bytes", len(html.encode()), "cards", len(re.findall(r'js-product" data-product-lid="', html)), "lid elements", html.count('data-product-lid="'), "records", len(re.findall(r'data-record-type="', html)), "divs balanced", len(re.findall(r'<div\b', html)) == html.count("</div>"))
print("osio.json items", len(products[:12]), "bytes", os.path.getsize(OUT + "/osio.json"))
