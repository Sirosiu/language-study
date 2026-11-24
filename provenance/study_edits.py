"""Beginner glosses for ambiguous high-frequency forms.

These short teaching glosses are authored editorial additions. The original
dictionary sense stays in otherMeanings; source links provide fuller meanings.
Letter-name-only entries are replaced with useful authored study entries.
"""
import json,re,urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OVERRIDES={
'ar':'''من|from; of; who (depending on vowels and context)|prep
و|and|conj
ما|what; a negation word in some constructions|pron''',
'da':'''en|a/an (common gender); one|det
et|a/an (neuter); one|det
det|it; that; the (neuter determiner)|pron
den|it; that; the (common-gender determiner)|pron''',
'nl':'''de|the (common-gender singular and all plurals)|article
het|the (neuter singular); it|article
een|a/an; one|det
op|on; up (according to context)|prep''',
'fr':'''le|the (masculine singular); him/it as an object pronoun|article
la|the (feminine singular); her/it as an object pronoun|article
les|the (plural); them as an object pronoun|article
un|a/an (masculine singular); one|det
une|a/an (feminine singular); one|det
est|is (être, third-person singular); east in another sense|verb
en|in; of/from it or them as a pronoun|prep
de|of; from|prep
as|have (tu as); an ace in another sense|verb
suis|am (je suis); follow (je suis, from suivre)|verb''',
'de':'''der|the (masculine nominative); other case forms and relative uses|article
die|the (feminine singular or plural); relative pronoun in context|article
das|the (neuter singular); that/which in other uses|article
ein|a/an (masculine or neuter); one|det
eine|a/an (feminine); one|det
zu|to; too before an adjective|prep''',
'fi':'''voi|can/may (voida); butter in another sense|verb
on|is; has in the construction minulla on|verb
se|it; that|pron
että|that (introducing a clause)|conj''',
'it':'''e|and|conj
o|or|conj
ci|us; there; a particle in several constructions|pron
ti|you (singular object); to you|pron
la|the (feminine singular); her/it as a pronoun|article
le|the (feminine plural); them/to her as a pronoun|article
il|the (masculine singular)|article
lo|the (masculine singular before certain sounds); him/it|article
un|a/an (masculine singular)|det
una|a/an (feminine singular)|det
che|that; which; what (depending on construction)|pron
sono|I am; they are|verb''',
'es':'''de|of; from|prep
la|the (feminine singular); her/it as an object pronoun|article
el|the (masculine singular)|article
los|the (masculine plural); them as an object pronoun|article
las|the (feminine plural); them as an object pronoun|article
un|a/an (masculine singular); one|det
una|a/an (feminine singular); one|det
te|you (singular object); to you|pron
e|and (used before an initial i sound)|conj
es|is (ser, third-person singular)|verb
son|are (ser, third-person plural)|verb
hay|there is; there are|verb''',
'ru':'''в|in (location + prepositional); into (direction + accusative)|prep
и|and; also in some contexts|conj
я|I|pron
а|and; but (contrasting or shifting the topic)|conj
о|about (+ prepositional); an exclamation in another use|prep
об|about (variant of о before some sounds)|prep
у|at/by; possession in у меня есть|prep
что|what; that (introducing a clause)|pron''',
'tr':'''ve|and|conj
bir|one; a/an|det
bu|this|pron
en|most; width in another sense|adv
ile|with; and in some uses|postp
de|also; too (written separately)|particle
da|also; too (written separately)|particle''',
'ko':'''에|at/in/to; a location, time or destination particle|particle
을|direct-object particle after a consonant|particle
의|possessive or genitive particle, often translated as of or 's|particle
고|a verb-linking ending meaning and; late/deceased before a name in another use|particle
다|all; also the plain declarative ending in verb forms|particle
로|by/with; toward; as (particle, with 으로 after most consonants)|particle
는|topic particle after a vowel; contrasts known information|particle
은|topic particle after a consonant|particle
이|subject particle after a consonant; this in a different use|particle
가|subject particle after a vowel|particle''',
'en':'''caught|captured; past tense and participle of catch|verb
doctor|a medical practitioner; also a holder of a doctorate|noun
advantage|a benefit or favourable position|noun
software|programs and instructions used by a computer|noun
sat|past tense and participle of sit|verb''',
}
POOLS={
'de':'''Aussprache|pronunciation|noun
Wortschatz|vocabulary|noun
Lernziel|learning goal|noun
Satzbau|sentence structure|noun
Leseverständnis|reading comprehension|noun''',
'ar':'''مفردات|vocabulary|noun
نطق|pronunciation|noun
محادثة|conversation|noun''',
'da':'''udtale|pronunciation|noun
ordforråd|vocabulary|noun
grammatik|grammar|noun
lytte|to listen|verb''',
'en':'''clarify|to make something easier to understand|verb
evaluate|to judge value or quality using evidence|verb
coherent|logically connected and understandable|adj
concise|brief while preserving the necessary meaning|adj
inference|a conclusion drawn from evidence|noun
assumption|something accepted as true for an argument|noun
corroborate|to support a claim with additional evidence|verb
methodology|the methods and principles used in an inquiry|noun
feasible|practical and possible to carry out|adj
mitigate|to reduce the seriousness or impact|verb''',
'fi':'''ääntäminen|pronunciation|noun
sanasto|vocabulary|noun
kielioppi|grammar|noun
kuunteleminen|listening|noun
kirjoittaminen|writing|noun
lukeminen|reading|noun
oppiminen|learning|noun
harjoitus|exercise; practice|noun
muistiinpano|a note written to remember something|noun
oppikirja|textbook|noun
esimerkki|example|noun
lause|sentence|noun
tavu|syllable|noun
käännös|translation|noun
kirjain|letter of an alphabet|noun''',
'it':'''pronuncia|pronunciation|noun
vocabolario|vocabulary; dictionary|noun
grammatica|grammar|noun
esercizio|exercise; practice|noun
traduzione|translation|noun
ascoltare|to listen|verb
imparare|to learn|verb
insegnare|to teach|verb
sillaba|syllable|noun
consonante|consonant|noun
vocale|vowel|noun
quaderno|notebook|noun
matita|pencil|noun
dizionario|dictionary|noun
appunto|a written note|noun
comprensione|understanding; comprehension|noun
conversazione|conversation|noun
ripetere|to repeat|verb
migliorare|to improve|verb
memorizzare|to memorise|verb''',
'ru':'''произношение|pronunciation|noun
словарь|dictionary; vocabulary|noun
грамматика|grammar|noun
упражнение|exercise; practice task|noun
перевод|translation|noun
тетрадь|notebook|noun
учебник|textbook|noun
слушать|to listen|verb
учиться|to study; to learn|verb
понимать|to understand|verb
повторять|to repeat|verb
улучшать|to improve|verb
запоминать|to memorise|verb
согласный|consonant; also agreeing in another use|noun
гласный|vowel|noun
слог|syllable|noun
объяснение|explanation|noun
собеседник|conversation partner|noun
письменность|writing system|noun
задание|task; assignment|noun''',
'es':'''pronunciación|pronunciation|noun
vocabulario|vocabulary|noun
gramática|grammar|noun
ejercicio|exercise; practice|noun
traducción|translation|noun
cuaderno|notebook|noun
escuchar|to listen|verb
aprender|to learn|verb
enseñar|to teach|verb
sílaba|syllable|noun
consonante|consonant|noun
vocal|vowel|noun
diccionario|dictionary|noun
conversación|conversation|noun
comprensión|understanding; comprehension|noun
repetir|to repeat|verb
mejorar|to improve|verb
memorizar|to memorise|verb
ortografía|spelling|noun
explicación|explanation|noun''',
'tr':'''telaffuz|pronunciation|noun
kelime|word|noun
gramer|grammar|noun
sözlük|dictionary|noun
çeviri|translation|noun
alıştırma|exercise; practice|noun
defter|notebook|noun
öğrenmek|to learn|verb
öğretmek|to teach|verb
dinlemek|to listen|verb
konuşmak|to speak|verb
okumak|to read|verb
yazmak|to write|verb
anlamak|to understand|verb
tekrarlamak|to repeat|verb
ezberlemek|to memorise|verb
geliştirmek|to develop; to improve|verb
hece|syllable|noun
ünlü|vowel; famous in another sense|noun
ünsüz|consonant|noun
cümle|sentence|noun
paragraf|paragraph|noun
açıklama|explanation|noun
ödev|homework; assignment|noun
öğrenci|student|noun
öğretmen|teacher|noun
ders|lesson|noun
kitap|book|noun
kütüphane|library|noun
kalem|pen; pencil|noun
silgi|eraser|noun
bilgisayar|computer|noun
klavye|keyboard|noun
ekran|screen|noun
kulaklık|headphones|noun
mikrofon|microphone|noun
internet|internet|noun
bağlantı|connection; link|noun
iletişim|communication|noun
sohbet|conversation; chat|noun
görüşme|meeting; interview|noun
başvuru|application; request|noun
randevu|appointment|noun
fırsat|opportunity|noun
başarı|success|noun
güven|trust; confidence|noun
hedef|goal; target|noun
amaç|purpose; aim|noun
yöntem|method|noun
araştırma|research|noun
bilgi|information; knowledge|noun
deneyim|experience|noun
beceri|skill|noun
çözüm|solution|noun
sorun|problem|noun
karar|decision|noun
sonuç|result|noun
süreç|process|noun
planlama|planning|noun
ilerleme|progress|noun
değerlendirme|evaluation|noun
geri bildirim|feedback|noun
zaman yönetimi|time management|noun
kelime hazinesi|vocabulary|noun
dil bilgisi|grammar|noun
okuma alışkanlığı|reading habit|noun''',
'zh':'''词汇|vocabulary|noun
发音|pronunciation|noun
语法|grammar|noun
练习|exercise; practice|noun
音节|syllable|noun
声调|tone|noun''',
}
LETTER_ONLY=re.compile(r'\bname of (?:the |a )?(?:Latin|Cyrillic|Greek|Arabic|Hebrew).*letter',re.I)
EXTRA_DROP={'de':{'Ich'},'es':{'A'},'ru':{'В.','И','А','К','Н-то.','Е','е','э','ю','ы'}}
def rows(text):
    return [line.split('|') for line in text.strip().splitlines()]
def edit(course):
    code=course['code'];words=course['words'];changes=[];spelling_changes=[]
    for word,meaning,pos in rows(OVERRIDES.get(code,'')) if OVERRIDES.get(code) else []:
        w=next((w for w in words if w['word']==word),None)
        if w and w['meaning']!=meaning:
            old=w['meaning'];w['meaning']=meaning;w['pos']=pos
            w['otherMeanings']=list(dict.fromkeys([old]+w.get('otherMeanings',[])))[:4]
            w['meaningSource']='authored teaching gloss; source dictionary gives the fuller entry'
            changes.append(word)
    occupied={w['word'] for w in words};pool=iter(rows(POOLS.get(code,''))) if POOLS.get(code) else iter([])
    for w in words:
        if not (LETTER_ONLY.search(w['meaning']) or w['word'] in EXTRA_DROP.get(code,set())):continue
        item=next((item for item in pool if item[0] not in occupied),None)
        if not item:raise ValueError('Need a replacement study word for '+code+' '+w['word'])
        word,meaning,pos=item;old=w['word'];occupied.add(word)
        w.update(word=word,meaning=meaning,pos=pos,ipa='',roman='',audio='',tags=[],examples=[],otherMeanings=[],source='https://en.wiktionary.org/wiki/'+urllib.parse.quote(word),meaningSource='authored teaching entry; consult the linked dictionary')
        spelling_changes.append({'id':w['id'],'old':old,'word':word})
    return changes,spelling_changes
if __name__=='__main__':
    report=[]
    for m in json.loads((ROOT/'data'/'manifest.json').read_text()):
        code=m['code'];course=json.loads((ROOT/'data'/f'{code}.json').read_text());a,b=edit(course)
        assert len({w['word'] for w in course['words']})==1000
        (ROOT/'data'/f'{code}.json').write_text(json.dumps(course,ensure_ascii=False))
        (ROOT/'data'/f'{code}.js').write_text('window.COURSES=window.COURSES||{};window.COURSES['+json.dumps(code)+']='+json.dumps(course,ensure_ascii=False)+';')
        (ROOT/'data'/f'{code}-vocabulary.json').write_text(json.dumps(course['words'],ensure_ascii=False))
        report.append({'code':code,'glossesEdited':a,'spellingsReplaced':b})
    (ROOT/'tmp'/'study-edits.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))
