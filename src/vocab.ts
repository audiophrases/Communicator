// The built-in board, used until the teacher saves their own at /create.
// Each item is "English=picture=Catalan". A picture is an emoji, a short visual cue, or @ followed by an SVG name.
// Core words never move, so the hand learns where each one is.
//
// The pages hold the CEFR A1 words (the Oxford 3000's A1 list and Cambridge's A1 Movers list) that a learner can say
// something with: alcohol, CDs and DVDs are left out, and so are spellings that only repeat a word (bicycle, telephone).
// A2–B1 additions cover everyday conversations, school, shopping, work and getting around.

import type { Board, Kind, Word } from '../shared/board.ts';

const row = (kind: Kind, items: string): Word[] => items.split('|').map(item => {
    const [w, picture, ca] = item.split('=');
    return { w, k: kind, ...(picture.startsWith('@') ? { s: picture.slice(1) } : picture ? { e: picture } : {}), ...(ca ? { ca } : {}) };
});

// Mulberry Symbols (mulberry-symbols/, © Steve Lee, CC BY-SA 4.0), by page and word, where a symbol shows the meaning
// better than the emoji did, or where a word had no picture of its own or shared one with another word:
// actions (an emoji of a chair for "sit" is the chair), question words, family relations (who to whom), time words
// that emoji show as media buttons, body parts, pairs such as open/closed and hungry/thirsty, numbers past ten,
// colours, seasons and weather, and where things are (above, behind, between).
// Emoji stay where they are clear: feelings, most food and things, animals, call, wait, write.
const SYMBOLS: Record<string, Record<string, string>> = {
    core: {
        I: 'I_me', want: 'want_,_to', go: 'go_,_to', come: 'come_,_to', get: 'get_,_to', make: 'make_,_to', see: 'look_,_to', eat: 'eat_,_to',
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
        card: 'bank_card', passport: 'passport', bed: 'single_bed', table: 'table', light: 'ceiling_light', answer: 'answer'
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
    ...row('person', `I=🙋=jo|you=🫵=tu / vostè|he=👨=ell|she=👩=ella|we=👥=nosaltres|they=👫=ells / elles|it=@scene_it=ho / això|this=👇=això / aquest|that=👉=allò / aquell|my=@scene_my=el meu / la meva`),
    ...row('verb', `want=🤲=voler|need=❗=necessitar|like=👍=agradar|have=🎒=tenir|go=➡️=anar|come=🫴=venir|get==aconseguir / obtenir|do=@scene_do=fer|make=🛠️=fer / crear|can=💪=poder`),
    ...row('verb', `see=👀=veure|eat=🍽️=menjar|drink=🥤=beure|help=🆘=ajudar|know=🧠=saber / conèixer|think=🤔=pensar|feel=💗=sentir|say=🗣️=dir|give=🎁=donar|be=@scene_be=ser / estar`),
    ...row('no', `not=🚫=no (negació)|no=❌=no`), ...row('social', `yes=✅=sí`),
    ...row('little', `and=@scene_and=i|but=@scene_but=però|because=@scene_because=perquè|to=@scene_to=a / per a|in=📥=a / dins de|with=🤝=amb|for=@scene_for=per / per a`),
    ...row('question', `what=❓=què|where=📍=on|when=🕒=quan|who=👤=qui|why==per què|how==com`),
    ...row('describe', `now=⏱️=ara|here=📌=aquí|more=➕=més`), ...row('question', `?=💬❔=interrogant: és una pregunta`),
    ...row('describe', `very=‼️=molt|good=🙂=bo / bé|bad=🙁=dolent / malament|big=🐘=gran|small=🐜=petit|hot=🔥=calent / calor|cold=🧊=fred|happy=😊=content|tired=😴=cansat`),
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
    pictureVersion: 4,
    core: CORE_BOARD,
    pages: [
        { id: 'people', name: 'People', ca: 'Persones', icon: '👪', words: [...fromCore('I', 'you', 'he', 'she', 'we', 'they', 'it', 'this', 'that', 'my'), ...withSymbols('people', row('person', `me=@scene_me=em / mi|him=@scene_him=ell / el / li|us=@scene_us=nosaltres / ens|them=@scene_them=ells / els|your=@scene_your=el teu / la teva|his=@scene_his=el seu (d'ell)|her=@scene_her=el seu (d'ella)|its=@scene_its=el seu (d'això)|our=@scene_our=el nostre / la nostra|their=@scene_their=el seu (d'ells)|yourself=@scene_yourself=tu mateix / tu mateixa|someone=👤=algú|anyone=@scene_anyone=algú / qualsevol|everyone=@scene_everyone=tothom|nobody=@scene_nobody=ningú|family=👪=família|mother=👩=mare|father=👨=pare|mum=👩‍🍼=mama|dad=👨‍🍼=papa|parents==pares|son=👦=fill|daughter=👧=filla|brother==germà|sister==germana|husband=🤵=marit|wife=👰=dona / esposa|grandmother==àvia|grandfather==avi|aunt==tia|uncle==oncle|cousin=@scene_cousin=cosí / cosina|child=🧒=nen / nena|baby=👶=nadó|boy=👦=noi|girl=👧=noia|teenager=@scene_teenager=adolescent|adult=🧑=adult / adulta|man==home|woman==dona|person=🧍=persona|people=👥=gent|group=👥👥=grup|friend=🧑‍🤝‍🧑=amic / amiga|boyfriend=@scene_boyfriend=xicot / nòvio|girlfriend=@scene_girlfriend=xicota / nòvia|partner=@partner=parella|neighbor=🏘️=veí / veïna|age=@scene_age=edat|teacher=🧑‍🏫=professor / professora|student=🧑‍🎓=alumne / alumna|doctor=🧑‍⚕️=metge / metgessa|nurse==infermer / infermera|police=👮=policia|boss=👔=cap|worker=👷=treballador / treballadora|driver=@taxi_driver_2a=conductor / conductora|farmer=🧑‍🌾=pagès / pagesa|waiter=🧑‍🍳🍽️=cambrer / cambrera|writer=@scene_writer=escriptor / escriptora|singer=🧑‍🎤=cantant|actor=@scene_actor=actor / actriu|artist=🧑‍🎨=artista|scientist=🧑‍🔬=científic / científica|tourist=🧳📷=turista|visitor=@visitor_1b=visitant|customer=@scene_customer=client / clienta|member=@scene_member=membre`)),
            ...row('person', `myself=🙋🪞=jo mateix / jo mateixa|ourselves=👥🪞=nosaltres mateixos / mateixes|mine=🙋🔑=el meu / la meva|yours=🫵🔑=el teu / la teva|ours=👥🔑=el nostre / la nostra|theirs=👉👥🔑=el seu / la seva (d'ells)`),
            ...row('person', `classmate=🧑‍🎓🤝=company / companya de classe|colleague=💼🤝=company / companya de feina|flatmate=🏠🤝=company / companya de pis|stranger=👤❔=desconegut / desconeguda|interpreter=💬🔁=intèrpret|dentist=@dentist_2a=dentista|mechanic=@car_mechanic_1b=mecànic / mecànica|passenger=🧑🚌=passatger / passatgera|guest=🛎️🧑=convidat / convidada`)
        ] },
        { id: 'actions', name: 'Actions', ca: 'Accions', icon: '🏃', words: [...fromCore('want', 'need', 'like', 'have', 'go', 'come', 'get', 'do', 'make', 'can', 'see', 'eat', 'drink', 'help', 'know', 'think', 'feel', 'say', 'give', 'be'), ...withSymbols('actions', row('verb', `work=💼=treballar|live=🏠=viure|buy=🛍️=comprar|sell=@scene_sell=vendre|pay=💳=pagar|spend=@scene_spend=gastar / passar (temps)|order==demanar|take==agafar / prendre|put==posar|keep==guardar / quedar-se|carry==portar / dur|bring==portar|call=📞=trucar|wait=⏳=esperar|understand=💡=entendre|speak=🗣️=parlar|talk==parlar / xerrar|hear==sentir|listen=👂=escoltar|learn=📖=aprendre|read=📚=llegir|write=✍️=escriure|look=👀=mirar|find=🔎=trobar|use=@scene_use=fer servir|open=🔓=obrir|close=🔒=tancar|start=▶️=començar|begin==començar|finish=🏁=acabar|stop=🛑=parar|arrive=@scene_arrive=arribar|leave=@scene_leave=marxar / sortir|stay=@scene_stay=quedar-se|return==tornar|meet==trobar-se / conèixer|move==moure / mudar-se|sleep=🛌=dormir|wake up=⏰=despertar-se|cook=🍳=cuinar|clean=🧹=netejar|wash=🧼=rentar|drive=🚗=conduir|walk=🚶=caminar|sit=🪑=seure|stand==estar dret|jump==saltar|fall==caure|play=⚽=jugar|send=📤=enviar|ask=🙋=preguntar / demanar|tell==dir / explicar|show==ensenyar|thank=@scene_thank=agrair|try=@scene_try=intentar / provar|choose=@scene_choose=triar / escollir|decide=@scene_decide=decidir|agree=@scene_agree=estar d'acord|forget=@scene_forget=oblidar|remember==recordar|believe=@scene_believe=creure|hope=@scene_hope=esperar (desitjar)|imagine=💭🌈=imaginar|love=❤️=estimar|hate=@scene_hate=odiar|enjoy=@scene_enjoy=gaudir|prefer=☑️❤️=preferir|laugh=😂=riure|smile==somriure|hurt=🩹=fer mal|lose=@scene_lose=perdre|miss=@scene_miss=trobar a faltar / perdre|break==trencar|cut==tallar|build==construir|grow==créixer / cultivar|add==afegir|fill==omplir|share==compartir|join==unir-se / apuntar-se|turn==girar / tombar|follow=@scene_follow=seguir|let=@scene_let=deixar|change=🔁=canviar|become=@scene_become=fer-se / tornar-se|happen=@scene_happen=passar (ocórrer)|prepare=@scene_prepare=preparar|plan=@scene_plan=planificar|create=@scene_create=crear|improve=@scene_improve=millorar|introduce=@scene_introduce=presentar|die=@die_,_to=morir|born=🐣=nascut / néixer|will=@scene_will=(futur: faré, aniré…)|would=💭➡️=(condicional: faria…)|did=⏪✔️=(passat: vaig fer…)|could=💭💪=podria / podia|should=@scene_should=hauria de|must=@scene_must=haver de|have to=📋❗=haver de|can't=🚫💪=no poder|am=🙋＝=soc / estic|is=👤＝=és / està|are=👥＝=ets / som / són|was=⏪＝=era / estava`)),
            ...row('verb', `might=🤔🔮=podria / potser|used to=⏪🔁=solia / acostumava a|were=👥⏪=eres / érem / éreu / eren|had=⏪🎒=tenia / havia`),
            ...row('verb', `borrow=📖⬅️=agafar en préstec|lend=📖➡️=deixar en préstec|repair=🔧🪑=reparar|collect=@collect_,_to=recollir|deliver=@deliver_,_to=lliurar|receive=@receive_,_to=rebre|offer=🫴🎁=oferir|refuse=✋🎁=rebutjar|accept=🤲🎁=acceptar|invite=✉️🎉=convidar`),
            ...row('verb', `suggest=💬💡=suggerir|disagree=💬≠=no estar d'acord|promise=🤙💬=prometre|remind=🔔🧠=recordar a algú|allow=🚪✅=permetre|apologise=💬😔=demanar perdó|solve=🧩✔️=resoldre|point=@point_,_to=assenyalar|touch=@touch_,_to=tocar|communicate=@communicate_,_to=comunicar-se|change my mind=@change_mind_,_to=canviar d'opinió`)
        ] },
        { id: 'food', name: 'Food', ca: 'Menjar', icon: '🍎', words: withSymbols('food', [
            ...row('noun', `food=🍲=menjar|meal=🍽️=àpat|water=💧=aigua|coffee=☕=cafè|tea=🍵=te|milk=🥛=llet|juice=🧃=suc|bread=🍞=pa|butter=🧈=mantega|rice=🍚=arròs|pasta=🍝=pasta|pizza=🍕=pizza|sandwich=🥪=entrepà|soup=🥣=sopa|salad=🥗=amanida|chicken=🍗=pollastre|meat=🥩=carn|fish=🐟=peix|egg=🥚=ou|cheese=🧀=formatge|fruit=🍇=fruita|apple=🍎=poma|banana=🍌=plàtan|vegetables=🥦=verdures|potato=🥔=patata|tomato=🍅=tomàquet|carrot=🥕=pastanaga|onion=🧅=ceba|pepper=🫑=pebrot|cake=🍰=pastís|chocolate=🍫=xocolata|ice cream=🍦=gelat|cream=@cream=nata|sugar==sucre|salt=🧂=sal|breakfast=🥞=esmorzar|lunch=🥙=dinar|dinner=🍽️=sopar|dish=@dish=plat (menjar)|menu=📋=carta / menú|bill=🧾=compte|cup=@doidy_cup=tassa|glass=🥛=got|bottle=@milk_bottle=ampolla|plate=🍽️=plat|spoon=🥄=cullera`),
            ...row('noun', `snack=🍎🥨=refrigeri / cosa per picar|toast=@toast=torrada|cereal=@cereal=cereals|yoghurt=@yogurt=iogurt|grapes=@grapes=raïm|strawberry=@strawberry=maduixa|beans=@baked_beans=mongetes / fesols|lentils=@lentils=llenties|nuts=@nuts=fruita seca|ingredient=@ingredients=ingredient|fork=@fork=forquilla|knife=@knife=ganivet|bowl=@bowl=bol`),
            ...row('describe', `spicy=@spicy=picant|sweet=🍯😋=dolç / dolça|vegetarian=🥕🥗=vegetarià / vegetariana|gluten-free=🌾🚫=sense gluten`)
        ]) },
        { id: 'places', name: 'Places', ca: 'Llocs', icon: '🏠', words: withSymbols('places', [
            ...row('noun', `home=🏠=casa|house=🏡=casa|apartment=@scene_apartment=pis / apartament|room=@room=habitació / sala|bedroom=🛏️=habitació|kitchen=🍳=cuina|bathroom=🚻=lavabo|garden=🌷=jardí|building=🏗️🏢=edifici|school=🏫=escola|university=🎓=universitat|college=🎓🏫=institut / facultat|work=🏢=feina|office=🗄️=oficina|shop=🏪=botiga|supermarket=🛒=supermercat|market=🛒🥕=mercat|cafe==cafeteria|restaurant=🍴=restaurant|hotel=🏨=hotel|hospital=🏥=hospital|pharmacy=💊=farmàcia|bank=🏦=banc|post office=📮=oficina de correus|library=📚=biblioteca|museum=🏛️=museu|cinema=🍿=cinema|theatre=🎭=teatre|gym=@gym_1=gimnàs|pool=🏊‍♀️=piscina|park=🌳=parc|beach==platja|farm=🚜=granja|church=⛪=església|mosque=🕌=mesquita|street=🛣️=carrer|road=@road=carretera|traffic=🚦=trànsit|town=@scene_town=poble / ciutat|village=🏡🏡=poble|city=🏙️=ciutat|country=🌍=país|world=🌏=món|place=@scene_place=lloc|area=@scene_area=zona|centre=@scene_centre=centre|outside=🌤️=fora|map=🗺️=mapa|north=@north=nord|south=@south=sud|east=@east=est|west=@west=oest|station=🚉=estació|bus stop=🚏=parada d'autobús|airport=✈️=aeroport|flight=@scene_flight=vol|bus=🚌=autobús|train=🚆=tren|car=🚗=cotxe|taxi=🚕=taxi|bike=🚲=bicicleta|plane=🛩️=avió|boat=⛵=vaixell`),
            ...row('noun', `entrance=🚪⬅️=entrada|exit=🚪➡️=sortida|lift=@lift=ascensor|ramp=@ramp=rampa|stairs=@stairs=escales|crossing=@zebra_crossing=pas de vianants|traffic lights=@traffic_lights=semàfor|corner=📐📍=cantonada|directions=@signpost=indicacions per arribar-hi`),
            ...row('noun', `journey=🧳🛤️=viatge / trajecte|platform=🚉🔢=andana|timetable=🚌🕒=horari|delay=🚆⏳=retard|return ticket=🎟️↔️=bitllet d'anada i tornada|single ticket=🎟️➡️=bitllet senzill|luggage=@suitcase_1=equipatge|underground=@underground_train=metro|reservation=🛎️📋=reserva`),
            ...row('noun', `Catalonia=@scene_catalonia=Catalunya|Barcelona=BCN=Barcelona|Madrid=MAD=Madrid|London=💂🕰️=Londres|Paris=@scene_paris=París`),
            ...row('verb', `book=🗓️🖊️=reservar|cancel=🗓️❌=cancel·lar|get on=🧍➡️🚌=pujar (al transport)|get off=🚌➡️🧍=baixar (del transport)`),
            ...row('describe', `lost=@lost=perdut / perduda|accessible=@disabled_sign=accessible`)
        ]) },
        { id: 'body', name: 'Health', ca: 'Salut', icon: '🩺', words: withSymbols('body', [
            ...row('noun', `body==cos|head=🗣️=cap|face==cara|hair=💇=cabell|eye=👁️=ull|ear=👂=orella|nose=👃=nas|mouth==boca|tooth=🦷=dent|throat==gola|back==esquena|stomach==estómac / panxa|arm=💪=braç|hand=✋=mà|leg=🦵=cama|foot=🦶=peu|heart=🫀=cor|blood=🩸=sang|health=@scene_health=salut|pain=🤕=dolor|fever=🌡️=febre|cough==tos|allergy=🤧=al·lèrgia|medicine=💊=medicament|appointment=📅=cita|glasses=👓=ulleres|toilet=🚽=vàter|shower=🚿=dutxa|bath=🛁=bany|emergency=🚨=urgència|ambulance=🚑=ambulància`),
            ...row('describe', `sick=🤒=malalt|healthy=@healthy=sa / sana|dizzy=😵=marejat|hurt=🩹=ferit / em fa mal|better=📈=millor|worse=📉=pitjor|pregnant=🤰=embarassada|afraid=😨=espantat / tenir por`),
            ...row('noun', `headache=@headache=mal de cap|toothache=@toothache=mal de queixal|stomach ache=@stomach_ache=mal de panxa|injury=@broken_bone=lesió|temperature=@thermometer=temperatura|plaster=@plaster=tireta|wheelchair=@wheelchair=cadira de rodes|hearing aid=@hearing_aid_1=audiòfon|communication board=@communication_board=tauler de comunicació`),
            ...row('verb', `rest=@rest_,_to=descansar|breathe=🫁💨=respirar`),
            ...row('describe', `allergic=🤧⚠️=al·lèrgic / al·lèrgica|sore=🩹😣=adolorit / adolorida`)
        ]) },
        { id: 'describe', name: 'Describe', ca: 'Descriure', icon: '🎨', words: [...fromCore('here', 'very', 'good', 'bad', 'big', 'small', 'hot', 'cold', 'happy', 'tired'), ...withSymbols('describe', row('describe', `sad=😢=trist|angry=😠=enfadat|worried=😟=preocupat|excited=🤩=il·lusionat|bored=🥱=avorrit|hungry=😋=tenir gana|thirsty=🥤=tenir set|ready=✅=a punt|busy==ocupat|free=@scene_free=lliure|late=⌛=tard|early=@scene_early=d'hora|fast=⚡=ràpid|slow=🐢=lent|easy=@scene_easy=fàcil|difficult=🧩=difícil|hard=@scene_hard=dur / difícil|important=⭐=important|new=✨=nou|old=@old_object=vell / antic|young=@young=jove|tall=@tall=alt|short=@short=baix / curt|long=@long=llarg|high=@high=alt|large=@large=gran|strong=@strong=fort|cheap=🪙=barat|expensive=💰=car|rich=@scene_rich=ric|poor=@scene_poor=pobre|full=@full=ple|empty=@empty=buit / buida|clean=@clean_hands=net|dirty=@dirty=brut|quiet=🤫=tranquil / silenciós|beautiful=@scene_beautiful=bonic / preciós|pretty=@pretty=bonic / maco|nice=@scene_nice=agradable / maco|friendly=👋😊=simpàtic|funny=@funny_laugh=divertit / graciós|interesting=@scene_interesting=interessant|interested=👀💡=interessat|boring=@scene_boring=avorrit (que avorreix)|exciting=@scene_exciting=emocionant|great=@great=genial|fantastic=🌠=fantàstic|wonderful=🤩✨=meravellós|amazing=🤯=increïble|cool=😎=guai|perfect=@scene_perfect=perfecte|best=@scene_best=el millor|fine=🙂👌=bé|terrible=@scene_terrible=terrible|delicious=@delicious_food=deliciós|dangerous=@scene_dangerous=perillós|famous=🌟📸=famós|popular=👥❤️=popular|special=@scene_special=especial|favourite=💖=preferit|married=💍=casat / casada|modern=@scene_modern=modern|online=🟢🌐=en línia|useful=🧰✔️=útil|open==obert|closed==tancat|right=✔️=correcte|wrong=✖️=incorrecte / equivocat|true=@scene_true=cert / veritat|false=@scene_false=fals|real=@scene_real=real / de veritat|sure=@scene_sure=segur|possible=@scene_possible=possible|same==igual|different=@scene_different=diferent|many=●●●=molts|some==alguns / una mica de|all=@scene_all=tot / tots|a little=🤏=una mica|more=➕=més|less=➖=menys|too=@scene_too=massa / també|really=✔️❗=de veritat / molt|quite=◕=bastant|well=@scene_well=bé|again=🔁=una altra vegada|also=⊕=també|only=@scene_only=només|just=☝️=només / acabar de|still=@scene_still=encara|even=＋❕=fins i tot|together=@scene_together=junts|maybe=🤷=potser|probably=@scene_probably=probablement|always=@scene_always=sempre|usually=@scene_usually=normalment|often=@scene_often=sovint|sometimes=@scene_sometimes=de vegades|ever=@scene_ever=alguna vegada|never=@scene_never=mai|near==a prop|far=@scene_far=lluny|up=⬆️=amunt|down=⬇️=avall|left=⬅️=esquerra|right=➡️=dreta`)),
            ...row('describe', `confused=@confused_lady=confós / confosa|surprised=@surprised_man=sorprès / sorpresa|nervous=😬💓=nerviós / nerviosa|proud=😊🏅=orgullós / orgullosa|embarrassed=😳🫣=avergonyit / avergonyida|frustrated=😣🧩=frustrat / frustrada|lonely=🧍💭=que se sent sol / sola|calm=😌🕊️=tranquil / tranquil·la|comfortable=🛋️😊=còmode / còmoda|uncomfortable=🪑😣=incòmode / incòmoda`),
            ...row('describe', `safe=🛡️✔️=segur / segura|private=🔒👤=privat / privada|urgent=⏱️❗=urgent|noisy=@noisy=sorollós / sorollosa|crowded=🚇👥=ple de gent|broken=@broken=trencat / trencada|wet=@wet=mullat / mullada|dry=@dry=sec / seca|heavy=@heavy=pesant|available=🗓️✔️=disponible`)
        ] },
        { id: 'questions', name: 'Ask & answer', ca: 'Preguntar i respondre', icon: '❓', words: [
            ...fromCore('what', 'where', 'when', 'who', 'why', 'how', '?'), ...row('question', `which=@which=quin / quina|how much=@scene_how_much=quant / quanta|how many=@how_many=quants / quantes`),
            ...fromCore('yes', 'no', 'not', 'please'),
            ...withSymbols('questions', row('social', `ok=👌=d'acord|sorry=😔=perdó / ho sento|excuse me=🙋💬=perdoni|thank you=@scene_thank_you=gràcies|thanks=💬🙏=gràcies|hello==hola|hi=👋=hola|goodbye=@scene_goodbye=adéu|bye=👋🚶=adéu|welcome=@scene_welcome=benvingut / de res|yeah=🙌=sí / ja`)),
            ...row('question', `whose=👤🔑❓=de qui|how long=⏳❓=quant de temps|how often=🔁❓=amb quina freqüència|how far=📏❓=a quina distància|what time=🕰️❓=a quina hora`),
            ...row('social', `my turn=🙋🔄=em toca|your turn=🫵🔄=et toca|one moment=☝️⏳=un moment|no problem=👌🙂=cap problema`)
        ] },
        { id: 'time', name: 'Time', ca: 'Temps', icon: '🕒', words: [...fromCore('now'), ...withSymbols('time', [
            ...row('describe', `today=📅=avui|tonight=🌃=aquesta nit|tomorrow=⏭️=demà|yesterday=⏮️=ahir|morning=🌅=matí|afternoon=☀️=tarda|evening=🌇=vespre|night=🌙=nit|midnight=🕛=mitjanit|o'clock=🕐=en punt|soon=@scene_soon=aviat|later=@scene_later=més tard|before==abans|after==després|next==següent / vinent|last==últim / passat|ago=@scene_ago=fa (fa dos dies)|every day=📅🔁=cada dia`),
            ...row('noun', `time=🕒=temps / hora|moment=⏱️🤏=moment|hour==hora|minute==minut|day==dia|week==setmana|month==mes|year==any|century=@scene_century=segle|date=@date=data|beginning=@scene_beginning=començament|end=🔚=final|past=@past=passat|future=@future=futur|routine=📋🔁=rutina|Monday=@scene_monday=dilluns|Tuesday=@scene_tuesday=dimarts|Wednesday=@scene_wednesday=dimecres|Thursday=@scene_thursday=dijous|Friday=@scene_friday=divendres|Saturday=@scene_saturday=dissabte|Sunday=@scene_sunday=diumenge|weekend==cap de setmana|January=@scene_january=gener|February=@scene_february=febrer|March=@scene_march=març|April=@scene_april=abril|May=@scene_may=maig|June=@scene_june=juny|July=@scene_july=juliol|August=@scene_august=agost|September=@scene_september=setembre|October=@scene_october=octubre|November=@scene_november=novembre|December=@scene_december=desembre`),
            ...row('little', `at=@scene_at=a|on==a / sobre|from=@scene_from=de / des de|until=@scene_until=fins a|during=@scene_during=durant`),
            ...row('describe', `already=✔️⏱️=ja|yet=⏳❔=encara / ja (en preguntes)|recently=⏪🗓️=fa poc|suddenly=⚡⏱️=de sobte|finally=🏁⏱️=finalment|on time=🕒✅=puntualment|right now=👇⏱️=ara mateix`),
            ...row('noun', `midday=🕛☀️=migdia|weekday=🗓️💼=dia feiner|Christmas=@Christmas_tree=Nadal|New Year's Day=1 Jan=Cap d'Any`)
        ])] },
        { id: 'numbers', name: 'Numbers', ca: 'Nombres', icon: '🔢', words: withSymbols('numbers', [
            ...row('little', `zero=0️⃣=zero|one=1️⃣=u / un|two=2️⃣=dos|three=3️⃣=tres|four=4️⃣=quatre|five=5️⃣=cinc|six=6️⃣=sis|seven=7️⃣=set|eight=8️⃣=vuit|nine=9️⃣=nou|ten=🔟=deu|eleven==onze|twelve==dotze|thirteen==tretze|fourteen==catorze|fifteen==quinze|sixteen==setze|seventeen==disset|eighteen==divuit|nineteen==dinou|twenty==vint|thirty==trenta|forty==quaranta|fifty==cinquanta|sixty==seixanta|seventy==setanta|eighty==vuitanta|ninety==noranta|hundred==cent|thousand==mil|million=10⁶=milió|first==primer / primera|second=@second=segon / segona|third=🥉=tercer / tercera|fourth=4ᵗʰ=quart / quarta|fifth=5ᵗʰ=cinquè / cinquena|half==mig / meitat|quarter==quart|once=@scene_once=una vegada|twice=2×=dues vegades`),
            ...row('noun', `pair=@scene_pair=parell|price=💲=preu|euro=€=euro|cent=¢=cèntim|dollar=💵=dòlar|pound=💷=lliura|metre=1 m=metre|kilometre=1 km=quilòmetre|mile=1 mi=milla`),
            ...row('verb', `cost=🏷️💰=costar`)]) },
        { id: 'things', name: 'Things', ca: 'Coses', icon: '📱', words: withSymbols('things', [
            ...row('noun', `phone=📱=telèfon / mòbil|money=💶=diners|card=💳=targeta|key=🔑=clau|bag=👜=bossa|box=📦=caixa|ticket=🎫=bitllet / entrada|passport=🛂=passaport|paper=📄=paper|form=📝=formulari|pen=🖊️=bolígraf|book=📕=llibre|newspaper=📰=diari|magazine=@scene_magazine=revista|computer=💻=ordinador|internet=🌐=internet|website=🌐🖥️=web|email=📧=correu electrònic|message=📩=missatge|password=🔐=contrasenya|radio=📻=ràdio|clock=🕰️=rellotge|picture=@picture=imatge / dibuix|present=🎁=regal|bed=🛏️=llit|door=🚪=porta|window=🪟=finestra|wall=@wall=paret|floor=@floor=terra / pis|table==taula|chair=🪑=cadira|light=💡=llum|machine=⚙️=màquina|job=💼=feina|business=@scene_business=negoci|company=🏢👥=empresa|meeting=👥💬=reunió|advice=@scene_advice=consell|problem=⚠️=problema|question=❓=pregunta|answer==resposta|name=📛=nom|address=🏷️=adreça|number=🔢=número|English=💬EN=anglès|word=🔤=paraula|news=📺📰=notícies|life=@scene_life=vida|way=🛤️=manera / camí|reason=@scene_reason=raó / motiu|kind=@scene_kind=tipus|part=@part=part|piece=@scene_piece=tros / peça|sound=🔊=so|thing=@scene_thing=cosa|something=@scene_something=alguna cosa|anything=🎁❔=res / qualsevol cosa|nothing=@scene_nothing=res|everything=🌎✳️=tot`),
            ...row('noun', `charger=@charger_electric=carregador|battery=@battery_1=bateria / pila|Wi-Fi=📶=wifi|keyboard=@computer_keyboard=teclat|screen=@touch_screen=pantalla|headphones=@headphones=auriculars|attachment=@email_attachment=fitxer adjunt`),
            ...row('verb', `download=@download_,_to=baixar / descarregar|save=@save=desar|print=@print=imprimir`),
            ...row('noun', `soap=@soap=sabó|toothbrush=@toothbrush=raspall de dents|towel=@towel=tovallola|blanket=@blanket=manta`)
        ]) },
        { id: 'clothes', name: 'Clothes & colours', ca: 'Roba i colors', icon: '👕', words: withSymbols('clothes', [
            ...row('noun', `clothes==roba|t-shirt=👕=samarreta|shirt==camisa|sweater==jersei|jacket=🧥=jaqueta|coat==abric|dress=👗=vestit|skirt==faldilla|trousers==pantalons|jeans=👖=texans|shoes=👟=sabates|boots=🥾=botes|hat=👒=barret|umbrella=☂️=paraigua`),
            ...row('verb', `wear=🧍👕=portar (roba)`),
            ...row('describe', `colour==color|red==vermell|orange=🟠=taronja|yellow==groc|green==verd|blue==blau|purple==lila|pink==rosa|brown==marró|black==negre|white==blanc|grey==gris|dark=🌑=fosc|blonde=👱=ros / rossa`),
            ...row('noun', `socks=@socks=mitjons|scarf=@scarf=bufanda|gloves=@gloves=guants|belt=@belt=cinturó|pocket=@pocket=butxaca|zip=@zip=cremallera|raincoat=@raincoat=impermeable|pyjamas=@pyjamas=pijama`)
        ]) },
        { id: 'nature', name: 'Nature & weather', ca: 'Natura i clima', icon: '⛅', words: [...withSymbols('nature', [
            ...row('noun', `weather=🌦️=el temps (meteo)|sun==sol|rain==pluja|snow==neu|cloud==núvol|wind=💨=vent|ice=🧊❄️=gel|fire=🔥=foc|spring==primavera|summer==estiu|autumn==tardor|winter==hivern`),
            ...row('describe', `warm=@scene_warm=càlid`)]), ...fromCore('hot', 'cold'), ...withSymbols('nature', row('noun', `sea=🌊=mar|river=🏞️=riu|mountain==muntanya|island=🏝️=illa|tree==arbre|flower==flor|plant=🪴=planta|star=🌟=estrella|air=@scene_air=aire|land=@scene_land=terra|animal=🐾=animal|dog=🐕=gos|cat=🐈=gat|bird=🐦=ocell|horse=🐎=cavall|cow=🐄=vaca|pig=🐖=porc|sheep=🐑=ovella|mouse=🐁=ratolí|lion=🦁=lleó|elephant==elefant|snake=🐍=serp`)),
            ...row('noun', `storm=@thunder_storm=tempesta|fog=🌫️=boira|forest=🌲🌳=bosc|lake=🏞️💧=llac|environment=🌍🌱=medi ambient|rubbish=🗑️🛍️=deixalles`),
            ...row('verb', `recycle=@recycle_logo=reciclar`)
        ] },
        { id: 'school', name: 'School', ca: 'Escola', icon: '🏫', words: withSymbols('school', [
            ...row('noun', `class=@scene_class=classe|classroom=@class_room=aula|lesson=@scene_lesson=lliçó|course=@scene_course=curs|subject=@scene_subject=assignatura|homework=📓=deures|exercise=📖✏️=exercici|test=💯=prova|exam=@scene_exam=examen|break=@break_time_1=pausa|language=@scene_language=llengua / idioma|maths=➗=matemàtiques|science=🔬=ciències|history=@history=història|geography=@geography=geografia|art=@art=art|project=@scene_project=projecte|pencil=✏️=llapis|desk==pupitre|dictionary==diccionari|page=📃=pàgina|letter=✉️=carta / lletra|sentence=@scene_sentence=frase|phrase=💬…=expressió|paragraph=¶=paràgraf|text=@scene_text=text|story=@scene_story=història / conte|article=@scene_article=article|title=@scene_title=títol|topic=💬🎯=tema|dialogue=🗨️↔️=diàleg|conversation=💬=conversa|meaning=@scene_meaning=significat|example=@scene_example=exemple|difference=@scene_difference=diferència|mistake=@mistake_no_wrong=error|spelling=🔠✏️=ortografia|note=🗒️=nota / apunt|list=@scene_list=llista|chart=📊=gràfic|line=@line_horizontal=línia|information=ℹ️=informació|idea=@scene_idea=idea|opinion=@scene_opinion=opinió|rule=@scene_rule=norma|practice=@scene_practice=pràctica|result=@scene_result=resultat`),
            ...row('verb', `teach=@scene_teach=ensenyar|study==estudiar|practise=@scene_practise=practicar|repeat=@scene_repeat=repetir|spell==lletrejar|mean=@scene_mean=voler dir|explain=@scene_explain=explicar|describe=@scene_describe=descriure|discuss=@scene_discuss=comentar|compare=@scene_compare=comparar|complete=🏁✔️=completar|check=☑️=comprovar|correct==corregir|guess==endevinar|count==comptar|type==teclejar`),
            ...row('noun', `instructions=📋①=instruccions|worksheet=@worksheet=fitxa d'exercicis|notebook=@notebook=llibreta|scissors=@scissors=tisores|glue=@glue=cola|whiteboard=@whiteboard=pissarra blanca|presentation=🧑‍🏫📊=presentació|feedback=📝💬=comentaris per millorar|pronunciation=👄🔊=pronunciació`),
            ...row('verb', `translate=💬⇄=traduir|pronounce=👄🎙️=pronunciar|revise=📚🔁=repassar|hand in=📄📥=lliurar (un treball)|underline=A̲=subratllar|copy=@copy_,_to=copiar`)
        ]) },
        { id: 'free', name: 'Free time', ca: 'Temps lliure', icon: '🎉', words: withSymbols('free', [
            ...row('noun', `hobby=@scene_hobby=afició|activity=🏃🎨=activitat|fun=🥳=diversió|party=🎉=festa|birthday=🎂=aniversari|holiday=🧳=vacances|trip=@scene_trip=viatge / excursió|sport=🏅=esport|football==futbol|tennis=🎾=tennis|swimming=🏊=natació|exercise=🏋️=exercici (físic)|game=🎲=joc|ball=🏀=pilota|team=👕⚽=equip|player=⛹️=jugador / jugadora|match=⚽🆚=partit|club=@scene_club=club|music=🎵=música|song=🎶=cançó|guitar=🎸=guitarra|piano=🎹=piano|band=🎸🥁=grup (de música)|concert=🎤=concert|festival=🎪=festival|dancing=💃=ball|film=🎬=pel·lícula|movie=📽️=pel·lícula|TV=📺=tele|video=📹=vídeo|photo=📸=foto|camera=📷=càmera|painting=🖼️=pintura / quadre|reading=📖👀=lectura|cooking=@scene_cooking=cuina|shopping=🛒🛍️=anar de compres`),
            ...row('verb', `dance==ballar|sing==cantar|swim==nedar|run==córrer|climb==escalar / pujar|ride=@ride_horse_,_to=muntar / anar amb|draw==dibuixar|paint==pintar|watch==mirar|travel==viatjar|visit==visitar|fly=🛫=volar|relax==relaxar-se|win=🏆=guanyar`),
            ...row('noun', `invitation=💌🎈=invitació|audience=👏👥=públic|performance=🎭👏=actuació|competition=🏅🏁=competició`),
            ...row('verb', `take part=🙋🏁=participar|score=🥅⚽=marcar (un gol)`)
        ]) },
        { id: 'little', name: 'Little words', ca: 'Paraules petites', icon: '🔗', words: [...fromCore('and', 'but', 'because', 'to', 'in', 'with', 'for'), ...withSymbols('little', row('little', `the=@scene_the=el / la|a=@scene_a=un / una|an=①🍎=un / una|of=@scene_of=de|about=@scene_about=sobre / de|or=@scene_or=o|if=@scene_if=si|so=@scene_so=així que|as=≍=com|than=≷=que|then=①→②=després / llavors|there=@scene_there=allà|by=@scene_by=per / al costat de|without=@scene_without=sense|into=@scene_into=cap a dins de|out==fora|off==fora / apagat|over==per sobre|under==sota|above==a sobre de|below==a sota de|behind==darrere|in front of==davant de|next to==al costat de|between==entre|opposite==davant / enfront|across==a l'altra banda|through==a través de|around==al voltant|away==lluny|upstairs=@walk_upstairs_,_to=a dalt|downstairs=@walk_downstairs_,_to=a baix|any=@scene_any=cap / algun|another=@scene_another=un altre / una altra|other=◯◆=altre / altra|each=@scene_each=cada|every=@every=cada / tots|both=@both=tots dos|few=@scene_few=pocs|enough=@enough=prou|much=▂▅█=molt|a lot=●●●＋=molt / molts|most=@most=la majoria|own=🔑🙋=propi`)),
            ...row('little', `somewhere=❔📍=en algun lloc|anywhere=🌐📍=a qualsevol lloc|nowhere=🚫📍=enlloc|else=➕❔=més / altre`),
            ...row('little', `although=🌧️↔☀️=tot i que|however=💬↩️=tanmateix / però|instead=🔀☝️=en comptes d'això|while=⏱️⇉=mentre|since=📅→=des de / des que|unless=⚠️↪️=tret que|except=👥➖👤=excepte|either=@either=l'un o l'altre|neither=@neither=ni l'un ni l'altre|against=@against=contra|towards=→📍=cap a`)
        ] },
        { id: 'languages', name: 'Languages', ca: 'Llengües', icon: '💬', words: [
            ...row('noun', `English=💬EN=anglès|Catalan=💬CA=català|Spanish=💬ES=castellà / espanyol|Arabic=💬AR=àrab|Darija=💬MA=àrab marroquí / darija|Amazigh=💬ⵣ=amazic|Basque=💬EU=basc / euskera|Bengali=💬BN=bengalí|Chinese=💬ZH=xinès|Dutch=💬NL=neerlandès|French=💬FR=francès|Galician=💬GL=gallec|German=💬DE=alemany|Greek=💬EL=grec|Hindi=💬HI=hindi`),
            ...row('noun', `Italian=💬IT=italià|Japanese=💬JA=japonès|Korean=💬KO=coreà|Mandarin=💬普=mandarí|Polish=💬PL=polonès|Portuguese=💬PT=portuguès|Punjabi=💬PA=panjabi|Romanian=💬RO=romanès|Russian=💬RU=rus|Turkish=💬TR=turc|Ukrainian=💬UK=ucraïnès|Urdu=💬UR=urdú|Wolof=💬WO=wòlof|sign language=🤟💬=llengua de signes|Catalan Sign Language=🤟LSC=llengua de signes catalana`)
        ] },
        { id: 'countries', name: 'Countries', ca: 'Països', icon: '🌍', words: [
            ...row('noun', `Spain=@flag_Spain=Espanya|Andorra=@flag_Andorra=Andorra|Algeria=@flag_Algeria=Algèria|Argentina=@flag_Argentina=Argentina|Australia=@scene_australia=Austràlia|Bangladesh=@flag_Bangladesh=Bangladesh|Belgium=@flag_Belgium=Bèlgica|Bolivia=@flag_Bolivia=Bolívia|Brazil=@flag_Brazil=Brasil|Canada=@flag_Canada=Canadà|Chile=@flag_Chile=Xile|China=@flag_China=Xina|Colombia=@flag_Colombia=Colòmbia`),
            ...row('noun', `Ecuador=@flag_Ecuador=Equador|Egypt=@flag_Egypt=Egipte|France=@flag_France=França|Germany=@flag_Germany=Alemanya|Greece=@flag_Greece=Grècia|India=@flag_India=Índia|Ireland=@flag_Ireland=Irlanda|Italy=@flag_Italy=Itàlia|Japan=@flag_Japan=Japó|Mexico=@flag_Mexico=Mèxic|Morocco=@flag_Morocco=Marroc|Netherlands=@flag_The_Netherlands=Països Baixos|Nigeria=@flag_Nigeria=Nigèria`),
            ...row('noun', `Pakistan=@flag_Pakistan=Pakistan|Peru=@flag_Peru=Perú|Philippines=@flag_Philippines=Filipines|Poland=@flag_Poland=Polònia|Portugal=@flag_Portugal=Portugal|Romania=@flag_Romania=Romania|Russia=@flag_Russian_Federation=Rússia|Senegal=@flag_Senegal=Senegal|South Africa=@flag_South_Africa=Sud-àfrica|South Korea=@flag_South_Korea=Corea del Sud|Turkey=@flag_Turkey=Turquia|Ukraine=@flag_Ukraine=Ucraïna|United Kingdom=@flag_United_Kingdom=Regne Unit|United States=@flag_United_States_of_America=Estats Units|Venezuela=@flag_Venezuela=Veneçuela`)
        ] },
        { id: 'shopping', name: 'Shopping', ca: 'Compres', icon: '🛍️', words: [
            ...row('noun', `cash=💵🪙=diners en efectiu|change=🪙↩️=canvi / monedes|wallet=@wallet=cartera|cash machine=@cash_point=caixer automàtic|basket=@basket=cistell|checkout=🛒💳=caixa (de la botiga)|queue=@queue_,_to=cua|receipt=🧾✅=tiquet de compra|refund=💳↩️=reemborsament|discount=🏷️%=descompte|size=S M L=talla|packet=🍪📦=paquet|delivery=@delivery_trolley=lliurament a domicili`),
            ...row('verb', `try on=👕🪞=emprovar-se|exchange=👕🔄=canviar (un producte)|afford=👛✅=poder-se permetre|weigh=⚖️🍎=pesar`),
            ...row('describe', `second-hand=👕♻️=de segona mà|sold out=🛒❌=exhaurit / exhaurida`)
        ] },
        { id: 'work', name: 'Work', ca: 'Feina', icon: '💼', words: [
            ...row('noun', `interview=💼💬=entrevista|application=📝📨=sol·licitud|CV=📄👤=currículum|contract=📄✍️=contracte|salary=💼💶=sou|shift=🕗💼=torn de feina|task=📋☐=tasca|deadline=🗓️🏁=data límit|skill=🧠🛠️=habilitat|experience=💼🗓️=experiència|training=🧑‍🏫🛠️=formació|uniform=👔🪪=uniforme`),
            ...row('person', `employer=💼🧑‍💼=ocupador / ocupadora|employee=🪪🧑=empleat / empleada|volunteer=🙋💛=voluntari / voluntària`),
            ...row('verb', `apply=📝➡️💼=presentar una sol·licitud|sign=🖊️📄=signar|earn=🛠️💶=guanyar (diners)`),
            ...row('describe', `full-time=💼🕗=a jornada completa|part-time=💼🕓=a temps parcial|unemployed=💼🔍=a l'atur`)
        ] }
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
        ['One more time, please.', 'Una altra vegada, si us plau.'],
        ['I use a communication board.', 'Faig servir un tauler de comunicació.'],
        ['I need a break.', 'Necessito una pausa.'],
        ['Please let me finish.', "Deixi'm acabar, si us plau."],
        ['Please ask me one question at a time.', "Faci'm una pregunta cada vegada, si us plau."],
        ['I need a quiet place.', 'Necessito un lloc tranquil.'],
        ['I need an interpreter.', 'Necessito un intèrpret.'],
        ["I've changed my mind.", "He canviat d'opinió."],
        ['Which languages do you speak?', 'Quines llengües parla?']
    ].map(([t, ca]) => ({ t, ca }))
};
