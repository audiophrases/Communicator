// The built-in board, used until the teacher saves their own at /create.
// Each item is "English=emoji=Catalan"; leave the emoji empty with "word==Catalan".
// Core words never move, so the hand learns where each one is.

import type { Board, Kind, Word } from '../shared/board.ts';

const row = (kind: Kind, items: string): Word[] => items.split('|').map(item => {
    const [w, e, ca] = item.split('=');
    return { w, k: kind, ...(e ? { e } : {}), ...(ca ? { ca } : {}) };
});

// 10 columns by 6 rows. On a narrow screen each row splits into two rows of 5, in the same order.
const CORE: Word[] = [
    ...row('person', `I=🙋=jo|you=🫵=tu / vostè|he=👨=ell|she=👩=ella|we=👥=nosaltres|they=👫=ells / elles|it==ho / això|this=👇=això / aquest|that=👉=allò / aquell|my==el meu / la meva`),
    ...row('verb', `want=🤲=voler|need=❗=necessitar|like=👍=agradar|have=🎒=tenir|go=➡️=anar|come=🫴=venir|get==aconseguir / obtenir|do==fer|make=🛠️=fer / crear|can=💪=poder`),
    ...row('verb', `see=👀=veure|eat=🍽️=menjar|drink=🥤=beure|help=🆘=ajudar|know=💡=saber / conèixer|think=🤔=pensar|feel=💗=sentir|say=🗣️=dir|give=🎁=donar|be==ser / estar`),
    ...row('no', `not=🚫=no (negació)|no=❌=no`), ...row('social', `yes=✅=sí`),
    ...row('little', `and==i|but==però|because==perquè|to==a / per a|in=📥=a / dins de|with=🤝=amb|for==per / per a`),
    ...row('question', `what=❓=què|where=📍=on|when=🕒=quan|who=👤=qui|why==per què|how==com`),
    ...row('describe', `now=⏱️=ara|here=📌=aquí|more=➕=més|less=➖=menys`),
    ...row('describe', `very==molt|good=🙂=bo / bé|bad=🙁=dolent / malament|big=🐘=gran|small=🐜=petit|hot=🔥=calent / calor|cold=🧊=fred|happy=😊=content|tired=😴=cansat`),
    ...row('social', `please=🙏=si us plau`)
];

export const DEFAULT_BOARD: Board = {
    core: CORE,
    pages: [
        { id: 'people', name: 'People', ca: 'Persones', icon: '👪', words: row('person', `me==em / mi|your==el teu / la teva|his==el seu (d'ell)|her==el seu (d'ella)|our==el nostre / la nostra|their==el seu (d'ells)|family=👪=família|mother=👩=mare|father=👨=pare|son=👦=fill|daughter=👧=filla|brother==germà|sister==germana|husband=🤵=marit|wife=👰=dona / esposa|child=🧒=nen / nena|baby=👶=nadó|friend=🧑‍🤝‍🧑=amic / amiga|teacher=🧑‍🏫=professor / professora|doctor=🧑‍⚕️=metge / metgessa|nurse==infermer / infermera|boss=💼=cap|neighbor=🏘️=veí / veïna|police=👮=policia|man==home|woman==dona|people=👥=gent|someone==algú`) },
        { id: 'actions', name: 'Actions', ca: 'Accions', icon: '🏃', words: row('verb', `work=💼=treballar|live=🏠=viure|buy=🛒=comprar|pay=💳=pagar|take==agafar / prendre|call=📞=trucar|wait=⏳=esperar|understand=💡=entendre|speak=🗣️=parlar|learn=📖=aprendre|read=📚=llegir|write=✍️=escriure|listen=👂=escoltar|look=👀=mirar|find=🔎=trobar|use==fer servir|open=🔓=obrir|close=🔒=tancar|start=▶️=començar|finish=🏁=acabar|stop=✋=parar|sleep=🛌=dormir|wake up=⏰=despertar-se|cook=🍳=cuinar|clean=🧹=netejar|wash=🧼=rentar|drive=🚗=conduir|walk=🚶=caminar|sit=🪑=seure|play=⚽=jugar|send=📤=enviar|bring==portar|ask=🙋=preguntar / demanar|tell==dir / explicar|show==ensenyar|try==intentar / provar|forget==oblidar|remember==recordar|love=❤️=estimar|hurt=🤕=fer mal|lose==perdre|change=🔁=canviar|will==(futur: faré, aniré…)|did==(passat: vaig fer…)|am==soc / estic|is==és / està|are==ets / som / són|was==era / estava`) },
        { id: 'food', name: 'Food', ca: 'Menjar', icon: '🍎', words: row('noun', `food=🍲=menjar|water=💧=aigua|coffee=☕=cafè|tea=🍵=te|milk=🥛=llet|juice=🧃=suc|bread=🍞=pa|rice=🍚=arròs|chicken=🍗=pollastre|meat=🥩=carn|fish=🐟=peix|egg=🥚=ou|cheese=🧀=formatge|fruit=🍎=fruita|vegetables=🥦=verdures|soup=🥣=sopa|pasta=🍝=pasta|pizza=🍕=pizza|sandwich=🥪=entrepà|salad=🥗=amanida|sugar==sucre|salt=🧂=sal|breakfast=🥞=esmorzar|lunch=🥙=dinar|dinner=🍽️=sopar|menu=📋=carta / menú|bill=🧾=compte|glass=🥛=got|plate=🍽️=plat|spoon=🥄=cullera`) },
        { id: 'places', name: 'Places', ca: 'Llocs', icon: '🏠', words: row('noun', `home=🏠=casa|school=🏫=escola|work=🏢=feina|shop=🏪=botiga|supermarket=🛒=supermercat|hospital=🏥=hospital|pharmacy=💊=farmàcia|bank=🏦=banc|post office=📮=oficina de correus|restaurant=🍴=restaurant|bathroom=🚻=lavabo|kitchen=🍳=cuina|bedroom=🛏️=habitació|street=🛣️=carrer|park=🌳=parc|city=🏙️=ciutat|country=🌍=país|station=🚉=estació|bus stop=🚏=parada d'autobús|airport=✈️=aeroport|bus=🚌=autobús|train=🚆=tren|car=🚗=cotxe|taxi=🚕=taxi|bike=🚲=bicicleta|office=🗄️=oficina|library=📚=biblioteca|church=⛪=església|mosque=🕌=mesquita|outside=🌤️=fora`) },
        { id: 'body', name: 'Health', ca: 'Salut', icon: '🩺', words: [
            ...row('noun', `head=🗣️=cap|eye=👁️=ull|ear=👂=orella|tooth=🦷=dent|throat==gola|back==esquena|stomach==estómac / panxa|arm=💪=braç|hand=✋=mà|leg=🦵=cama|foot=🦶=peu|heart=🫀=cor|pain=🤕=dolor|fever=🌡️=febre|cough==tos|medicine=💊=medicament|appointment=📅=cita|allergy=🤧=al·lèrgia|blood=🩸=sang|glasses=👓=ulleres|emergency=🚨=urgència|ambulance=🚑=ambulància`),
            ...row('describe', `sick=🤒=malalt|dizzy=😵=marejat|hurt=🤕=ferit / em fa mal|better=📈=millor|worse=📉=pitjor|pregnant=🤰=embarassada|afraid=😨=espantat / tenir por`)] },
        { id: 'describe', name: 'Describe', ca: 'Descriure', icon: '🎨', words: row('describe', `sad=😢=trist|angry=😠=enfadat|worried=😟=preocupat|hungry=😋=tenir gana|thirsty=🥤=tenir set|ready=✅=a punt|busy==ocupat|free==lliure|late=⌛=tard|early==d'hora|fast=⚡=ràpid|slow=🐢=lent|easy==fàcil|difficult=🧩=difícil|important=❗=important|new=✨=nou|old==vell / antic|cheap==barat|expensive=💰=car|open==obert|closed==tancat|right=✔️=correcte|wrong=✖️=incorrecte / equivocat|same==igual|different==diferent|many==molts|some==alguns / una mica de|all==tot / tots|a little=🤏=una mica|more=➕=més|less=➖=menys|too==massa / també|again=🔁=una altra vegada|also==també|only==només|maybe=🤷=potser|always==sempre|never==mai|sometimes==de vegades|near==a prop|far==lluny|up=⬆️=amunt|down=⬇️=avall|left=⬅️=esquerra|right=➡️=dreta`) },
        { id: 'time', name: 'Time', ca: 'Temps', icon: '🕒', words: [
            ...row('describe', `today=📅=avui|tomorrow=⏭️=demà|yesterday=⏮️=ahir|morning=🌅=matí|afternoon=☀️=tarda|evening=🌇=vespre|night=🌙=nit|soon==aviat|later==més tard|before==abans|after==després|next==següent / vinent|last==últim / passat|every day==cada dia`),
            ...row('noun', `time=🕒=temps / hora|hour==hora|minute==minut|day==dia|week==setmana|month==mes|year==any|Monday==dilluns|Tuesday==dimarts|Wednesday==dimecres|Thursday==dijous|Friday==divendres|Saturday==dissabte|Sunday==diumenge|weekend==cap de setmana`),
            ...row('little', `one=1️⃣=u / un|two=2️⃣=dos|three=3️⃣=tres|four=4️⃣=quatre|five=5️⃣=cinc|six=6️⃣=sis|seven=7️⃣=set|eight=8️⃣=vuit|nine=9️⃣=nou|ten=🔟=deu|at==a|on==a / sobre|from==de / des de|until==fins a`)] },
        { id: 'things', name: 'Things', ca: 'Coses', icon: '📱', words: [
            ...row('noun', `phone=📱=telèfon / mòbil|money=💶=diners|card=💳=targeta|key=🔑=clau|bag=👜=bossa|ticket=🎫=bitllet / entrada|passport=🛂=passaport|paper=📄=paper|form=📝=formulari|pen=🖊️=bolígraf|book=📕=llibre|computer=💻=ordinador|internet=🌐=internet|password=🔐=contrasenya|clothes=👕=roba|shoes=👟=sabates|jacket=🧥=jaqueta|bed=🛏️=llit|door=🚪=porta|window=🪟=finestra|table==taula|chair=🪑=cadira|light=💡=llum|job=💼=feina|problem=⚠️=problema|question=❓=pregunta|answer==resposta|name=📛=nom|address=🏷️=adreça|number=🔢=número|English=🇬🇧=anglès|word=🔤=paraula|thing==cosa|something==alguna cosa|nothing==res|everything==tot`),
            ...row('little', `the==el / la|a==un / una|an==un / una|of==de|about==sobre / de|or==o|if==si|so==així que|than==que|then==després / llavors|there==allà|by==per / al costat de|under==sota|next to==al costat de`)] }
    ],
    // Whole sentences for moments when there is no time to build one. A tap speaks at once.
    quick: [
        ['Hello!', 'Hola!'], ['Goodbye!', 'Adéu!'], ['Thank you very much.', 'Moltes gràcies.'], ["You're welcome.", 'De res.'],
        ['Excuse me.', 'Perdoni.'], ["I'm sorry.", 'Ho sento.'], ['Yes, please.', 'Sí, si us plau.'], ['No, thank you.', 'No, gràcies.'],
        ["I don't understand.", 'No ho entenc.'], ["I don't know.", 'No ho sé.'],
        ['Can you speak more slowly, please?', 'Pot parlar més a poc a poc, si us plau?'], ['Can you repeat that, please?', 'Ho pot repetir, si us plau?'],
        ['Can you write it down, please?', 'Ho pot escriure, si us plau?'], ['What does this word mean?', 'Què vol dir aquesta paraula?'],
        ['How do you say this in English?', 'Com es diu això en anglès?'], ['I am learning English.', 'Estic aprenent anglès.'],
        ['Please wait a moment. I am writing my answer.', 'Esperi un moment, si us plau. Estic escrivint la meva resposta.'],
        ['Can you help me, please?', 'Em pot ajudar, si us plau?'], ['I need help.', 'Necessito ajuda.'], ['Where is the bathroom?', 'On és el lavabo?'],
        ['How much is it?', 'Quant costa?'], ['Nice to meet you.', 'Encantat / encantada de conèixer-te.'], ['My name is …', 'Em dic …'],
        ['I come from …', 'Soc de …'], ['I need a doctor.', 'Necessito un metge.'], ['Please call this number.', 'Si us plau, truqui a aquest número.'],
        ['I am lost.', "M'he perdut."], ['That is correct.', 'És correcte.'], ['That is not what I mean.', 'No vull dir això.'],
        ['One more time, please.', 'Una altra vegada, si us plau.']
    ].map(([t, ca]) => ({ t, ca }))
};
