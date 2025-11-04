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


let czastrwania = 1000;
function updateCzasTrwania() {
    const select = document.getElementById('czastrwania');
    const option = select.options[select.selectedIndex];
    czastrwania = Number(option.value) || 1000;
}
document.getElementById('czastrwania').onchange = updateCzasTrwania;
updateCzasTrwania();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const toneSampleBaseUrl = 'https://nbrosowsky.github.io/tonejs-instruments/samples/';
const DEFAULT_INSTRUMENT = 'piano';
const MIN_RANGE_STEPS = 2;
const DEFAULT_RANGE = { minNote: 'C4', maxNote: 'C6' };
const RANGE_UPDATE_DEBOUNCE_MS = 150;

const SCALE_TEMPO_ADJUSTMENT_FACTOR = 0.3;


const game = {
    status: 'selection',
    selectedExercises: new Set(),
    currentExerciseId: null,
    isSoundPlaying: false,
    score: {
        good: 0,
        bad: 0
    },
    countdownInterval: null,
    pendingInstrument: null
};





const stepSettings = document.getElementById("step-settings");
const stepSelection = document.getElementById("step-selection");
const stepGame = document.getElementById("step-game");
const gameMenu = document.getElementById("game-menu");
const gameButtonsContainer = document.getElementById("game-buttons-container");
const stepsContainer = document.getElementById("steps-container");

const gotoSelectionBtn = document.getElementById("goto-selection-btn");
const startGameBtn = document.getElementById("start-game-btn");
const stopGameBtn = document.getElementById("stop-game-btn");
const powtorzButton = document.getElementById("powtorz-btn"); 
const startButtonLabelEl = startGameBtn ? startGameBtn.querySelector('.button-text') : null;
let isPreparingGame = false;
let isToneStarted = false;

function setButtonLabel(labelElement, key) {
    if (!labelElement) return;
    labelElement.setAttribute('data-i18n', key);
    labelElement.textContent = t(key);
}

function setStartButtonLabel(key) {
    if (!startGameBtn || !startButtonLabelEl) return;
    setButtonLabel(startButtonLabelEl, key);
}

function updateCategoryToggleButton(button, allSelected) {
    if (!button) return;
    const key = allSelected ? 'cwiczenia.category.clearAll' : 'cwiczenia.category.selectAll';
    button.setAttribute('data-i18n', key);
    button.textContent = t(key);
    button.classList.toggle('active', allSelected);
}

function resetStartButton(force = false) {
    if (!startGameBtn) return;
    if (!force && isPreparingGame) return;
    startGameBtn.disabled = false;
    setStartButtonLabel('common.buttons.start');
}

const scoreGoodEl = document.getElementById("ilosc-dobrze");
const scoreBadEl = document.getElementById("ilosc-zle");

const feedbackModal = document.getElementById("feedback-modal");
const popupTitle = document.getElementById("popup-title");
const popupBody = document.getElementById("popup-body");
const popupNextBtn = document.getElementById("popup-next-btn");
const popupCountdown = document.getElementById("popup-countdown");

const originalPopupBtnText = popupNextBtn.innerHTML;

const infoModal = document.getElementById("info-modal");
const infoModalBody = document.getElementById("info-modal-body");
const infoModalCloseBtn = document.getElementById("info-modal-close-btn");

function updateUI() {
    stepSettings.style.display = "none";
    stepSelection.style.display = "none";
    stepGame.style.display = "none";
    gameMenu.style.display = "none";

    const bottomNav = document.getElementById("bottom-nav");
    gotoSelectionBtn.style.display = "none";
    startGameBtn.style.display = "none";
    bottomNav.style.display = "none";

    if (game.status === 'selection') {
        stepSelection.style.display = "block";
        bottomNav.style.display = "flex";
        gotoSelectionBtn.style.display = "inline-block";
        resetStartButton();
    } else if (game.status === 'settings') {
        stepSettings.style.display = "block";
        bottomNav.style.display = "flex";
        startGameBtn.style.display = "inline-block";
        if (!isPreparingGame) {
            resetStartButton();
        }
    } else if (game.status === 'playing') {
        stepGame.style.display = "block";
        gameMenu.style.display = "flex";
    }
}


function setMenuButtonsDisabled(disabled) {
    powtorzButton.disabled = disabled;
    if (stopGameBtn) stopGameBtn.disabled = disabled;
}

gotoSelectionBtn.onclick = function () {
    if (!game.selectedExercises || game.selectedExercises.size === 0) {
        showInfoModal(t('cwiczenia.messages.selectExercise'));
        return;
    }

    game.status = 'settings';
    updateUI();
};

startGameBtn.onclick = async function () {
    if (isPreparingGame) return;
    if (game.selectedExercises.size === 0) {
        showInfoModal(t('cwiczenia.messages.selectExercise'));
        return;
    }

    isPreparingGame = true;
    game.pendingInstrument = null;

    if (startGameBtn) {
        startGameBtn.disabled = true;
        setStartButtonLabel('common.buttons.loading');
    }

    try {
        await ensureToneReady();


        const instrumentSelect = document.getElementById('instrument');
        const selectValue = instrumentSelect ? instrumentSelect.value : null;

        if (selectValue === 'losowo') {
            const warmInstrument = currentInstrument || DEFAULT_INSTRUMENT;
            await loadSampler(warmInstrument);
            game.pendingInstrument = null; 
        } else {
            const initialInstrument = getSelectedInstrument() || currentInstrument;
            await loadSampler(initialInstrument);
            game.pendingInstrument = initialInstrument;
        }
    } catch (err) {
        console.error('Nie udało się przygotować ćwiczeń:', err);
        if (startGameBtn) {
            startGameBtn.disabled = false;
            setStartButtonLabel('common.buttons.tryAgain');
        }
        isPreparingGame = false;
        return;
    }
    
    try {
        game.status = 'playing';
        game.score.good = 0;
        game.score.bad = 0;
        
        document.querySelector("#ilosc-dobrze .score-value").textContent = game.score.good;
        document.querySelector("#ilosc-zle .score-value").textContent = game.score.bad;
        
        buildGameButtons();
        updateUI();
        if (stepsContainer) {
            stepsContainer.scrollTo({ top: 0, behavior: 'auto' });
        }
        rozpocznijNowaRunde();
    } finally {
        isPreparingGame = false;
        resetStartButton(true);
    }
};
if (stopGameBtn) {
    stopGameBtn.onclick = function () {
        if (game.status !== 'playing' || stopGameBtn.disabled) return; 

        game.status = 'settings';
        game.selectedExercises.clear();
        
        const allButtons = document.querySelectorAll('.przycisk-wyboru');
        allButtons.forEach(btn => btn.classList.remove('selected'));
        const allCategoryBtns = document.querySelectorAll('.category-toggle-btn');
        allCategoryBtns.forEach(btn => {
            updateCategoryToggleButton(btn, false);
        });
        
    updateSettingsAvailability();
        
        updateUI();
        if (sampler && sampler.releaseAll) {
            sampler.releaseAll();
        }
    };
}


function toggleExercise(element) {
    if (game.status !== 'selection') return;
    
    const id = Number(element.dataset.id);
    if (!id) return;

    if (game.selectedExercises.has(id)) {
        game.selectedExercises.delete(id);
        element.classList.remove('selected');
    } else {
        game.selectedExercises.add(id);
        element.classList.add('selected');
    }

    const categoryGroup = element.closest('.category-group');
    if (categoryGroup) {
        checkCategoryStatus(categoryGroup);
    }
    

    updateSettingsAvailability();
}

function checkCategoryStatus(categoryGroup) {
    const categoryBtn = categoryGroup.querySelector('.category-toggle-btn');
    const buttons = categoryGroup.querySelectorAll('.przycisk-wyboru');
    
    if (buttons.length === 0) return;

    const allSelected = Array.from(buttons).every(b => b.classList.contains('selected'));
    updateCategoryToggleButton(categoryBtn, allSelected);
}

function toggleCategory(buttonElement) {
    if (game.status !== 'selection') return;
    const categoryGroup = buttonElement.closest('.category-group');
    const buttons = categoryGroup.querySelectorAll('.przycisk-wyboru');
    
    const allSelected = Array.from(buttons).every(b => b.classList.contains('selected'));

    buttons.forEach(btn => {
        const isSelected = btn.classList.contains('selected');
        
        if (allSelected) {
            if (isSelected) {
                toggleExercise(btn);
            }
        } else {
            if (!isSelected) {
                toggleExercise(btn);
            }
        }
    });
    
    checkCategoryStatus(categoryGroup);
    

    updateSettingsAvailability();
}


function updateSettingsAvailability() {
    const trybGraniaSelect = document.getElementById('trybgrania');
    if (!trybGraniaSelect) return;

    if (game.selectedExercises.size === 0) {
        trybGraniaSelect.disabled = false;
        return;
    }

    let hasNonScales = false;
    let hasScales = false;

    for (const id of game.selectedExercises) {
        const key = exerciseIdToKey[id];
        if (key && _scaleKeys.has(key)) {
            hasScales = true;
        } else {
            hasNonScales = true;
        }
        

        if (hasScales && hasNonScales) break;
    }

    if (hasScales && !hasNonScales) {
        trybGraniaSelect.disabled = true;

    } else {
        trybGraniaSelect.disabled = false;
    }
}


function buildGameButtons() {
    gameButtonsContainer.innerHTML = ""; 

    const selectionRows = document.querySelectorAll("#step-selection #ukladacz");

    selectionRows.forEach(row => {
        const selectedButtonsInRow = row.querySelectorAll(".przycisk-wyboru.selected");

        if (selectedButtonsInRow.length > 0) {
            
            const gameRow = document.createElement('div');
            gameRow.id = 'ukladacz'; 

            selectedButtonsInRow.forEach(selectionButton => {
                const id = Number(selectionButton.dataset.id);
                const h3Content = selectionButton.innerHTML; 

                const answerButton = document.createElement('div');
                answerButton.className = 'przycisk-odpowiedzi';
                
                answerButton.dataset.id = id; 
                answerButton.onclick = () => wybierz(id);

                answerButton.innerHTML = h3Content; 

                gameRow.appendChild(answerButton);
            });

            gameButtonsContainer.appendChild(gameRow);
        }
    });
}


function showInfoModal(message) {
    infoModalBody.textContent = message;
    infoModal.style.display = "flex";
}
infoModalCloseBtn.onclick = function(e) {
    e.preventDefault();
    infoModal.style.display = "none";
}

infoModal.onclick = function(e) {
    if (e.target === infoModal) {
        infoModal.style.display = "none";
    }
}


const now = Tone.now();

const tab = [
    "C1", "C#1", "D1", "D#1", "E1", "F1", "F#1", "G1", "G#1", "A1", "A#1", "B1",
    "C2", "C#2", "D2", "D#2", "E2", "F2", "F#2", "G2", "G#2", "A2", "A#2", "B2",
    "C3", "C#3", "D3", "D#3", "E3", "F3", "F#3", "G3", "G#3", "A3", "A#3", "B3",
    "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
    "C5", "C#5", "D5", "D#5", "E5", "F5", "F#5", "G5", "G#5", "A5", "A#5", "B5",
    "C6", "C#6", "D6", "D#6", "E6", "F6", "F#6", "G6", "G#6", "A6", "A#6", "B6",
    "C7", "C#7", "D7", "D#7", "E7", "F7", "F#7", "G7", "G#7", "A7", "A#7", "B7",
    "C8"
];

const toneRangeMinInput = document.getElementById('tone-range-min');
const toneRangeMaxInput = document.getElementById('tone-range-max');
const toneRangeDisplay = document.getElementById('tone-range-display');
const cNoteStepIndices = tab.reduce((acc, note, idx) => {
    if (note && note[0] === 'C' && note[1] !== '#') acc.push(idx);
    return acc;
}, []);

let playableNoteRange = { minIndex: 0, maxIndex: tab.length - 1 };
let rangeInitialized = false;
let pendingRangeUpdateHandle = null;

let lastPattern = { los: null, base: 0, offsets: [0] };
let currentInstrument = DEFAULT_INSTRUMENT;
let sampler = null;
let samplerLoaded = false;
let pendingSamplerLoad = null;
let samplerState = { instrument: null, loadedNotes: new Set() };
let samplerLoadToken = 0;


async function ensureToneReady() {
    if (isToneStarted) return;
    await Tone.start();
    isToneStarted = true;
}


function rangeSignature(range) {
    return `${range.minIndex}:${range.maxIndex}`;
}

function ensureSampleLibraryExt(ext = '.mp3') {
    if (typeof SampleLibrary === 'undefined' || !SampleLibrary) return;
    if (typeof SampleLibrary.setExt !== 'function') return;
    if (SampleLibrary.ext === ext) return;
    try {
        SampleLibrary.setExt(ext);
    } catch (err) {
        console.error('Failed to set SampleLibrary extension:', err);
    }
}

function getInstrumentSampleMap(instrument) {
    if (typeof SampleLibrary === 'undefined' || !SampleLibrary) return null;
    ensureSampleLibraryExt('.mp3');
    const map = SampleLibrary[instrument];
    if (!map) {
        console.warn(`SampleLibrary does not contain instrument: ${instrument}`);
        return null;
    }
    return map;
}

function captureSamplerStateSnapshot() {
    return {
        samplerInstance: sampler,
        instrument: currentInstrument,
        loaded: samplerLoaded,
        samplerStateInstrument: samplerState.instrument,
        loadedNotes: new Set(samplerState.loadedNotes || [])
    };
}

function restoreSamplerState(snapshot) {
    if (!snapshot) return;
    sampler = snapshot.samplerInstance;
    currentInstrument = snapshot.instrument;
    samplerLoaded = snapshot.loaded;
    samplerState = {
        instrument: snapshot.samplerStateInstrument || null,
        loadedNotes: new Set(snapshot.loadedNotes || [])
    };
}

function normalizeRange(range) {
    const fallbackMinIndex = findNoteIndex(DEFAULT_RANGE.minNote);
    const fallbackMaxIndex = findNoteIndex(DEFAULT_RANGE.maxNote);

    let minIndex;
    let maxIndex;

    if (range && typeof range.minIndex === 'number') {
        minIndex = clampIndex(range.minIndex);
    } else if (range && range.minNote) {
        const idx = findNoteIndex(range.minNote);
        minIndex = idx >= 0 ? idx : clampIndex(fallbackMinIndex >= 0 ? fallbackMinIndex : 0);
    } else if (typeof playableNoteRange?.minIndex === 'number') {
        minIndex = clampIndex(playableNoteRange.minIndex);
    } else {
        minIndex = clampIndex(fallbackMinIndex >= 0 ? fallbackMinIndex : 0);
    }

    if (range && typeof range.maxIndex === 'number') {
        maxIndex = clampIndex(range.maxIndex);
    } else if (range && range.maxNote) {
        const idx = findNoteIndex(range.maxNote);
        maxIndex = idx >= 0 ? idx : clampIndex(fallbackMaxIndex >= 0 ? fallbackMaxIndex : tab.length - 1);
    } else if (typeof playableNoteRange?.maxIndex === 'number') {
        maxIndex = clampIndex(playableNoteRange.maxIndex);
    } else {
        maxIndex = clampIndex(fallbackMaxIndex >= 0 ? fallbackMaxIndex : tab.length - 1);
    }

    if (minIndex > maxIndex) {
        const tmp = minIndex;
        minIndex = maxIndex;
        maxIndex = tmp;
    }

    const minNote = formatNoteLabel(minIndex);
    const maxNote = formatNoteLabel(maxIndex);

    return { minNote, maxNote, minIndex, maxIndex };
}

function getCurrentRangeBounds() {
    return normalizeRange({
        minIndex: playableNoteRange ? playableNoteRange.minIndex : undefined,
        maxIndex: playableNoteRange ? playableNoteRange.maxIndex : undefined
    });
}

function computeRequiredSamples(instrument, range) {
    const instrumentMap = getInstrumentSampleMap(instrument);
    if (!instrumentMap) {
        return { urls: {}, notes: new Set() };
    }

    const entries = Object.entries(instrumentMap)
        .map(([note, file]) => ({ note, file, index: findNoteIndex(note) }))
        .filter(item => item.index >= 0)
        .sort((a, b) => a.index - b.index);

    if (!entries.length) {
        return { urls: {}, notes: new Set() };
    }

    const { minIndex, maxIndex } = range;
    const selected = [];
    let lowerNeighbor = null;
    let upperNeighbor = null;

    for (const entry of entries) {
        if (entry.index <= minIndex) {
            lowerNeighbor = entry;
        }
        if (entry.index >= minIndex && entry.index <= maxIndex) {
            selected.push(entry);
        }
        if (!upperNeighbor && entry.index >= maxIndex) {
            upperNeighbor = entry;
        }
    }

    if (!selected.length) {
        if (lowerNeighbor) selected.push(lowerNeighbor);
        if (upperNeighbor && (!lowerNeighbor || upperNeighbor.note !== lowerNeighbor.note)) {
            selected.push(upperNeighbor);
        }
    } else {
        if (lowerNeighbor && lowerNeighbor.index < selected[0].index) {
            selected.unshift(lowerNeighbor);
        }
        if (upperNeighbor && upperNeighbor.index > selected[selected.length - 1].index) {
            selected.push(upperNeighbor);
        }
    }

    if (!selected.length && entries.length) {
        selected.push(entries[0]);
    }

    const urls = {};
    const noteSet = new Set();

    selected.forEach(({ note, file }) => {
        if (!urls[note]) {
            urls[note] = file;
            noteSet.add(note);
        }
    });

    return { urls, notes: noteSet };
}

function createSamplerWithUrls(token, instrument, urls, normalizedRange, previousState) {
    const urlKeys = Object.keys(urls || {});
    if (!urlKeys.length) {
        return Promise.reject(new Error(`Brak próbek do załadowania dla instrumentu ${instrument}`));
    }

    samplerLoaded = false;

    const promise = new Promise((resolve, reject) => {
        let samplerInstance = null;
        try {
            samplerInstance = new Tone.Sampler({
                urls,
                release: 5,
                baseUrl: `${toneSampleBaseUrl}${instrument}/`,
                onload: () => {
                    try {
                        if (token !== samplerLoadToken) {
                            samplerInstance.dispose?.();
                            resolve();
                            return;
                        }

                        samplerInstance.toDestination?.();

                        if (sampler && sampler !== samplerInstance) {
                            try { sampler.dispose(); } catch (err) { console.warn('Previous sampler dispose failed', err); }
                        }

                        sampler = samplerInstance;
                        currentInstrument = instrument;
                        samplerLoaded = true;
                        samplerState = {
                            instrument,
                            loadedNotes: new Set(urlKeys)
                        };
                        resolve();
                    } catch (err) {
                        samplerInstance.dispose?.();
                        if (token === samplerLoadToken) {
                            restoreSamplerState(previousState);
                        }
                        reject(err);
                    }
                },
                onerror: (err) => {
                    samplerInstance?.dispose?.();
                    if (token === samplerLoadToken) {
                        restoreSamplerState(previousState);
                    }
                    reject(err);
                }
            });
        } catch (err) {
            samplerInstance?.dispose?.();
            restoreSamplerState(previousState);
            reject(err);
        }
    });

    pendingSamplerLoad = {
        token,
        instrument,
        signature: rangeSignature(normalizedRange),
        promise
    };

    return promise.finally(() => {
        if (pendingSamplerLoad && pendingSamplerLoad.token === token) {
            pendingSamplerLoad = null;
        }
    });
}

function addSamplesToSampler(token, instrument, urls, notesToAdd, normalizedRange, previousState) {
    if (!notesToAdd.length) {
        if (token === samplerLoadToken) {
            samplerLoaded = true;
            currentInstrument = instrument;
        }
        return Promise.resolve();
    }

    const samplerInstance = sampler;
    if (!samplerInstance) {
        return createSamplerWithUrls(token, instrument, urls, normalizedRange, previousState);
    }

    if (typeof Tone === 'undefined' || !Tone || !Tone.ToneAudioBuffer) {
        return createSamplerWithUrls(token, instrument, urls, normalizedRange, previousState);
    }

    const tasks = notesToAdd.map((note) => {
        const fileName = urls[note];
        if (!fileName) {
            return Promise.resolve();
        }
        const fullUrl = `${toneSampleBaseUrl}${instrument}/${fileName}`;

        return new Promise((resolve, reject) => {
            const buffer = new Tone.ToneAudioBuffer(fullUrl, () => {
                if (token !== samplerLoadToken || sampler !== samplerInstance || samplerState.instrument !== instrument) {
                    buffer.dispose();
                    resolve();
                    return;
                }
                try {
                    samplerInstance.add(note, buffer);
                    samplerState.loadedNotes.add(note);
                    resolve();
                } catch (err) {
                    buffer.dispose();
                    reject(err);
                }
            }, (err) => {
                buffer.dispose();
                if (token === samplerLoadToken) {
                    restoreSamplerState(previousState);
                }
                reject(err || new Error(`Nie udało się załadować próbki ${note}`));
            });
        });
    });

    const promise = Promise.all(tasks).then(() => {
        if (token === samplerLoadToken && sampler === samplerInstance) {
            samplerLoaded = true;
            currentInstrument = instrument;
        }
    }).catch((err) => {
        if (token === samplerLoadToken) {
            restoreSamplerState(previousState);
        }
        throw err;
    });

    pendingSamplerLoad = {
        token,
        instrument,
        signature: rangeSignature(normalizedRange),
        promise
    };

    return promise.finally(() => {
        if (pendingSamplerLoad && pendingSamplerLoad.token === token) {
            pendingSamplerLoad = null;
        }
    });
}


function loadSampler(instrument, rangeOverride) {
    const token = ++samplerLoadToken;
 
    const resolvedInstrument = resolveInstrumentChoice(instrument);
    const targetInstrument = resolvedInstrument || currentInstrument || DEFAULT_INSTRUMENT;
    const normalizedRange = normalizeRange(rangeOverride || getCurrentRangeBounds());
    const previousState = captureSamplerStateSnapshot();

    if (pendingSamplerLoad && pendingSamplerLoad.token !== undefined) {
        if (pendingSamplerLoad.signature === rangeSignature(normalizedRange) && pendingSamplerLoad.instrument === targetInstrument) {
            return pendingSamplerLoad.promise;
        }
    }

    const { urls, notes } = computeRequiredSamples(targetInstrument, normalizedRange);

    const isSameInstrument = sampler && samplerState.instrument === targetInstrument;
    const missingNotes = isSameInstrument ? Array.from(notes).filter(note => !samplerState.loadedNotes.has(note)) : Array.from(notes);

    if (isSameInstrument && missingNotes.length === 0) {
        currentInstrument = targetInstrument;
        samplerLoaded = true;
        return Promise.resolve();
    }

    if (!sampler || !isSameInstrument) {
        return createSamplerWithUrls(token, targetInstrument, urls, normalizedRange, previousState);
    }

    return addSamplesToSampler(token, targetInstrument, urls, missingNotes, normalizedRange, previousState);
}

function setupInstrumentSelect() {
    const externalSelect = document.getElementById('instrument');
    if (!externalSelect) return;

    try { externalSelect.value = currentInstrument; } catch (e) {}

    externalSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        loadSampler(value).catch((err) => {
            console.error('Instrument load failed:', err);
        });
    });
}
setupInstrumentSelect();
setupToneRangeControls();


const exerciseDefinitions = {
    // 🎵 INTERWAŁY
    "1": [0, 0],
    "2>": [0, 1],
    "2": [0, 2],
    "3>": [0, 3],
    "3": [0, 4],
    "4": [0, 5],
    "4<": [0, 6],
    "5": [0, 7],
    "6>": [0, 8],
    "6": [0, 9],
    "7": [0, 10],
    "7<": [0, 11],
    "8": [0, 12],

    //interwały złozone
    "9>": [0, 13],
    "9": [0, 14],
    "10>": [0, 15],
    "10": [0, 16],
    "11": [0, 17],
    "11<": [0, 18],
    "12": [0, 19],
    "13>": [0, 20],
    "13": [0, 21],
    "14": [0, 22],
    "14<": [0, 23],
    "15": [0, 24],

    // trojdzwieki
    "+": [0, 4, 7],
    "+3": [0, 3, 8],
    "+5": [0, 5, 9],
    "o": [0, 3, 7],
    "o3": [0, 4, 9],
    "o5": [0, 5, 8],
    ">": [0, 3, 6],
    ">3": [0, 3, 9],
    ">5": [0, 6, 9],
    "<": [0, 4, 8],

    // akordy d7
    "D7": [0, 4, 7, 10],
    "D7/3": [0, 3, 6, 8],
    "D7/5": [0, 3, 5, 9],
    "D7/7": [0, 2, 6, 9],

    //akordy d9
    "D9": [0, 4, 7, 10, 14],
    "D9b": [0, 4, 7, 10, 13],

    //gamy
    "dur": [0, 2, 4, 5, 7, 9, 11, 12, 12, 11, 9, 7, 5, 4, 2, 0],
    "moll_naturalna": [0, 2, 3, 5, 7, 8, 10, 12, 12, 10, 8, 7, 5, 3, 2, 0],

    "moll_harmoniczna": [0, 2, 3, 5, 7, 8, 11, 12, 12, 11, 8, 7, 5, 3, 2, 0],
    "moll_melodyczna": [0, 2, 3, 5, 7, 9, 11, 12, 12, 10, 8, 7, 5, 3, 2, 0],
    "moll_dorycka": [0, 2, 3, 5, 7, 9, 10, 12, 12, 10, 9, 7, 5, 3, 2, 0],

    // skale
    "jońska": [0, 2, 4, 5, 7, 9, 11, 12, 12, 11, 9, 7, 5, 4, 2, 0],
    "dorycka": [0, 2, 3, 5, 7, 9, 10, 12, 12, 10, 9, 7, 5, 3, 2, 0],
    "frygijska": [0, 1, 3, 5, 7, 8, 10, 12, 12, 10, 8, 7, 5, 3, 1, 0],
    "lidyjska": [0, 2, 4, 6, 7, 9, 11, 12, 12, 11, 9, 7, 6, 4, 2, 0],
    "miksolidyjska": [0, 2, 4, 5, 7, 9, 10, 12, 12, 10, 9, 7, 5, 4, 2, 0],
    "eolska": [0, 2, 3, 5, 7, 8, 10, 12, 12, 10, 8, 7, 5, 3, 2, 0],
    "lokrycka": [0, 1, 3, 5, 6, 8, 10, 12, 12, 10, 8, 6, 5, 3, 1, 0],
    "góralska": [0, 2, 4, 5, 7, 9, 10, 12, 12, 10, 9, 7, 5, 4, 2, 0]
};


const exerciseIdToKey = {
    1: "1",
    2: "2>",
    3: "2",
    4: "3>",
    5: "3",
    6: "4",
    7: "4<",
    8: "5",
    9: "6>",
    10: "6",
    11: "7",
    12: "7<",
    13: "8",
    14: "9>",
    15: "9",
    16: "10>",
    17: "10",
    18: "11",
    19: "11<",
    20: "12",
    21: "13>",
    22: "13",
    23: "14",
    24: "14<",
    25: "15",

    26: "+",
    27: "+3",
    28: "+5",
    29: "o",
    30: "o3",
    31: "o5",
    32: ">",
    33: ">3",
    34: ">5",
    35: "<",

    36: "D7",
    37: "D7/3",
    38: "D7/5",
    39: "D7/7",

    40: "D9",
    41: "D9b",

    42: "dur",
    43: "moll_naturalna",

    44: "moll_harmoniczna",
    45: "moll_melodyczna",
    46: "moll_dorycka",

    47: "jońska",
    48: "dorycka",
    49: "frygijska",
    50: "lidyjska",
    51: "miksolidyjska",
    52: "eolska",
    53: "lokrycka",
    54: "góralska"
};

function getExercisePatternById(id) {
    if (!id) return [0];
    const key = exerciseIdToKey[id];
    if (key && exerciseDefinitions[key]) return exerciseDefinitions[key];
    console.warn('Unknown exercise id or missing definition for id', id);
    return [0];
}


const _scaleKeys = new Set([
    "dur", "moll_naturalna", "moll_harmoniczna", "moll_melodyczna", "moll_dorycka",
    "jońska", "dorycka", "frygijska", "lidyjska", "miksolidyjska",
    "eolska", "lokrycka", "góralska"
]);

function clampIndex(i) {
    if (i < 0) return 0;
    if (i > tab.length - 1) return tab.length - 1;
    return i;
}

function findNoteIndex(noteName) {
    if (!noteName) return -1;
    return tab.indexOf(String(noteName).toUpperCase());
}

function formatNoteLabel(index) {
    const safeIndex = clampIndex(index);
    return tab[safeIndex];
}

function updateRangeFill() {
    if (!toneRangeMinInput || !toneRangeMaxInput) return;

    const minStep = Number(toneRangeMinInput.value);
    const maxStep = Number(toneRangeMaxInput.value);

    const trackStyleId = 'tone-range-track-style';
    let styleEl = document.getElementById(trackStyleId);
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = trackStyleId;
        document.head.appendChild(styleEl);
    }

    const maxStepIndex = Math.max(1, cNoteStepIndices.length - 1);
    const minPercent = (minStep / maxStepIndex) * 100;
    const maxPercent = (maxStep / maxStepIndex) * 100;

    const gradient = `linear-gradient(90deg, transparent ${minPercent}%, rgba(0, 123, 255, 0.4) ${minPercent}%, rgba(0, 123, 255, 0.4) ${maxPercent}%, transparent ${maxPercent}%)`;

    styleEl.textContent = `
        #tone-range-min::-webkit-slider-runnable-track,
        #tone-range-max::-webkit-slider-runnable-track {
            background-image: ${gradient};
        }

        #tone-range-min::-moz-range-track,
        #tone-range-max::-moz-range-track {
            background-image: ${gradient};
        }
    `;
}

function updateRangeState(minIndex, maxIndex) {
    playableNoteRange = {
        minIndex: clampIndex(minIndex),
        maxIndex: clampIndex(Math.max(minIndex, maxIndex))
    };

    if (toneRangeDisplay) {
        toneRangeDisplay.textContent = `${formatNoteLabel(playableNoteRange.minIndex)} - ${formatNoteLabel(playableNoteRange.maxIndex)}`;
    }

    updateRangeFill();

    if (rangeInitialized) {
        requestSamplerRangeUpdate();
    }
}

function requestSamplerRangeUpdate(immediate = false) {
    if (!rangeInitialized) return;

    if (pendingRangeUpdateHandle) {
        clearTimeout(pendingRangeUpdateHandle);
        pendingRangeUpdateHandle = null;
    }

    const instrumentToUse = pendingSamplerLoad && pendingSamplerLoad.instrument ? pendingSamplerLoad.instrument : currentInstrument;

    if (immediate) {
        loadSampler(instrumentToUse);
        return;
    }

    pendingRangeUpdateHandle = setTimeout(() => {
        pendingRangeUpdateHandle = null;
        loadSampler(instrumentToUse);
    }, RANGE_UPDATE_DEBOUNCE_MS);
}

function setupToneRangeControls() {
    if (!toneRangeMinInput || !toneRangeMaxInput) {
        const fallbackMin = findNoteIndex(DEFAULT_RANGE.minNote);
        const fallbackMax = findNoteIndex(DEFAULT_RANGE.maxNote);
        const safeMin = fallbackMin >= 0 ? fallbackMin : 0;
        const safeMax = fallbackMax >= 0 ? fallbackMax : tab.length - 1;
        updateRangeState(safeMin, safeMax);
        rangeInitialized = true;
        requestSamplerRangeUpdate(true);
        return;
    }

    const stepsCount = cNoteStepIndices.length;
    if (stepsCount < MIN_RANGE_STEPS + 1) {
        const fallbackMin = findNoteIndex(DEFAULT_RANGE.minNote);
        const fallbackMax = findNoteIndex(DEFAULT_RANGE.maxNote);
        const safeMin = fallbackMin >= 0 ? fallbackMin : 0;
        const safeMax = fallbackMax >= 0 ? fallbackMax : tab.length - 1;
        updateRangeState(safeMin, safeMax);
        rangeInitialized = true;
        requestSamplerRangeUpdate(true);
        return;
    }

    const maxStepIndex = stepsCount - 1;
    const clampStep = (value) => {
        if (Number.isNaN(value)) return 0;
        if (value < 0) return 0;
        if (value > maxStepIndex) return maxStepIndex;
        return value;
    };
    const stepToIndex = (step) => {
        const clamped = clampStep(step);
        return cNoteStepIndices[clamped] ?? 0;
    };

    const defaultMinIndex = findNoteIndex(DEFAULT_RANGE.minNote);
    const defaultMaxIndex = findNoteIndex(DEFAULT_RANGE.maxNote);

    let initialMinStep = defaultMinIndex >= 0 ? cNoteStepIndices.indexOf(defaultMinIndex) : 0;
    if (initialMinStep < 0) initialMinStep = 0;
    let initialMaxStep = defaultMaxIndex >= 0 ? cNoteStepIndices.indexOf(defaultMaxIndex) : initialMinStep + MIN_RANGE_STEPS;
    if (initialMaxStep < 0) initialMaxStep = initialMinStep + MIN_RANGE_STEPS;
    initialMaxStep = Math.min(Math.max(initialMaxStep, initialMinStep + MIN_RANGE_STEPS), maxStepIndex);

    toneRangeMinInput.min = '0';
    toneRangeMinInput.max = String(maxStepIndex);
    toneRangeMinInput.step = '1';
    toneRangeMinInput.value = String(clampStep(initialMinStep));

    toneRangeMaxInput.min = '0';
    toneRangeMaxInput.max = String(maxStepIndex);
    toneRangeMaxInput.step = '1';
    toneRangeMaxInput.value = String(clampStep(initialMaxStep));

    const enforceRange = (changed) => {
        let minHandleStep = clampStep(Number(toneRangeMinInput.value));
        let maxHandleStep = clampStep(Number(toneRangeMaxInput.value));

        if (maxHandleStep - minHandleStep < MIN_RANGE_STEPS) {
            if (changed === 'min') {
                minHandleStep = Math.max(0, maxHandleStep - MIN_RANGE_STEPS);
            } else if (changed === 'max') {
                maxHandleStep = Math.min(maxStepIndex, minHandleStep + MIN_RANGE_STEPS);
            } else {
                maxHandleStep = Math.min(maxStepIndex, minHandleStep + MIN_RANGE_STEPS);
            }
        }

        minHandleStep = clampStep(minHandleStep);
        maxHandleStep = clampStep(Math.max(maxHandleStep, minHandleStep + MIN_RANGE_STEPS));

        toneRangeMinInput.value = String(minHandleStep);
        toneRangeMaxInput.value = String(maxHandleStep);

        updateRangeState(stepToIndex(minHandleStep), stepToIndex(maxHandleStep));
    };

    toneRangeMinInput.addEventListener('input', () => enforceRange('min'));
    toneRangeMaxInput.addEventListener('input', () => enforceRange('max'));

    enforceRange();
    rangeInitialized = true;
    requestSamplerRangeUpdate(true);
}

function randomBetween(min, max) {
    if (min >= max) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function playPattern(baseIndex, offsets, opts) {
    if (!sampler) return;
    if (!samplerLoaded) {
        setTimeout(() => { try { playPattern(baseIndex, offsets, opts); } catch (e) {} }, 150);
        return;
    }
    opts = opts || {};
    const cleanOffsets = offsets.slice();
    const notes = cleanOffsets.map(function (off) {
        const idx = clampIndex(baseIndex + off);
        return tab[idx];
    }).filter(Boolean);

    let mode = opts.mode !== undefined ? opts.mode : (document.getElementById('trybgrania') ? document.getElementById('trybgrania').value : 'melodycznie_gora');

    if (mode === 'losowo') {
        const modes = ['melodycznie_gora', 'melodycznie_dol', 'harmonicznie'];
        mode = modes[Math.floor(Math.random() * modes.length)];
    }
    

    const perNoteMs = opts.duration !== undefined ? Math.max(50, Number(opts.duration)) : Math.max(50, Number(czastrwania));
    const patternKey = opts.patternKey || (game.currentExerciseId ? exerciseIdToKey[game.currentExerciseId] : undefined) || lastPattern.patternKey;


    let effectiveMode = mode;
    if (_scaleKeys.has(patternKey)) {
        effectiveMode = 'melodycznie_gora';
    }

    if (effectiveMode === 'melodycznie_gora' || effectiveMode === 'melodycznie_dol') {
        const perSec = perNoteMs / 1000;
        let seq = notes.slice();
        if (effectiveMode === 'melodycznie_dol') seq = seq.slice().reverse();
        for (let i = 0; i < seq.length; i++) {
            const note = seq[i];
            const dur = perSec;
            const time = Tone.now() + i * perSec;
            if (sampler.triggerAttackRelease) {
                sampler.triggerAttackRelease(note, dur, time);
            } else {
                setTimeout((n) => { try { sampler.triggerAttack([n]); } catch (e) {} }, i * perNoteMs, note);
                setTimeout((n) => { try { sampler.triggerRelease([n]); } catch (e) {} }, i * perNoteMs + perNoteMs, note);
            }
        }
    } else {

        if (sampler.triggerAttack) {
            sampler.triggerAttack(notes);
            setTimeout(() => { try { sampler.triggerRelease(notes); } catch (e) {} }, perNoteMs);
        }
    }

    const totalUsedMs = (effectiveMode === 'melodycznie_gora' || effectiveMode === 'melodycznie_dol')
        ? perNoteMs * notes.length
        : perNoteMs;

    lastPattern = {
        los: game.currentExerciseId,
        base: baseIndex,
        offsets: offsets,
    selectedDuration: perNoteMs,
    duration: totalUsedMs,
        mode: effectiveMode,
        instrument: opts.instrument || currentInstrument,
        patternKey: patternKey,
        range: {
            minIndex: playableNoteRange.minIndex,
            maxIndex: playableNoteRange.maxIndex
        }
    };
}

function getSelectedDurationMs() {
    const sel = document.getElementById('czastrwania');
    if (!sel) return czastrwania;
    const v = sel.value;
    if (v === 'losowo') {

        const choices = Array.from(sel.options)
            .map(opt => Number(opt.value))
            .filter(val => !isNaN(val) && val > 0);
        if (choices.length === 0) return czastrwania;
        return choices[Math.floor(Math.random() * choices.length)];
    }
    return Number(v) || czastrwania;
}

function getSelectedInstrument() {
    const sel = document.getElementById('instrument');
    if (!sel) return currentInstrument;
    const v = sel.value;
    if (v === 'losowo') {
        const choices = Array.from(sel.options)
            .map(opt => opt.value)
            .filter(val => val !== 'losowo' && val !== '');
        return choices[Math.floor(Math.random() * choices.length)];
    }
    return v || currentInstrument;
}


function resolveInstrumentChoice(instr) {
    if (!instr) return instr;
    if (instr === 'losowo') {

        try {
            if (typeof SampleLibrary !== 'undefined' && SampleLibrary && typeof SampleLibrary === 'object') {
                const libChoices = Object.keys(SampleLibrary).filter(k => k && k !== 'losowo');
                if (libChoices.length > 0) {
                    return libChoices[Math.floor(Math.random() * libChoices.length)];
                }
            }
        } catch (e) {

        }


        const sel = document.getElementById('instrument');
        if (!sel) return currentInstrument || DEFAULT_INSTRUMENT;
        const choices = Array.from(sel.options)
            .map(opt => opt.value)
            .filter(v => v && v !== 'losowo');
        if (choices.length === 0) return currentInstrument || DEFAULT_INSTRUMENT;
        return choices[Math.floor(Math.random() * choices.length)];
    }
    return instr;
}

function getSelectedMode() {
    const sel = document.getElementById('trybgrania');
    if (!sel) return 'melodycznie_gora';

    return sel.value; 
}



function rozpocznijNowaRunde() {
    const wybrane = Array.from(game.selectedExercises);
    if (wybrane.length === 0) {
        showInfoModal(t('cwiczenia.messages.allCompleted'));
        setMenuButtonsDisabled(false); 
        if(stopGameBtn) stopGameBtn.click();
        return;
    }
    game.currentExerciseId = wybrane[Math.floor(Math.random() * wybrane.length)];

    game.isSoundPlaying = true;
    powtorzButton.disabled = true; 
    if (stopGameBtn) stopGameBtn.disabled = false;  

    const allButtons = gameButtonsContainer.querySelectorAll('.przycisk-odpowiedzi');
    allButtons.forEach(btn => btn.disabled = false);

    const pattern = getExercisePatternById(game.currentExerciseId);
    const selectedDuration = getSelectedDurationMs();
    
    const maxOffset = Math.max.apply(null, pattern);
    let minBase = playableNoteRange.minIndex;
    let maxBase = playableNoteRange.maxIndex - maxOffset;

    if (maxBase < minBase) {
        minBase = 0;
        maxBase = tab.length - 1 - maxOffset;
    }

    const baseIndex = clampIndex(randomBetween(minBase, Math.max(minBase, maxBase)));
    let roundInstrument = game.pendingInstrument;
    if (roundInstrument) {
        game.pendingInstrument = null;
    } else {
        roundInstrument = getSelectedInstrument();
    }
    if (!roundInstrument) {
        roundInstrument = currentInstrument;
    }

    const mode = getSelectedMode();
    const patternKey = exerciseIdToKey[game.currentExerciseId];
    const isScale = _scaleKeys.has(patternKey);


    const basePerNoteMs = Math.max(50, Number(selectedDuration));


    let perNoteMs = basePerNoteMs;
    if (isScale) {
        perNoteMs = Math.max(50, Math.round(basePerNoteMs * SCALE_TEMPO_ADJUSTMENT_FACTOR));
    }


    let effectiveMode = mode;
    if (isScale) {
        effectiveMode = 'melodycznie_gora';
    } else if (mode === 'losowo') {
        const modes = ['melodycznie_gora', 'melodycznie_dol', 'harmonicznie'];
        effectiveMode = modes[Math.floor(Math.random() * modes.length)];
    }


    const totalUsedMs = (effectiveMode === 'melodycznie_gora' || effectiveMode === 'melodycznie_dol')
        ? perNoteMs * Math.max(1, pattern.length)
        : perNoteMs;



    const playOpts = {
        duration: perNoteMs,
        mode: effectiveMode,
        instrument: roundInstrument,
        patternKey
    };

    const samplerLoadPromise = loadSampler(playOpts.instrument);
    const playFn = () => playPattern(baseIndex, pattern, playOpts);

    samplerLoadPromise.then(playFn).catch((err) => {
        console.error('Playback fallback due to sampler load error:', err);
        playFn();
    });


    setTimeout(() => {
        game.isSoundPlaying = false;
        powtorzButton.disabled = false;
    }, totalUsedMs);
}


powtorzButton.onclick = function () {
    if (game.isSoundPlaying || game.status !== 'playing' || powtorzButton.disabled) return;
    if (!lastPattern || lastPattern.los == null) return;

    game.isSoundPlaying = true;
    powtorzButton.disabled = true; 

    const neededInstrument = lastPattern.instrument || currentInstrument;
    

    const playOpts = { 
        duration: (lastPattern.selectedDuration !== undefined ? lastPattern.selectedDuration : 2000), 
        mode: lastPattern.mode, 
        instrument: neededInstrument, 
        patternKey: lastPattern.patternKey 
    };

    let promise = null;
    if (neededInstrument && neededInstrument !== currentInstrument) {
        promise = loadSampler(neededInstrument, lastPattern.range);
    } else if (lastPattern.range) {
        promise = loadSampler(currentInstrument, lastPattern.range);
    }

    const playFn = () => playPattern(lastPattern.base, lastPattern.offsets, playOpts);

    if (promise) {
        promise.then(playFn).catch((err) => {
            console.error('Replay fallback due to sampler load error:', err);
            playFn();
        });
    } else {
        playFn();
    }


    setTimeout(() => {
        game.isSoundPlaying = false;
        powtorzButton.disabled = false; 
    }, (lastPattern.duration || czastrwania));
};


async function wybierz(id) {
    if (game.isSoundPlaying || game.status !== 'playing') {
        return;
    }

    game.isSoundPlaying = true;
    powtorzButton.disabled = true;

    const allButtons = gameButtonsContainer.querySelectorAll('.przycisk-odpowiedzi');
    allButtons.forEach(btn => btn.disabled = true);

    const isCorrect = (game.currentExerciseId == id);

    const clickedElement = gameButtonsContainer.querySelector(`.przycisk-odpowiedzi[data-id="${id}"]`);
    const correctElement = gameButtonsContainer.querySelector(`.przycisk-odpowiedzi[data-id="${game.currentExerciseId}"]`);

    if (isCorrect) {
        game.score.good++;
        document.querySelector("#ilosc-dobrze .score-value").textContent = game.score.good;

        if (clickedElement) {
            clickedElement.classList.add('correct-flash');
        }

        await sleep(1000); 
        
        if (clickedElement) {
            clickedElement.classList.remove('correct-flash');
        }

    } else {
        game.score.bad++;
        document.querySelector("#ilosc-zle .score-value").textContent = game.score.bad;

        if (clickedElement) {
            clickedElement.classList.add('incorrect-flash');
        }

        await sleep(1200); 
        
        if (clickedElement) {
            clickedElement.classList.remove('incorrect-flash');
        }

        if (correctElement) {
            correctElement.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "nearest"
            });

            await sleep(500); 
        }

        if (correctElement) {
            correctElement.classList.add('reveal-glow');
        }

        await sleep(1400);

        if (correctElement) {
            correctElement.classList.remove('reveal-glow');
        }
    }

    rozpocznijNowaRunde();
}

// Theme toggle
const themeToggleBtn = document.getElementById('theme-toggle-btn');

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    }
}

if (themeToggleBtn) {
    themeToggleBtn.onclick = function() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    };
}


applySavedTheme();
updateUI();