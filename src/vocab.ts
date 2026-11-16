// The board's words. Colours follow the modified Fitzgerald key, and core words never move,
// so the hand learns where each one is.

export type Kind = 'person' | 'verb' | 'describe' | 'noun' | 'little' | 'question' | 'social' | 'no';
export type Word = { w: string; e?: string; k: Kind };

const row = (kind: Kind, items: string): Word[] => items.split('|').map(item => {
    const [w, e] = item.split('=');
    return { w, k: kind, ...(e ? { e } : {}) };
});

// 10 columns by 6 rows. On a narrow screen each row splits into two rows of 5, in the same order.
export const CORE: Word[] = [
    ...row('person', 'I=🙋|you=🫵|he=👨|she=👩|we=👥|they=👫|it|this=👇|that=👉|my'),
    ...row('verb', 'want=🤲|need=❗|like=👍|have=🎒|go=➡️|come=🫴|get|do|make=🛠️|can=💪'),
    ...row('verb', 'see=👀|eat=🍽️|drink=🥤|help=🆘|know=💡|think=🤔|feel=💗|say=🗣️|give=🎁|be'),
    ...row('no', 'not=🚫|no=❌'), ...row('social', 'yes=✅'), ...row('little', 'and=➕|but|because|to|in=📥|with=🤝|for'),
    ...row('question', 'what=❓|where=📍|when=🕒|who=👤|why|how'), ...row('describe', 'now=⏱️|here=📌|more=➕|very'),
    ...row('describe', 'good=🙂|bad=🙁|big=🐘|small=🐜|hot=🔥|cold=🧊|happy=😊|tired=😴|sick=🤒'), ...row('social', 'please=🙏')
];

export type Page = { id: string; name: string; icon: string; words: Word[] };

export const PAGES: Page[] = [
    { id: 'people', name: 'People', icon: '👪', words: row('person', 'me|your|his|her|our|their|family=👪|mother=👩|father=👨|son=👦|daughter=👧|brother|sister|husband=🤵|wife=👰|child=🧒|baby=👶|friend=🧑‍🤝‍🧑|teacher=🧑‍🏫|doctor=🧑‍⚕️|nurse|boss=💼|neighbor=🏘️|police=👮|man|woman|people=👥|someone') },
    { id: 'actions', name: 'Actions', icon: '🏃', words: row('verb', 'work=💼|live=🏠|buy=🛒|pay=💳|take|call=📞|wait=⏳|understand=💡|speak=🗣️|learn=📖|read=📚|write=✍️|listen=👂|look=👀|find=🔎|use|open=🔓|close=🔒|start=▶️|finish=🏁|stop=✋|sleep=🛌|wake up=⏰|cook=🍳|clean=🧹|wash=🧼|drive=🚗|walk=🚶|sit=🪑|play=⚽|send=📤|bring|ask=🙋|tell|show|try|forget|remember|love=❤️|hurt=🤕|lose|change=🔁|will|did|am|is|are|was') },
    { id: 'food', name: 'Food', icon: '🍎', words: row('noun', 'food=🍲|water=💧|coffee=☕|tea=🍵|milk=🥛|juice=🧃|bread=🍞|rice=🍚|chicken=🍗|meat=🥩|fish=🐟|egg=🥚|cheese=🧀|fruit=🍎|vegetables=🥦|soup=🥣|pasta=🍝|pizza=🍕|sandwich=🥪|salad=🥗|sugar|salt=🧂|breakfast=🥞|lunch=🥙|dinner=🍽️|menu=📋|bill=🧾|glass=🥛|plate=🍽️|spoon=🥄') },
    { id: 'places', name: 'Places', icon: '🏠', words: row('noun', 'home=🏠|school=🏫|work=🏢|shop=🏪|supermarket=🛒|hospital=🏥|pharmacy=💊|bank=🏦|post office=📮|restaurant=🍴|bathroom=🚻|kitchen=🍳|bedroom=🛏️|street=🛣️|park=🌳|city=🏙️|country=🌍|station=🚉|bus stop=🚏|airport=✈️|bus=🚌|train=🚆|car=🚗|taxi=🚕|bike=🚲|office=🗄️|library=📚|church=⛪|mosque=🕌|outside=🌤️') },
    { id: 'body', name: 'Health', icon: '🩺', words: [
        ...row('noun', 'head=🗣️|eye=👁️|ear=👂|tooth=🦷|throat|back|stomach|arm=💪|hand=✋|leg=🦵|foot=🦶|heart=🫀|pain=🤕|fever=🌡️|cough|medicine=💊|appointment=📅|allergy=🤧|blood=🩸|glasses=👓|emergency=🚨|ambulance=🚑'),
        ...row('describe', 'dizzy=😵|hurt=🤕|better=📈|worse=📉|pregnant=🤰|afraid=😨')] },
    { id: 'describe', name: 'Describe', icon: '🎨', words: row('describe', 'sad=😢|angry=😠|worried=😟|hungry=😋|thirsty=🥤|ready=✅|busy|free|late=⌛|early|fast=⚡|slow=🐢|easy|difficult=🧩|important=❗|new=✨|old|cheap|expensive=💰|open|closed|right=✔️|wrong=✖️|same|different|many|some|all|a little=🤏|too|again=🔁|also|only|maybe=🤷|always|never|sometimes|near|far|up=⬆️|down=⬇️|left=⬅️|right=➡️') },
    { id: 'time', name: 'Time', icon: '🕒', words: [
        ...row('describe', 'today=📅|tomorrow=⏭️|yesterday=⏮️|morning=🌅|afternoon=☀️|evening=🌇|night=🌙|soon|later|before|after|next|last|every day'),
        ...row('noun', 'time=🕒|hour|minute|day|week|month|year|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|weekend'),
        ...row('little', 'one=1️⃣|two=2️⃣|three=3️⃣|four=4️⃣|five=5️⃣|six=6️⃣|seven=7️⃣|eight=8️⃣|nine=9️⃣|ten=🔟|at|on|from|until')] },
    { id: 'things', name: 'Things', icon: '📱', words: [
        ...row('noun', 'phone=📱|money=💶|card=💳|key=🔑|bag=👜|ticket=🎫|passport=🛂|paper=📄|form=📝|pen=🖊️|book=📕|computer=💻|internet=🌐|password=🔐|clothes=👕|shoes=👟|jacket=🧥|bed=🛏️|door=🚪|window=🪟|table|chair=🪑|light=💡|job=💼|problem=⚠️|question=❓|answer|name=📛|address=🏷️|number=🔢|English=🇬🇧|word=🔤|thing|something|nothing|everything'),
        ...row('little', 'the|a|an|of|about|or|if|so|than|then|there|by|under|next to')] }
];

// Whole sentences for moments when there is no time to build one. A tap speaks at once.
export const QUICK: string[] = [
    'Hello!', 'Goodbye!', 'Thank you very much.', "You're welcome.", 'Excuse me.', "I'm sorry.",
    'Yes, please.', 'No, thank you.', "I don't understand.", "I don't know.",
    'Can you speak more slowly, please?', 'Can you repeat that, please?', 'Can you write it down, please?', 'What does this word mean?',
    'How do you say this in English?', 'I am learning English.', 'Please wait a moment. I am writing my answer.', 'Can you help me, please?',
    'I need help.', 'Where is the bathroom?', 'How much is it?', 'Nice to meet you.', 'My name is …', 'I come from …',
    'I need a doctor.', 'Please call this number.', 'I am lost.', 'That is correct.', 'That is not what I mean.', 'One more time, please.'
];
