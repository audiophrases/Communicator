// The built-in board, used until the teacher saves their own at /create.
// Each item is "English=emoji=Catalan"; leave the emoji empty with "word==Catalan".
// Core words never move, so the hand learns where each one is.
//
// The pages hold the CEFR A1 words (the Oxford 3000's A1 list and Cambridge's A1 Movers list) that a learner can say
// something with: alcohol, CDs and DVDs are left out, and so are spellings that only repeat a word (bicycle, telephone).

import type { Board, Kind, Word } from '../shared/board.ts';

const row = (kind: Kind, items: string): Word[] => items.split('|').map(item => {
    const [w, e, ca] = item.split('=');
    return { w, k: kind, ...(e ? { e } : {}), ...(ca ? { ca } : {}) };
});

// Mulberry Symbols (mulberry-symbols/, © Steve Lee, CC BY-SA 4.0), by page and word, where a symbol shows the meaning
// better than the emoji did, or where a word had no picture of its own or shared one with another word:
// actions (an emoji of a chair for "sit" is the chair), question words, family relations (who to whom), time words
// that emoji show as media buttons, body parts, pairs such as open/closed and hungry/thirsty, numbers past ten,
// colours, seasons and weather, and where things are (above, behind, between).
// Emoji stay where they are clear: feelings, most food and things, animals, call, wait, write.
const SYMBOLS: Record<string, Record<string, string>> = {
    core: {
        want: 'want_,_to', go: 'go_,_to', come: 'come_,_to', get: 'get_,_to', make: 'make_,_to', see: 'look_,_to', eat: 'eat_,_to',
        drink: 'drink_,_to', help: 'help_,_to', give: 'give_,_to', in: 'in', what: 'what', when: 'when', who: 'who', why: 'why', how: 'how',
        now: 'now', good: 'good', bad: 'bad', hot: 'hot'
    },
    people: {
        mother: 'mum_parent', father: 'dad_parent', son: 'son', daughter: 'daughter', brother: 'brother', sister: 'sister', nurse: 'nurse_2a',
        man: 'happy_man', woman: 'happy_lady', people: 'group_work', parents: 'parents', grandmother: 'grandmother', grandfather: 'grandfather',
        aunt: 'aunt_maternal', uncle: 'uncle_maternal'
    },
    actions: {
        work: 'work_,_to', live: 'house', take: 'take_,_to', speak: 'talk_1_,_to', read: 'read_,_to', open: 'open_door_,_to', close: 'close_door_,_to',
        cook: 'cook_,_to', wash: 'wash_hands_,_to', drive: 'drive_,_to', sit: 'sit_,_to', play: 'play_,_to', bring: 'bring_,_to', ask: 'ask_,_to',
        tell: 'talk_2_,_to', show: 'show_me_,_to', remember: 'think_,_to', change: 'change_,_to', talk: 'talk_3_,_to', hear: 'hear_,_to',
        meet: 'meet_,_to', move: 'move_,_to', stand: 'stand_,_to', put: 'put_,_to', carry: 'carry_,_to', keep: 'keep_,_to', order: 'order_1_,_to',
        cut: 'cut_,_to', build: 'build_,_to', grow: 'grow_,_to', share: 'share_,_to', join: 'join_,_to', turn: 'turn_,_to', return: 'return_,_to',
        begin: 'begin_start', fall: 'fall_over_,_to', break: 'break_,_to', add: 'add', fill: 'fill_2_,_to', smile: 'smile_,_to', jump: 'jump_,_to'
    },
    food: { water: 'water', sugar: 'sugar_white', dinner: 'dinner', glass: 'glass_,_drinking', plate: 'plate', fruit: 'fruit' },
    places: { outside: 'outside', cafe: 'cafe', beach: 'beach' },
    body: {
        head: 'head', ear: 'ear', throat: 'throat', back: 'back', stomach: 'stomach', arm: 'arm', cough: 'sneeze_cold', medicine: 'medicine',
        body: 'body_outline', face: 'face_neutral_3', mouth: 'mouth'
    },
    describe: {
        hungry: 'hungry', thirsty: 'thirsty', ready: 'ready', busy: 'busy', open: 'open_shop', closed: 'closed_shop', same: 'same', some: 'some', near: 'near'
    },
    questions: { hello: 'hello' },
    time: {
        today: 'today', tomorrow: 'tomorrow', yesterday: 'yesterday', before: 'before', after: 'after', next: 'next', last: 'last', hour: 'one_hour',
        minute: 'minute', day: 'day', week: 'week', month: 'calendar_month', year: 'calendar', weekend: 'weekend', on: 'on'
    },
    numbers: {
        eleven: 'eleven', twelve: 'twelve', thirteen: 'thirteen', fourteen: 'fourteen', fifteen: 'fifteen', sixteen: 'sixteen', seventeen: 'seventeen',
        eighteen: 'eighteen', nineteen: 'nineteen', twenty: 'twenty', thirty: 'thirty', forty: 'forty', fifty: 'fifty', sixty: 'sixty', seventy: 'seventy',
        eighty: 'eighty', ninety: 'ninety', hundred: 'hundred', thousand: 'thousand', first: 'first', half: 'half', quarter: 'quarter'
    },
    things: {
        card: 'bank_card', passport: 'passport', bed: 'single_bed', table: 'table', light: 'ceiling_light', answer: 'answer',
        English: 'flag_United_Kingdom'
    },
    clothes: {
        clothes: 'clothes_generic', shirt: 'shirt', sweater: 'jumper', coat: 'coat', skirt: 'skirt', trousers: 'trousers', colour: 'colour',
        red: 'red', yellow: 'yellow', green: 'green', blue: 'blue', purple: 'purple', pink: 'pink', brown: 'brown',
        black: 'black', white: 'white', grey: 'grey_dark'
    },
    nature: {
        sun: 'sun', rain: 'rain', snow: 'snow', cloud: 'cloudy', spring: 'spring', summer: 'summer', autumn: 'autumn', winter: 'winter',
        tree: 'tree', flower: 'flower', mountain: 'mountains', elephant: 'elephant'
    },
    school: {
        desk: 'desk', dictionary: 'dictionary', study: 'study_,_to', spell: 'spell_,_to', correct: 'correct', guess: 'guess_,_to',
        type: 'type_,_to', count: 'count_,_to'
    },
    free: {
        football: 'football', dance: 'dance_,_to', sing: 'sing_,_to', swim: 'swim_,_to', run: 'run_,_to', draw: 'draw_,_to', paint: 'paint_,_to',
        watch: 'watch_,_to', climb: 'climb_up_,_to', travel: 'travel', visit: 'visit_,_to', relax: 'relax_,_to'
    },
    little: {
        under: 'under_1', 'next to': 'beside_next_to', above: 'above', below: 'below', behind: 'behind', between: 'between', 'in front of': 'in_front',
        opposite: 'opposite', across: 'across', through: 'through', out: 'out', off: 'off', over: 'over', around: 'around', away: 'away'
    }
};

// A symbol replaces the word's emoji.
const withSymbols = (page: string, words: Word[]): Word[] => words.map(word => {
    const s = SYMBOLS[page]?.[word.w];
    if (!s) return word;
    const { e: _emoji, ...rest } = word;
    return { ...rest, s };
});

// 10 columns by 6 rows. On a narrow screen each row splits into two rows of 5, in the same order.
const CORE: Word[] = [
    ...row('person', `I=🙋=jo|you=🫵=tu / vostè|he=👨=ell|she=👩=ella|we=👥=nosaltres|they=👫=ells / elles|it==ho / això|this=👇=això / aquest|that=👉=allò / aquell|my==el meu / la meva`),
    ...row('verb', `want=🤲=voler|need=❗=necessitar|like=👍=agradar|have=🎒=tenir|go=➡️=anar|come=🫴=venir|get==aconseguir / obtenir|do==fer|make=🛠️=fer / crear|can=💪=poder`),
    ...row('verb', `see=👀=veure|eat=🍽️=menjar|drink=🥤=beure|help=🆘=ajudar|know=🧠=saber / conèixer|think=🤔=pensar|feel=💗=sentir|say=🗣️=dir|give=🎁=donar|be==ser / estar`),
    ...row('no', `not=🚫=no (negació)|no=❌=no`), ...row('social', `yes=✅=sí`),
    ...row('little', `and==i|but==però|because==perquè|to==a / per a|in=📥=a / dins de|with=🤝=amb|for==per / per a`),
    ...row('question', `what=❓=què|where=📍=on|when=🕒=quan|who=👤=qui|why==per què|how==com`),
    ...row('describe', `now=⏱️=ara|here=📌=aquí|more=➕=més|less=➖=menys`),
    ...row('describe', `very==molt|good=🙂=bo / bé|bad=🙁=dolent / malament|big=🐘=gran|small=🐜=petit|hot=🔥=calent / calor|cold=🧊=fred|happy=😊=content|tired=😴=cansat`),
    ...row('social', `please=🙏=si us plau`)
];
const CORE_BOARD = withSymbols('core', CORE);

// Core words also sit on the page of their colour, first and in Core's order, so a sentence can be built without
// going back to Core: the same button, with the same picture and Catalan. Question words and yes/no/not/please, whose
// colours have no page of their own, get the Ask & answer page.
const fromCore = (...words: string[]): Word[] => words.map(w => {
    const word = CORE_BOARD.find(item => item.w === w);
    if (!word) throw new Error(`"${w}" is not a core word`);
    return { ...word };
});

export const DEFAULT_BOARD: Board = {
    core: CORE_BOARD,
    pages: [
        { id: 'people', name: 'People', ca: 'Persones', icon: '👪', words: [...fromCore('I', 'you', 'he', 'she', 'we', 'they', 'it', 'this', 'that', 'my'), ...withSymbols('people', row('person', `me==em / mi|him==ell / el / li|us==nosaltres / ens|them==ells / els|your==el teu / la teva|his==el seu (d'ell)|her==el seu (d'ella)|its==el seu (d'això)|our==el nostre / la nostra|their==el seu (d'ells)|yourself==tu mateix / tu mateixa|someone=👤=algú|anyone==algú / qualsevol|everyone==tothom|nobody==ningú|family=👪=família|mother=👩=mare|father=👨=pare|mum==mama|dad==papa|parents==pares|son=👦=fill|daughter=👧=filla|brother==germà|sister==germana|husband=🤵=marit|wife=👰=dona / esposa|grandmother==àvia|grandfather==avi|aunt==tia|uncle==oncle|cousin==cosí / cosina|child=🧒=nen / nena|baby=👶=nadó|boy=👦=noi|girl=👧=noia|teenager==adolescent|adult=🧑=adult / adulta|man==home|woman==dona|person=🧍=persona|people=👥=gent|group==grup|friend=🧑‍🤝‍🧑=amic / amiga|boyfriend==xicot / nòvio|girlfriend==xicota / nòvia|partner==parella|neighbor=🏘️=veí / veïna|age==edat|teacher=🧑‍🏫=professor / professora|student=🧑‍🎓=alumne / alumna|doctor=🧑‍⚕️=metge / metgessa|nurse==infermer / infermera|police=👮=policia|boss=👔=cap|worker=👷=treballador / treballadora|driver==conductor / conductora|farmer=🧑‍🌾=pagès / pagesa|waiter==cambrer / cambrera|writer==escriptor / escriptora|singer=🧑‍🎤=cantant|actor==actor / actriu|artist=🧑‍🎨=artista|scientist=🧑‍🔬=científic / científica|tourist==turista|visitor==visitant|customer==client / clienta|member==membre`))] },
        { id: 'actions', name: 'Actions', ca: 'Accions', icon: '🏃', words: [...fromCore('want', 'need', 'like', 'have', 'go', 'come', 'get', 'do', 'make', 'can', 'see', 'eat', 'drink', 'help', 'know', 'think', 'feel', 'say', 'give', 'be'), ...withSymbols('actions', row('verb', `work=💼=treballar|live=🏠=viure|buy=🛍️=comprar|sell==vendre|pay=💳=pagar|spend==gastar / passar (temps)|order==demanar|take==agafar / prendre|put==posar|keep==guardar / quedar-se|carry==portar / dur|bring==portar|call=📞=trucar|wait=⏳=esperar|understand=💡=entendre|speak=🗣️=parlar|talk==parlar / xerrar|hear==sentir|listen=👂=escoltar|learn=📖=aprendre|read=📚=llegir|write=✍️=escriure|look=👀=mirar|find=🔎=trobar|use==fer servir|open=🔓=obrir|close=🔒=tancar|start=▶️=començar|begin==començar|finish=🏁=acabar|stop=🛑=parar|arrive=🛬=arribar|leave==marxar / sortir|stay==quedar-se|return==tornar|meet==trobar-se / conèixer|move==moure / mudar-se|sleep=🛌=dormir|wake up=⏰=despertar-se|cook=🍳=cuinar|clean=🧹=netejar|wash=🧼=rentar|drive=🚗=conduir|walk=🚶=caminar|sit=🪑=seure|stand==estar dret|jump==saltar|fall==caure|play=⚽=jugar|send=📤=enviar|ask=🙋=preguntar / demanar|tell==dir / explicar|show==ensenyar|thank==agrair|try==intentar / provar|choose==triar / escollir|decide==decidir|agree==estar d'acord|forget==oblidar|remember==recordar|believe==creure|hope==esperar (desitjar)|imagine==imaginar|love=❤️=estimar|hate==odiar|enjoy==gaudir|prefer==preferir|laugh=😂=riure|smile==somriure|hurt=🩹=fer mal|lose==perdre|miss==trobar a faltar / perdre|break==trencar|cut==tallar|build==construir|grow==créixer / cultivar|add==afegir|fill==omplir|share==compartir|join==unir-se / apuntar-se|turn==girar / tombar|follow==seguir|let==deixar|change=🔁=canviar|become==fer-se / tornar-se|happen==passar (ocórrer)|prepare==preparar|plan==planificar|create==crear|improve==millorar|introduce==presentar|die==morir|born==nascut / néixer|will==(futur: faré, aniré…)|would==(condicional: faria…)|did==(passat: vaig fer…)|could==podria / podia|should==hauria de|must==haver de|have to==haver de|can't==no poder|am==soc / estic|is==és / està|are==ets / som / són|was==era / estava`))] },
        { id: 'food', name: 'Food', ca: 'Menjar', icon: '🍎', words: withSymbols('food', row('noun', `food=🍲=menjar|meal==àpat|water=💧=aigua|coffee=☕=cafè|tea=🍵=te|milk=🥛=llet|juice=🧃=suc|bread=🍞=pa|butter=🧈=mantega|rice=🍚=arròs|pasta=🍝=pasta|pizza=🍕=pizza|sandwich=🥪=entrepà|soup=🥣=sopa|salad=🥗=amanida|chicken=🍗=pollastre|meat=🥩=carn|fish=🐟=peix|egg=🥚=ou|cheese=🧀=formatge|fruit=🍇=fruita|apple=🍎=poma|banana=🍌=plàtan|vegetables=🥦=verdures|potato=🥔=patata|tomato=🍅=tomàquet|carrot=🥕=pastanaga|onion=🧅=ceba|pepper=🫑=pebrot|cake=🍰=pastís|chocolate=🍫=xocolata|ice cream=🍦=gelat|cream==nata|sugar==sucre|salt=🧂=sal|breakfast=🥞=esmorzar|lunch=🥙=dinar|dinner=🍽️=sopar|dish==plat (menjar)|menu=📋=carta / menú|bill=🧾=compte|cup==tassa|glass=🥛=got|bottle==ampolla|plate=🍽️=plat|spoon=🥄=cullera`)) },
        { id: 'places', name: 'Places', ca: 'Llocs', icon: '🏠', words: withSymbols('places', row('noun', `home=🏠=casa|house=🏡=casa|apartment==pis / apartament|room==habitació / sala|bedroom=🛏️=habitació|kitchen=🍳=cuina|bathroom=🚻=lavabo|garden=🌷=jardí|building==edifici|school=🏫=escola|university=🎓=universitat|college==institut / facultat|work=🏢=feina|office=🗄️=oficina|shop=🏪=botiga|supermarket=🛒=supermercat|market==mercat|cafe==cafeteria|restaurant=🍴=restaurant|hotel=🏨=hotel|hospital=🏥=hospital|pharmacy=💊=farmàcia|bank=🏦=banc|post office=📮=oficina de correus|library=📚=biblioteca|museum=🏛️=museu|cinema=🍿=cinema|theatre=🎭=teatre|gym==gimnàs|pool==piscina|park=🌳=parc|beach==platja|farm=🚜=granja|church=⛪=església|mosque=🕌=mesquita|street=🛣️=carrer|road==carretera|traffic=🚦=trànsit|town==poble / ciutat|village==poble|city=🏙️=ciutat|country=🌍=país|world=🌏=món|place==lloc|area==zona|centre==centre|outside=🌤️=fora|map=🗺️=mapa|north==nord|south==sud|east==est|west==oest|station=🚉=estació|bus stop=🚏=parada d'autobús|airport=✈️=aeroport|flight==vol|bus=🚌=autobús|train=🚆=tren|car=🚗=cotxe|taxi=🚕=taxi|bike=🚲=bicicleta|plane=🛩️=avió|boat=⛵=vaixell`)) },
        { id: 'body', name: 'Health', ca: 'Salut', icon: '🩺', words: withSymbols('body', [
            ...row('noun', `body==cos|head=🗣️=cap|face==cara|hair=💇=cabell|eye=👁️=ull|ear=👂=orella|nose=👃=nas|mouth==boca|tooth=🦷=dent|throat==gola|back==esquena|stomach==estómac / panxa|arm=💪=braç|hand=✋=mà|leg=🦵=cama|foot=🦶=peu|heart=🫀=cor|blood=🩸=sang|health==salut|pain=🤕=dolor|fever=🌡️=febre|cough==tos|allergy=🤧=al·lèrgia|medicine=💊=medicament|appointment=📅=cita|glasses=👓=ulleres|toilet=🚽=vàter|shower=🚿=dutxa|bath=🛁=bany|emergency=🚨=urgència|ambulance=🚑=ambulància`),
            ...row('describe', `sick=🤒=malalt|healthy==sa / sana|dizzy=😵=marejat|hurt=🩹=ferit / em fa mal|better=📈=millor|worse=📉=pitjor|pregnant=🤰=embarassada|afraid=😨=espantat / tenir por`)]) },
        { id: 'describe', name: 'Describe', ca: 'Descriure', icon: '🎨', words: [...fromCore('here', 'very', 'good', 'bad', 'big', 'small', 'hot', 'cold', 'happy', 'tired'), ...withSymbols('describe', row('describe', `sad=😢=trist|angry=😠=enfadat|worried=😟=preocupat|excited=🤩=il·lusionat|bored=🥱=avorrit|hungry=😋=tenir gana|thirsty=🥤=tenir set|ready=✅=a punt|busy==ocupat|free==lliure|late=⌛=tard|early==d'hora|fast=⚡=ràpid|slow=🐢=lent|easy==fàcil|difficult=🧩=difícil|hard==dur / difícil|important=⭐=important|new=✨=nou|old==vell / antic|young==jove|tall==alt|short==baix / curt|long==llarg|high==alt|large==gran|strong==fort|cheap=🪙=barat|expensive=💰=car|rich==ric|poor==pobre|full==ple|clean==net|dirty==brut|quiet=🤫=tranquil / silenciós|beautiful==bonic / preciós|pretty==bonic / maco|nice==agradable / maco|friendly==simpàtic|funny==divertit / graciós|interesting==interessant|interested==interessat|boring==avorrit (que avorreix)|exciting==emocionant|great==genial|fantastic==fantàstic|wonderful==meravellós|amazing==increïble|cool==guai|perfect==perfecte|best==el millor|fine==bé|terrible==terrible|delicious==deliciós|dangerous==perillós|famous==famós|popular==popular|special==especial|favourite=💖=preferit|married=💍=casat / casada|modern==modern|online==en línia|useful==útil|open==obert|closed==tancat|right=✔️=correcte|wrong=✖️=incorrecte / equivocat|true==cert / veritat|false==fals|real==real / de veritat|sure==segur|possible==possible|same==igual|different==diferent|many==molts|some==alguns / una mica de|all==tot / tots|a little=🤏=una mica|more=➕=més|less=➖=menys|too==massa / també|really==de veritat / molt|quite==bastant|well==bé|again=🔁=una altra vegada|also==també|only==només|just==només / acabar de|still==encara|even==fins i tot|together==junts|maybe=🤷=potser|probably==probablement|always==sempre|usually==normalment|often==sovint|sometimes==de vegades|ever==alguna vegada|never==mai|near==a prop|far==lluny|up=⬆️=amunt|down=⬇️=avall|left=⬅️=esquerra|right=➡️=dreta`))] },
        { id: 'questions', name: 'Ask & answer', ca: 'Preguntar i respondre', icon: '❓', words: [
            ...fromCore('what', 'where', 'when', 'who', 'why', 'how'), ...row('question', `which==quin / quina|how much==quant / quanta|how many==quants / quantes`),
            ...fromCore('yes', 'no', 'not', 'please'),
            ...withSymbols('questions', row('social', `ok=👌=d'acord|sorry=😔=perdó / ho sento|excuse me==perdoni|thank you==gràcies|thanks==gràcies|hello==hola|hi=👋=hola|goodbye==adéu|bye==adéu|welcome==benvingut / de res|yeah==sí / ja`))] },
        { id: 'time', name: 'Time', ca: 'Temps', icon: '🕒', words: [...fromCore('now'), ...withSymbols('time', [
            ...row('describe', `today=📅=avui|tonight=🌃=aquesta nit|tomorrow=⏭️=demà|yesterday=⏮️=ahir|morning=🌅=matí|afternoon=☀️=tarda|evening=🌇=vespre|night=🌙=nit|midnight=🕛=mitjanit|o'clock=🕐=en punt|soon==aviat|later==més tard|before==abans|after==després|next==següent / vinent|last==últim / passat|ago==fa (fa dos dies)|every day==cada dia`),
            ...row('noun', `time=🕒=temps / hora|moment==moment|hour==hora|minute==minut|day==dia|week==setmana|month==mes|year==any|century==segle|date==data|beginning==començament|end=🔚=final|past==passat|future==futur|routine==rutina|Monday==dilluns|Tuesday==dimarts|Wednesday==dimecres|Thursday==dijous|Friday==divendres|Saturday==dissabte|Sunday==diumenge|weekend==cap de setmana|January==gener|February==febrer|March==març|April==abril|May==maig|June==juny|July==juliol|August==agost|September==setembre|October==octubre|November==novembre|December==desembre`),
            ...row('little', `at==a|on==a / sobre|from==de / des de|until==fins a|during==durant`)])] },
        { id: 'numbers', name: 'Numbers', ca: 'Nombres', icon: '🔢', words: withSymbols('numbers', [
            ...row('little', `zero=0️⃣=zero|one=1️⃣=u / un|two=2️⃣=dos|three=3️⃣=tres|four=4️⃣=quatre|five=5️⃣=cinc|six=6️⃣=sis|seven=7️⃣=set|eight=8️⃣=vuit|nine=9️⃣=nou|ten=🔟=deu|eleven==onze|twelve==dotze|thirteen==tretze|fourteen==catorze|fifteen==quinze|sixteen==setze|seventeen==disset|eighteen==divuit|nineteen==dinou|twenty==vint|thirty==trenta|forty==quaranta|fifty==cinquanta|sixty==seixanta|seventy==setanta|eighty==vuitanta|ninety==noranta|hundred==cent|thousand==mil|million==milió|first==primer / primera|second==segon / segona|third==tercer / tercera|fourth==quart / quarta|fifth==cinquè / cinquena|half==mig / meitat|quarter==quart|once==una vegada|twice==dues vegades`),
            ...row('noun', `pair==parell|price=💲=preu|euro==euro|cent==cèntim|dollar=💵=dòlar|pound=💷=lliura|metre==metre|kilometre==quilòmetre|mile==milla`),
            ...row('verb', `cost==costar`)]) },
        { id: 'things', name: 'Things', ca: 'Coses', icon: '📱', words: withSymbols('things', row('noun', `phone=📱=telèfon / mòbil|money=💶=diners|card=💳=targeta|key=🔑=clau|bag=👜=bossa|box=📦=caixa|ticket=🎫=bitllet / entrada|passport=🛂=passaport|paper=📄=paper|form=📝=formulari|pen=🖊️=bolígraf|book=📕=llibre|newspaper=📰=diari|magazine==revista|computer=💻=ordinador|internet=🌐=internet|website==web|email=📧=correu electrònic|message=📩=missatge|password=🔐=contrasenya|radio=📻=ràdio|clock=🕰️=rellotge|picture==imatge / dibuix|present=🎁=regal|bed=🛏️=llit|door=🚪=porta|window=🪟=finestra|wall==paret|floor==terra / pis|table==taula|chair=🪑=cadira|light=💡=llum|machine==màquina|job=💼=feina|business==negoci|company==empresa|meeting==reunió|advice==consell|problem=⚠️=problema|question=❓=pregunta|answer==resposta|name=📛=nom|address=🏷️=adreça|number=🔢=número|English=🇬🇧=anglès|word=🔤=paraula|news==notícies|life==vida|way==manera / camí|reason==raó / motiu|kind==tipus|part==part|piece==tros / peça|sound=🔊=so|thing==cosa|something==alguna cosa|anything==res / qualsevol cosa|nothing==res|everything==tot`)) },
        { id: 'clothes', name: 'Clothes & colours', ca: 'Roba i colors', icon: '👕', words: withSymbols('clothes', [
            ...row('noun', `clothes==roba|t-shirt=👕=samarreta|shirt==camisa|sweater==jersei|jacket=🧥=jaqueta|coat==abric|dress=👗=vestit|skirt==faldilla|trousers==pantalons|jeans=👖=texans|shoes=👟=sabates|boots=🥾=botes|hat=👒=barret|umbrella=☂️=paraigua`),
            ...row('verb', `wear==portar (roba)`),
            ...row('describe', `colour==color|red==vermell|orange=🟠=taronja|yellow==groc|green==verd|blue==blau|purple==lila|pink==rosa|brown==marró|black==negre|white==blanc|grey==gris|dark==fosc|blonde==ros / rossa`)]) },
        { id: 'nature', name: 'Nature & weather', ca: 'Natura i clima', icon: '⛅', words: [...withSymbols('nature', [
            ...row('noun', `weather==el temps (meteo)|sun==sol|rain==pluja|snow==neu|cloud==núvol|wind=💨=vent|ice==gel|fire=🔥=foc|spring==primavera|summer==estiu|autumn==tardor|winter==hivern`),
            ...row('describe', `warm==càlid`)]), ...fromCore('hot', 'cold'), ...withSymbols('nature', row('noun', `sea=🌊=mar|river=🏞️=riu|mountain==muntanya|island=🏝️=illa|tree==arbre|flower==flor|plant=🪴=planta|star=🌟=estrella|air==aire|land==terra|animal=🐾=animal|dog=🐕=gos|cat=🐈=gat|bird=🐦=ocell|horse=🐎=cavall|cow=🐄=vaca|pig=🐖=porc|sheep=🐑=ovella|mouse=🐁=ratolí|lion=🦁=lleó|elephant==elefant|snake=🐍=serp`))] },
        { id: 'school', name: 'School', ca: 'Escola', icon: '🏫', words: withSymbols('school', [
            ...row('noun', `class==classe|classroom==aula|lesson==lliçó|course==curs|subject==assignatura|homework=📓=deures|exercise==exercici|test=💯=prova|exam==examen|break==pausa|language==llengua / idioma|maths=➗=matemàtiques|science=🔬=ciències|history==història|geography==geografia|art==art|project==projecte|pencil=✏️=llapis|desk==pupitre|dictionary==diccionari|page=📃=pàgina|letter=✉️=carta / lletra|sentence==frase|phrase==expressió|paragraph==paràgraf|text==text|story==història / conte|article==article|title==títol|topic==tema|dialogue==diàleg|conversation=💬=conversa|meaning==significat|example==exemple|difference==diferència|mistake==error|spelling==ortografia|note=🗒️=nota / apunt|list==llista|chart=📊=gràfic|line==línia|information=ℹ️=informació|idea==idea|opinion==opinió|rule==norma|practice==pràctica|result==resultat`),
            ...row('verb', `teach==ensenyar|study==estudiar|practise==practicar|repeat==repetir|spell==lletrejar|mean==voler dir|explain==explicar|describe==descriure|discuss==comentar|compare==comparar|complete==completar|check==comprovar|correct==corregir|guess==endevinar|count==comptar|type==teclejar`)]) },
        { id: 'free', name: 'Free time', ca: 'Temps lliure', icon: '🎉', words: withSymbols('free', [
            ...row('noun', `hobby==afició|activity==activitat|fun=🥳=diversió|party=🎉=festa|birthday=🎂=aniversari|holiday=🧳=vacances|trip==viatge / excursió|sport=🏅=esport|football==futbol|tennis=🎾=tennis|swimming=🏊=natació|exercise=🏋️=exercici (físic)|game=🎲=joc|ball=🏀=pilota|team==equip|player==jugador / jugadora|match==partit|club==club|music=🎵=música|song=🎶=cançó|guitar=🎸=guitarra|piano=🎹=piano|band==grup (de música)|concert=🎤=concert|festival=🎪=festival|dancing==ball|film=🎬=pel·lícula|movie=📽️=pel·lícula|TV=📺=tele|video=📹=vídeo|photo=📸=foto|camera=📷=càmera|painting=🖼️=pintura / quadre|reading==lectura|cooking==cuina|shopping==anar de compres`),
            ...row('verb', `dance==ballar|sing==cantar|swim==nedar|run==córrer|climb==escalar / pujar|ride==muntar / anar amb|draw==dibuixar|paint==pintar|watch==mirar|travel==viatjar|visit==visitar|fly=🛫=volar|relax==relaxar-se|win=🏆=guanyar`)]) },
        { id: 'little', name: 'Little words', ca: 'Paraules petites', icon: '🔗', words: [...fromCore('and', 'but', 'because', 'to', 'in', 'with', 'for'), ...withSymbols('little', row('little', `the==el / la|a==un / una|an==un / una|of==de|about==sobre / de|or==o|if==si|so==així que|as==com|than==que|then==després / llavors|there==allà|by==per / al costat de|without==sense|into==cap a dins de|out==fora|off==fora / apagat|over==per sobre|under==sota|above==a sobre de|below==a sota de|behind==darrere|in front of==davant de|next to==al costat de|between==entre|opposite==davant / enfront|across==a l'altra banda|through==a través de|around==al voltant|away==lluny|upstairs==a dalt|downstairs==a baix|any==cap / algun|another==un altre / una altra|other==altre / altra|each==cada|every==cada / tots|both==tots dos|few==pocs|enough==prou|much==molt|a lot==molt / molts|most==la majoria|own==propi`))] }
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
