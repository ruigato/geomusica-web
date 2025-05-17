import * as THREE from 'three';
import { createLayerState } from './layerState.js';
import { DEFAULT_VALUES } from '../config/constants.js'; // For default lerp time
import { removePointLabel } from '../ui/domLabels.js'; // Ensure this import is present

export class LayerManager {
    constructor(scene) {
        if (!scene) {
            throw new Error("LayerManager requires a THREE.Scene instance.");
        }
        this.scene = scene;
        this.layers = [];
        this.activeLayerId = null;
        this._subscribers = [];
        this.nextLayerIndex = 0; // To help with default naming
    }

    _getNextLayerDefaultName() {
        return `Layer ${this.nextLayerIndex + 1}`;
    }

    addLayer(initialConfig = {}) {
        const layerIndex = this.layers.length; // Or use a persistent counter if layers can be reordered
        const layerId = `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const completeInitialConfig = {
            id: layerId,
            name: initialConfig.name || this._getNextLayerDefaultName(),
            index: layerIndex, // Pass index for default naming or other setup in createLayerState
            ...initialConfig, // User-provided config overrides defaults
        };
        
        const layerState = createLayerState(completeInitialConfig);

        const group = new THREE.Group();
        group.name = `LayerGroup_${layerState.name}_${layerId}`;
        this.scene.add(group);

        const layer = {
            id: layerId,
            state: layerState,
            group: group,
            baseGeo: null, // Will be managed by animation/geometry logic
        };

        this.layers.push(layer);
        this.nextLayerIndex++;

        if (!this.activeLayerId || this.layers.length === 1) {
            this.setActiveLayer(layerId);
        }

        this._notifySubscribers({ type: 'layerAdded', layerId: layer.id, layerCount: this.layers.length });
        console.log(`Layer added: ${layer.state.name} (ID: ${layer.id})`);
        return layer;
    }

    removeLayer(layerId) {
        const layerIndex = this.layers.findIndex(l => l.id === layerId);
        if (layerIndex === -1) {
            console.warn(`Layer with ID ${layerId} not found for removal.`);
            return false;
        }

        const layerToRemove = this.layers[layerIndex];

        // Clean up labels associated with this layer
        if (layerToRemove.state && layerToRemove.state.pointFreqLabelsArray && typeof removePointLabel === 'function') {
            console.log(`Removing ${layerToRemove.state.pointFreqLabelsArray.length} point frequency labels for layer ${layerToRemove.state.name}`);
            layerToRemove.state.pointFreqLabelsArray.forEach(labelId => {
                removePointLabel(labelId);
            });
            layerToRemove.state.pointFreqLabelsArray = []; // Clear the array on the state object
        }

        // Remove group from scene
        if (layerToRemove.group) {
            this.scene.remove(layerToRemove.group);
            // Dispose of geometries and materials within the group
            layerToRemove.group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => { if (m.dispose) m.dispose(); });
                    } else if (child.material.dispose) {
                        child.material.dispose();
                    }
                }
            });
        }
        
        // Dispose baseGeo if it exists and has a dispose method
        if (layerToRemove.baseGeo && typeof layerToRemove.baseGeo.dispose === 'function') {
            layerToRemove.baseGeo.dispose();
        }

        this.layers.splice(layerIndex, 1);
        console.log(`Layer removed: ${layerToRemove.state.name} (ID: ${layerId})`);

        if (this.activeLayerId === layerId) {
            if (this.layers.length > 0) {
                // Try to set the previous layer as active, or the first one
                const newActiveIndex = Math.max(0, layerIndex - 1);
                this.setActiveLayer(this.layers[newActiveIndex].id);
            } else {
                this.activeLayerId = null;
            }
        }
        
        // Recalculate nextLayerIndex if needed, though simple increment is fine for default names
        // For more robust naming, might need a different strategy if layers are re-ordered often

        this._notifySubscribers({ type: 'layerRemoved', layerId: layerId, layerCount: this.layers.length, newActiveLayerId: this.activeLayerId });
        return true;
    }

    getLayerById(layerId) {
        return this.layers.find(l => l.id === layerId);
    }

    setActiveLayer(layerId) {
        const layer = this.getLayerById(layerId);
        if (layer && this.activeLayerId !== layerId) {
            this.activeLayerId = layerId;
            console.log(`Active layer set to: ${layer.state.name} (ID: ${layerId})`);
            this._notifySubscribers({ type: 'activeLayerChanged', activeLayerId: layerId });
        } else if (!layer) {
            console.warn(`Attempted to set active layer to non-existent ID: ${layerId}`);
        }
    }

    getActiveLayer() {
        if (!this.activeLayerId) return null;
        return this.getLayerById(this.activeLayerId);
    }

    getActiveLayerState() {
        const activeLayer = this.getActiveLayer();
        return activeLayer ? activeLayer.state : null;
    }

    getAllLayers() {
        return [...this.layers]; // Return a copy
    }

    serializeLayers() {
        return this.layers.map(layer => layer.state);
    }

    deserializeLayers(layersData) {
        if (!Array.isArray(layersData)) {
            console.error("deserializeLayers: layersData is not an array.");
            return;
        }
        
        // Clear existing layers
        while (this.layers.length > 0) {
            this.removeLayer(this.layers[0].id); // removeLayer handles scene removal and disposal
        }
        this.activeLayerId = null;
        this.nextLayerIndex = 0; // Reset naming index

        layersData.forEach((layerStateData, index) => {
            // The createLayerState function is designed to take an initialConfig,
            // which can be a full state object. It merges this with defaults.
            // We ensure 'id' and 'name' are present or generated.
            const config = {
                ...layerStateData, // Spread the loaded state data
                id: layerStateData.id || `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Ensure ID
                name: layerStateData.name || `Layer ${index + 1}`, // Ensure name
                index: index // Provide index for consistency
            };
            this.addLayer(config); // addLayer will handle state creation and scene setup
        });

        if (this.layers.length > 0 && !this.activeLayerId) {
            this.setActiveLayer(this.layers[0].id);
        }
        console.log(`${this.layers.length} layers deserialized.`);
        this._notifySubscribers({ type: 'layersDeserialized', layerCount: this.layers.length, activeLayerId: this.activeLayerId });
    }
    
    updateLerpForAllLayers(dt, globalLerpTimeOverride = null) {
        const defaultLerpTime = globalLerpTimeOverride !== null ? globalLerpTimeOverride : DEFAULT_VALUES.LERP_TIME;
        this.layers.forEach(layer => {
            if (layer.state.enabled && layer.state.useLerp && typeof layer.state.updateLerp === 'function') {
                layer.state.updateLerp(dt, layer.state.lerpTime || defaultLerpTime);
            }
        });
    }

    // --- Subscriber system for UI updates ---
    subscribe(callback) {
        if (typeof callback === 'function') {
            this._subscribers.push(callback);
        }
    }

    unsubscribe(callback) {
        this._subscribers = this._subscribers.filter(sub => sub !== callback);
    }

    _notifySubscribers(event = {}) {
        // console.log('LayerManager notifying subscribers:', event, 'Subscribers:', this._subscribers.length);
        this._subscribers.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error("Error in LayerManager subscriber callback:", error);
            }
        });
    }
} 