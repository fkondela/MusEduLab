document.addEventListener("DOMContentLoaded", () => {

    const i18nApi = window.i18n || {
        t: (key) => key,
        onChange: () => () => {}
    };

    const t = (key) => {
        try {
            return i18nApi.t(key);
        } catch (err) {
            console.warn('Translation lookup failed for key:', key, err);
            return key;
        }
    };

    const currentPath = window.location.pathname || '';
    const docLang = (document.documentElement && document.documentElement.lang) ? document.documentElement.lang.toLowerCase() : '';

    const isEnglishLocale = docLang.startsWith('en');
    const toneSampleBaseUrl = 'https://nbrosowsky.github.io/tonejs-instruments/samples/';

    const startGameBtn = document.getElementById("start-game-btn");
    const startButtonLabelEl = startGameBtn ? startGameBtn.querySelector('.button-text') : null;
    const gameMenu = document.getElementById("game-menu");
    const bottomNav = document.getElementById("bottom-nav");
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const repeatBtn = document.getElementById("powtorz-btn");
    const checkBtn = document.getElementById("sprawdz-btn");
    const checkBtnIcon = checkBtn ? checkBtn.querySelector('i') : null;
    const checkBtnLabel = checkBtn ? checkBtn.querySelector('.button-label') : null;
    const toolbar = document.querySelector(".dyktando-toolbar");
    const durationBtns = toolbar ? toolbar.querySelectorAll(".tool-btn[data-duration]") : [];
    const accidentalBtns = toolbar ? toolbar.querySelectorAll(".tool-btn[data-accidental]") : [];
    const accidentalGroup = toolbar ? toolbar.querySelector('.tool-group[data-role="accidentals"]') : null;
    const eraserBtn = document.getElementById("eraser-btn");
    const restToggleBtn = document.getElementById("rest-toggle-btn");
    const dotToggleBtn = document.getElementById("dot-toggle-btn");
    const staffWrapper = document.querySelector(".staff-wrapper");
    const staffCanvas = document.getElementById("staff-canvas");
    const staffStage = document.getElementById("staff-stage");
    const hitboxContainer = document.getElementById("staff-hitbox-container");
    const feedbackModal = document.getElementById("feedback-modal");
    const popupTitle = document.getElementById("popup-title");
    const popupBody = document.getElementById("popup-body");
    const popupNextBtn = document.getElementById("popup-next-btn");
    const stepSelection = document.getElementById("step-selection");
    const stepsContainer = document.getElementById("steps-container");
    const stepSettings = document.getElementById("step-settings");
    const stepGame = document.getElementById("step-game");
    const meterSelect = document.getElementById("meter-select");
    const instrumentSelect = document.getElementById("instrument-select");
    const dictationLengthSelect = document.getElementById("dictation-length-select");
    const tempoInput = document.getElementById("tempo-input");
    const keyModeSelect = document.getElementById("key-mode-select");
    const dictationTypeSelect = document.getElementById("dictation-type-select");
    const dictationTypeButtons = stepSelection ? Array.from(stepSelection.querySelectorAll(".dictation-mode-btn[data-type]")) : [];
    const gotoSelectionBtn = document.getElementById("goto-selection-btn");

    if (dictationTypeButtons && dictationTypeButtons.length) {
        dictationTypeButtons.forEach(btn => btn.setAttribute('aria-pressed', 'false'));
    }

    const setButtonLabel = (labelElement, key) => {
        if (!labelElement) return;
        labelElement.setAttribute('data-i18n', key);
        labelElement.textContent = t(key);
    };

    const setStartButtonLabel = (key) => {
        if (!startButtonLabelEl) return;
        setButtonLabel(startButtonLabelEl, key);
    };

    const setCheckButtonLabel = (key) => {
        if (!checkBtnLabel) return;
        setButtonLabel(checkBtnLabel, key);
    };

    // Konfiguracja rendererów VexFlow i parametrów skalowania
    const VF = Vex.Flow;
    let renderer, context, stave;
    let systemsLayout = [];
    let scaleX = 1, scaleY = 1;
    let snapEl = null;
    let hitboxSvgHeight = 0;

    // Konfiguracja audio (Tone.js) i metronomu
    let sampler = null;
    let samplerInstrument = null;
    let samplerLoaded = false;
    let pendingInstrumentLoad = null;
    let fallbackSynth = null;
    let isToneStarted = false;
    let metronomeSynth = null;

    const DEFAULT_TEMPO = 100;
    const TEMPO_MIN = 40;
    const TEMPO_MAX = 200;

    // Zmienne sterujące logiką gry i weryfikacją nut
    let isGameReady = false;
    let currentDurationBase = "q";
    let currentAccidental = "n";
    let userMelody = [];
    let dictationMelody = [];
    let userSlots = [];
    let dictationSlots = [];
    let overlayCorrectMap = new Map();
    let gapStateMap = new Map();

    let isChecked = false;
    let isEraserMode = false;
    let isRestMode = false;
    let isDottedMode = false;
    let isAccidentalClearMode = false;
    let resizeDebounceId = null;
    let isPlaybackActive = false;
    let playbackEndEventId = null;
    let isPreparingExercise = false;
    let meterSelection = "4/4";
    let instrumentSelection = "piano";
    let dictationLengthSelection = "4";
    let currentDictationMeasures = 4;
    let activeInstrument = "piano";
    let tempoSelection = DEFAULT_TEMPO;
    let keyModeSelection = "major";
    let currentKeyContext = null;
    let dictationTypeSelection = "melodic";

    let uiState = "selection";

    // Stałe pomocnicze wykorzystywane przy generowaniu i renderowaniu dyktand
    const NOTE_POSITIONS = [
        "f/5", "e/5", "d/5", "c/5", "b/4", "a/4", "g/4", "f/4", "e/4", "d/4", "c/4"
    ];
    const DURATION_MAP_TONE = {
        "w": "1n",
        "wd": "1n.",
        "h": "2n",
        "hd": "2n.",
        "q": "4n",
        "qd": "4n.",
        "8": "8n"
    };
    const ACCIDENTAL_MAP_VEX = { "s": "#", "f": "b", "n": "n" };

    const DURATION_VALUE = { "w": 4, "wd": 6, "h": 2, "hd": 3, "q": 1, "qd": 1.5, "8": 0.5 };

    const SLOT_RES = 0.5;
    const DURATION_SLOTS = { w: 8, wd: 12, h: 4, hd: 6, q: 2, qd: 3, 8: 1 };

    const DOTTED_VARIANTS = { w: "wd", h: "hd", q: "qd" };

    const DICTATION_MODES = { MELODIC: "melodic", RHYTHMIC: "rhythmic" };

    const RHYTHM_DEFAULT_NOTE = "b/4";
    const RHYTHM_ROW_INDEX = Math.max(0, NOTE_POSITIONS.indexOf(RHYTHM_DEFAULT_NOTE));
    const RHYTHM_BASE_DURATION_SYMBOLS = ["h", "hd", "q", "qd", "8"];
    const RHYTHM_REST_PROBABILITY = 0.24;

    const TIME_SIGNATURE_OPTIONS = [
        { value: "2/4", beats: 2, beatValue: 4 },
        { value: "3/4", beats: 3, beatValue: 4 },
        { value: "4/4", beats: 4, beatValue: 4 }
    ];
    const DEFAULT_TIME_SIGNATURE = TIME_SIGNATURE_OPTIONS.find(ts => ts.value === "4/4") || TIME_SIGNATURE_OPTIONS[0];

    const AVAILABLE_INSTRUMENTS = [
        "bass-electric", "bassoon", "cello", "clarinet", "contrabass", "flute", "french-horn",
        "guitar-acoustic", "guitar-electric", "guitar-nylon", "harmonium", "harp", "organ",
        "piano", "saxophone", "trombone", "trumpet", "tuba", "violin", "xylophone"
    ];

    const DICTATION_LENGTH_OPTIONS = [2, 4, 8, 16];
    const SUPPORTED_SLOT_LENGTHS = [8, 6, 4, 3, 2, 1];

    const GENERATION_DURATION_WEIGHTS = [
        { value: "w", weight: 0.05 },
        { value: "wd", weight: 0.03 },
        { value: "h", weight: 0.16 },
        { value: "hd", weight: 0.12 },
        { value: "q", weight: 0.36 },
        { value: "qd", weight: 0.16 },
        { value: "8", weight: 0.12 }
    ];
    const GENERATION_ACCIDENTAL_WEIGHTS = [
        { value: "n", weight: 0.6 },
        { value: "s", weight: 0.2 },
        { value: "f", weight: 0.2 }
    ];
    const GENERATION_REST_PROBABILITY = 0.22;
    const GENERATION_ACCIDENTAL_PROBABILITY = 0.35;

    const KEY_MODE_OPTIONS = ["major", "minor", "atonal"];
    const KEY_MODE_LABELS = {
        atonal: { pl: "atonalna", en: "atonal" },
        major: { pl: "dur", en: "major" },
        minor: { pl: "mol", en: "minor" }
    };

    const getKeyModeLabel = (mode) => {
        const entry = KEY_MODE_LABELS[mode];
        if (!entry) {
            return mode;
        }
        if (typeof entry === 'string') {
            return entry;
        }
        const { pl, en } = entry;
        return isEnglishLocale ? (en || pl || mode) : (pl || en || mode);
    };
    const MAJOR_KEY_LIBRARY = [
        { tonicLetter: "c", tonicAccidental: "n", keySignature: "C" },
        { tonicLetter: "g", tonicAccidental: "n", keySignature: "G" },
        { tonicLetter: "d", tonicAccidental: "n", keySignature: "D" },
        { tonicLetter: "a", tonicAccidental: "n", keySignature: "A" },
        { tonicLetter: "e", tonicAccidental: "n", keySignature: "E" },
        { tonicLetter: "b", tonicAccidental: "n", keySignature: "B" },
        { tonicLetter: "f", tonicAccidental: "s", keySignature: "F#" },
        { tonicLetter: "c", tonicAccidental: "s", keySignature: "C#" },
        { tonicLetter: "f", tonicAccidental: "n", keySignature: "F" },
        { tonicLetter: "b", tonicAccidental: "f", keySignature: "Bb" },
        { tonicLetter: "e", tonicAccidental: "f", keySignature: "Eb" },
        { tonicLetter: "a", tonicAccidental: "f", keySignature: "Ab" },
        { tonicLetter: "d", tonicAccidental: "f", keySignature: "Db" },
        { tonicLetter: "g", tonicAccidental: "f", keySignature: "Gb" },
        { tonicLetter: "c", tonicAccidental: "f", keySignature: "Cb" }
    ];
    const MINOR_KEY_LIBRARY = [
        { tonicLetter: "a", tonicAccidental: "n", keySignature: "Am" },
        { tonicLetter: "e", tonicAccidental: "n", keySignature: "Em" },
        { tonicLetter: "b", tonicAccidental: "n", keySignature: "Bm" },
        { tonicLetter: "f", tonicAccidental: "s", keySignature: "F#m" },
        { tonicLetter: "c", tonicAccidental: "s", keySignature: "C#m" },
        { tonicLetter: "g", tonicAccidental: "s", keySignature: "G#m" },
        { tonicLetter: "d", tonicAccidental: "s", keySignature: "D#m" },
        { tonicLetter: "a", tonicAccidental: "s", keySignature: "A#m" },
        { tonicLetter: "d", tonicAccidental: "n", keySignature: "Dm" },
        { tonicLetter: "g", tonicAccidental: "n", keySignature: "Gm" },
        { tonicLetter: "c", tonicAccidental: "n", keySignature: "Cm" },
        { tonicLetter: "f", tonicAccidental: "n", keySignature: "Fm" },
        { tonicLetter: "b", tonicAccidental: "f", keySignature: "Bbm" },
        { tonicLetter: "e", tonicAccidental: "f", keySignature: "Ebm" },
        { tonicLetter: "a", tonicAccidental: "f", keySignature: "Abm" }
    ];
    const KEY_LIBRARY = {
        "major": MAJOR_KEY_LIBRARY,
        "minor": MINOR_KEY_LIBRARY
    };
    const SCALE_PATTERNS = {
        "major": [0, 2, 4, 5, 7, 9, 11],
        "minor": [0, 2, 3, 5, 7, 8, 10]
    };
    const LETTER_SEQUENCE = ["c", "d", "e", "f", "g", "a", "b"];
    const LETTER_BASE_SEMITONES = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
    const ACCIDENTAL_OFFSETS = { n: 0, s: 1, f: -1 };
    const LOWEST_ALLOWED_MIDI = noteToMidi("c", "n", 4);
    const HIGHEST_ALLOWED_MIDI = noteToMidi("g", "n", 5);

    // Funkcje pomocnicze odpowiadają za interpretację wyborów użytkownika
    function computeTimeSignatureMeta(ts) {
        const beats = Number(ts?.beats) || 4;
        const beatValue = Number(ts?.beatValue) || 4;
        const capacity = beats * (4 / beatValue);
        const slotsPerMeasure = Math.max(1, Math.round(capacity / SLOT_RES));
        const beatSlots = Math.max(1, Math.round((4 / beatValue) / SLOT_RES));
        const label = ts?.value || `${beats}/${beatValue}`;
        return { beats, beatValue, capacity, slotsPerMeasure, beatSlots, label, value: label };
    }

    function pickRandom(array) {
        if (!array || !array.length) return null;
        const idx = Math.floor(Math.random() * array.length);
        return array[idx];
    }

    function pickWeightedOption(options) {
        if (!options || !options.length) return null;
        const totalWeight = options.reduce((sum, option) => sum + (option.weight ?? 1), 0);
        let threshold = Math.random() * totalWeight;
        for (const option of options) {
            threshold -= option.weight ?? 1;
            if (threshold <= 0) return option;
        }
        return options[options.length - 1];
    }

    function resolveTimeSignatureSelection(selection) {
        const chosen = (selection === "losowo")
            ? pickRandom(TIME_SIGNATURE_OPTIONS)
            : TIME_SIGNATURE_OPTIONS.find(ts => ts.value === selection);
        return computeTimeSignatureMeta(chosen || DEFAULT_TIME_SIGNATURE);
    }

    function resolveInstrumentSelection(selection) {
        if (AVAILABLE_INSTRUMENTS.includes(selection)) return selection;
        return "piano";
    }

    function resolveDictationLength(selection) {
        const parsed = Number(selection);
        if (Number.isFinite(parsed) && parsed >= 1) return parsed;
        return 2;
    }

    function resolveTempoValue(value) {
        if (value === '' || value === null || value === undefined) return DEFAULT_TEMPO;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return DEFAULT_TEMPO;
        const rounded = Math.round(parsed);
        return Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, rounded));
    }

    function resolveKeyMode(selection) {
        if (!selection) return "atonal";
        const normalized = String(selection).toLowerCase();
        if (KEY_MODE_OPTIONS.includes(normalized)) return normalized;
        return "atonal";
    }

    function resolveDictationType(selection) {
        const normalized = String(selection || "").toLowerCase();
        return (normalized === DICTATION_MODES.RHYTHMIC) ? DICTATION_MODES.RHYTHMIC : DICTATION_MODES.MELODIC;
    }

    function isRhythmicMode() {
        return dictationTypeSelection === DICTATION_MODES.RHYTHMIC;
    }

    function isMelodicMode() {
        return !isRhythmicMode();
    }

    function getAllowedRhythmDurationSymbols() {
        const capacity = currentTimeSignature?.capacity || 4;
        const allowed = new Set();
        RHYTHM_BASE_DURATION_SYMBOLS.forEach(symbol => {
            const value = DURATION_VALUE[symbol];
            if (!value || value <= capacity + 1e-6) {
                allowed.add(symbol);
            }
        });
        if (capacity >= 4 - 1e-6) {
            allowed.add("w");
        }
        return allowed;
    }

    function getAllowedRhythmDurationBases() {
        const bases = new Set();
        const symbols = getAllowedRhythmDurationSymbols();
        symbols.forEach(symbol => {
            if (!symbol) return;
            if (symbol.endsWith("d")) {
                bases.add(symbol.slice(0, -1));
            } else {
                bases.add(symbol);
            }
        });
        return bases;
    }

    function isDottedVariantAllowed(baseSymbol) {
        if (!baseSymbol || !DOTTED_VARIANTS[baseSymbol]) return false;
        if (isMelodicMode()) return true;
        const allowed = getAllowedRhythmDurationSymbols();
        return allowed.has(DOTTED_VARIANTS[baseSymbol]);
    }

    function areRestsEnabledForCurrentMode() {
        return true;
    }

    function enforceDurationAvailability() {
        if (isMelodicMode()) return;
        const allowedBases = getAllowedRhythmDurationBases();
        if (!allowedBases.has(currentDurationBase)) {
            const iterator = allowedBases.values();
            const fallback = iterator.next().value || 'q';
            currentDurationBase = fallback;
        }
        if (isDottedMode && !isDottedVariantAllowed(currentDurationBase)) {
            setDottedMode(false);
        }
    }

    function noteToMidi(letter, accidental, octave) {
        const base = LETTER_BASE_SEMITONES[letter] ?? 0;
        const accidentalOffset = ACCIDENTAL_OFFSETS[accidental] ?? 0;
        return (octave + 1) * 12 + base + accidentalOffset;
    }

    function getPitchClass(letter, accidental) {
        return ((LETTER_BASE_SEMITONES[letter] ?? 0) + (ACCIDENTAL_OFFSETS[accidental] ?? 0) + 12) % 12;
    }

    function determineAccidentalForLetter(letter, targetPitchClass) {
        const basePitchClass = LETTER_BASE_SEMITONES[letter] ?? 0;
        const diff = (targetPitchClass - basePitchClass + 12) % 12;
        if (diff === 0) return "n";
        if (diff === 1) return "s";
        if (diff === 11) return "f";
        return diff <= 6 ? "s" : "f";
    }

    function buildScaleDefinition(tonicLetter, tonicAccidental, pattern) {
        if (!tonicLetter || !Array.isArray(pattern) || !pattern.length) return [];
        const basePitchClass = getPitchClass(tonicLetter, tonicAccidental);
        const startIndex = LETTER_SEQUENCE.indexOf(tonicLetter);
        if (startIndex === -1) return [];

        const definition = [];
        for (let i = 0; i < pattern.length; i++) {
            const letter = LETTER_SEQUENCE[(startIndex + i) % LETTER_SEQUENCE.length];
            const targetPitchClass = (basePitchClass + pattern[i]) % 12;
            const accidental = determineAccidentalForLetter(letter, targetPitchClass);
            definition.push({ letter, accidental, pitchClass: targetPitchClass });
        }
        return definition;
    }

    function buildScalePool(scaleDefinition) {
        if (!Array.isArray(scaleDefinition) || !scaleDefinition.length) return [];
        const pool = [];
        for (let octave = 2; octave <= 6; octave++) {
            for (const degree of scaleDefinition) {
                const midi = noteToMidi(degree.letter, degree.accidental, octave);
                if (midi < LOWEST_ALLOWED_MIDI || midi > HIGHEST_ALLOWED_MIDI) continue;
                pool.push({
                    key: `${degree.letter}/${octave}`,
                    accidental: degree.accidental,
                    midi
                });
            }
        }
        return pool.sort((a, b) => a.midi - b.midi);
    }

    function createKeyContext(mode) {
        if (mode === "atonal") return null;
        const pattern = SCALE_PATTERNS[mode];
        if (!pattern) return null;
        const library = KEY_LIBRARY[mode];
        if (!library || !library.length) return null;
        const choice = pickRandom(library) || library[0];
        const tonicLetter = choice.tonicLetter || "c";
        const tonicAccidental = choice.tonicAccidental || "n";
        const definition = buildScaleDefinition(tonicLetter, tonicAccidental, pattern);
        const pool = buildScalePool(definition);
        if (!pool.length) return null;
        const signatureMap = new Map();
        definition.forEach(degree => {
            if (!degree || !degree.letter) return;
            signatureMap.set(degree.letter.toLowerCase(), degree.accidental || 'n');
        });
        return {
            mode,
            tonic: { letter: tonicLetter, accidental: tonicAccidental },
            pattern,
            definition,
            pool,
            keySignature: choice.keySignature || null,
            signatureMap
        };
    }

    function accidentalToSymbol(accidental) {
        if (accidental === "s") return "#";
        if (accidental === "f") return "b";
        return "";
    }

    function formatKeyLabel(context) {
        if (!context || !context.tonic) return "";
        const { letter, accidental } = context.tonic;
        if (!letter) return "";
        let displayLetter = letter.toUpperCase();
        if (letter === "b" && accidental !== "f") {
            displayLetter = "H";
        }
        return `${displayLetter}${accidentalToSymbol(accidental)}`;
    }

    function parseKeyString(keyString) {
        if (!keyString) return { letter: null, octave: null };
        const [rawLetter, rawOctave] = keyString.split("/");
        const letter = (rawLetter || "").toLowerCase();
        const octave = Number(rawOctave);
        return { letter: letter || null, octave: Number.isFinite(octave) ? octave : null };
    }

    function getKeySignatureAccidental(letter) {
        if (!letter) return null;
        if (!currentKeyContext || !(currentKeyContext.signatureMap instanceof Map)) return null;
        const normalized = letter.toLowerCase();
        if (currentKeyContext.signatureMap.has(normalized)) {
            return currentKeyContext.signatureMap.get(normalized);
        }
        return null;
    }

    function shouldDisplayAccidental(letter, accidental) {
        if (isRhythmicMode()) return false;
        const normalizedLetter = letter?.toLowerCase?.();
        const noteAcc = accidental || 'n';
        if (!normalizedLetter) {
            return noteAcc !== 'n';
        }
        if (!currentKeyContext || !(currentKeyContext.signatureMap instanceof Map)) {
            return noteAcc !== 'n';
        }
        const defaultAcc = getKeySignatureAccidental(normalizedLetter) ?? 'n';
        return noteAcc !== defaultAcc;
    }

    function refreshDurationButtons() {
        const isRhythm = isRhythmicMode();
        const allowedBases = isRhythm ? getAllowedRhythmDurationBases() : null;

        durationBtns.forEach(btn => {
            const base = btn.dataset.duration;
            const shouldBeActive = !isAccidentalClearMode && base === currentDurationBase;
            btn.classList.toggle('active', shouldBeActive);
            if (isRhythm) {
                const isAllowed = allowedBases.has(base);
                btn.disabled = !isAllowed;
                btn.style.display = isAllowed ? '' : 'none';
                if (!isAllowed) btn.classList.remove('active');
            } else {
                btn.disabled = false;
                btn.style.display = '';
            }
        });

        if (dotToggleBtn) {
            let canApply = !!DOTTED_VARIANTS[currentDurationBase];
            if (canApply && isRhythm) {
                canApply = isDottedVariantAllowed(currentDurationBase);
            }
            dotToggleBtn.disabled = !canApply;
            if (!canApply && isDottedMode) {
                setDottedMode(false);
            }
            dotToggleBtn.classList.toggle('active', isDottedMode);
        }

        if (restToggleBtn) {
            const canUseRest = !isRhythm || areRestsEnabledForCurrentMode();
            restToggleBtn.disabled = !canUseRest;
            if (!canUseRest) {
                restToggleBtn.classList.remove('active');
                isRestMode = false;
            }
        }
    }

    function setDurationBase(symbol) {
        if (!symbol || !DURATION_SLOTS[symbol]) return;
        if (isRhythmicMode()) {
            const allowedBases = getAllowedRhythmDurationBases();
            if (!allowedBases.has(symbol)) return;
        }
        currentDurationBase = symbol;
        if (isDottedMode && (!DOTTED_VARIANTS[currentDurationBase] || !isDottedVariantAllowed(currentDurationBase))) {
            setDottedMode(false);
        }
        refreshDurationButtons();
    }

    function setDottedMode(enabled) {
        const canApply = !!DOTTED_VARIANTS[currentDurationBase] && (!isRhythmicMode() || isDottedVariantAllowed(currentDurationBase));
        isDottedMode = !!enabled && canApply;
        if (dotToggleBtn) dotToggleBtn.classList.toggle('active', isDottedMode);
    }

    function getActiveDurationSymbol() {
        if (isDottedMode && DOTTED_VARIANTS[currentDurationBase]) {
            return DOTTED_VARIANTS[currentDurationBase];
        }
        return currentDurationBase;
    }

    let currentTimeSignature = computeTimeSignatureMeta(DEFAULT_TIME_SIGNATURE);
    currentDictationMeasures = resolveDictationLength(dictationLengthSelection);
    activeInstrument = resolveInstrumentSelection(instrumentSelection);

    const DEFAULT_MEASURES_PER_SYSTEM = 2;
    const SYSTEM_GAP = 40;
    const STAVE_X = 10;
    const MAX_STAVE_WIDTH = 700;
    const MIN_MEASURE_WIDTH = 280;
    const STAVE_HEIGHT = 120;

    function setAppTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('theme', theme);
        } catch (err) {
            console.warn('Nie można zapisać motywu w localStorage:', err);
        }
        if (context) {
            drawStaff();
        }
    }

    function initTheme() {
        let savedTheme = null;
        try {
            savedTheme = localStorage.getItem('theme');
        } catch (err) {
            console.warn('Nie można odczytać motywu z localStorage:', err);
        }

        if (savedTheme) {
            setAppTheme(savedTheme);
            return;
        }

        const currentHour = new Date().getHours();
        const defaultTheme = (currentHour >= 20 || currentHour < 6) ? 'dark' : 'light';
        setAppTheme(defaultTheme);
    }

    function toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setAppTheme(newTheme);
    }

    function getLayoutConfig() {
        const wrapperRect = (staffWrapper && typeof staffWrapper.getBoundingClientRect === 'function')
            ? staffWrapper.getBoundingClientRect()
            : null;

        let availableWidth = wrapperRect && wrapperRect.width ? (wrapperRect.width - 20) : (window.innerWidth - 40);
        if (!Number.isFinite(availableWidth) || availableWidth <= 0) availableWidth = MAX_STAVE_WIDTH;
        availableWidth = Math.max(availableWidth, MIN_MEASURE_WIDTH);

        let measuresPerSystem = DEFAULT_MEASURES_PER_SYSTEM;
        let staveWidth = Math.min(MAX_STAVE_WIDTH, availableWidth);

        if (staveWidth / measuresPerSystem < MIN_MEASURE_WIDTH) {
            measuresPerSystem = 1;
            staveWidth = Math.min(MAX_STAVE_WIDTH, availableWidth);
        }

        return { measuresPerSystem, staveWidth };
    }

    function handleWindowResize() {
        syncOverlayToSVG();
        if (resizeDebounceId) clearTimeout(resizeDebounceId);
        resizeDebounceId = setTimeout(() => {
            drawStaff();
            resizeDebounceId = null;
        }, 120);
    }

    function updateSettingsVisibility() {
        if (!stepSettings) return;
        const isRhythm = isRhythmicMode();
        const modeBlocks = stepSettings.querySelectorAll('[data-mode]');
        modeBlocks.forEach(block => {
            if (!block || !block.dataset) return;
            const mode = block.dataset.mode;
            if (!mode) return;
            const shouldShow = mode === 'rhythmic' ? isRhythm : mode === 'melodic' ? !isRhythm : true;
            block.style.display = shouldShow ? '' : 'none';
        });
    }

    function configureToolbarForMode() {
        const isRhythm = isRhythmicMode();

        if (accidentalGroup) {
            accidentalGroup.style.display = isRhythm ? 'none' : 'flex';
        }

        accidentalBtns.forEach(btn => {
            if (!btn) return;
            btn.disabled = isRhythm;
            if (isRhythm) btn.classList.remove('active');
        });

        if (isRhythm) {
            currentAccidental = 'n';
            isAccidentalClearMode = false;
        }

        enforceDurationAvailability();
        refreshDurationButtons();
    }

    function updateUIState() {
        if (stepSelection) stepSelection.style.display = uiState === 'selection' ? 'block' : 'none';
        if (stepSettings) stepSettings.style.display = uiState === 'settings' ? 'block' : 'none';
        if (stepGame) stepGame.style.display = uiState === 'playing' ? 'block' : 'none';

        if (gameMenu) gameMenu.style.display = uiState === 'playing' ? 'flex' : 'none';

        if (!bottomNav) return;

        if (uiState === 'selection') {
            bottomNav.style.display = 'flex';
            if (gotoSelectionBtn) {
                gotoSelectionBtn.style.display = 'inline-flex';
                gotoSelectionBtn.disabled = isPreparingExercise;
            }
            if (startGameBtn) {
                startGameBtn.style.display = 'none';
            }
        } else if (uiState === 'settings') {
            bottomNav.style.display = 'flex';
            if (gotoSelectionBtn) gotoSelectionBtn.style.display = 'none';
            if (startGameBtn) {
                startGameBtn.style.display = 'inline-flex';
                startGameBtn.disabled = isPreparingExercise;
            }
        } else {
            bottomNav.style.display = 'none';
            if (gotoSelectionBtn) gotoSelectionBtn.style.display = 'none';
            if (startGameBtn) startGameBtn.style.display = 'none';
        }
    }

    function setDictationType(mode) {
        const resolved = resolveDictationType(mode);
        dictationTypeSelection = resolved;
        if (dictationTypeSelect) dictationTypeSelect.value = resolved;

        if (dictationTypeButtons && dictationTypeButtons.length) {
            dictationTypeButtons.forEach(btn => {
                if (!btn) return;
                const matches = btn.dataset?.type === resolved;
                btn.classList.toggle('selected', matches);
                btn.setAttribute('aria-pressed', matches ? 'true' : 'false');
            });
        }

        const isRhythm = isRhythmicMode();

        if (instrumentSelect) instrumentSelect.disabled = false;
        if (keyModeSelect) keyModeSelect.disabled = isRhythm;

        if (isRhythm) {
            currentKeyContext = null;
        }

        stopPlayback();

        updateSettingsVisibility();
        configureToolbarForMode();
        if (context && !isPreparingExercise) {
            drawStaff();
        }
    }

    function setPlaybackState(active) {
        isPlaybackActive = active;
        if (repeatBtn) repeatBtn.disabled = active;
        if (checkBtn) checkBtn.disabled = active;
    }

    function stopPlayback({ fromEvent = false } = {}) {
        if (!fromEvent && playbackEndEventId != null) {
            Tone.Transport.clear(playbackEndEventId);
        }
        playbackEndEventId = null;
        try {
            Tone.Transport.stop();
            Tone.Transport.position = 0;
        } catch (err) {
            console.warn('Błąd zatrzymywania transportu Tone.js:', err);
        }
        setPlaybackState(false);
    }

    function loadInstrument(instrumentName) {
        const name = instrumentName || 'piano';
        if (sampler && samplerInstrument === name && samplerLoaded) {
            return Promise.resolve();
        }

        if (pendingInstrumentLoad && pendingInstrumentLoad.name === name) {
            return pendingInstrumentLoad.promise;
        }

        if (sampler && typeof sampler.dispose === 'function') {
            try { sampler.dispose(); } catch (err) { console.warn('Błąd podczas zwalniania poprzedniego instrumentu:', err); }
        }

        samplerLoaded = false;
        samplerInstrument = name;

        const promise = new Promise((resolve, reject) => {
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                samplerLoaded = true;
                resolve();
            };

            try {
                sampler = SampleLibrary.load({
                    instruments: name,
                    baseUrl: toneSampleBaseUrl,
                    ext: '.mp3',
                    onload: () => {
                        try { sampler?.toDestination?.(); } catch (err) { console.warn('Nie udało się podłączyć instrumentu do wyjścia:', err); }
                        finish();
                    }
                });

                try { sampler?.toDestination?.(); } catch (err) { console.warn('Nie udało się podłączyć instrumentu do wyjścia (szybkie podłączenie):', err); }

                if (sampler && sampler.loaded) {
                    finish();
                }
            } catch (err) {
                console.error('Nie udało się załadować instrumentu Tone.js:', err);
                sampler = null;
                samplerInstrument = null;
                samplerLoaded = false;
                finished = true;
                reject(err);
            }
        });

        pendingInstrumentLoad = { name, promise };

        return promise.finally(() => {
            if (pendingInstrumentLoad && pendingInstrumentLoad.name === name) {
                pendingInstrumentLoad = null;
            }
        });
    }

    async function playRhythmicSequence(sequence) {
        if (!isGameReady || !sequence || !sequence.length) return;

        try {
            await loadInstrument(activeInstrument);
        } catch (err) {
            console.error('Nie udało się załadować instrumentu dla trybu rytmicznego. Używam syntezatora zapasowego.', err);
            if (!fallbackSynth) {
                try {
                    fallbackSynth = new Tone.Synth().toDestination();
                } catch (synthErr) {
                    console.error('Nie udało się utworzyć syntezatora zapasowego.', synthErr);
                }
            }
        }

        const instrumentNode = (samplerLoaded && sampler && samplerInstrument === activeInstrument) ? sampler : fallbackSynth;
        if (!instrumentNode || typeof instrumentNode.triggerAttackRelease !== 'function') {
            console.warn('Brak instrumentu do odtworzenia rytmu.');
            return;
        }

        stopPlayback();

        Tone.Transport.cancel();
        try {
            Tone.Transport.position = 0;
        } catch (err) {
            console.warn('Błąd resetowania pozycji transportu Tone.js:', err);
        }

        applyTempoToTransport();

        const beatsPerMeasure = Math.max(1, currentTimeSignature.beats || 4);
        const beatValue = currentTimeSignature.beatValue || 4;
        const beatSeconds = Tone.Time(`${beatValue}n`).toSeconds();
        let currentTime = 0;

        const totalMetBeats = beatsPerMeasure * 2;
        const metSynth = getMetronomeSynth();
        if (metSynth && typeof metSynth.triggerAttackRelease === 'function') {
            for (let i = 0; i < totalMetBeats; i++) {
                const isBarStart = (i % beatsPerMeasure) === 0;
                const pitch = isBarStart ? 'C5' : 'G4';
                try {
                    metSynth.triggerAttackRelease(pitch, '32n', `+${currentTime}`);
                } catch (err) {
                    console.warn('Nie udało się odtworzyć uderzenia metronomu:', err);
                }
                currentTime += beatSeconds;
            }
        } else {
            currentTime += beatSeconds * totalMetBeats;
        }

        const slotsReference = (Array.isArray(dictationSlots) && dictationSlots.length)
            ? dictationSlots
            : sequenceToSlots(sequence);

        const tonePitch = getTonePitch({ key: RHYTHM_DEFAULT_NOTE, accidental: 'n' });
        let slotIndex = 0;
        let firstAccentTriggered = false;
        while (slotIndex < slotsReference.length) {
            const slotData = slotsReference[slotIndex];
            if (slotData && !slotData.sustain) {
                const durationSymbol = slotData.duration;
                const toneDuration = DURATION_MAP_TONE[durationSymbol];
                const durationSeconds = toneDuration ? Tone.Time(toneDuration).toSeconds() : Tone.Time('8n').toSeconds();
                if (!slotData.rest && tonePitch) {
                    const velocity = firstAccentTriggered ? 0.65 : 0.95;
                    try {
                        instrumentNode.triggerAttackRelease(
                            tonePitch,
                            toneDuration,
                            `+${currentTime}`,
                            velocity
                        );
                    } catch (err) {
                        console.error('Błąd podczas odtwarzania wartości rytmicznej.', err);
                    }
                    if (!firstAccentTriggered) firstAccentTriggered = true;
                }
                currentTime += durationSeconds;
                const advance = Math.max(1, slotData.durationSlots || 1);
                slotIndex += advance;
            } else {
                const slotSeconds = Tone.Time('8n').toSeconds();
                currentTime += slotSeconds;
                slotIndex += 1;
            }
        }

        const playbackDuration = currentTime;
        if (playbackDuration <= 0) {
            setPlaybackState(false);
            return;
        }

        setPlaybackState(true);
        try {
            playbackEndEventId = Tone.Transport.scheduleOnce(() => {
                stopPlayback({ fromEvent: true });
            }, playbackDuration);
            Tone.Transport.start();
        } catch (err) {
            console.warn('Nie udało się uruchomić odtwarzania rytmu Tone.js:', err);
            stopPlayback();
        }
    }

    function getMetronomeSynth() {
        if (metronomeSynth) return metronomeSynth;
        try {
            metronomeSynth = new Tone.MembraneSynth({
                pitchDecay: 0.01,
                octaves: 2,
                envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.03 }
            }).toDestination();
            metronomeSynth.volume.value = -4;
        } catch (err) {
            console.warn('Nie udało się utworzyć metronomu Tone.js:', err);
            metronomeSynth = null;
        }
        return metronomeSynth;
    }

    function applyTempoToTransport() {
        try {
            Tone.Transport.bpm.value = tempoSelection;
        } catch (err) {
            console.warn('Nie udało się zaktualizować tempa w Tone.Transport:', err);
        }
    }

    function updateTempoSelection(rawValue) {
        const resolved = resolveTempoValue(rawValue);
        tempoSelection = resolved;
        if (tempoInput) tempoInput.value = resolved;
        applyTempoToTransport();
    }

    function applyExerciseSettings() {
        currentTimeSignature = resolveTimeSignatureSelection(meterSelection);
        currentDictationMeasures = resolveDictationLength(dictationLengthSelection);
        activeInstrument = resolveInstrumentSelection(instrumentSelection);
        try {
            Tone.Transport.timeSignature = [currentTimeSignature.beats, currentTimeSignature.beatValue];
        } catch (err) {
            console.warn('Nie udało się ustawić metrum w Tone.Transport:', err);
        }
        applyTempoToTransport();
    }

    function setCheckButtonState(state) {
        if (!checkBtn) return;
        if (state === 'next') {
            checkBtn.dataset.mode = 'next';
            if (checkBtnIcon) checkBtnIcon.className = 'fa-solid fa-arrow-right';
            setCheckButtonLabel('common.buttons.next');
        } else {
            checkBtn.dataset.mode = 'check';
            if (checkBtnIcon) checkBtnIcon.className = 'fa-solid fa-check';
            setCheckButtonLabel('common.buttons.check');
        }
    }

    function resetCheckStateAfterEdit() {
        isChecked = false;
        overlayCorrectMap = new Map();
        gapStateMap = new Map();
        setCheckButtonState('check');
    }

    function handleCheckButtonClick() {
        if (!isGameReady || isPlaybackActive) return;
        const mode = checkBtn ? (checkBtn.dataset.mode || 'check') : 'check';
        if (mode === 'next') {
            nextExercise();
            return;
        }
        checkAnswer();
        if (isChecked) {
            setCheckButtonState('next');
        }
    }



    function initVexFlow() {
        renderer = new VF.Renderer(staffCanvas, VF.Renderer.Backends.SVG);
        const { staveWidth } = getLayoutConfig();
        renderer.resize(STAVE_X + staveWidth + 10, 180);
        context = renderer.getContext();
        stave = new VF.Stave(STAVE_X, 20, staveWidth);
    stave.addClef("treble").addTimeSignature(currentTimeSignature.label);
        stave.setContext(context).draw();
    setupHitboxLayer();
    }



    function setupHitboxLayer() {
        hitboxContainer.innerHTML = "";
        hitboxContainer.style.cursor = "crosshair";
        hitboxContainer.addEventListener("click", handleCanvasClick);
        hitboxContainer.addEventListener("mousemove", handleCanvasMove);
        hitboxContainer.addEventListener("mouseleave", () => { if (snapEl) snapEl.style.display = 'none'; });
        snapEl = document.createElement('div');
        snapEl.className = 'snap-preview';
        snapEl.style.display = 'none';
        hitboxContainer.appendChild(snapEl);
        syncOverlayToSVG();
        window.addEventListener("resize", handleWindowResize);
    }

    function syncOverlayToSVG() {
        const svg = staffCanvas.querySelector("svg");
        if (!svg) return;
        const svgRect = svg.getBoundingClientRect();
        let internalW = parseFloat(svg.getAttribute('width'));
        let internalH = parseFloat(svg.getAttribute('height'));
        if (!(internalW > 0 && internalH > 0)) {
            const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
            if (vb && vb.width && vb.height) {
                internalW = vb.width;
                internalH = vb.height;
            } else {
                internalW = svgRect.width;
                internalH = svgRect.height;
            }
        }
        scaleX = svgRect.width / internalW;
        scaleY = svgRect.height / internalH;
        const stageRect = staffStage.getBoundingClientRect();
        const leftOffset = svgRect.left - stageRect.left;
        const topOffset = svgRect.top - stageRect.top;
        staffStage.style.width = svgRect.width + "px";
        staffStage.style.height = svgRect.height + "px";
        hitboxContainer.style.width = svgRect.width + "px";
        const interactiveHeight = hitboxSvgHeight > 0
            ? Math.min(svgRect.height, Math.max(0, hitboxSvgHeight * scaleY))
            : svgRect.height;
        hitboxContainer.style.height = interactiveHeight + "px";
        hitboxContainer.style.left = leftOffset + "px";
        hitboxContainer.style.top = topOffset + "px";
    }



    // Aktywuje Tone.js i ustawia tempo tylko przy pierwszym wywołaniu
    async function ensureToneReady() {
        if (isToneStarted) return;
        await Tone.start();
        applyTempoToTransport();
        isToneStarted = true;
    }

    // Obsługuje rozpoczęcie dyktanda z ekranu ustawień
    async function handleStartButtonClick() {
        if (!startGameBtn || isPreparingExercise || uiState !== 'settings') return;

        isPreparingExercise = true;
    isGameReady = false;
        startGameBtn.disabled = true;
        setStartButtonLabel('common.buttons.loading');
        updateUIState();

        try {
            await ensureToneReady();
            applyExerciseSettings();
            await loadInstrument(activeInstrument);
            isGameReady = true;
            uiState = 'playing';
            updateUIState();
            if (stepsContainer && typeof stepsContainer.scrollTo === 'function') {
                stepsContainer.scrollTo({ top: 0, behavior: 'auto' });
            }
            await nextExercise({ autoPlay: true, force: true });
            setStartButtonLabel('common.buttons.start');
        } catch (err) {
            console.error('Nie udało się przygotować dyktanda startowego:', err);
            setStartButtonLabel('common.buttons.tryAgain');
            isGameReady = false;
            isPreparingExercise = false;
            startGameBtn.disabled = false;
            uiState = 'settings';
            updateUIState();
            return;
        }

        isPreparingExercise = false;
        startGameBtn.disabled = false;
        updateUIState();
    }



    // Buduje nową rundę dyktanda i opcjonalnie uruchamia odsłuch
    async function nextExercise({ autoPlay = true, force = false } = {}) {
        if (!isGameReady || (isPreparingExercise && !force)) return;
    isPreparingExercise = true;
    updateUIState();
        setPlaybackState(false);
        stopPlayback();
        currentKeyContext = null;

        try {
            applyExerciseSettings();

            try {
                await loadInstrument(activeInstrument);
            } catch (err) {
                console.warn('Ćwiczenie zostanie odtworzone na syntezatorze zapasowym.', err);
                if (!fallbackSynth) {
                    try {
                        fallbackSynth = new Tone.Synth().toDestination();
                    } catch (synthErr) {
                        console.error('Nie udało się utworzyć syntezatora zapasowego.', synthErr);
                    }
                }
            }

            userMelody = [];
            dictationMelody = [];
            userSlots = [];
            dictationSlots = [];
            overlayCorrectMap = new Map();
            gapStateMap = new Map();
            feedbackModal.style.display = "none";
            isChecked = false;
            setCheckButtonState('check');

            generateDictation();
            dictationSlots = sequenceToSlots(dictationMelody);

            userSlots = new Array(dictationSlots.length).fill(null);
            if (dictationSlots[0] && !dictationSlots[0].sustain) {
                const first = { ...dictationSlots[0], state: 'given' };
                placeNoteInSlots(userSlots, 0, first, true);
            }

            drawStaff();

            if (autoPlay) {
                setTimeout(() => {
                    playMelody(dictationMelody);
                }, 500);
            }
        } finally {
            isPreparingExercise = false;
            updateUIState();
        }
    }

    function generateDictation() {
        if (isRhythmicMode()) {
            generateRhythmicDictation();
        } else {
            generateMelodicDictation();
        }
    }



    function generateMelodicDictation() {
        dictationMelody = [];
        const totalBeats = Math.max(1, (currentTimeSignature.capacity || 4) * currentDictationMeasures);
        const measureCapacity = Math.max(1, currentTimeSignature.capacity || 4);
        const possiblePitches = [
            "c/4", "d/4", "e/4", "f/4", "g/4", "a/4", "b/4",
            "c/5", "d/5", "e/5", "f/5", "g/5"
        ];
        const keyMode = resolveKeyMode(keyModeSelection);
        keyModeSelection = keyMode;
        const keyContext = createKeyContext(keyMode);
        currentKeyContext = keyContext;
        const tonalPool = keyContext?.pool && keyContext.pool.length ? keyContext.pool : null;

        let currentBeats = 0;

        while (currentBeats < totalBeats) {
            const remainingBeats = totalBeats - currentBeats;
            const positionInMeasure = currentBeats % measureCapacity;

            const durationCandidates = GENERATION_DURATION_WEIGHTS.filter(candidate => {
                const value = DURATION_VALUE[candidate.value];
                if (!value) return false;
                if (value > remainingBeats + 1e-6) return false;
                if (value > measureCapacity + 1e-6) return false;
                if (positionInMeasure + value > measureCapacity + 1e-6) return false;
                return true;
            });

            let durationSymbol;
            if (durationCandidates.length) {
                durationSymbol = pickWeightedOption(durationCandidates).value;
            } else {
                const fallbackOrder = ["q", "qd", "8"];
                const fallback = fallbackOrder.find(symbol => {
                    const value = DURATION_VALUE[symbol];
                    if (!value) return false;
                    if (value > remainingBeats + 1e-6) return false;
                    if (positionInMeasure + value > measureCapacity + 1e-6) return false;
                    return true;
                });
                if (!fallback) break;
                durationSymbol = fallback;
            }

            const durationValue = DURATION_VALUE[durationSymbol];

            const allowRest = dictationMelody.length > 0;
            const useRest = allowRest && Math.random() < GENERATION_REST_PROBABILITY;

            if (useRest) {
                dictationMelody.push({
                    key: "b/4",
                    duration: durationSymbol,
                    accidental: "n",
                    rest: true
                });
            } else {
                if (tonalPool) {
                    const selectedNote = pickRandom(tonalPool) || tonalPool[0];
                    dictationMelody.push({
                        key: selectedNote.key,
                        duration: durationSymbol,
                        accidental: selectedNote.accidental || "n",
                        rest: false
                    });
                } else {
                    const selectedPitch = pickRandom(possiblePitches) || "c/4";
                    const accidentalChoice = pickWeightedOption(GENERATION_ACCIDENTAL_WEIGHTS);
                    let accidentalSymbol = "n";
                    if (Math.random() < GENERATION_ACCIDENTAL_PROBABILITY && accidentalChoice) {
                        accidentalSymbol = accidentalChoice.value;
                    }
                    dictationMelody.push({
                        key: selectedPitch,
                        duration: durationSymbol,
                        accidental: accidentalSymbol,
                        rest: false
                    });
                }
            }

            currentBeats += durationValue;
        }

        if (dictationMelody.length && dictationMelody[0].rest) {
            if (tonalPool) {
                const fallbackNote = pickRandom(tonalPool) || tonalPool[0];
                dictationMelody[0] = {
                    ...dictationMelody[0],
                    key: fallbackNote.key,
                    accidental: fallbackNote.accidental || "n",
                    rest: false
                };
            } else {
                const replacementPitch = pickRandom(possiblePitches) || "c/4";
                dictationMelody[0] = {
                    ...dictationMelody[0],
                    key: replacementPitch,
                    accidental: "n",
                    rest: false
                };
            }
        }

        if (currentKeyContext) {
            const modeLabel = getKeyModeLabel(currentKeyContext.mode);
            console.log(
                `Wygenerowane dyktando (${currentDictationMeasures} takt/ów, ${currentTimeSignature.label}) | Tonacja: ${formatKeyLabel(currentKeyContext)} ${modeLabel}:`,
                dictationMelody
            );
        } else {
            console.log(`Wygenerowane dyktando (${currentDictationMeasures} takt/ów, ${currentTimeSignature.label}) | Tryb: atonalny:`, dictationMelody);
        }
    }

    function generateRhythmicDictation() {
        dictationMelody = [];
        const totalBeats = Math.max(1, (currentTimeSignature.capacity || 4) * currentDictationMeasures);
        const measureCapacity = Math.max(1, currentTimeSignature.capacity || 4);
        const allowedDurations = Array.from(getAllowedRhythmDurationSymbols());
        const fallbackDurations = ["q", "8"];
        const restProbability = areRestsEnabledForCurrentMode() ? RHYTHM_REST_PROBABILITY : 0;

        let currentBeats = 0;

        while (currentBeats < totalBeats - 1e-6) {
            const remainingBeats = totalBeats - currentBeats;
            const positionInMeasure = currentBeats % measureCapacity;

            const durationCandidates = allowedDurations.filter(symbol => {
                const value = DURATION_VALUE[symbol];
                if (!value) return false;
                if (value > remainingBeats + 1e-6) return false;
                if (value > measureCapacity + 1e-6) return false;
                if (positionInMeasure + value > measureCapacity + 1e-6) return false;
                return true;
            });

            let durationSymbol = null;
            if (durationCandidates.length) {
                durationSymbol = pickRandom(durationCandidates);
            } else {
                const fallbackChoice = fallbackDurations.find(symbol => {
                    const value = DURATION_VALUE[symbol];
                    if (!value) return false;
                    if (value > remainingBeats + 1e-6) return false;
                    if (positionInMeasure + value > measureCapacity + 1e-6) return false;
                    return true;
                });
                durationSymbol = fallbackChoice || '8';
            }

            const durationValue = DURATION_VALUE[durationSymbol] || 0.5;
            let useRest = restProbability > 0 && dictationMelody.length > 0 && Math.random() < restProbability;
            if (currentBeats === 0) useRest = false;

            dictationMelody.push({
                key: RHYTHM_DEFAULT_NOTE,
                duration: durationSymbol,
                accidental: 'n',
                rest: useRest
            });

            currentBeats += durationValue;
        }

        if (dictationMelody.length && dictationMelody[0].rest) {
            dictationMelody[0].rest = false;
        }
        if (dictationMelody.length && dictationMelody.every(n => n.rest)) {
            dictationMelody[0].rest = false;
        }

        console.log(`Wygenerowane dyktando rytmiczne (${currentDictationMeasures} takt/ów, ${currentTimeSignature.label})`, dictationMelody);
    }

    function sequenceToSlots(seq) {
        const totalSlots = seq.reduce((sum, n) => sum + (DURATION_SLOTS[n.duration] || 0), 0);
        const slots = new Array(totalSlots).fill(null);
        let idx = 0;
        for (const n of seq) {
            const len = DURATION_SLOTS[n.duration];
            const isRest = !!n.rest;
            slots[idx] = {
                key: isRest ? "b/4" : n.key,
                accidental: isRest ? "n" : (n.accidental || 'n'),
                duration: n.duration,
                durationSlots: len,
                rest: isRest
            };
            for (let j = 1; j < len; j++) slots[idx + j] = { sustain: true, rest: isRest };
            idx += len;
        }
        return slots;
    }

    function slotsToSequence(slots) {
        const seq = [];
        for (let i = 0; i < slots.length; i++) {
            const s = slots[i];
            if (s && !s.sustain && !s.rest) seq.push({ key: s.key, accidental: s.accidental, duration: s.duration });
        }
        return seq;
    }



    function handleToolbarClick(e) {
        const btn = e.target.closest(".tool-btn");
        if (!btn) return;
    if (btn.disabled) return;

        const duration = btn.dataset.duration;
        const accidental = btn.dataset.accidental;
        const mode = btn.dataset.mode;
        const isRestToggle = (mode === 'rest');
        const isDotToggle = (mode === 'dot');

        if (isRestToggle) {
            e.preventDefault();
            isRestMode = !isRestMode;
            btn.classList.toggle('active', isRestMode);
            if (isRestMode) {
                if (eraserBtn) eraserBtn.classList.remove('active');
                isEraserMode = false;
                isAccidentalClearMode = false;
                accidentalBtns.forEach(b => b.classList.remove('active'));
                currentAccidental = 'n';
                refreshDurationButtons();
            }
            return;
        }

        if (isDotToggle) {
            e.preventDefault();
            const nextState = !isDottedMode;
            setDottedMode(nextState);
            return;
        }

        if (duration) {
            if (eraserBtn) eraserBtn.classList.remove('active');
            isEraserMode = false;
            if (isAccidentalClearMode) {
                isAccidentalClearMode = false;
                const naturalBtn = toolbar.querySelector('.tool-btn[data-accidental="n"]');
                if (naturalBtn) naturalBtn.classList.remove('active');
            }
            setDurationBase(duration);
        }

        if (accidental) {
            if (isRhythmicMode()) return;
            if (eraserBtn) eraserBtn.classList.remove('active');
            isEraserMode = false;
            if (isRestMode) {
                isRestMode = false;
                if (restToggleBtn) restToggleBtn.classList.remove('active');
            }
            if (accidental === 'n') {
                const wasActive = btn.classList.contains('active');
                accidentalBtns.forEach(b => {
                    if (b !== btn) b.classList.remove('active');
                });
                if (wasActive) {
                    btn.classList.remove('active');
                    isAccidentalClearMode = false;
                } else {
                    btn.classList.add('active');
                    isAccidentalClearMode = true;
                }
                currentAccidental = 'n';
                refreshDurationButtons();
                return;
            }

            if (isAccidentalClearMode) {
                isAccidentalClearMode = false;
                const naturalBtn = toolbar.querySelector('.tool-btn[data-accidental="n"]');
                if (naturalBtn) naturalBtn.classList.remove('active');
                refreshDurationButtons();
            }

            if (currentAccidental === accidental) {
                currentAccidental = 'n';
                btn.classList.remove('active');
            } else {
                currentAccidental = accidental;
                accidentalBtns.forEach(b => {
                    if (b !== btn) b.classList.remove('active');
                });
                btn.classList.add('active');
            }
        }
    }



    function handleCanvasClick(e) {
        if (!isGameReady) return;
        const svg = staffCanvas.querySelector('svg');
        if (!svg) return;

        const rect = hitboxContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const target = getTargetFromXY(x, y);
        if (!target) return;
    const { slotIndex, noteKey, measureStartSlot, measureEndSlot, row } = target;

        if (isEraserMode) {
            const changed = eraseNoteAtSlot(slotIndex);
            if (changed) {
                resetCheckStateAfterEdit();
                drawStaff();
            }
            return;
        }

        if (isAccidentalClearMode) {
            const changed = clearAccidentalAtSlot(slotIndex);
            if (changed) {
                resetCheckStateAfterEdit();
                drawStaff();
            }
            return;
        }

    const activeDurationSymbol = getActiveDurationSymbol();
    const slotsPerMeasure = Math.max(1, currentTimeSignature.slotsPerMeasure || 1);
    const durationSlots = DURATION_SLOTS[activeDurationSymbol] || 1;
    const noteStartSlot = findNoteStartSlot(userSlots, slotIndex);
        const targetStartSlot = noteStartSlot !== -1 ? noteStartSlot : slotIndex;
    const targetMeasureStart = measureStartSlot != null ? measureStartSlot : Math.floor(targetStartSlot / slotsPerMeasure) * slotsPerMeasure;
    const targetMeasureEnd = measureEndSlot != null ? measureEndSlot : targetMeasureStart + slotsPerMeasure;

        if (targetStartSlot + durationSlots > targetMeasureEnd) {
            console.warn('Nuta nie mieści się w aktualnym takcie. Dodaj nowy takt lub wybierz krótszą wartość.');
            return;
        }

        if (targetStartSlot === 0 && userSlots[0] && !userSlots[0].sustain && userSlots[0].state === 'given') {
            return;
        }

        if (isRestMode) {
            if (!areRestsEnabledForCurrentMode()) {
                isRestMode = false;
                if (restToggleBtn) restToggleBtn.classList.remove('active');
            } else {
                const restNote = {
                    rest: true,
                    key: 'b/4',
                    duration: activeDurationSymbol,
                    accidental: 'n',
                    durationSlots,
                    state: 'default'
                };
                placeNoteInSlots(userSlots, targetStartSlot, restNote);
                resetCheckStateAfterEdit();
                drawStaff();
                return;
            }
        }

        const existingNote = noteStartSlot !== -1 ? userSlots[noteStartSlot] : null;
        const existingRow = existingNote ? keyToRow(existingNote.key) : -1;
        const shouldKeepPitch = isRhythmicMode()
            ? !!existingNote
            : existingNote && existingRow !== -1 && existingRow === row;

        let targetKey = shouldKeepPitch && existingNote ? existingNote.key : noteKey;
        if (isRhythmicMode()) {
            targetKey = RHYTHM_DEFAULT_NOTE;
        }
        const { letter: targetLetter } = parseKeyString(targetKey);
        const signatureAcc = isMelodicMode() ? (getKeySignatureAccidental(targetLetter) ?? 'n') : 'n';

        let effectiveAccidental = signatureAcc;
        if (isRhythmicMode()) {
            effectiveAccidental = 'n';
        } else {
            if (shouldKeepPitch && existingNote) {
                const existingAcc = existingNote.accidental;
                if (existingAcc) effectiveAccidental = existingAcc;
            }
            if (isAccidentalClearMode) {
                effectiveAccidental = 'n';
            } else if (currentAccidental === 's' || currentAccidental === 'f') {
                effectiveAccidental = currentAccidental;
            } else if (currentAccidental === 'n') {
                effectiveAccidental = signatureAcc;
            }
        }

        const newNote = {
            key: targetKey,
            duration: activeDurationSymbol,
            accidental: effectiveAccidental,
            durationSlots,
            state: 'default'
        };

        placeNoteInSlots(userSlots, targetStartSlot, newNote);
        resetCheckStateAfterEdit();
        drawStaff();
    }

    function handleCanvasMove(e) {
        if (!systemsLayout.length || !snapEl) return;
        const rect = hitboxContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const target = getTargetFromXY(x, y);
        if (!target) { snapEl.style.display = 'none'; return; }
        snapEl.style.display = 'block';
        const width = Math.max(12, target.slotWidthPx || 0);
        const height = Math.max(12, target.slotHeightPx || 0);
        snapEl.style.width = width + 'px';
        snapEl.style.height = height + 'px';
        snapEl.style.left = (target.xPx ?? 0) + 'px';
        snapEl.style.top = (target.yPx ?? 0) + 'px';
        snapEl.style.transform = 'translate(-50%, -50%)';
    }

    function getTargetFromXY(x, y) {
        if (!systemsLayout.length) return null;
        let sys = systemsLayout.find(s => y >= s.yStart * scaleY && y <= s.yEnd * scaleY);
        if (!sys) {
            const topEdge = systemsLayout[0].yStart * scaleY;
            sys = (y < topEdge) ? systemsLayout[0] : systemsLayout[systemsLayout.length - 1];
        }
        let meas = sys.measures.find(m => x >= (m.xNotesStart ?? m.xStart) * scaleX && x <= (m.xNotesEnd ?? m.xEnd) * scaleX);
        if (!meas) {
            const firstEdge = (sys.measures[0].xNotesStart ?? sys.measures[0].xStart) * scaleX;
            meas = (x < firstEdge) ? sys.measures[0] : sys.measures[sys.measures.length - 1];
        }
        const measureSlots = Math.max(1, meas.measureSlots || currentTimeSignature.slotsPerMeasure || 1);
        const slotBoundariesScaled = Array.isArray(meas.slotBoundaries) && meas.slotBoundaries.length === measureSlots + 1
            ? meas.slotBoundaries.map(v => v * scaleX)
            : null;
        const slotCentersScaled = Array.isArray(meas.slotCenters) && meas.slotCenters.length === measureSlots
            ? meas.slotCenters.map(v => v * scaleX)
            : null;

        const measXStart = slotBoundariesScaled ? slotBoundariesScaled[0] : (meas.xNotesStart ?? meas.xStart) * scaleX;
        const measXEnd = slotBoundariesScaled ? slotBoundariesScaled[measureSlots] : (meas.xNotesEnd ?? meas.xEnd) * scaleX;

        let slotInMeasure = 0;
        if (slotBoundariesScaled) {
            if (x <= slotBoundariesScaled[0]) {
                slotInMeasure = 0;
            } else if (x >= slotBoundariesScaled[measureSlots]) {
                slotInMeasure = measureSlots - 1;
            } else {
                for (let i = 0; i < measureSlots; i++) {
                    if (x < slotBoundariesScaled[i + 1]) {
                        slotInMeasure = i;
                        break;
                    }
                }
            }
        } else {
            const relX = Math.max(0, Math.min(x - measXStart, measXEnd - measXStart));
            const slotWidth = (measXEnd - measXStart) / measureSlots;
            slotInMeasure = Math.max(0, Math.min(
                Math.floor(relX / Math.max(slotWidth, 1e-6)),
                measureSlots - 1
            ));
        }
        const slotIndex = meas.startSlot + slotInMeasure;

        const yTopScaled = (sys.yTopLine || sys.yStart) * scaleY;
        const sblScaled = (sys.sbl || 10) * scaleY;
        const rowFloat = (y - yTopScaled) / (sblScaled / 2);
        let row = Math.max(0, Math.min(Math.round(rowFloat), NOTE_POSITIONS.length - 1));
        if (isRhythmicMode()) {
            row = RHYTHM_ROW_INDEX >= 0 ? RHYTHM_ROW_INDEX : row;
        }
        const noteKey = isRhythmicMode() ? RHYTHM_DEFAULT_NOTE : NOTE_POSITIONS[row];
        const slotWidthPx = slotBoundariesScaled
            ? Math.max(1e-3, slotBoundariesScaled[Math.min(slotInMeasure + 1, slotBoundariesScaled.length - 1)] - slotBoundariesScaled[slotInMeasure])
            : (measXEnd - measXStart) / measureSlots;
        const defaultCenter = measXStart + slotWidthPx * 0.5 + slotWidthPx * slotInMeasure;
        const centerPx = slotCentersScaled && slotCentersScaled[slotInMeasure] != null
            ? slotCentersScaled[slotInMeasure]
            : defaultCenter;
        const xPx = centerPx;
        const yPx = yTopScaled + row * (sblScaled / 2);
        return {
            sys,
            meas,
            slotIndex,
            row,
            noteKey,
            xPx,
            yPx,
            slotWidthPx,
            slotHeightPx: sblScaled / 2,
            measureStartSlot: meas.startSlot,
            measureEndSlot: meas.measureEndSlot != null ? meas.measureEndSlot : meas.startSlot + measureSlots
        };
    }

    function findNoteStartSlot(slots, slotIndex) {
        if (!slots || slotIndex < 0 || slotIndex >= slots.length) return -1;
        const current = slots[slotIndex];
        if (!current) return -1;
        if (!current.sustain) return slotIndex;
        let i = slotIndex - 1;
        while (i >= 0) {
            const prev = slots[i];
            if (prev && !prev.sustain) return i;
            if (!prev) break;
            i--;
        }
        return -1;
    }

    function keyToRow(key) {
        if (!key) return -1;
        return NOTE_POSITIONS.indexOf(key.toLowerCase());
    }

    function placeNoteInSlots(slots, slotIndex, note, force = false) {
        if (!slots || slotIndex < 0) return;
        const totalSlots = Math.max(slots.length, slotIndex + note.durationSlots);
        if (totalSlots > slots.length) slots.length = totalSlots;

        const rangeEnd = Math.min(slotIndex + note.durationSlots, slots.length);
        for (let i = 0; i < slots.length; i++) {
            const s = slots[i];
            if (s && !s.sustain) {
                const start = i;
                const end = i + (s.durationSlots || 1);
                const overlap = !(end <= slotIndex || start >= rangeEnd);
                const isGiven = s.state === 'given';
                if (overlap && !(isGiven && start === 0 && !force)) {
                    slots[start] = null;
                    for (let k = start + 1; k < end; k++) slots[k] = null;
                }
                i = end - 1;
            }
        }

        const fits = Math.min(note.durationSlots, slots.length - slotIndex);
        const toPlace = { ...note, durationSlots: fits };
        slots[slotIndex] = toPlace;
        for (let j = 1; j < fits; j++) slots[slotIndex + j] = { sustain: true, rest: toPlace.rest };
    }

    function clearAccidentalAtSlot(slotIndex) {
        if (slotIndex < 0 || slotIndex >= userSlots.length) return false;
        let noteIndex = slotIndex;
        let s = userSlots[noteIndex];

        if (!s) return false;

        if (s.sustain) {
            noteIndex = findNoteStartSlot(userSlots, slotIndex);
            if (noteIndex === -1) return false;
            s = userSlots[noteIndex];
        }

    if (!s || s.sustain) return false;
    if (s.rest) return false;
    if (s.state === 'given') return false;

    if (s.accidental === 'n') return false;

    userSlots[noteIndex] = { ...s, accidental: 'n', state: 'default' };
    return true;
    }

    function eraseNoteAtSlot(slotIndex) {
        if (slotIndex < 0 || slotIndex >= userSlots.length) return false;
        let startIndex = slotIndex;
        let s = userSlots[startIndex];

        if (s && s.sustain) {
            startIndex = findNoteStartSlot(userSlots, slotIndex);
            if (startIndex === -1) return false;
            s = userSlots[startIndex];
        }

        if (!s || s.sustain) return false;
        if (s.state === 'given') return false;

        const len = s.durationSlots || 1;
        userSlots[startIndex] = null;
        for (let k = 1; k < len; k++) userSlots[startIndex + k] = null;
        return true;
    }



    function deleteLastNote() {
        for (let i = userSlots.length - 1; i >= 0; i--) {
            const s = userSlots[i];
            if (s && !s.sustain && s.state !== 'given') {
                const len = s.durationSlots || 1;
                userSlots[i] = null;
                for (let k = 1; k < len; k++) userSlots[i + k] = null;
                resetCheckStateAfterEdit();
                drawStaff();
                return;
            }
        }
    }



    function drawStaff() {
        if (!context) return;

        context.clear();
        systemsLayout = [];
        hitboxSvgHeight = 0;

        const slotsPerMeasure = Math.max(1, currentTimeSignature.slotsPerMeasure || 1);
        const { measuresPerSystem, staveWidth } = getLayoutConfig();
        const isDarkMode = (document.body.getAttribute('data-theme') === 'dark');
        const isRhythm = isRhythmicMode();
        const defaultNoteColor = isDarkMode ? '#f0f4f8' : '#000000';
        const correctColor = '#2e7d32';
        const incorrectColor = '#d32f2f';
        const givenColor = '#1e88e5';
        const labelColor = isDarkMode ? '#f0f4f8' : '#1c2333';
        const activeKeySignature = isRhythm ? null : (currentKeyContext?.keySignature || null);

        const slots = Math.max(dictationSlots.length || 0, userSlots.length || 0, slotsPerMeasure);
        const measuresCount = Math.max(1, Math.ceil(slots / slotsPerMeasure));
        const systemsCount = Math.max(1, Math.ceil(measuresCount / measuresPerSystem));
        const measureWidth = staveWidth / measuresPerSystem;

        const LABEL_FONT_SIZE = 18;
        const LABEL_MARGIN_BOTTOM = 8;
        const TOP_PADDING = 24;
        const SECTION_GAP = 36;
        const BOTTOM_PADDING = 24;

        const systemBlockHeight = systemsCount * STAVE_HEIGHT + Math.max(0, systemsCount - 1) * SYSTEM_GAP;
        const userSectionHeight = LABEL_FONT_SIZE + LABEL_MARGIN_BOTTOM + systemBlockHeight;
        const correctSectionHeight = isChecked
            ? SECTION_GAP + LABEL_FONT_SIZE + LABEL_MARGIN_BOTTOM + systemBlockHeight
            : 0;
        const totalHeight = TOP_PADDING + userSectionHeight + correctSectionHeight + BOTTOM_PADDING;

        renderer.resize(STAVE_X + staveWidth + 10, totalHeight);

        let currentY = TOP_PADDING;

        const tonalLabel = (!isRhythm && currentKeyContext)
            ? `${formatKeyLabel(currentKeyContext)} ${getKeyModeLabel(currentKeyContext.mode)}`
            : null;
        const userSectionLabel = (() => {
            if (isRhythm) {
                return isEnglishLocale ? 'Your rhythmic dictation' : 'Twoje dyktando rytmiczne';
            }
            if (tonalLabel) {
                return isEnglishLocale
                    ? `Your dictation — key: ${tonalLabel}`
                    : `Twoje dyktando — tonacja: ${tonalLabel}`;
            }
            return isEnglishLocale ? 'Your dictation' : 'Twoje dyktando';
        })();
        drawSectionLabel(userSectionLabel, STAVE_X, currentY + LABEL_FONT_SIZE, labelColor, LABEL_FONT_SIZE);
        currentY += LABEL_FONT_SIZE + LABEL_MARGIN_BOTTOM;

        const userBaseY = currentY;
        let userAreaBottom = currentY;

        for (let s = 0; s < systemsCount; s++) {
            const systemTop = userBaseY + s * (STAVE_HEIGHT + SYSTEM_GAP);
            const sysMeasures = [];
            let yTopLine = null;
            let spacingBetweenLines = null;

            for (let m = 0; m < measuresPerSystem; m++) {
                const globalMeasureIndex = s * measuresPerSystem + m;
                if (globalMeasureIndex >= measuresCount) break;

                const x = STAVE_X + m * measureWidth;
                const stave = new VF.Stave(x, systemTop, measureWidth);
                if (m === 0) {
                    stave.addClef('treble');
                    if (activeKeySignature) {
                        stave.addKeySignature(activeKeySignature);
                    }
                    if (s === 0) {
                        stave.addTimeSignature(currentTimeSignature.label);
                    }
                }
                stave.setContext(context).draw();

                if (m === 0) {
                    try {
                        const yTop = stave.getYForLine(0);
                        const yBottom = stave.getYForLine(4);
                        yTopLine = yTop;
                        spacingBetweenLines = (yBottom - yTop) / 4;
                    } catch (err) {
                        yTopLine = systemTop + 10;
                        spacingBetweenLines = 10;
                    }
                }

                const startSlot = globalMeasureIndex * slotsPerMeasure;
                const endSlot = Math.min(startSlot + slotsPerMeasure, slots);

                const userNotes = buildMeasureTickablesFromSlots(userSlots, startSlot, endSlot, gapStateMap);
                const voiceConfig = {
                    num_beats: currentTimeSignature.beats,
                    beat_value: currentTimeSignature.beatValue,
                    resolution: VF.RESOLUTION
                };
                const voice = new VF.Voice(voiceConfig);
                voice.setStrict(false);
                voice.addTickables(userNotes);

                const formatter = new VF.Formatter();
                formatter.formatToStave([voice], stave);

                const beams = buildEighthBeams(userNotes);
                voice.draw(context, stave);
                beams.forEach(b => b.setContext(context).draw());

                userNotes.forEach(note => {
                    if (!note) return;
                    const slotIdx = note._slotIndex;
                    if (slotIdx == null) return;
                    const slotData = userSlots[slotIdx];
                    let state = null;
                    if (slotData && !slotData.sustain) state = slotData.state;
                    if (!state && typeof note._state === 'string') state = note._state;

                    let color = defaultNoteColor;
                    if (isChecked) {
                        if (state === 'correct') color = correctColor;
                        else if (state === 'incorrect') color = incorrectColor;
                    }
                    if (slotIdx === 0 && slotData && slotData.state === 'given') {
                        color = givenColor;
                    }
                    paintNoteGlyph(note, color);
                });

                let xNotesStart = x + 10;
                let xNotesEnd = x + measureWidth - 10;
                try {
                    if (typeof stave.getNoteStartX === 'function') xNotesStart = stave.getNoteStartX();
                    if (typeof stave.getNoteEndX === 'function') xNotesEnd = stave.getNoteEndX();
                } catch (err) {}
                const slotLayout = computeMeasureSlotLayout({
                    measureSlots: slotsPerMeasure,
                    startSlot,
                    xNotesStart,
                    xNotesEnd,
                    userNotes
                });
                sysMeasures.push({
                    xStart: x,
                    xEnd: x + measureWidth,
                    xNotesStart,
                    xNotesEnd,
                    startSlot,
                    measureEndSlot: startSlot + slotsPerMeasure,
                    measureSlots: slotsPerMeasure,
                    slotCenters: slotLayout.slotCenters,
                    slotBoundaries: slotLayout.slotBoundaries
                });
            }

            systemsLayout.push({
                yStart: systemTop,
                yEnd: systemTop + STAVE_HEIGHT,
                yTopLine: yTopLine ?? (systemTop + 10),
                sbl: spacingBetweenLines ?? 10,
                measures: sysMeasures
            });

            userAreaBottom = Math.max(userAreaBottom, systemTop + STAVE_HEIGHT);
        }

        hitboxSvgHeight = userAreaBottom;

        if (isChecked) {
            currentY = userAreaBottom + SECTION_GAP;
            const correctLabel = (() => {
                if (isRhythm) {
                    return isEnglishLocale ? 'Correct version — rhythm' : 'Wersja poprawna — rytm';
                }
                if (tonalLabel) {
                    return isEnglishLocale
                        ? `Correct version — key: ${tonalLabel}`
                        : `Wersja poprawna — tonacja: ${tonalLabel}`;
                }
                return isEnglishLocale ? 'Correct version' : 'Wersja poprawna';
            })();
            drawSectionLabel(correctLabel, STAVE_X, currentY + LABEL_FONT_SIZE, labelColor, LABEL_FONT_SIZE);
            currentY += LABEL_FONT_SIZE + LABEL_MARGIN_BOTTOM;
            const correctBaseY = currentY;

            for (let s = 0; s < systemsCount; s++) {
                const systemTop = correctBaseY + s * (STAVE_HEIGHT + SYSTEM_GAP);
                for (let m = 0; m < measuresPerSystem; m++) {
                    const globalMeasureIndex = s * measuresPerSystem + m;
                    if (globalMeasureIndex >= measuresCount) break;

                    const x = STAVE_X + m * measureWidth;
                    const stave = new VF.Stave(x, systemTop, measureWidth);
                    if (m === 0) {
                        stave.addClef('treble');
                        if (activeKeySignature) {
                            stave.addKeySignature(activeKeySignature);
                        }
                        if (s === 0) {
                            stave.addTimeSignature(currentTimeSignature.label);
                        }
                    }
                    stave.setContext(context).draw();

                    const startSlot = globalMeasureIndex * slotsPerMeasure;
                    const endSlot = Math.min(startSlot + slotsPerMeasure, dictationSlots.length);

                    const correctNotes = buildMeasureTickablesFromSlots(dictationSlots, startSlot, endSlot);
                    const voiceConfig = {
                        num_beats: currentTimeSignature.beats,
                        beat_value: currentTimeSignature.beatValue,
                        resolution: VF.RESOLUTION
                    };
                    const voice = new VF.Voice(voiceConfig);
                    voice.setStrict(false);
                    voice.addTickables(correctNotes);

                    const formatter = new VF.Formatter();
                    formatter.formatToStave([voice], stave);

                    const beams = buildEighthBeams(correctNotes);
                    voice.draw(context, stave);
                    beams.forEach(b => b.setContext(context).draw());

                    correctNotes.forEach(note => paintNoteGlyph(note, defaultNoteColor));
                }
            }
        }

        syncOverlayToSVG();
    }

    function drawSectionLabel(text, x, y, color, fontSize) {
        if (!context || typeof context.fillText !== 'function') return;
        context.save();
        if (typeof context.setFont === 'function') {
            context.setFont('Inter', fontSize ?? 18, 'bold');
        }
        if (typeof context.setFillStyle === 'function') {
            context.setFillStyle(color);
        }
        context.fillText(text, x, y);
        context.restore();
    }

    function paintNoteGlyph(note, color) {
        if (!note) return;
        const svgEl = typeof note.getSVGElement === 'function' ? note.getSVGElement() : note.attrs ? note.attrs.el : null;
        if (!svgEl) return;
        const fillColor = color || '#000000';
        const applyColor = (el) => {
            if (!el) return;
            el.setAttribute('fill', fillColor);
            el.setAttribute('stroke', fillColor);
            el.style.fill = fillColor;
            el.style.stroke = fillColor;
            el.style.color = fillColor;
        };
        applyColor(svgEl);
        const noteheads = svgEl.querySelectorAll('.vf-notehead');
        if (noteheads.length) {
            noteheads.forEach(head => {
                applyColor(head);
                head.querySelectorAll('path, ellipse, circle, rect, line, polygon, polyline, use').forEach(applyColor);
            });
        }
        svgEl.querySelectorAll('path, ellipse, circle, rect, line, polygon, polyline, use, text').forEach(applyColor);
    }


    function buildEighthBeams(notes) {
        const beams = [];
        let idx = 0;
        while (idx < notes.length - 1) {
            const first = notes[idx];
            if (!isBeamableEighth(first)) {
                idx += 1;
                continue;
            }
            const second = notes[idx + 1];
            if (!isBeamableEighth(second) || !areAdjacentSlots(first, second) || !areWithinSameBeat(first, second)) {
                idx += 1;
                continue;
            }
            beams.push(new VF.Beam([first, second]));
            idx += 2;
        }
        return beams;
    }

    function isBeamableEighth(note) {
        if (!note || typeof note.getDuration !== 'function') return false;
        if (note._slotIndex == null) return false;
        if (typeof note.isRest === 'function' && note.isRest()) return false;
        return note.getDuration() === '8';
    }

    function areAdjacentSlots(first, second) {
        if (first._slotIndex == null || second._slotIndex == null) return false;
        return second._slotIndex === first._slotIndex + 1;
    }

    function areWithinSameBeat(first, second) {
        const slotsPerMeasure = Math.max(1, currentTimeSignature.slotsPerMeasure || 1);
        const beatSlots = Math.max(1, currentTimeSignature.beatSlots || 1);
        let slotInMeasureA = first._slotIndex % slotsPerMeasure;
        let slotInMeasureB = second._slotIndex % slotsPerMeasure;
        if (slotInMeasureA < 0) slotInMeasureA += slotsPerMeasure;
        if (slotInMeasureB < 0) slotInMeasureB += slotsPerMeasure;
        const beatA = Math.floor(slotInMeasureA / beatSlots);
        const beatB = Math.floor(slotInMeasureB / beatSlots);
        return beatA === beatB;
    }

    function addMeasureAtEnd() {
        const addEmptySlots = (arr) => {
            const currentLen = arr.length | 0;
            const measureSlots = Math.max(1, currentTimeSignature.slotsPerMeasure || 1);
            const targetLen = Math.ceil(currentLen / measureSlots) * measureSlots;
            if (currentLen < targetLen) arr.length = targetLen;
            for (let i = 0; i < measureSlots; i++) arr.push(null);
        };
        addEmptySlots(userSlots);
        addEmptySlots(dictationSlots);
        resetCheckStateAfterEdit();
        drawStaff();
    }

    function appendRestNotes(target, startSlotIndex, restSlots, beatSlots, stateAccessor) {
        if (restSlots <= 0) return;
        const preferredChunk = Math.max(1, beatSlots || 1);
        let remaining = restSlots;
        let slotIndex = startSlotIndex;

        while (remaining > 0) {
            const beatAligned = preferredChunk > 1;
            const beatOffset = beatAligned ? (slotIndex % preferredChunk) : 0;
            const slotsUntilBeat = beatAligned
                ? (beatOffset === 0 ? preferredChunk : preferredChunk - beatOffset)
                : remaining;

            let chunk = null;
            for (const len of SUPPORTED_SLOT_LENGTHS) {
                if (len === 4) continue;
                if (len > remaining) continue;
                if (beatAligned) {
                    if (beatOffset !== 0 && len > slotsUntilBeat) continue;
                    if (beatOffset === 0 && len > preferredChunk) {
                        if (preferredChunk === 0 || (len % preferredChunk) !== 0) continue;
                    }
                }
                chunk = len;
                break;
            }

            if (!chunk) {
                const fallbackLimit = beatAligned ? Math.max(1, slotsUntilBeat) : 1;
                chunk = Math.min(remaining, fallbackLimit);
            }

            const rest = new VF.StaveNote({ keys: ['b/4'], duration: slotsToDuration(chunk, { isRest: true }) });
            applyDotIfNeeded(rest, chunk);
            rest._durationSlots = chunk;
            rest._slotIndex = slotIndex;
            if (typeof stateAccessor === 'function') {
                let chunkState = null;
                for (let offset = 0; offset < chunk; offset++) {
                    const state = stateAccessor(slotIndex + offset);
                    if (!state) continue;
                    if (state === 'incorrect') {
                        chunkState = 'incorrect';
                        break;
                    }
                    if (state === 'correct' && chunkState !== 'incorrect') {
                        chunkState = 'correct';
                    }
                }
                if (chunkState) rest._state = chunkState;
            }
            target.push(rest);

            remaining -= chunk;
            slotIndex += chunk;
        }
    }

    function buildMeasureTickablesFromSlots(sourceSlots, startSlot, endSlot, gapMap) {
        const notes = [];
        if (!Array.isArray(sourceSlots)) return notes;

        const beatSlots = Math.max(1, currentTimeSignature.beatSlots || 1);
        const gapAccessor = gapMap instanceof Map && gapMap.size
            ? (slotIdx) => gapMap.get(slotIdx)
            : null;

        for (let i = startSlot; i < endSlot;) {
            const slotData = sourceSlots[i];
            if (slotData && !slotData.sustain) {
                const noteSlotIndex = i;
                const maxLen = Math.min(slotData.durationSlots || 1, endSlot - i);
                const isRest = !!slotData.rest;
                const dur = slotsToDuration(maxLen, { isRest });
                const noteKeys = isRest ? ['b/4'] : [slotData.key];
                const vf = new VF.StaveNote({ keys: noteKeys, duration: dur });
                applyDotIfNeeded(vf, maxLen);
                vf._durationSlots = maxLen;
                if (!isRest) {
                    const { letter } = parseKeyString(slotData.key);
                    const noteAccidental = slotData.accidental || 'n';
                    if (shouldDisplayAccidental(letter, noteAccidental)) {
                        const vexSymbol = ACCIDENTAL_MAP_VEX[noteAccidental];
                        if (vexSymbol) {
                            const accidental = new VF.Accidental(vexSymbol);
                            if (typeof vf.addAccidental === 'function') {
                                vf.addAccidental(0, accidental);
                            } else if (typeof vf.addModifier === 'function') {
                                vf.addModifier(accidental);
                            }
                        }
                    }
                }
                vf._slotIndex = noteSlotIndex;
                if (slotData.state) vf._state = slotData.state;
                notes.push(vf);
                i += maxLen;
                continue;
            }

            if (slotData && slotData.sustain) {
                i += 1;
                continue;
            }

            const restStart = i;
            let restSlots = 0;
            while (i < endSlot && !sourceSlots[i]) {
                restSlots += 1;
                i += 1;
            }
            appendRestNotes(notes, restStart, restSlots, beatSlots, gapAccessor);
        }

        return notes;
    }

    function computeMeasureSlotLayout({ measureSlots, startSlot, xNotesStart, xNotesEnd, userNotes }) {
        const slots = Math.max(1, Number(measureSlots) || 0);
        const safeStart = Number.isFinite(xNotesStart) ? xNotesStart : 0;
        const safeEndRaw = Number.isFinite(xNotesEnd) ? xNotesEnd : safeStart + 1;
        const safeEnd = Math.max(safeStart + 1e-3, safeEndRaw);
        const width = safeEnd - safeStart;
        const centers = new Array(slots);
        const hasCustomCenter = new Array(slots).fill(false);
        const defaultSlotWidth = width / slots;
        for (let i = 0; i < slots; i++) {
            centers[i] = safeStart + defaultSlotWidth * (i + 0.5);
        }

        const applyFromNotes = (notes) => {
            if (!Array.isArray(notes)) return;
            notes.forEach(note => {
                const slotIdx = note && typeof note._slotIndex === 'number' ? note._slotIndex : null;
                if (slotIdx == null) return;
                const slotInMeasure = slotIdx - startSlot;
                if (slotInMeasure < 0 || slotInMeasure >= slots) return;
                if (typeof note.getAbsoluteX !== 'function') return;
                let absX;
                try {
                    absX = note.getAbsoluteX();
                } catch (err) {
                    absX = null;
                }
                if (!Number.isFinite(absX)) return;
                const clampedX = Math.min(Math.max(absX, safeStart), safeEnd);
                if (!hasCustomCenter[slotInMeasure]) {
                    centers[slotInMeasure] = clampedX;
                    hasCustomCenter[slotInMeasure] = true;
                }
            });
        };

        applyFromNotes(userNotes);

        for (let i = 1; i < centers.length; i++) {
            if (centers[i] <= centers[i - 1]) centers[i] = Math.min(safeEnd, centers[i - 1] + 1e-3);
        }

        const boundaries = new Array(slots + 1);
        boundaries[0] = safeStart;
        for (let i = 1; i < slots; i++) {
            const mid = (centers[i - 1] + centers[i]) / 2;
            boundaries[i] = Math.max(boundaries[i - 1], Math.min(Math.max(mid, safeStart), safeEnd));
        }
        boundaries[slots] = Math.max(boundaries[slots - 1], safeEnd);

        return { slotCenters: centers, slotBoundaries: boundaries };
    }

    function slotsToDuration(slotsLen, { isRest = false } = {}) {
        let value;
        switch (slotsLen) {
            case 12: value = 'w'; break;
            case 8: value = 'w'; break;
            case 6: value = 'h'; break;
            case 4: value = 'h'; break;
            case 3: value = 'q'; break;
            case 2: value = 'q'; break;
            case 1: value = '8'; break;
            default:
                value = '8';
        }
        let notation = value;
        if (isRest) notation += 'r';
        return notation;
    }

    function applyDotIfNeeded(vfNote, slotsLen) {
        if (!vfNote) return;
        if (slotsLen === 3 || slotsLen === 6 || slotsLen === 12) {
            try {
                if (typeof vfNote.addDotToAll === 'function') {
                    vfNote.addDotToAll();
                } else if (typeof VF.Dot?.buildAndAttach === 'function') {
                    VF.Dot.buildAndAttach([vfNote], { all: true });
                }
            } catch (err) {
                console.warn('Nie udało się dodać kropki do nuty/resty.', err);
            }
        }
    }



    async function playMelody(melody) {
        if (!isGameReady || !melody || melody.length === 0) return;

        if (isRhythmicMode()) {
            await playRhythmicSequence(melody);
            return;
        }

        try {
            await loadInstrument(activeInstrument);
        } catch (err) {
            console.error('Nie udało się załadować wybranego instrumentu. Nastąpi użycie syntezatora bazowego.', err);
            if (!fallbackSynth) {
                try {
                    fallbackSynth = new Tone.Synth().toDestination();
                } catch (synthErr) {
                    console.error('Nie udało się utworzyć syntezatora rezerwowego.', synthErr);
                }
            }
        }

        const instrumentNode = (samplerLoaded && sampler && samplerInstrument === activeInstrument) ? sampler : fallbackSynth;
        if (!instrumentNode || typeof instrumentNode.triggerAttackRelease !== 'function') {
            console.warn('Brak dostępnego instrumentu do odtworzenia dyktanda.');
            return;
        }

        stopPlayback();

        Tone.Transport.cancel();
        try {
            Tone.Transport.position = 0;
        } catch (err) {
            console.warn('Błąd resetowania pozycji transportu Tone.js:', err);
        }

        applyTempoToTransport();

        const beatValue = currentTimeSignature.beatValue || 4;
        const beatsPerMeasure = Math.max(1, currentTimeSignature.beats || 4);
        const beatSeconds = Tone.Time(`${beatValue}n`).toSeconds();
        let currentTime = 0;

        const totalMetBeats = beatsPerMeasure * 2;

        const metSynth = getMetronomeSynth();
        if (metSynth && typeof metSynth.triggerAttackRelease === 'function') {
            for (let i = 0; i < totalMetBeats; i++) {
                const isBarStart = (i % beatsPerMeasure) === 0;
                const pitch = isBarStart ? 'C5' : 'G4';
                try {
                    metSynth.triggerAttackRelease(pitch, '32n', `+${currentTime}`);
                } catch (err) {
                    console.warn('Nie udało się odtworzyć uderzenia metronomu:', err);
                }
                currentTime += beatSeconds;
            }
        } else {
            currentTime += beatSeconds * totalMetBeats;
        }

        let playbackTime = currentTime;

        melody.forEach(note => {
            const toneDuration = DURATION_MAP_TONE[note.duration];
            if (!toneDuration) return;

            if (!note.rest) {
                const tonePitch = getTonePitch(note);
                try {
                    instrumentNode.triggerAttackRelease(
                        tonePitch,
                        toneDuration,
                        `+${playbackTime}`
                    );
                } catch (err) {
                    console.error('Błąd podczas wyzwalania nuty:', err);
                }
            }

            playbackTime += Tone.Time(toneDuration).toSeconds();
        });

        const playbackDuration = playbackTime;
        if (playbackDuration <= 0) {
            setPlaybackState(false);
            return;
        }

        setPlaybackState(true);
        try {
            playbackEndEventId = Tone.Transport.scheduleOnce(() => {
                stopPlayback({ fromEvent: true });
            }, playbackDuration);

            Tone.Transport.start();
        } catch (err) {
            console.error('Nie udało się uruchomić odtwarzania Tone.js:', err);
            stopPlayback();
        }
    }



    function getTonePitch(note) {
        if (!note || note.rest) return null;
        let [pitch, octave] = note.key.split('/');
        pitch = pitch.toUpperCase();

        switch(note.accidental) {
            case "s": return `${pitch}#${octave}`;
            case "f": return `${pitch}b${octave}`;
            default: return `${pitch}${octave}`;
        }
    }



    function checkAnswer() {
        if (!isGameReady) return;

        isChecked = true;
        overlayCorrectMap = new Map();
        gapStateMap = new Map();

        const totalSlots = Math.max(userSlots.length, dictationSlots.length);
        const matchedDictStarts = new Set();
        const dictStartIndexes = [];

        for (let i = 0; i < userSlots.length; i++) {
            const slot = userSlots[i];
            if (slot && !slot.sustain && slot.state !== 'given') {
                slot.state = 'default';
            }
        }

        for (let i = 1; i < dictationSlots.length; i++) {
            const slot = dictationSlots[i];
            if (slot && !slot.sustain) {
                dictStartIndexes.push(i);
            }
        }

        const markGapRange = (start, len, state = 'incorrect') => {
            const safeLen = Math.max(1, len || 1);
            const clampedStart = Math.max(0, start);
            const clampedEnd = Math.min(totalSlots, clampedStart + safeLen);
            for (let idx = clampedStart; idx < clampedEnd; idx++) {
                if (state === 'correct') {
                    const existing = gapStateMap.get(idx);
                    if (existing !== 'incorrect') {
                        gapStateMap.set(idx, 'correct');
                    }
                } else {
                    gapStateMap.set(idx, state);
                }
            }
        };

        dictStartIndexes.forEach(slotIndex => {
            const dictSlot = dictationSlots[slotIndex];
            if (!dictSlot || dictSlot.rest) return;

            const userSlot = userSlots[slotIndex];
            const userStart = (userSlot && !userSlot.sustain && !userSlot.rest) ? userSlot : null;

            if (userStart) {
                const durationMatch = userStart.durationSlots === dictSlot.durationSlots;
                const pitchMatch = isRhythmicMode() || ((userStart.key === dictSlot.key) && (userStart.accidental === dictSlot.accidental));

                if (durationMatch && pitchMatch) {
                    userStart.state = 'correct';
                    matchedDictStarts.add(slotIndex);
                } else {
                    userStart.state = 'incorrect';
                }
            } else {
                markGapRange(slotIndex, dictSlot.durationSlots, 'incorrect');
            }
        });

        dictStartIndexes.forEach(slotIndex => {
            const dictSlot = dictationSlots[slotIndex];
            if (!dictSlot || !dictSlot.rest) return;

            const restDuration = Math.max(1, dictSlot.durationSlots || 1);
            const restEnd = slotIndex + restDuration;
            const coverage = new Array(restDuration).fill(false);
            let hasError = false;

            for (let offset = 0; offset < restDuration; offset++) {
                const slotPos = slotIndex + offset;
                const userCell = userSlots[slotPos];

                if (!userCell) {
                    coverage[offset] = true;
                    continue;
                }

                if (userCell.sustain) {
                    const originIndex = findNoteStartSlot(userSlots, slotPos);
                    if (originIndex >= 0) {
                        const origin = userSlots[originIndex];
                        if (origin && !origin.sustain && origin.state !== 'given') {
                            origin.state = 'incorrect';
                        }
                    }
                    hasError = true;
                    continue;
                }

                if (!userCell.rest) {
                    userCell.state = 'incorrect';
                    hasError = true;
                    continue;
                }

                const userDuration = Math.max(1, userCell.durationSlots || 1);
                const userEnd = slotPos + userDuration;
                const overflow = (slotPos < slotIndex) || (userEnd > restEnd);

                for (let k = 0; k < userDuration; k++) {
                    const rel = offset + k;
                    if (rel >= 0 && rel < restDuration) {
                        coverage[rel] = true;
                    }
                }

                if (userCell.state !== 'incorrect') {
                    userCell.state = overflow ? 'incorrect' : 'correct';
                }
                if (overflow) {
                    hasError = true;
                }

                offset += userDuration - 1;
            }

            const uncovered = coverage.some(flag => !flag);

            if (!hasError && !uncovered) {
                markGapRange(slotIndex, restDuration, 'correct');
                matchedDictStarts.add(slotIndex);
            } else {
                if (uncovered) {
                    let gapStart = null;
                    for (let offset = 0; offset < coverage.length; offset++) {
                        if (!coverage[offset]) {
                            if (gapStart === null) gapStart = slotIndex + offset;
                        } else if (gapStart !== null) {
                            markGapRange(gapStart, (slotIndex + offset) - gapStart, 'incorrect');
                            gapStart = null;
                        }
                    }
                    if (gapStart !== null) {
                        markGapRange(gapStart, restEnd - gapStart, 'incorrect');
                    }
                } else {
                    markGapRange(slotIndex, restDuration, 'incorrect');
                }
            }
        });

        for (let i = 1; i < userSlots.length; i++) {
            const slot = userSlots[i];
            if (!slot || slot.sustain || slot.state === 'given') continue;
            if (slot.state === 'default') {
                slot.state = 'incorrect';
            }
        }

        const hasIncorrectStart = userSlots.some((slot, idx) => idx > 0 && slot && !slot.sustain && slot.state === 'incorrect');
        const hasGaps = Array.from(gapStateMap.values()).some(state => state === 'incorrect');
        const dictStartCount = dictStartIndexes.length;
        const isPerfect = matchedDictStarts.size === dictStartCount && !hasIncorrectStart && !hasGaps;

        if (isPerfect) {
            showFeedback("Doskonale!", "<p style='color: green; font-weight: bold;'>Gratulacje! Wszystko poprawnie.</p>");
        }

        console.log('Stany nut po sprawdzeniu:', userSlots.map((s, i) => s && !s.sustain ? { i, key: s.key, state: s.state } : null).filter(Boolean));
        drawStaff();
    }



    function showFeedback(title, body) {
        popupTitle.textContent = title;
        popupBody.innerHTML = body;
        feedbackModal.style.display = "flex";
    }

    // Końcowa inicjalizacja widoku i podpięcie wszystkich nasłuchiwaczy
    setCheckButtonState('check');
    setPlaybackState(false);
    initTheme();
    if (gameMenu) gameMenu.style.display = 'none';
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            toggleTheme();
        });
    }

    dictationTypeSelection = resolveDictationType(dictationTypeSelect ? dictationTypeSelect.value : dictationTypeSelection);
    if (dictationTypeSelect) dictationTypeSelect.value = dictationTypeSelection;


    if (meterSelect && meterSelect.value) meterSelection = meterSelect.value;
    if (instrumentSelect && instrumentSelect.value) instrumentSelection = instrumentSelect.value;
    if (dictationLengthSelect && dictationLengthSelect.value) dictationLengthSelection = dictationLengthSelect.value;
    if (keyModeSelect && keyModeSelect.value) {
        keyModeSelection = resolveKeyMode(keyModeSelect.value);
        keyModeSelect.value = keyModeSelection;
    }
    if (tempoInput) {
        updateTempoSelection(tempoInput.value || DEFAULT_TEMPO);
    } else {
        updateTempoSelection(DEFAULT_TEMPO);
    }

    if (gotoSelectionBtn) {
        gotoSelectionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (isPreparingExercise) return;
            uiState = 'settings';
            updateUIState();
            if (stepsContainer && typeof stepsContainer.scrollTo === 'function') {
                stepsContainer.scrollTo({ top: 0, behavior: 'auto' });
            }
        });
    }
    if (dictationTypeSelect) {
        dictationTypeSelect.addEventListener('change', (e) => {
            setDictationType(e.target.value);
        });
    }
    if (dictationTypeButtons && dictationTypeButtons.length) {
        dictationTypeButtons.forEach(btn => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                const type = btn?.dataset?.type;
                if (!type) return;
                setDictationType(type);
            });
        });
    }
    if (startGameBtn) startGameBtn.addEventListener("click", handleStartButtonClick);
    if (toolbar) toolbar.addEventListener("click", handleToolbarClick);
    if (repeatBtn) repeatBtn.addEventListener("click", () => playMelody(dictationMelody));
    if (checkBtn) checkBtn.addEventListener("click", handleCheckButtonClick);
    if (popupNextBtn) popupNextBtn.addEventListener("click", () => { nextExercise(); });
    if (meterSelect) {
        meterSelect.addEventListener('change', (e) => {
            meterSelection = e.target.value;
            currentTimeSignature = resolveTimeSignatureSelection(meterSelection);
            if (isRhythmicMode()) {
                enforceDurationAvailability();
            }
            refreshDurationButtons();
            if (context) {
                drawStaff();
            }
        });
    }
    if (instrumentSelect) {
        instrumentSelect.addEventListener('change', (e) => {
            instrumentSelection = e.target.value;
        });
    }
    if (dictationLengthSelect) {
        dictationLengthSelect.addEventListener('change', (e) => {
            dictationLengthSelection = e.target.value;
        });
    }
    if (keyModeSelect) {
        keyModeSelect.addEventListener('change', (e) => {
            keyModeSelection = resolveKeyMode(e.target.value);
            keyModeSelect.value = keyModeSelection;
        });
    }
    if (tempoInput) {
        const handleTempoEvent = (event) => {
            updateTempoSelection(event.target.value);
        };
        tempoInput.addEventListener('change', handleTempoEvent);
        tempoInput.addEventListener('blur', handleTempoEvent);
    }
    if (eraserBtn) {
        eraserBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isEraserMode = !isEraserMode;
            eraserBtn.classList.toggle('active', isEraserMode);
            if (isEraserMode) {
                if (restToggleBtn) restToggleBtn.classList.remove('active');
                isRestMode = false;
                durationBtns.forEach(b => b.classList.remove('active'));
                accidentalBtns.forEach(b => b.classList.remove('active'));
                const naturalBtn = toolbar.querySelector('.tool-btn[data-accidental="n"]');
                if (naturalBtn) naturalBtn.classList.remove('active');
                isAccidentalClearMode = false;
                currentAccidental = 'n';
                setDottedMode(false);
                if (dotToggleBtn) dotToggleBtn.disabled = !DOTTED_VARIANTS[currentDurationBase];
            } else {
                refreshDurationButtons();
            }
        });
    }

    refreshDurationButtons();

    initVexFlow();
    setDictationType(dictationTypeSelection);
    uiState = 'selection';
    updateUIState();
});




