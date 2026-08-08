import json, subprocess, os, sys, re, concurrent.futures
sys.path.insert(0,'/Users/naeemsani/Documents/halal/scripts/seed')
from report import freetext_violations
SB=os.environ['SUPABASE_URL']+'/rest/v1'; SK=os.environ['SUPABASE_SERVICE_ROLE_KEY']
# proper adjectives stay capitalised; common-noun cuisines lowercased
CUISINE={'middle_eastern':'Middle Eastern','indian':'Indian','malay_indonesian':'Malay-Indonesian',
 'malaysian':'Malaysian','indonesian':'Indonesian','chinese':'Chinese','japanese':'Japanese',
 'korean':'Korean','thai':'Thai','vietnamese':'Vietnamese','western':'Western','seafood':'seafood',
 'dessert':'dessert','other':None}
PTYPE={'restaurant':'restaurant','cafe':'cafe','hawker':'hawker stall','bakery':'bakery',
 'grocery':'grocery','butcher':'butcher','sweets':'sweet shop','other':'eatery',None:'eatery'}
PRICE={1:'budget-friendly',2:'mid-range',3:'upscale',4:'fine-dining'}
def article(word): return 'An' if word[:1].lower() in 'aeiou' else 'A'
def describe(p):
    cz=CUISINE.get(p.get('cuisine_type')); pt=PTYPE.get(p.get('place_type'),'eatery')
    price=PRICE.get(p.get('price_range')); where=p.get('neighbourhood') or p.get('city') or 'the area'
    words=[w for w in [price,cz,pt] if w]
    return f"{article(words[0])} {' '.join(words)} in {where}."

# all active places
places=[]; off=0
while True:
    pg=json.loads(subprocess.run(['curl','-s',f'{SB}/places?select=id,cuisine_type,place_type,price_range,neighbourhood,city&is_active=eq.true&order=id&offset={off}&limit=1000','-H',f'apikey: {SK}','-H',f'Authorization: Bearer {SK}'],capture_output=True,text=True).stdout)
    if not pg: break
    places+=pg; off+=len(pg)
    if len(pg)<1000: break
print(f'active places: {len(places)}', flush=True)
# lint every generated description first (fail-safe)
bad=[(p['id'],describe(p)) for p in places if freetext_violations(describe(p))]
print(f'lint check on all generated: {len(bad)} violations (must be 0)', flush=True)
if bad: [print('  ✗',b) for b in bad[:5]]; sys.exit(1)

def patch(p):
    d=describe(p)
    code=subprocess.run(['curl','-s','-o','/dev/null','-w','%{http_code}','-X','PATCH',f"{SB}/places?id=eq.{p['id']}",
      '-H',f'apikey: {SK}','-H',f'Authorization: Bearer {SK}','-H','Content-Type: application/json',
      '-H','Prefer: return=minimal','-d',json.dumps({'description':d})],capture_output=True,text=True).stdout
    return code=='204'
ok=0
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
    for i,r in enumerate(ex.map(patch,places)):
        ok+=r
        if (i+1)%400==0: print(f'  ...{i+1}/{len(places)}', flush=True)
print(f'backfilled: {ok}/{len(places)}', flush=True)
