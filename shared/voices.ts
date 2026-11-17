// English voices from PinPlay's Edge TTS bridge, the same list as HelloChat and Pixel Plaza.
// The page offers them and the Worker accepts only these.
export type EnglishVoice = Readonly<{ id: string; label: string; accent: string }>;

export const DEFAULT_VOICE = 'en-US-EmmaMultilingualNeural'; // Emma, American English

export const ENGLISH_VOICES: readonly EnglishVoice[] = [
    { id: 'en-GB-SoniaNeural', label: 'Sonia', accent: 'United Kingdom' },
    { id: 'en-GB-RyanNeural', label: 'Ryan', accent: 'United Kingdom' },
    { id: 'en-US-AvaMultilingualNeural', label: 'Ava', accent: 'United States' },
    { id: 'en-US-AndrewMultilingualNeural', label: 'Andrew', accent: 'United States' },
    { id: 'en-US-EmmaMultilingualNeural', label: 'Emma', accent: 'United States' },
    { id: 'en-US-BrianMultilingualNeural', label: 'Brian', accent: 'United States' },
    { id: 'en-IE-EmilyNeural', label: 'Emily', accent: 'Ireland' },
    { id: 'en-IE-ConnorNeural', label: 'Connor', accent: 'Ireland' },
    { id: 'en-AU-NatashaNeural', label: 'Natasha', accent: 'Australia' },
    { id: 'en-AU-WilliamNeural', label: 'William', accent: 'Australia' },
    { id: 'en-CA-ClaraNeural', label: 'Clara', accent: 'Canada' },
    { id: 'en-CA-LiamNeural', label: 'Liam', accent: 'Canada' },
    { id: 'en-NZ-MollyNeural', label: 'Molly', accent: 'New Zealand' },
    { id: 'en-NZ-MitchellNeural', label: 'Mitchell', accent: 'New Zealand' },
    { id: 'en-ZA-LeahNeural', label: 'Leah', accent: 'South Africa' },
    { id: 'en-ZA-LukeNeural', label: 'Luke', accent: 'South Africa' },
    { id: 'en-IN-NeerjaNeural', label: 'Neerja', accent: 'India' },
    { id: 'en-IN-PrabhatNeural', label: 'Prabhat', accent: 'India' }
];

export const isEnglishVoice = (value: unknown): value is string => ENGLISH_VOICES.some(voice => voice.id === value);

// Speaking speed: the setting's number, and how the bridge says it.
export const RATES: Readonly<Record<string, string>> = { '0.8': '-20%', '1': '+0%', '1.15': '+15%' };
export const bridgeRate = (rate: unknown): string => RATES[String(rate)] ?? '+0%';
