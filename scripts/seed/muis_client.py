import json, subprocess, re, time, os
JAR='/private/tmp/claude-501/-Users-naeemsani-Documents-halal/c56745b8-63a2-4fa4-8515-9b0d29471738/scratchpad/muis_cookies.txt'
BASE='https://halal.muis.gov.sg'
def fresh_token():
    html=subprocess.run(['curl','-s','-c',JAR,f'{BASE}/halal/establishments','-H','User-Agent: Mozilla/5.0'],capture_output=True,text=True).stdout
    m=re.search(r'name="__RequestVerificationToken"[^>]*value="([^"]+)"', html)
    return m.group(1)
def search(text, token, start=0, length=100):
    body=json.dumps({"text":text,"start":start,"length":length})
    out=subprocess.run(['curl','-s','-b',JAR,f'{BASE}/api/halal/establishments','-X','POST',
        '-H','Content-Type: application/json','-H','Origin: '+BASE,'-H','User-Agent: Mozilla/5.0',
        '-H',f'X-CSRF-TOKEN: {token}','--data-raw',body],capture_output=True,text=True).stdout
    try: return json.loads(out)
    except: return {'_raw':out[:200]}

if __name__=='__main__':
    tok=fresh_token()
    print('token acquired:', tok[:20]+'...')
    r=search('dim sum', tok)
    print('search "dim sum": total=%s returned=%s' % (r.get('totalRecords'), len(r.get('data',[]))))
    # probe: can we page a broad query to enumerate? try a very common substring
    for q in ['a','e','restaurant','halal',' ']:
        r=search(q, tok, 0, 1)
        print(f'  query {q!r}: totalRecords={r.get("totalRecords")}')
