import { DEFAULT_VALUES } from '../config/constants.js';
import { getCurrentTime } from '../time/time.js'; // Assuming this utility exists

// Helper to create the parameter changes object structure
function createParameterChangesObject(keys) {
    const changes = {};
    keys.forEach(key => {
        changes[key] = false;
    });
    return changes;
}

const globalParameterKeys = [
    'bpm', 'timeSubdivisionValue', 'useTimeSubdivision', 'quantizationValue', 'useQuantization',
    'useEqualTemperament', 'referenceFrequency', 'showAxisFreqLabels', 'showPointsFreqLabels', 
    'debug', 'masterVolume',
    // Add other global parameter keys as identified
];

export function createGlobalState() {
    const state = {
        // Performance and frame tracking
        frame: 0,
        lastUpdateTime: typeof performance !== 'undefined' ? performance.now() : 0,
        performance: {
            highPerformanceMode: true,
            skipFramesWhenNeeded: true,
            updateThreshold: 100, // ms
        },
        lastTime: getCurrentTime(),

        // Global Playback/Tempo
        bpm: DEFAULT_VALUES.BPM,

        // Global Time/Quantization Effects
        timeSubdivisionValue: DEFAULT_VALUES.TIME_SUBDIVISION_VALUE,
        useTimeSubdivision: DEFAULT_VALUES.USE_TIME_SUBDIVISION,
        quantizationValue: DEFAULT_VALUES.QUANTIZATION_VALUE !== undefined ? DEFAULT_VALUES.QUANTIZATION_VALUE : 0,
        useQuantization: DEFAULT_VALUES.USE_QUANTIZATION !== undefined ? DEFAULT_VALUES.USE_QUANTIZATION : false,

        // Global Tuning Settings
        useEqualTemperament: DEFAULT_VALUES.USE_EQUAL_TEMPERAMENT,
        referenceFrequency: DEFAULT_VALUES.REFERENCE_FREQ,

        // Global Display Options
        showAxisFreqLabels: DEFAULT_VALUES.SHOW_AXIS_FREQ_LABELS,
        showPointsFreqLabels: DEFAULT_VALUES.SHOW_POINTS_FREQ_LABELS, // This might need careful handling if it interacts with layer visibility

        // Global Audio
        masterVolume: 0.8, // Default master volume

        debug: false,

        // --- Runtime state, not typically saved ---
        activeModals: {}, // e.g., { settingsModalVisible: false }
        // audioContext: null, // Will be set by setupAudio

        // --- Meta-state for global parameter changes ---
        parameterChanges: createParameterChangesObject(globalParameterKeys),

        // --- Methods to modify global state ---
        _updateValue(key, value) {
            if (state[key] !== value) {
                state[key] = value;
                if (state.parameterChanges.hasOwnProperty(key)) {
                    state.parameterChanges[key] = true;
                }
                // console.log(`Global state ${key} changed to:`, value);
            }
        },

        setBpm(value) { this._updateValue('bpm', parseFloat(value)); },
        setTimeSubdivisionValue(value) { this._updateValue('timeSubdivisionValue', parseFloat(value)); },
        setUseTimeSubdivision(value) { this._updateValue('useTimeSubdivision', !!value); },
        setQuantizationValue(value) { this._updateValue('quantizationValue', parseInt(value, 10)); },
        setUseQuantization(value) { this._updateValue('useQuantization', !!value); },
        setUseEqualTemperament(value) { this._updateValue('useEqualTemperament', !!value); },
        setReferenceFrequency(value) { this._updateValue('referenceFrequency', parseFloat(value)); },
        setShowAxisFreqLabels(value) { this._updateValue('showAxisFreqLabels', !!value); },
        setShowPointsFreqLabels(value) { this._updateValue('showPointsFreqLabels', !!value); },
        setMasterVolume(value) { this._updateValue('masterVolume', parseFloat(value)); },
        setDebug(value) { this._updateValue('debug', !!value); },

        resetParameterChanges() {
            for (const key in state.parameterChanges) {
                state.parameterChanges[key] = false;
            }
        },

        hasParameterChanged() {
            return Object.values(state.parameterChanges).some(changed => changed);
        },
        
        // Utility to get current time, ensures consistency if time module is not directly accessible everywhere
        getCurrentTime() {
            return getCurrentTime();
        }
    };
    return state;
} 