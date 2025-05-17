import { Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import { DEFAULT_VALUES, UI_RANGES, QUANTIZATION_VALUES, TIME_SUBDIVISION_OPTIONS } from '../config/constants.js';
import { ParameterMode } from '../notes/notes.js'; // For Layer controls

let pane;
let globalFolder;
let layersFolder;
let activeLayerFolder;

// To keep track of the dynamically added active layer selector
let activeLayerSelectorBlade = null;

export function setupUI(globalState, layerManager, scene, camera, renderer) {
    // Ensure a container div exists for Tweakpane, or create one
    let tweakpaneContainer = document.getElementById('tweakpane-container');
    if (!tweakpaneContainer) {
        console.warn("'tweakpane-container' div not found. Creating one. For best results, add <div id='tweakpane-container' style='position: fixed; top: 10px; right: 10px; width: 300px; z-index: 10001;'></div> to your HTML.");
        tweakpaneContainer = document.createElement('div');
        tweakpaneContainer.id = 'tweakpane-container';
        Object.assign(tweakpaneContainer.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            width: '300px', // Default width, can be adjusted
            zIndex: '10001'  // Ensure it's above other elements
        });
        document.body.appendChild(tweakpaneContainer);
    }


    pane = new Pane({
        title: 'GeoMusica Controls',
        expanded: true,
        container: tweakpaneContainer
    });
    pane.registerPlugin(EssentialsPlugin);

    // --- Global Settings Folder ---
    globalFolder = pane.addFolder({ title: 'Global Settings', expanded: true });

    globalFolder.addBinding(globalState, 'bpm', { min: UI_RANGES.BPM.min, max: UI_RANGES.BPM.max, step: 1, label: 'BPM' })
        .on('change', ev => globalState.setBpm(ev.value));
    globalFolder.addBinding(globalState, 'masterVolume', { min: 0, max: 1, step: 0.01, label: 'Master Vol' })
        .on('change', ev => globalState.setMasterVolume(ev.value));
    
    const timeFolder = globalFolder.addFolder({ title: 'Time & Quantization', expanded: false });
    timeFolder.addBinding(globalState, 'useTimeSubdivision', { label: 'Use Time Subdiv' })
        .on('change', ev => globalState.setUseTimeSubdivision(ev.value));
    timeFolder.addBinding(globalState, 'timeSubdivisionValue', {
        label: 'Time Subdiv',
        options: TIME_SUBDIVISION_OPTIONS.reduce((acc, opt) => {
            acc[opt.label] = opt.value;
            return acc;
        }, {}),
    }).on('change', ev => globalState.setTimeSubdivisionValue(ev.value));
    
    timeFolder.addBinding(globalState, 'useQuantization', { label: 'Use Quantization' })
        .on('change', ev => globalState.setUseQuantization(ev.value));
    timeFolder.addBinding(globalState, 'quantizationValue', { 
        label: 'Quantize To',
        options: QUANTIZATION_VALUES.reduce((acc, val) => {
            acc[val] = val; 
            return acc;
        }, {}),
    }).on('change', ev => globalState.setQuantizationValue(ev.value));

    const displayFolder = globalFolder.addFolder({ title: 'Display Options', expanded: false });
    displayFolder.addBinding(globalState, 'showAxisFreqLabels', { label: 'Show Axis Labels' })
        .on('change', ev => globalState.setShowAxisFreqLabels(ev.value));
    displayFolder.addBinding(globalState, 'showPointsFreqLabels', { label: 'Show Point Labels' })
        .on('change', ev => globalState.setShowPointsFreqLabels(ev.value));
    displayFolder.addBinding(globalState, 'debug', { label: 'Debug Mode' })
        .on('change', ev => globalState.setDebug(ev.value));

    // --- Layers Management Folder ---
    layersFolder = pane.addFolder({ title: 'Layers', expanded: true });
    layersFolder.addButton({ title: 'Add New Layer' }).on('click', () => {
        layerManager.addLayer(); 
    });
    layersFolder.addButton({ title: 'Remove Active Layer' }).on('click\', () => {
        const activeLayer = layerManager.getActiveLayer();
        if (activeLayer) {
            layerManager.removeLayer(activeLayer.id);
        } else {
            alert("No active layer to remove.");
        }
    });

    // Active Layer Settings Folder (populated by updateActiveLayerControls)
    activeLayerFolder = pane.addFolder({ title: 'Active Layer Settings', expanded: true });

    // Initial UI population
    updateLayersUI(layerManager, globalState);

    // Subscribe to LayerManager changes
    layerManager.subscribe((event) => {
        // console.log('UI received LayerManager event:', event.type);
        updateLayersUI(layerManager, globalState); // Rebuild relevant parts of UI
    });

    // FPS graph
    const fpsGraphBlade = pane.addBlade({
        view: 'fpsgraph',
        label: 'FPS',
        lineCount: 2,
    });
    function loop() {
        fpsGraphBlade.begin();
        fpsGraphBlade.end();
        requestAnimationFrame(loop);
    }
    loop();

    console.log("Tweakpane UI setup complete.");
    return pane; 
}

function updateLayersUI(layerManager, globalState) {
    if (!layersFolder) return;

    const allLayers = layerManager.getAllLayers();
    const activeLayer = layerManager.getActiveLayer();

    // Remove previous layer selector blade if it exists
    if (activeLayerSelectorBlade) {
        layersFolder.remove(activeLayerSelectorBlade);
        activeLayerSelectorBlade = null;
    }

    if (allLayers.length > 0) {
        const layerOptions = allLayers.reduce((acc, layer) => {
            acc[layer.state.name || layer.id] = layer.id; // Use name as text, ID as value
            return acc;
        }, {});

        // Create a temporary object to bind the selection to
        const selectionState = { currentLayerId: activeLayer ? activeLayer.id : '' };

        activeLayerSelectorBlade = layersFolder.addBinding(selectionState, 'currentLayerId', {
            label: 'Active Layer',
            options: layerOptions,
        });
        activeLayerSelectorBlade.on('change', (ev) => {
            if (ev.value) { 
                layerManager.setActiveLayer(ev.value);
            }
        });
    } else {
        activeLayerSelectorBlade = layersFolder.addBlade({
            view: 'text',
            value: 'No layers available. Add a layer to begin.',
            label: 'Status', 
            parse: (v) => String(v),
        });
    }
    
    updateActiveLayerControls(activeLayer ? activeLayer.state : null, globalState);
}

function updateActiveLayerControls(activeLayerState, globalState) {
    if (!activeLayerFolder) return;

    activeLayerFolder.children.slice().forEach(child => activeLayerFolder.remove(child)); 
    activeLayerFolder.title = activeLayerState ? `Layer: ${activeLayerState.name}` : 'Active Layer Settings';

    if (!activeLayerState) {
        activeLayerFolder.addBlade({ view: 'text', value: 'No active layer selected.', parse: v => String(v), label: 'Info'});
        pane.refresh(); // Refresh to ensure title update is visible
        return;
    }

    activeLayerFolder.addBinding(activeLayerState, 'name', { label: 'Name' })
        .on('change', ev => activeLayerState.setName(ev.value));
    activeLayerFolder.addBinding(activeLayerState, 'enabled', { label: 'Enabled' })
        .on('change', ev => activeLayerState.setEnabled(ev.value));

    // Geometry Folder
    const geoFolder = activeLayerFolder.addFolder({ title: 'Geometry', expanded: true });
    geoFolder.addBinding(activeLayerState, 'radius', { min: UI_RANGES.RADIUS.min, max: UI_RANGES.RADIUS.max, step: 1, label: 'Radius' })
        .on('change', ev => activeLayerState.setRadius(ev.value));
    geoFolder.addBinding(activeLayerState, 'segments', { min: UI_RANGES.SEGMENTS.min, max: UI_RANGES.SEGMENTS.max, step: 1, label: 'Segments' })
        .on('change', ev => activeLayerState.setSegments(ev.value));
    // TODO: Add dynamic update for starSkip max based on segments
    // const starSkipBinding = starFractalFolder.addBinding(activeLayerState, 'starSkip', ...);
    // segmentsBinding.on('change', ev => {
    //    const newMax = Math.max(1, ev.value - 1);
    //    starSkipBinding.constraints[0].max = newMax; // Assuming Tweakpane API allows this
    //    if (activeLayerState.starSkip >= newMax) activeLayerState.setStarSkip(newMax > 1 ? newMax-1 : 1);
    //    pane.refresh();
    // });


    geoFolder.addBinding(activeLayerState, 'copies', { min: UI_RANGES.COPIES.min, max: UI_RANGES.COPIES.max, step: 1, label: 'Copies' })
        .on('change', ev => activeLayerState.setCopies(ev.value));
    geoFolder.addBinding(activeLayerState, 'stepScale', { min: UI_RANGES.STEP_SCALE.min, max: UI_RANGES.STEP_SCALE.max, step: 0.01, label: 'Step Scale' })
        .on('change', ev => activeLayerState.setStepScale(ev.value));
    geoFolder.addBinding(activeLayerState, 'angle', { min: UI_RANGES.ANGLE.min, max: UI_RANGES.ANGLE.max, step: 0.1, label: 'Angle Offset' })
        .on('change', ev => activeLayerState.setAngle(ev.value));

    const replFolder = geoFolder.addFolder({ title: 'Replication Logic', expanded: false });
    replFolder.addBinding(activeLayerState, 'useModulus', { label: 'Use Modulus Scale' })
        .on('change', ev => activeLayerState.setUseModulus(ev.value));
    replFolder.addBinding(activeLayerState, 'modulusValue', { min: 1, max: 12, step: 1, label: 'Modulus Value' })
        .on('change', ev => activeLayerState.setModulusValue(ev.value));
    replFolder.addSeparator();
    replFolder.addBinding(activeLayerState, 'useAltScale\', { label: 'Use Alt. Scale' })
        .on('change', ev => activeLayerState.setUseAltScale(ev.value));
    replFolder.addBinding(activeLayerState, 'altScale', { min: 0.1, max: 5, step: 0.01, label: 'Alt. Scale Factor' })
        .on('change', ev => activeLayerState.setAltScale(ev.value));
    replFolder.addBinding(activeLayerState, 'altStepN', { min: 1, max: 12, step: 1, label: 'Alt. Scale Every Nth' })
        .on('change', ev => activeLayerState.setAltStepN(ev.value));

    const starFractalFolder = geoFolder.addFolder({ title: 'Stars & Fractals', expanded: false });
    starFractalFolder.addBinding(activeLayerState, 'useStars', { label: 'Use Stars' })
        .on('change', ev => activeLayerState.setUseStars(ev.value));
    // Storing the binding to potentially update its constraints later
    const starSkipBinding = starFractalFolder.addBinding(activeLayerState, 'starSkip', { 
        min: 1, 
        max: Math.max(1, activeLayerState.segments -1), // Initial max
        step: 1, 
        label: 'Star Skip' 
    });
    starSkipBinding.on('change', ev => activeLayerState.setStarSkip(ev.value));
    
    starFractalFolder.addBinding(activeLayerState, 'useCuts', { label: 'Use Star Cuts (Intersections)' })
        .on('change', ev => activeLayerState.setUseCuts(ev.value));
    starFractalFolder.addSeparator();
    starFractalFolder.addBinding(activeLayerState, 'useFractal', { label: 'Use Fractal Subdiv' })
        .on('change', ev => activeLayerState.setUseFractal(ev.value));
    starFractalFolder.addBinding(activeLayerState, 'fractalValue', { min: 1, max: 10, step: 1, label: 'Fractal Subdivisions' })
        .on('change', ev => activeLayerState.setFractalValue(ev.value));
    
    geoFolder.addBinding(activeLayerState, 'useIntersections', { label: 'Calculate Intersections' })
        .on('change', ev => activeLayerState.setUseIntersections(ev.value));

    // Visuals Folder
    const visualFolder = activeLayerFolder.addFolder({ title: 'Visuals', expanded: true });
    visualFolder.addBinding(activeLayerState, 'color', { label: 'Color' }) // Uses Tweakpane color picker
        .on('change', ev => activeLayerState.setColor(ev.value));
    visualFolder.addBinding(activeLayerState, 'opacity', { min: 0, max: 1, step: 0.01, label: 'Opacity' })
        .on('change', ev => activeLayerState.setOpacity(ev.value));

    // Audio Synth Folder
    const audioFolder = activeLayerFolder.addFolder({ title: 'Audio Synth (Layer)', expanded: false });
    audioFolder.addBinding(activeLayerState, 'attack', { min: 0.001, max: 2, step: 0.001, label: 'Attack (s)' })
        .on('change', ev => activeLayerState.setAttack(ev.value));
    audioFolder.addBinding(activeLayerState, 'decay', { min: 0.01, max: 2, step: 0.01, label: 'Decay (s)' })
        .on('change', ev => activeLayerState.setDecay(ev.value));
    audioFolder.addBinding(activeLayerState, 'sustain', { min: 0, max: 1, step: 0.01, label: 'Sustain Level' })
        .on('change', ev => activeLayerState.setSustain(ev.value));
    audioFolder.addBinding(activeLayerState, 'release', { min: 0.01, max: 5, step: 0.01, label: 'Release (s)' })
        .on('change', ev => activeLayerState.setRelease(ev.value));
    audioFolder.addBinding(activeLayerState, 'brightness', { min: 0, max: 1, step: 0.01, label: 'Brightness (filter)' })
        .on('change', ev => activeLayerState.setBrightness(ev.value));
    audioFolder.addBinding(activeLayerState, 'volume', { min: 0, max: 1.5, step: 0.01, label: 'Layer Volume' })
        .on('change', ev => activeLayerState.setVolume(ev.value));

    // Note Generation Folder
    const noteParamsFolder = activeLayerFolder.addFolder({ title: 'Note Generation Parameters', expanded: false });
    const durationFolder = noteParamsFolder.addFolder({ title: 'Duration', expanded: true});
    durationFolder.addBinding(activeLayerState, 'durationMode', { options: ParameterMode, label: 'Mode' })
        .on('change', ev => activeLayerState.setDurationMode(ev.value));
    durationFolder.addBinding(activeLayerState, 'durationModulo', { min:1, max:16, step:1, label: 'Modulo (N)'})
        .on('change', ev => activeLayerState.setDurationModulo(ev.value));
    durationFolder.addBinding(activeLayerState, 'minDuration', { min:0.01, max:5, step:0.01, label: 'Min Duration (s)'})
        .on('change', ev => activeLayerState.setMinDuration(ev.value));
    durationFolder.addBinding(activeLayerState, 'maxDuration', { min:0.01, max:5, step:0.01, label: 'Max Duration (s)'})
        .on('change', ev => activeLayerState.setMaxDuration(ev.value));
    durationFolder.addBinding(activeLayerState, 'durationPhase', { min:0, max:1, step:0.01, label: 'Phase Offset'})
        .on('change', ev => activeLayerState.setDurationPhase(ev.value));

    const velocityFolder = noteParamsFolder.addFolder({ title: 'Velocity', expanded: true});
    velocityFolder.addBinding(activeLayerState, 'velocityMode', { options: ParameterMode, label: 'Mode' })
        .on('change', ev => activeLayerState.setVelocityMode(ev.value));
    velocityFolder.addBinding(activeLayerState, 'velocityModulo', { min:1, max:16, step:1, label: 'Modulo (N)'})
        .on('change', ev => activeLayerState.setVelocityModulo(ev.value));
    velocityFolder.addBinding(activeLayerState, 'minVelocity', { min:0.01, max:1, step:0.01, label: 'Min Velocity'})
        .on('change', ev => activeLayerState.setMinVelocity(ev.value));
    velocityFolder.addBinding(activeLayerState, 'maxVelocity', { min:0.01, max:1, step:0.01, label: 'Max Velocity'})
        .on('change', ev => activeLayerState.setMaxVelocity(ev.value));
    velocityFolder.addBinding(activeLayerState, 'velocityPhase', { min:0, max:1, step:0.01, label: 'Phase Offset'})
        .on('change', ev => activeLayerState.setVelocityPhase(ev.value));

    // Lerping Folder
    const lerpFolder = activeLayerFolder.addFolder({ title: 'Parameter Lerping', expanded: false });
    lerpFolder.addBinding(activeLayerState, 'useLerp', { label: 'Enable Lerp' })
        .on('change', ev => activeLayerState.setUseLerp(ev.value));
    lerpFolder.addBinding(activeLayerState, 'lerpTime', { min: 0.1, max: 10, step: 0.1, label: 'Lerp Time (s)' })
        .on('change', ev => activeLayerState.setLerpTime(ev.value));
    
    pane.refresh(); // Crucial to update the pane after adding/removing controls
}

// The old setupModulusRadioButtons, setupTimeSubdivisionRadioButtons, etc. are removed 
// as Tweakpane handles enums/options directly.
// The old syncPair and other DOM manipulation helpers are also no longer needed.