"""Build separately playable, native-language synthetic letter references."""
from pathlib import Path
import asyncio, json, sys
import edge_tts
ROOT=Path(__file__).resolve().parents[2]
VOICES=json.loads((ROOT/'provenance/synthetic-voices.json').read_text())['languageVoices']
GEORGIAN='ანი ბანი განი დონი ენი ვინი ზენი თანი ინი კანი ლასი მანი ნარი ონი პარი ჟანი რაე სანი ტარი უნი ფარი ქანი ღანი ყარი შინი ჩინი ცანი ძანი წანი ჭარი ხანი ჯანი ჰაე'.split()
KOREAN={'ㅏ':'아','ㅑ':'야','ㅓ':'어','ㅕ':'여','ㅗ':'오','ㅛ':'요','ㅜ':'우','ㅠ':'유','ㅡ':'으','ㅣ':'이','ㄲ':'쌍기역','ㄸ':'쌍디귿','ㅃ':'쌍비읍','ㅆ':'쌍시옷','ㅉ':'쌍지읒','ㅐ':'애','ㅒ':'얘','ㅔ':'에','ㅖ':'예','ㅘ':'와','ㅙ':'왜','ㅚ':'외','ㅝ':'워','ㅞ':'웨','ㅟ':'위','ㅢ':'의'}
MANDARIN=[('波','bō · 波'),('坡','pō · 坡'),('摸','mō · 摸'),('佛','fó · 佛'),('德','dé · 德'),('特','tè · 特'),('呢','ne · 呢'),('乐','lè · 乐'),('哥','gē · 哥'),('科','kē · 科'),('喝','hē · 喝'),('鸡','jī · 鸡'),('七','qī · 七'),('西','xī · 西'),('知','zhī · 知'),('吃','chī · 吃'),('诗','shī · 诗'),('日','rì · 日'),('资','zī · 资'),('词','cí · 词'),('丝','sī · 丝'),('阿','ā · 阿'),('哦','ó · 哦'),('鹅','é · 鹅'),('衣','yī · 衣'),('乌','wū · 乌'),('鱼','yú · 鱼'),('妈。麻。马。骂。妈妈。','mā, má, mǎ, mà; neutral second syllable in māma')]
def reference(code,letter,index,uk=False):
    if code=='zh': return MANDARIN[index]
    if code=='ka': return GEORGIAN[index],GEORGIAN[index]
    if code=='ko':
        text=KOREAN.get(letter['symbol'],letter['name'].split()[0]);return text,text
    if code=='ja':
        text='お' if letter['symbol']=='を' else letter['symbol'];return text,letter['name']
    if code=='en' and index==25:return ('zed' if uk else 'zee'),('UK: zed' if uk else 'US: zee')
    text=letter['name'].split(' /')[0].split(' (')[0]
    return text,letter['name']
async def record(text,voice,path,semaphore):
    if path.exists() and path.stat().st_size>1000:return
    path.parent.mkdir(parents=True,exist_ok=True)
    for attempt in range(5):
        try:
            async with semaphore:
                await asyncio.wait_for(edge_tts.Communicate(text,voice,rate='-15%').save(str(path)),60)
            if path.stat().st_size>1000:return
        except Exception as error:
            if attempt==4:raise RuntimeError(f'{path.name}: {error}')
            await asyncio.sleep(2**attempt)
    raise RuntimeError(f'Empty recording: {path}')
async def main():
    semaphore=asyncio.Semaphore(3);jobs=[];manifest=[];courses=[]
    for code,voice in VOICES.items():
        p=ROOT/'web/data'/f'{code}.json';course=json.loads(p.read_text());courses.append((p,course))
        for index,letter in enumerate(course['foundation']['letters']):
            text,label=reference(code,letter,index);relative=f'Audio/{code}/Letters/{index+1:03d}.mp3'
            letter['audio']=relative;letter['audioLabel']=label;letter['audioKind']='syllable example' if code=='zh' else 'letter name or reading'
            jobs.append(record(text,voice,ROOT/'web'/relative,semaphore));manifest.append({'path':relative,'language':code,'symbol':letter['symbol'],'spokenText':text,'voice':voice,'synthetic':True,'source':'Microsoft Edge speech synthesis via edge-tts','kind':'letter'})
            if code=='en':
                text,label=reference(code,letter,index,True);relative=f'Audio/en/Letters/{index+1:03d}-UK.mp3';letter['audioUK']=relative
                jobs.append(record(text,'en-GB-SoniaNeural',ROOT/'web'/relative,semaphore));manifest.append({'path':relative,'language':code,'symbol':letter['symbol'],'spokenText':text,'voice':'en-GB-SoniaNeural','synthetic':True,'source':'Microsoft Edge speech synthesis via edge-tts','kind':'letter'})
    done=0
    async def logged(job):
        nonlocal done
        await job;done+=1
        if done%25==0:print(f'Letter recordings: {done}/{len(jobs)}',flush=True)
    await asyncio.gather(*(logged(job) for job in jobs))
    for p,course in courses:p.write_text(json.dumps(course,ensure_ascii=False,separators=(',',':')))
    existing=json.loads((ROOT/'web/data/audio-manifest.json').read_text());paths={m['path'] for m in manifest};existing=[m for m in existing if m['path'] not in paths]
    for m in manifest:
        m['bytes']=(ROOT/'web'/m['path']).stat().st_size;m['durationSeconds']=m['bytes']/6000
    (ROOT/'web/data/audio-manifest.json').write_text(json.dumps(sorted(existing+manifest,key=lambda m:m['path']),ensure_ascii=False,indent=2))
    (ROOT/'provenance/letter-audio.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
    print(f'Complete: {len(manifest)} individual recordings; {len(existing)+len(manifest)} total audio files.',flush=True)
if __name__=='__main__':asyncio.run(main())
