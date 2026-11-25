// The forms of a Catalan verb, so typing the form a student hears finds its button: "plou" and "plovia" find rain
// (pluja / ploure), "neva" finds snow (neu / nevar), "surto" finds go out (sortir). Search only: a button still
// shows just its Catalan. Forms are written without accents, as search ignores them. A form that does not exist
// does no harm, since no one types it, so the rules below may give a few.

// Verbs no rule conjugates. A key is a whole infinitive; one starting with "-" is the end of a family of them
// ("-tenir": tenir, obtenir, contenir), and its forms follow the part before that end ("ob" + "tinc").
const IRREGULAR: Record<string, string> = {
    ser: 'soc ets es som sou son era eres erem ereu eren sere seras sera serem sereu seran seria series serien sigut estat sigui siguis siguin siguem sigueu fos fossis fossin essent',
    estar: 'estic estas esta estem esteu estan estava estaves estavem estaveu estaven estare estaras estara estarem estareu estaran estaria estat estada estigui estiguis estiguin estigues estant',
    anar: 'vaig vas va anem aneu van anava anaves anavem anaveu anaven anire aniras anira anirem anireu aniran aniria anat anada vagi vagis vagin ves anant',
    haver: 'he has ha hem heu han havia havies haviem havieu havien haure hauras haura haurem haureu hauran hauria hagut hagi hagis hagin hagues havent',
    poder: 'puc pots pot podem podeu poden podia podies podiem podieu podien podre podras podra podrem podreu podran podria podries pogut pugui puguis puguin pogues podent',
    voler: 'vull vols vol volem voleu volen volia volies voliem volieu volien voldre voldras voldra voldrem voldreu voldran voldria volgut vulgui vulguis vulguin volgues volent',
    saber: 'se saps sap sabem sabeu saben sabia sabies sabiem sabieu sabien sabre sabras sabra sabrem sabreu sabran sabria sabut sapiga sapigues sapiguen sabent',
    dir: 'dic dius diu diem dieu diuen deia deies deiem deieu deien dire diras dira direm direu diran diria dit dita digui diguis diguin digues dient',
    predir: 'predic predius prediu prediem predieu prediuen predeia predira prediria predit predigui',
    dur: 'duc duus duu duem dueu duen duia duies duien dure duras dura durem dureu duran duria dut duta dugui duguis duguin duent',
    sortir: 'surto surts surt sortim sortiu surten sortia sorties sortien sortire sortira sortiria sortit sortida surti surtis surtin sortint',
    morir: 'moro mors mor morim moriu moren moria mories morien morire morira moriria mort morta mori moris morin morint',
    omplir: 'omplo omples omple omplim ompliu omplen omplia omplira ompliria omplert omplit ompli omplint',
    creixer: 'creixo creixes creix creixem creixeu creixen creixia creixera creixeria crescut crescuda creixi creixent',
    neixer: 'neixo neixes neix neixem naixem neixeu naixeu neixen neixia naixia neixera naixera nascut nascuda neixi neixent naixent',
    premer: 'premo prems prem premem premeu premen premia premera premeria premut premuda premi prement',
    pertanyer: 'pertanyo pertanys pertany pertanyem pertanyeu pertanyen pertanyia pertanyera pertangut pertanyi pertanyent',
    ploure: 'plou plouen plovia plovien ploura plouran plouria plogut plogui ploguin plogues ploguera plovent',
    coure: 'coc cous cou coem coeu couen coia coies coien coura couria cuit cuita cogui coguis coguin coent',
    romandre: 'romanc romans roman romanem romaneu romanen romania romandra romandria romas romasa romangui romanent',
    '-fer': 'faig fas fa fem feu fan feia feies feiem feieu feien fare faras fara farem fareu faran faria faries fet feta fets fetes faci facis facin fes fent',
    '-tenir': 'tinc tens te tenim teniu tenen tenia tenies teniem tenieu tenien tindre tindras tindra tindrem tindreu tindran tindria tingut tinguda tingui tinguis tinguin tingues tenint',
    '-venir': 'vinc vens ve venim veniu venen venia venies veniem venieu venien vindre vindras vindra vindrem vindreu vindran vindria vingut vinguda vingui vinguis vinguin vine vingues venint',
    '-eixer': 'ec eixo eixes eix eixem eixeu eixen eixia eixies eixien eixere eixera eixeria egut eguda egui eguis eguin eixent',
    '-penyer': 'penyo penys peny penyem penyeu penyen penyia penyera penyeria pes pesa penyi penyent',
    '-vencer': 'venco vences venc vencem venceu vencen vencia vencera venceria vencut vencuda venci vencent',
    '-correr': 'corro corres corre correm correu corren corria corries corrien correra correria corregut correguda corri corris corrin corrent',
    '-veure': 'veig veus veu veiem veieu veuen veia veies veien veura veuria vist vista vegi vegis vegin veges veient',
    '-beure': 'bec beus beu bevem beveu beuen bevia bevies bevien beura beuria begut beguda begui beguis beguin begues bevent',
    '-viure': 'visc vius viu vivim viviu viuen vivia vivies vivien viura viuria viscut viscuda visqui visquis visquin visques vivint',
    '-scriure': 'scric scrius scriu scrivim scriviu scriuen scrivia scrivies scrivien scriura scriuria scrit scrita scrigui scriguis scriguin scrivint',
    '-moure': 'moc mous mou movem moveu mouen movia movies movien moura mouria mogut moguda mogui moguis moguin movent',
    '-seure': 'sec seus seu seiem seieu seuen seia seies seien seura seuria segut seguda segui seguis seguin seient',
    '-caure': 'caic caus cau caiem caieu cauen queia queies queien caura cauria caigut caiguda caigui caiguis caiguin caient',
    '-creure': 'crec creus creu creiem creieu creuen creia creies creien creura creuria cregut creguda cregui creguis creguin creient',
    '-riure': 'ric rius riu riem rieu riuen reia reies reien riura riuria rigut rigui riguis riguin rient',
    '-cloure': 'cloc clous clou cloem cloeu clouen cloia cloies cloien cloura clouria clos closa clogui cloguis cloguin cloent',
    '-treure': 'trec treus treu traiem traieu treuen treia treies treien traura trauria tret treta tregui treguis treguin traient',
    '-traure': 'trec treus treu traiem traieu treuen treia treies treien traura trauria tret treta tregui treguis treguin traient',
    '-endre': 'enc ens en enem eneu enen enia enies enien endra endria es esa enut enuda engui enguis enguin enent',
    '-ondre': 'onc ons on onem oneu onen onia onies onien ondra ondria ost osta os osa ongui onguis onguin onent',
    '-oldre': 'olc ols ol olem oleu olen olia olies olien oldra oldria olt olta olgui olguis olguin olent',
    '-metre': 'meto mets met metem meteu meten metia meties metien metra metria mes mesa meti metis metin metent',
    '-brir': 'bro bres bre brim briu bren bria bries brien brira briria bert berta bri bris brin brint',
    '-collir': 'cullo culls cull collim colliu cullen collia collies collien collira colliria collit collida culli cullis cullin collint'
};
const FAMILIES = Object.keys(IRREGULAR).filter(key => key.startsWith('-')).sort((a, b) => b.length - a.length);

// Regular verbs: the endings after the stem ("parl" + "o"). An -ir verb gets both kinds (dormo, serveixo).
const AR_HARD = 'o a ava aves avem aveu aven are aras ara arem areu aran aria aries ariem arieu arien at ada ats ades ant'.split(' ');
const AR_SOFT = 'es em eu en i is in essis essin'.split(' '); // before e and i: toquem, paguem, comencem, mengem
const IR = 'o s _ en i is in eixo eixes eix eixen eixi eixis eixin im iu ia ies iem ieu ien ire iras ira irem ireu iran iria iries irien it ida its ides int'.split(' ');
const RE = 'o s _ em eu en ia ies iem ieu ien ra ria ut uda i is in ent'.split(' ');

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '');
const words = (forms: string) => forms.split(' ');

function conjugate(infinitive: string, verb: boolean): string[] {
    const bare = plain(infinitive);
    if (IRREGULAR[bare]) return words(IRREGULAR[bare]);
    const family = FAMILIES.find(end => bare.endsWith(end.slice(1)));
    if (family) return words(IRREGULAR[family]).map(form => bare.slice(0, bare.length - family.length + 1) + form);
    if (infinitive.length < 4) return [];
    const stem = infinitive.slice(0, -2);
    if (infinitive.endsWith('ar')) {
        const soft = /[gq]u$/.test(stem) ? stem : stem.replace(/c$/, 'qu').replace(/g$/, 'gu').replace(/ç$/, 'c').replace(/j$/, 'g');
        return [...AR_HARD.map(end => stem + end), ...AR_SOFT.map(end => soft + end)];
    }
    if (infinitive.endsWith('ir')) return IR.map(end => stem + end.replace('_', ''));
    // Other -re verbs only on a verb's button: a noun's "teatre" or "centre" is no verb.
    if (verb && infinitive.endsWith('re')) {
        const forms = RE.map(end => stem + end.replace('_', ''));
        return stem.endsWith('b') ? [...forms, stem.slice(0, -1) + 'p', stem.slice(0, -1) + 'ps'] : forms; // rebre: rep, reps
    }
    return [];
}

// The forms of the verb a button's Catalan starts with: "fer mal" gives "faig mal", "fa mal"…; "dutxar-se" gives
// "dutxo", "dutxes"…. verb: the button is a verb, so any Catalan infinitive on it is one.
export function verbForms(catalan: string, verb: boolean): string[] {
    const [first, ...rest] = catalan.toLowerCase().replace(/[’`]/g, "'").trim().split(/\s+/);
    if (!first) return [];
    const infinitive = first.replace(/(?:-[\p{L}']+)+$|'\p{L}+$/u, '');
    const tail = rest.length ? ` ${rest.join(' ')}` : '';
    return conjugate(infinitive, verb).map(form => form + tail);
}
