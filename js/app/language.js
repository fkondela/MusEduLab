
(function () {
    const FALLBACK_LANGUAGE = "en";
    const STORAGE_KEY = 'i18n.lang';

    const translations = {
        en: {
            common: {
                brand: "MusEduLab",
                nav: {
                    languageToggle: "Polski",
                    languageToggleShort: "PL",
                    languageToggleTitle: "Switch to Polish",
                    languageToggleAria: "Switch language to Polish",
                    homeTitle: "Go to home page"
                },
                buttons: {
                    repeat: "Repeat",
                    next: "Next",
                    start: "Start",
                    check: "Check",
                    loading: "Loading...",
                    tryAgain: "Try again"
                },
                modal: {
                    resultTitle: "Result",
                    infoTitle: "Information",
                    bodyPlaceholder: "Content..."
                },
                generic: {
                    random: "Random"
                },
                instruments: {
                    piano: "Piano",
                    guitarAcoustic: "Acoustic guitar",
                    guitarElectric: "Electric guitar",
                    guitarNylon: "Classical guitar",
                    violin: "Violin",
                    cello: "Cello",
                    flute: "Flute",
                    trumpet: "Trumpet",
                    saxophone: "Saxophone",
                    organ: "Organ",
                    harmonium: "Harmonium",
                    bassElectric: "Electric bass",
                    bassoon: "Bassoon",
                    clarinet: "Clarinet",
                    contrabass: "Double bass",
                    frenchHorn: "French horn",
                    harp: "Harp",
                    trombone: "Trombone",
                    tuba: "Tuba",
                    xylophone: "Xylophone"
                }
            },
                index: {
                    title: "MusEduLab - Home",
                    metaDescription: "Interactive ear training and dictation exercises online. Practice intervals, chords, scales, and create custom dictations with meter, tempo, and instrument choices.",
                    hero: {
                        heading: "Train your musical ear",
                        subtitle: "Interactive online exercises and dictations for music students.",
                        ctaExercises: "Start exercises",
                        ctaDictations: "Try dictations"
                    },
                    about: {
                        heading: "What is this project?",
                        body: "Learn music through practice! Our system helps you refine your musical ear, recognise intervals, triads, dominant sevenths and ninths, and improve your dictation skills."
                    },
                    features: {
                        heading: "Choose your learning mode",
                        exercise: {
                            title: "Interactive exercises",
                            desc: "Focus on single elements. Practice intervals, triads, dominants, scales, and modes at your own pace."
                        },
                        dictation: {
                            title: "Dictation generator",
                            desc: "Put your skills to the test. Choose meter, tempo, and instrument, then write down the melodies you hear."
                        }
                    },
                    practice: {
                        heading: "What's included in the exercises?",
                        intro: "Our exercises help you recognise intervals, triads, dominant sevenths and ninths, scales and modes. Choose what you want to practise and press start.",
                        card1: {
                            title: "Harmonic or melodic",
                            desc: "Decide whether notes are played together or one after another."
                        },
                        card2: {
                            title: "Advanced settings",
                            desc: "Choose instrument and pitch range to suit your needs."
                        },
                        card3: {
                            title: "Tempo control",
                            desc: "Adjust playback speed and instrument to match your needs."
                        },
                        card4: {
                            title: "Mixed mode",
                            desc: "Combine different exercises to add extra challenge."
                        },
                        cta: "Go to exercises"
                    },
                    dictation: {
                        heading: "What's included in the dictations?",
                        intro: "Choose the parameters and we'll prepare a dictation tailored to you. After checking, we'll suggest what to improve.",
                        card1: {
                            title: "Custom settings",
                            desc: "Adjust meter, tempo and dictation length to your level."
                        },
                        card2: {
                            title: "Keys and rhythm",
                            desc: "Generate rhythmic and melodic dictations in any key."
                        },
                        card3: {
                            title: "Instrument choice",
                            desc: "Listen to dictations on piano, guitar, violin and other instruments."
                        },
                        card4: {
                            title: "Advanced editing",
                            desc: "Make corrections, analyse mistakes and save your dictations."
                        },
                        cta: "Go to dictations"
                    }
                },
            cwiczenia: {
                title: "MusEduLab Exercises",
                score: {
                    correct: "Correct: ",
                    incorrect: "Incorrect: "
                },
                settings: {
                    heading: "Settings",
                    duration: "Tempo:",
                    durationOption: {
                        "2000": "Slow",
                        "1000": "Moderate",
                        "500": "Fast"
                    },
                    instrument: "Instrument:",
                    range: {
                        label: "Range:",
                        helper: "Adjust freely (min. two octaves). Handles will stay apart."
                    },
                    playMode: "Playback mode (not for scales/modes):",
                    playModeOption: {
                        ascending: "Melodic ascending",
                        descending: "Melodic descending",
                        harmonic: "Harmonic (together)"
                    }
                },
                selection: {
                    heading: "Select exercises",
                    category: {
                        intervals: "Intervals",
                        complexIntervals: "Extended intervals",
                        triads: "Triads",
                        dominant7: "Dominant seventh chords",
                        dominant9: "Dominant ninth chords",
                        gamy: "Scales",
                        scales: "Modes"
                    }
                },
                category: {
                    selectAll: "Select all",
                    clearAll: "Clear all"
                },
                messages: {
                    selectExercise: "Select at least one exercise first.",
                    allCompleted: "All selected exercises have been played. Pick new ones or start again."
                }
            },
            dyktanda: {
                title: "Music Dictation",
                selection: {
                    heading: "Choose dictation type",
                    melodic: {
                        title: "Melodic",
                        desc: "Practise reading melodic lines.",
                        option: "Melodic dictation"
                    },
                    rhythmic: {
                        title: "Rhythmic",
                        desc: "Focus on rhythm only, without pitch.",
                        option: "Rhythmic dictation"
                    }
                },
                settings: {
                    heading: "Settings",
                    meter: "Time signature:",
                    tempo: "Tempo (BPM):",
                    instrument: "Instrument:",
                    keyMode: "Key mode:",
                    keyModeOption: {
                        major: "Major",
                        minor: "Minor",
                        atonal: "Atonal"
                    },
                    length: "Dictation length:",
                    lengthOption: {
                        "2": "2 bars",
                        "4": "4 bars",
                        "8": "8 bars",
                        "16": "16 bars"
                    }
                },
                toolbar: {
                    dotted: "Dotted notes",
                    rest: "Rest mode",
                    eraser: "Eraser"
                }
            }
        }
    };


    const originalTextMap = Object.create(null);
    const originalAttrMap = Object.create(null);

    const collectOriginalStrings = () => {

        const textNodes = document.querySelectorAll('[data-i18n]');
        textNodes.forEach((node) => {
            const key = node.getAttribute('data-i18n');
            if (!key) return;
            const type = node.getAttribute('data-i18n-type');
            const value = type === 'html' ? node.innerHTML : node.textContent;
            originalTextMap[key] = value;
        });

        const attrNodes = document.querySelectorAll('[data-i18n-attr]');
        attrNodes.forEach((node) => {
            const mapping = node.getAttribute('data-i18n-attr');
            if (!mapping) return;
            mapping.split(',').forEach((pair) => {
                const parts = pair.split(':').map((p) => p.trim());
                if (parts.length !== 2) return;
                const [attr, key] = parts;
                try {
                    const val = node.getAttribute(attr);
                    if (val != null) originalAttrMap[key] = val;
                } catch (err) {

                }
            });
        });
    };


    try {
        if (translations && translations.pl) delete translations.pl;
    } catch (err) {

    }

    const listeners = new Set();
    let currentLanguage = FALLBACK_LANGUAGE;

    const resolveInitialLanguage = () => {
 
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && (translations[stored] || stored === 'pl' || stored === FALLBACK_LANGUAGE)) return stored;
        } catch (err) {

        }
        const langAttr = document.documentElement.getAttribute('lang');
        if (langAttr && (translations[langAttr] || langAttr === 'pl' || langAttr === FALLBACK_LANGUAGE)) {
            return langAttr;
        }
        return FALLBACK_LANGUAGE;
    };

    const getValue = (source, path) => {
        if (!source || !path) return undefined;
        return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), source);
    };

    const translateInternal = (language, key) => {
        const langMap = translations[language];
        const fallbackMap = translations[FALLBACK_LANGUAGE];

        if (langMap) {
            const lv = getValue(langMap, key);
            if (lv !== undefined && lv !== null) return lv;
        }

        if (originalTextMap && Object.prototype.hasOwnProperty.call(originalTextMap, key)) return originalTextMap[key];
        if (originalAttrMap && Object.prototype.hasOwnProperty.call(originalAttrMap, key)) return originalAttrMap[key];

        if (fallbackMap) {
            const fv = getValue(fallbackMap, key);
            if (fv !== undefined && fv !== null) return fv;
        }
        return key;
    };

    const applyTranslations = (language) => {
    
        document.documentElement.setAttribute('lang', language);

        const textNodes = document.querySelectorAll('[data-i18n]');
        textNodes.forEach((node) => {
            const key = node.getAttribute('data-i18n');
            if (!key) return;
            const type = node.getAttribute('data-i18n-type');
            const value = translateInternal(language, key);
            if (value === undefined || value === null) return;
            if (type === 'html') {
                node.innerHTML = value;
            } else {
                node.textContent = value;
            }
        });

        const attrNodes = document.querySelectorAll('[data-i18n-attr]');
        attrNodes.forEach((node) => {
            const mapping = node.getAttribute('data-i18n-attr');
            if (!mapping) return;
            mapping.split(',').forEach((pair) => {
                const [attr, key] = pair.split(':').map((part) => part.trim());
                if (!attr || !key) return;
                const value = translateInternal(language, key);
                if (value === undefined || value === null) return;
                node.setAttribute(attr, value);
            });
        });
    };

    const notifyListeners = () => {
        listeners.forEach((listener) => {
            try {
                listener(currentLanguage);
            } catch (err) {
                console.error('Language change listener error', err);
            }
        });
    };

    const setLanguage = (language) => {
        currentLanguage = language;
        applyTranslations(language);
        notifyListeners();
    };


    const persistLanguage = (language) => {
        try {
            localStorage.setItem(STORAGE_KEY, language);
        } catch (err) {
 
        }
    };

   
    const setLanguageWithPersist = (language) => {
        persistLanguage(language);
        setLanguage(language);
    };

    const getLanguage = () => currentLanguage;

    const onChange = (callback) => {
        if (typeof callback !== 'function') return () => {};
        listeners.add(callback);
        return () => listeners.delete(callback);
    };

    const attachToggleHandlers = () => {
        const toggles = document.querySelectorAll('[data-language-toggle]');
        toggles.forEach((toggle) => {
            toggle.addEventListener('click', (event) => {
                event.preventDefault();
                const next = toggle.getAttribute('data-language-next') || (currentLanguage === 'en' ? 'pl' : 'en');

                setLanguageWithPersist(next);
            });
        });
    };

    const init = () => {
        if (init.initialized) return;
        init.initialized = true;
    
        try { collectOriginalStrings(); } catch (err) { /* ignore */ }
        currentLanguage = resolveInitialLanguage();
        applyTranslations(currentLanguage);
        attachToggleHandlers();
        notifyListeners();
    };



    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    window.i18n = {
        t: (key) => translateInternal(currentLanguage, key),
        setLanguage: setLanguageWithPersist,
        getLanguage,
        onChange
    };
})();
