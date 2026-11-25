"""Rebuild the VacationRental JSON-LD on every villa page from data/villas.json.
Search Console (18.09.2026, "Жильё для отпуска") flagged: missing identifier, missing
containsPlace.occupancy.value, missing geo (1), plus warnings for streetAddress/postalCode,
additionalType, amenityFeature inside containsPlace, fewer than 8 images.
Run: python3 tools/villa-page/fix_vacation_rental_ld.py   (EN and /it/ pages)
"""
import json,re,glob
SITE='https://balivillas.ai'
villas=json.load(open('data/villas.json'))
by_slug={v['slug']:v for v in villas}
def parse_addr(a):
    a=(a or '').replace('Индонезия','Indonesia')
    pc=re.search(r'\b8\d{4}\b',a); street=a.split(',')[0].strip() if a else ''
    return street,(pc.group(0) if pc else '')
n=0
for f in glob.glob('villa/**/index.html',recursive=True)+glob.glob('it/villa/**/index.html',recursive=True):
    if '/gallery/' in f: continue
    h=open(f,encoding='utf-8').read()
    m=re.search(r'<script type="application/ld\+json">\s*(\{.*?"VacationRental".*?\})\s*</script>',h,re.S)
    if not m: continue
    try: d=json.loads(m.group(1))
    except Exception as e: print('skip',f,e); continue
    slug=re.sub(r'^(it/)?villa/','',f).replace('/index.html','')
    v=by_slug.get(slug)
    if not v: print('no villa data',f); continue
    street,pc=parse_addr(v.get('address'))
    d['identifier']=v['id']
    d['additionalType']='Apartment' if 'apartment' in v['name'].lower() else ('Townhouse' if 'townhouse' in v['name'].lower() else 'House')
    d['address']={'@type':'PostalAddress',**({'streetAddress':street} if street else {}),'addressLocality':v.get('area',''),'addressRegion':'Bali',**({'postalCode':pc} if pc else {}),'addressCountry':'ID'}
    if isinstance(v.get('lat'),(int,float)) and isinstance(v.get('lng'),(int,float)):
        d['geo']={'@type':'GeoCoordinates','latitude':v['lat'],'longitude':v['lng']}
    cp=d.get('containsPlace') or {'@type':'Accommodation'}
    cp['@type']='Accommodation'; cp['additionalType']='EntirePlace'
    cp['occupancy']={'@type':'QuantitativeValue','value':v.get('guests'),'maxValue':v.get('guests')}
    cp['numberOfBedrooms']=v.get('bedrooms'); cp['numberOfBathroomsTotal']=v.get('bathrooms')
    if 'amenityFeature' in d: cp['amenityFeature']=d.pop('amenityFeature')
    elif v.get('amenities'): cp['amenityFeature']=[{'@type':'LocationFeatureSpecification','name':a,'value':True} for a in v['amenities'][:20]]
    d['containsPlace']=cp
    imgs=[SITE+i for i in (v.get('topGallery') or [])+[i for i in v.get('images',[]) if i not in (v.get('topGallery') or [])]][:12]
    if len(imgs)>=8: d['image']=imgs
    new='<script type="application/ld+json">'+json.dumps(d,ensure_ascii=False)+'</script>'
    h=h[:m.start()]+new+h[m.end():]
    open(f,'w',encoding='utf-8').write(h); n+=1
print('rebuilt VacationRental on',n,'pages')
