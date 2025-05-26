# Deprecation Notice: intersections.js

## Overview
The `intersections.js` module has been **completely deprecated** and removed from functionality as of this update. All intersection-related features have been either removed or moved to more specialized modules.

## What Was Deprecated

### Files Modified
- `src/geometry/intersections.js` - All functions now return empty/default values
- `src/geometry/geometry.js` - Removed intersection markers functionality
- `src/animation/animation.js` - Removed intersection detection calls
- `src/triggers/triggers.js` - Disabled intersection trigger detection
- `src/ui/ui.js` - Disabled intersection UI controls
- `src/state/state.js` - Deprecated intersection-related state properties
- `src/state/statePersistence.js` - Removed intersection state persistence
- `src/config/constants.js` - Marked intersection constants as deprecated
- `index.html` - Marked intersection UI section as deprecated

### Deprecated Functions
- `findAllIntersections()` - Returns empty array
- `processIntersections()` - Does nothing
- `detectIntersections()` - Returns empty array
- `applyVelocityToMarkers()` - Does nothing

### Deprecated State Properties
- `useIntersections` - Always false
- `lastUseIntersections` - Always false
- `intersectionPoints` - Always empty array
- `needsIntersectionUpdate` - Always false

### Deprecated UI Controls
- "Find Intersections" checkbox - Disabled and marked as deprecated

## Migration Path

### For Star Polygon Intersections
Star polygon self-intersections are now handled by the dedicated `starCuts.js` module:
- Use `useStars: true` and `useCuts: true` in state
- Star cuts are automatically calculated and rendered
- No manual intersection detection needed

### For Future Intersection Systems
A new intersection system will be implemented in the future with:
- Better performance
- More accurate detection algorithms
- Cleaner separation of concerns
- Modern architecture

## Why This Was Deprecated

1. **Performance Issues**: The old intersection system was computationally expensive
2. **Code Complexity**: Intersection logic was scattered across multiple files
3. **Maintenance Burden**: The code was difficult to maintain and debug
4. **Feature Overlap**: Star cuts provide better intersection handling for star polygons
5. **Architecture**: The new modular approach is cleaner and more maintainable

## Timeline

- **Current**: All intersection functionality disabled but files preserved for reference
- **Future**: Complete removal of deprecated files and code
- **Future**: Implementation of new intersection system with modern architecture

## Notes for Developers

- All deprecated functions are kept as stubs that log warnings
- UI controls are disabled but visible with deprecation notices
- State properties are preserved but always return safe default values
- No breaking changes to the public API - everything fails gracefully

## Related Files

- `src/geometry/starCuts.js` - Replacement for star polygon intersections
- `src/geometry/geometry.js` - Main geometry handling (intersection markers removed)
- `src/triggers/triggers.js` - Audio trigger system (intersection triggers disabled) 