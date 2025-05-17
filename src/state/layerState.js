import { DEFAULT_VALUES } from '../config/constants.js';
import { ParameterMode } from '../notes/notes.js';

// Helper to create the parameter changes object structure
function createLayerParameterChangesObject(keys) {
    const changes = {};
    keys.forEach(key => {
        changes[key] = false;
    });
    return changes;
}

const layerGeometryParamKeys = [
    'radius', 'segments', 'copies', 'stepScale', 'angle', 
    'modulusValue', 'useModulus', 'altScale', 'altStepN', 'useAltScale',
    'fractalValue', 'useFractal', 'starSkip', 'useStars', 'useCuts', 
    'useIntersections'
];
const layerVisualParamKeys = ['color', 'opacity'];
const layerAudioParamKeys = ['attack', 'decay', 'sustain', 'release', 'brightness', 'volume'];
const layerNoteParamKeys = [
    'durationMode', 'durationModulo', 'minDuration', 'maxDuration', 'durationPhase',
    'velocityMode', 'velocityModulo', 'minVelocity', 'maxVelocity', 'velocityPhase'
];
const layerLerpParamKeys = ['useLerp', 'lerpTime'];

const allLayerParamKeys = [
    ...layerGeometryParamKeys, 
    ...layerVisualParamKeys, 
    ...layerAudioParamKeys,
    ...layerNoteParamKeys,
    ...layerLerpParamKeys
];

export function createLayerState(initialConfig = {}) {
    const layerIndex = initialConfig.index !== undefined ? initialConfig.index : 0; 

    const defaultState = {
        id: initialConfig.id || `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: initialConfig.name || `Layer ${layerIndex + 1}`,
        enabled: initialConfig.enabled !== undefined ? initialConfig.enabled : true,

        // Geometry
        radius: initialConfig.radius !== undefined ? initialConfig.radius : DEFAULT_VALUES.RADIUS,
        segments: initialConfig.segments !== undefined ? initialConfig.segments : DEFAULT_VALUES.SEGMENTS,
        copies: initialConfig.copies !== undefined ? initialConfig.copies : DEFAULT_VALUES.COPIES,
        stepScale: initialConfig.stepScale !== undefined ? initialConfig.stepScale : DEFAULT_VALUES.STEP_SCALE,
        angle: initialConfig.angle !== undefined ? initialConfig.angle : DEFAULT_VALUES.ANGLE,

        // Replication - Modulus
        modulusValue: initialConfig.modulusValue !== undefined ? initialConfig.modulusValue : DEFAULT_VALUES.MODULUS_VALUE,
        useModulus: initialConfig.useModulus !== undefined ? initialConfig.useModulus : DEFAULT_VALUES.USE_MODULUS,

        // Replication - Alt Scale
        altScale: initialConfig.altScale !== undefined ? initialConfig.altScale : DEFAULT_VALUES.ALT_SCALE,
        altStepN: initialConfig.altStepN !== undefined ? initialConfig.altStepN : DEFAULT_VALUES.ALT_STEP_N,
        useAltScale: initialConfig.useAltScale !== undefined ? initialConfig.useAltScale : DEFAULT_VALUES.USE_ALT_SCALE,

        // Geometry - Fractal
        fractalValue: initialConfig.fractalValue !== undefined ? initialConfig.fractalValue : (DEFAULT_VALUES.FRACTAL_VALUE !== undefined ? DEFAULT_VALUES.FRACTAL_VALUE : 1),
        useFractal: initialConfig.useFractal !== undefined ? initialConfig.useFractal : (DEFAULT_VALUES.USE_FRACTAL !== undefined ? DEFAULT_VALUES.USE_FRACTAL : false),

        // Geometry - Stars & Cuts
        starSkip: initialConfig.starSkip !== undefined ? initialConfig.starSkip : (DEFAULT_VALUES.STAR_SKIP !== undefined ? DEFAULT_VALUES.STAR_SKIP : 1),
        useStars: initialConfig.useStars !== undefined ? initialConfig.useStars : (DEFAULT_VALUES.USE_STARS !== undefined ? DEFAULT_VALUES.USE_STARS : false),
        useCuts: initialConfig.useCuts !== undefined ? initialConfig.useCuts : false, // Default to false if not in DEFAULT_VALUES

        // Geometry - Intersections
        useIntersections: initialConfig.useIntersections !== undefined ? initialConfig.useIntersections : DEFAULT_VALUES.USE_INTERSECTIONS,
        intersectionPoints: [], // Runtime, not typically set by initialConfig directly unless deserializing
        needsIntersectionUpdate: true,
        justCalculatedIntersections: false, // Runtime

        // Audio - Synth Envelope & Properties
        attack: initialConfig.attack !== undefined ? initialConfig.attack : 0.01,
        decay: initialConfig.decay !== undefined ? initialConfig.decay : 0.3,
        sustain: initialConfig.sustain !== undefined ? initialConfig.sustain : 0.5,
        release: initialConfig.release !== undefined ? initialConfig.release : 1.0,
        brightness: initialConfig.brightness !== undefined ? initialConfig.brightness : 1.0, 
        volume: initialConfig.volume !== undefined ? initialConfig.volume : 0.8, // Per-layer volume/gain

        // Note Generation - Duration
        durationMode: initialConfig.durationMode !== undefined ? initialConfig.durationMode : ParameterMode.MODULO,
        durationModulo: initialConfig.durationModulo !== undefined ? initialConfig.durationModulo : 3,
        minDuration: initialConfig.minDuration !== undefined ? initialConfig.minDuration : 0.1,
        maxDuration: initialConfig.maxDuration !== undefined ? initialConfig.maxDuration : 0.5,
        durationPhase: initialConfig.durationPhase !== undefined ? initialConfig.durationPhase : 0,

        // Note Generation - Velocity
        velocityMode: initialConfig.velocityMode !== undefined ? initialConfig.velocityMode : ParameterMode.MODULO,
        velocityModulo: initialConfig.velocityModulo !== undefined ? initialConfig.velocityModulo : 4,
        minVelocity: initialConfig.minVelocity !== undefined ? initialConfig.minVelocity : 0.3,
        maxVelocity: initialConfig.maxVelocity !== undefined ? initialConfig.maxVelocity : 0.9,
        velocityPhase: initialConfig.velocityPhase !== undefined ? initialConfig.velocityPhase : 0,

        // Lerping
        useLerp: initialConfig.useLerp !== undefined ? initialConfig.useLerp : false, 
        lerpTime: initialConfig.lerpTime !== undefined ? initialConfig.lerpTime : DEFAULT_VALUES.LERP_TIME,
        
        // Target values for lerping (initialized based on useLerp and presence in initialConfig)
        targetRadius: 0, 
        targetStepScale: 0, 
        targetAngle: 0, 
        targetAltScale: 0, 
        targetFractalValue: 0, 
        targetStarSkip: 0,
        // Add other lerpable target properties if needed (e.g. color, opacity, audio params)

        // Visuals
        color: initialConfig.color !== undefined ? initialConfig.color : '#FFFFFF',
        opacity: initialConfig.opacity !== undefined ? initialConfig.opacity : 1.0,

        // Runtime flags
        forceGeometryRecalculation: true, // Start true to build initial geometry
        cameraDistanceChanged: false, // Runtime
        lastAngleForTriggers: 0, // Runtime
        totalPointsInLayer: 0, // Runtime
        pointFreqLabelsArray: [], // Runtime, stores label IDs
        parameterChanges: {}, // Filled by createLayerParameterChangesObject
    };
    
    // Layer state merges defaults with initialConfig
    // This step is mostly handled by how defaultState is constructed above.
    // We just need to ensure initialConfig values overwrite defaults if provided.
    const layerState = { ...defaultState }; // Explicitly use the constructed defaultState

    // Initialize target values for lerping
    const lerpableProps = ['radius', 'stepScale', 'angle', 'altScale', 'fractalValue', 'starSkip'];
    lerpableProps.forEach(prop => {
        const targetProp = `target${prop.charAt(0).toUpperCase() + prop.slice(1)}`;
        layerState[targetProp] = layerState.useLerp && initialConfig[targetProp] === undefined 
            ? layerState[prop] 
            : (initialConfig[targetProp] !== undefined ? initialConfig[targetProp] : layerState[prop]);
    });

    // Initialize parameterChanges tracking object
    layerState.parameterChanges = createLayerParameterChangesObject(allLayerParamKeys);

    // --- Helper to update a value and set flags ---
    layerState._updateValue = function(key, value, isGeometric = false, isVisual = false, isAudio = false, isNote = false, isLerpConfig = false) {
        if (this[key] !== value) {
            const actualKey = key.replace('target', ''); // Get base key if it's a target
            const baseKey = actualKey.charAt(0).toLowerCase() + actualKey.slice(1);


            if (this.useLerp && (isGeometric || isAudio || isVisual /* add other lerpable categories */ ) && !key.startsWith('target') && this.hasOwnProperty(`target${baseKey.charAt(0).toUpperCase() + baseKey.slice(1)}`)) {
                 this[`target${baseKey.charAt(0).toUpperCase() + baseKey.slice(1)}`] = value;
            } else {
                this[key] = value;
            }
            
            if (this.parameterChanges.hasOwnProperty(key)) {
                this.parameterChanges[key] = true;
            }

            if (isGeometric) {
                this.forceGeometryRecalculation = true;
                this.needsIntersectionUpdate = true; // Most geometry changes affect intersections
            }
            if (isVisual && !isGeometric) { // If only visual, geometry might not need full recalc
                this.forceGeometryRecalculation = true; // Or a more specific flag like forceVisualUpdate
            }
             if (isAudio) {
                // Could set a flag: this.audioParametersChanged = true;
            }
            if (isNote) {
                // Could set a flag: this.noteParametersChanged = true;
            }
            if (isLerpConfig && key === 'useLerp') { // When useLerp is toggled
                if (value === false) { // Lerp disabled, snap current values to targets
                    lerpableProps.forEach(prop => {
                        const targetPropKey = `target${prop.charAt(0).toUpperCase() + prop.slice(1)}`;
                        this[prop] = this[targetPropKey];
                    });
                } else { // Lerp enabled, ensure targets match current if not already set
                     lerpableProps.forEach(prop => {
                        const targetPropKey = `target${prop.charAt(0).toUpperCase() + prop.slice(1)}`;
                        if (this[prop] !== this[targetPropKey]) { // If they diverged while lerp was off
                           // this[targetPropKey] = this[prop]; // Option 1: target matches current
                           // Option 2: leave target as is, lerp will catch up. Let's do this.
                        }
                    });
                }
                this.forceGeometryRecalculation = true; // Switching lerp mode might affect visuals
            }
            // console.log(`Layer ${this.id} ${key} changed to: ${this[key]}`);
        }
    };

    // --- Setters for layer properties ---
    // Enabled
    layerState.setEnabled = function(value) { this._updateValue('enabled', !!value); };
    layerState.setName = function(value) { this._updateValue('name', String(value)); };

    // Geometry
    layerState.setRadius = function(value) { this._updateValue('radius', parseFloat(value), true); };
    layerState.setSegments = function(value) { this._updateValue('segments', Math.round(parseFloat(value)), true); };
    layerState.setCopies = function(value) { this._updateValue('copies', parseInt(value, 10), true); };
    layerState.setStepScale = function(value) { this._updateValue('stepScale', parseFloat(value), true); };
    layerState.setAngle = function(value) { this._updateValue('angle', parseFloat(value), true); };
    
    layerState.setModulusValue = function(value) { this._updateValue('modulusValue', parseInt(value, 10), true); };
    layerState.setUseModulus = function(value) { this._updateValue('useModulus', !!value, true); };
    
    layerState.setAltScale = function(value) { this._updateValue('altScale', parseFloat(value), true); };
    layerState.setAltStepN = function(value) { this._updateValue('altStepN', parseInt(value, 10), true); };
    layerState.setUseAltScale = function(value) { this._updateValue('useAltScale', !!value, true); };

    layerState.setFractalValue = function(value) { this._updateValue('fractalValue', parseFloat(value), true); };
    layerState.setUseFractal = function(value) { this._updateValue('useFractal', !!value, true); };

    layerState.setStarSkip = function(value) { this._updateValue('starSkip', parseInt(value, 10), true); };
    layerState.setUseStars = function(value) { this._updateValue('useStars', !!value, true); };
    layerState.setUseCuts = function(value) { this._updateValue('useCuts', !!value, true); };
    
    layerState.setUseIntersections = function(value) { this._updateValue('useIntersections', !!value, true); };

    // Visuals
    layerState.setColor = function(value) { this._updateValue('color', String(value), false, true); };
    layerState.setOpacity = function(value) { this._updateValue('opacity', parseFloat(value), false, true); };

    // Audio - Synth
    layerState.setAttack = function(value) { this._updateValue('attack', parseFloat(value), false, false, true); };
    layerState.setDecay = function(value) { this._updateValue('decay', parseFloat(value), false, false, true); };
    layerState.setSustain = function(value) { this._updateValue('sustain', parseFloat(value), false, false, true); };
    layerState.setRelease = function(value) { this._updateValue('release', parseFloat(value), false, false, true); };
    layerState.setBrightness = function(value) { this._updateValue('brightness', parseFloat(value), false, false, true); };
    layerState.setVolume = function(value) { this._updateValue('volume', parseFloat(value), false, false, true); };

    // Note Generation
    layerState.setDurationMode = function(value) { this._updateValue('durationMode', value, false, false, false, true); };
    layerState.setDurationModulo = function(value) { this._updateValue('durationModulo', parseInt(value, 10), false, false, false, true); };
    layerState.setMinDuration = function(value) { this._updateValue('minDuration', parseFloat(value), false, false, false, true); };
    layerState.setMaxDuration = function(value) { this._updateValue('maxDuration', parseFloat(value), false, false, false, true); };
    layerState.setDurationPhase = function(value) { this._updateValue('durationPhase', parseFloat(value), false, false, false, true); };

    layerState.setVelocityMode = function(value) { this._updateValue('velocityMode', value, false, false, false, true); };
    layerState.setVelocityModulo = function(value) { this._updateValue('velocityModulo', parseInt(value, 10), false, false, false, true); };
    layerState.setMinVelocity = function(value) { this._updateValue('minVelocity', parseFloat(value), false, false, false, true); };
    layerState.setMaxVelocity = function(value) { this._updateValue('maxVelocity', parseFloat(value), false, false, false, true); };
    layerState.setVelocityPhase = function(value) { this._updateValue('velocityPhase', parseFloat(value), false, false, false, true); };
    
    // Lerping Config
    layerState.setUseLerp = function(value) { this._updateValue('useLerp', !!value, false, false, false, false, true); };
    layerState.setLerpTime = function(value) { this._updateValue('lerpTime', parseFloat(value), false, false, false, false, true); };

    layerState.resetParameterChanges = function() {
        for (const key in this.parameterChanges) {
            this.parameterChanges[key] = false;
        }
    };

    layerState.hasParameterChanged = function(category = null) {
        let keysToCheck = allLayerParamKeys;
        if (category === 'geometry') keysToCheck = layerGeometryParamKeys;
        else if (category === 'visual') keysToCheck = layerVisualParamKeys;
        else if (category === 'audio') keysToCheck = layerAudioParamKeys;
        else if (category === 'note') keysToCheck = layerNoteParamKeys;
        // Add more categories if needed

        return keysToCheck.some(key => this.parameterChanges[key]);
    };
    
    // --- Scale factor for modulus ---
    layerState.getScaleFactorForCopy = function(copyIndex) { 
        if (!this.useModulus || !this.modulusValue || this.modulusValue <= 0) {
            return 1.0;
        }
        const sequencePosition = (copyIndex % this.modulusValue) + 1;
        return sequencePosition / this.modulusValue; 
    };

    // --- Lerping logic ---
    layerState.isLerping = function() {
        if (!this.useLerp) return false;
        const threshold = 0.0001; // Small threshold for float comparison
        for (const prop of lerpableProps) {
            const targetProp = `target${prop.charAt(0).toUpperCase() + prop.slice(1)}`;
            if (Math.abs(this[prop] - this[targetProp]) > threshold) {
                return true;
            }
        }
        return false;
    };

    layerState.updateLerp = function(dt, globalLerpTime) {
        if (!this.useLerp) return;

        const effectiveLerpTime = this.lerpTime || globalLerpTime || DEFAULT_VALUES.LERP_TIME || 1.0;
        if (effectiveLerpTime <= 0) return; // Avoid division by zero or negative time

        const lerpFactor = Math.min(dt / effectiveLerpTime, 1.0);

        const lerp = (current, target) => current + (target - current) * lerpFactor;
        const snapThreshold = 0.001;
        const snapIfClose = (current, target) => Math.abs(target - current) < snapThreshold ? target : current;

        let changed = false;
        lerpableProps.forEach(prop => {
            const targetPropKey = `target${prop.charAt(0).toUpperCase() + prop.slice(1)}`;
            const oldVal = this[prop];
            let newVal = lerp(this[prop], this[targetPropKey]);
            newVal = snapIfClose(newVal, this[targetPropKey]);
            if (this[prop] !== newVal) {
                this[prop] = newVal;
                changed = true;
                // If direct property update should also flag general changes:
                if (this.parameterChanges.hasOwnProperty(prop)) {
                    this.parameterChanges[prop] = true; 
                }
            }
        });
        
        if (changed) {
            this.forceGeometryRecalculation = true; // Lerping geometry params needs recalc
            this.needsIntersectionUpdate = true;
        }
    };

    return layerState;
} 