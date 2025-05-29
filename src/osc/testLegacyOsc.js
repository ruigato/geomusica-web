// src/osc/testLegacyOsc.js - Test utility for legacy OSC compatibility

import { 
  isLegacyOscMessage, 
  translateLegacyOscMessage,
  getLegacyOscStats,
  getSupportedLegacyParameters,
  getLegacyParameterMapping
} from './legacyOscCompatibility.js';

/**
 * Test legacy OSC compatibility with sample messages
 */
export function testLegacyOscCompatibility() {
  console.log('=== Testing Legacy OSC Compatibility ===');
  
  // Sample legacy messages from GM_layer.maxpat
  const testMessages = [
    // Shape parameters
    '/G01/Angle 90',
    '/G01/Copies 4',
    '/G01/Number 8',
    '/G01/Gscale 1000',
    '/G01/Stepscale 1.5',
    '/G01/Offset 0.5',
    
    // Duration parameters
    '/G01/Xdurmin 0.2',
    '/G01/Xdurmax 2.5',
    '/G01/Xdurphase 0.75',
    '/G01/Xdurcycles 6',
    '/G01/Xdurmode 1',
    
    // Velocity parameters
    '/G01/Velmin 0.3',
    '/G01/Velmax 0.8',
    '/G01/Velphase 0.25',
    '/G01/Velcycles 4',
    '/G01/Velmode 2',
    
    // Boolean parameters
    '/G01/Fractal 1',
    '/G01/Star 0',
    '/G01/Delete 1',
    '/G01/Tesselate 1',
    '/G01/Euclid 0',
    
    // Timing parameters
    '/G01/Speed 3',
    '/G01/Lag 0.8',
    '/G01/Sync 1',
    
    // Delete parameters
    '/G01/Deletemin 2',
    '/G01/Deletemax 10',
    '/G01/Deleteseed 123',
    '/G01/Deletepp 0',
    '/G01/Deleterandom 1',
    
    // Other parameters
    '/G01/Numbers 1',
    '/G01/Particles 0',
    '/G01/Mirror 1',
    '/G01/Temperament 1',
    
    // Non-legacy message (should not be translated)
    '/G01/Radius 500',
    '/Global/BPM 140',
    
    // Invalid messages
    '/InvalidFormat',
    '/G01/UnknownParameter 42'
  ];
  
  console.log('\n--- Testing Message Translation ---');
  let translatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  testMessages.forEach((message, index) => {
    console.log(`\nTest ${index + 1}: "${message}"`);
    
    if (isLegacyOscMessage(message)) {
      const translated = translateLegacyOscMessage(message);
      if (translated) {
        console.log(`  ✓ Translated to: "${translated}"`);
        translatedCount++;
      } else {
        console.log(`  ✗ Translation failed`);
        errorCount++;
      }
    } else {
      console.log(`  → Not a legacy message (skipped)`);
      skippedCount++;
    }
  });
  
  console.log('\n--- Translation Summary ---');
  console.log(`Successfully translated: ${translatedCount}`);
  console.log(`Skipped (not legacy): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  
  // Test parameter mappings
  console.log('\n--- Testing Parameter Mappings ---');
  const sampleParameters = ['Angle', 'Xdurmode', 'Velmin', 'Fractal', 'Speed'];
  
  sampleParameters.forEach(param => {
    const mapping = getLegacyParameterMapping(param);
    if (mapping) {
      console.log(`${param}:`);
      console.log(`  → Current: ${mapping.current}`);
      console.log(`  → Type: ${mapping.type}`);
      console.log(`  → Legacy Range: ${mapping.range.min} - ${mapping.range.max}`);
      console.log(`  → Current Range: ${mapping.currentRange.min || mapping.currentRange[0]} - ${mapping.currentRange.max || mapping.currentRange[mapping.currentRange.length - 1]}`);
    } else {
      console.log(`${param}: No mapping found`);
    }
  });
  
  // Display statistics
  console.log('\n--- Legacy OSC Statistics ---');
  const stats = getLegacyOscStats();
  console.log(`Enabled: ${stats.isEnabled}`);
  console.log(`Messages Translated: ${stats.messagesTranslated}`);
  console.log(`Supported Parameters: ${stats.supportedParameters}`);
  console.log(`Unknown Parameters: ${stats.unknownParameters.join(', ') || 'None'}`);
  console.log(`Errors: ${stats.errors}`);
  
  console.log('\n--- Supported Legacy Parameters ---');
  const supportedParams = getSupportedLegacyParameters();
  console.log(`Total: ${supportedParams.length}`);
  console.log('Parameters:', supportedParams.sort().join(', '));
  
  console.log('\n=== Test Complete ===');
  
  return {
    total: testMessages.length,
    translated: translatedCount,
    skipped: skippedCount,
    errors: errorCount,
    supportedParameters: supportedParams.length
  };
}

/**
 * Test value conversion for specific parameter types
 */
export function testValueConversion() {
  console.log('\n=== Testing Value Conversion ===');
  
  const testCases = [
    // Number scaling tests
    { message: '/G01/Angle 90', expected: 'number between -180 and 180' },
    { message: '/G01/Gscale 2500', expected: 'scaled to current radius range' },
    { message: '/G01/Speed 3', expected: 'mapped to time subdivision' },
    
    // Boolean conversion tests
    { message: '/G01/Fractal 0', expected: 'false' },
    { message: '/G01/Fractal 1', expected: 'true' },
    { message: '/G01/Star 0.2', expected: 'false' },
    { message: '/G01/Star 0.8', expected: 'true' },
    
    // Mode conversion tests
    { message: '/G01/Xdurmode 0', expected: 'modulo' },
    { message: '/G01/Xdurmode 1', expected: 'random' },
    { message: '/G01/Xdurmode 2', expected: 'interpolation' },
    { message: '/G01/Velmode 3', expected: 'modulo (clamped)' }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\nTest ${index + 1}: ${testCase.message}`);
    console.log(`Expected: ${testCase.expected}`);
    
    const translated = translateLegacyOscMessage(testCase.message);
    if (translated) {
      console.log(`Result: ${translated}`);
    } else {
      console.log('Translation failed');
    }
  });
  
  console.log('\n=== Value Conversion Test Complete ===');
}

/**
 * Run all tests
 */
export function runAllLegacyOscTests() {
  const mainResults = testLegacyOscCompatibility();
  testValueConversion();
  
  return mainResults;
}

// Export for console testing
if (typeof window !== 'undefined') {
  window.testLegacyOsc = {
    test: testLegacyOscCompatibility,
    testValues: testValueConversion,
    runAll: runAllLegacyOscTests
  };
} 