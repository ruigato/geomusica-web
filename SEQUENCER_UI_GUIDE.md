# 🎯 GeometricSequencer UI Controls Guide

## Location
The sequencer controls are located in the **TIME tab** under the new **SEQUENCER** section (green background).

## Main Controls

### 🎛️ **Enable Sequencer Mode**
- **Checkbox**: Toggle between real-time detection and sequencer mode
- **Default**: Disabled (uses real-time detection)
- **Effect**: When enabled, switches from real-time Y-axis crossing detection to pre-calculated schedule timing

### ⚙️ **Configuration Options** (shown when enabled)

#### **Look-ahead Time (10-200ms)**
- **Default**: 50ms
- **Purpose**: Buffer time for event scheduling
- **Lower values**: More precise timing, potentially less stable
- **Higher values**: More stable, slightly less precise

#### **Timing Precision (0.1-10ms)**
- **Default**: 1ms
- **Purpose**: Acceptable timing error threshold
- **Lower values**: More accurate timing requirements
- **Higher values**: More tolerant of timing variations

#### **Max Queue Size (1,000-50,000)**
- **Default**: 10,000 events
- **Purpose**: Prevents memory bloat from too many scheduled events
- **Auto-cleanup**: Oldest events are removed when limit is reached

#### **Debug Mode**
- **Checkbox**: Enable detailed console logging
- **Use**: For troubleshooting and development
- **Shows**: Event scheduling, timing calculations, performance data

## 📊 **Performance Metrics** (Live Display)

### **Status Indicators**
- **Status**: Active (green) / Disabled (red)
- **Events/sec**: Number of trigger events per second
- **Queue size**: Current number of scheduled events
- **Timing accuracy**: Percentage of events within precision threshold
- **Cache hit rate**: Efficiency of geometry calculation caching
- **CPU usage**: Time spent on sequencer operations

### **⚡ Performance Comparison**
- **Sequencer CPU**: Time spent in sequencer mode
- **Real-time CPU**: Time spent in real-time detection
- **Performance gain**: Speed improvement ratio (e.g., "3.2x faster")

### **Refresh Metrics Button**
- Manual refresh of performance statistics
- Auto-updates every second when sequencer is active

## 🚀 **How to Use**

### **Basic Setup**
1. Open the **TIME tab**
2. Scroll down to the **🎯 SEQUENCER** section (green background)
3. Check **"Enable Sequencer Mode"**
4. Configuration options will appear below

### **Recommended Settings**

#### **For Maximum Performance**
```
✅ Enable Sequencer Mode: ON
⏱️ Look-ahead Time: 25ms
🎯 Timing Precision: 0.5ms
📦 Max Queue Size: 20,000
🐛 Debug Mode: OFF
```

#### **For Maximum Stability**
```
✅ Enable Sequencer Mode: ON
⏱️ Look-ahead Time: 100ms
🎯 Timing Precision: 2ms
📦 Max Queue Size: 10,000
🐛 Debug Mode: OFF
```

#### **For Development/Debugging**
```
✅ Enable Sequencer Mode: ON
⏱️ Look-ahead Time: 50ms
🎯 Timing Precision: 1ms
📦 Max Queue Size: 5,000
🐛 Debug Mode: ON
```

## 📈 **Performance Benefits**

### **When to Use Sequencer Mode**
- ✅ Complex geometries with many points (>50 vertices)
- ✅ High BPM settings (>150 BPM)
- ✅ Multiple layers with copies/intersections
- ✅ CPU-intensive scenarios
- ✅ When timing accuracy is critical

### **When to Use Real-time Mode**
- ✅ Simple geometries (<20 vertices)
- ✅ Interactive parameter changes
- ✅ Low BPM settings (<100 BPM)
- ✅ Single layer setups

### **Typical Performance Gains**
- **Simple geometries**: 2-3x faster CPU usage
- **Complex geometries**: 5-10x faster CPU usage
- **High-frequency events**: 10-20x faster CPU usage
- **Timing accuracy**: Sub-millisecond precision

## 🔧 **Console Commands**

You can also control the sequencer programmatically:

```javascript
// Enable sequencer mode
window.setSequencerMode(true);

// Check if sequencer is active
console.log('Sequencer active:', window.isSequencerMode());

// Get performance metrics
const sequencer = window.getGlobalSequencer();
if (sequencer) {
  console.log('Metrics:', sequencer.getPerformanceMetrics());
}

// Enable debug mode
if (sequencer) {
  sequencer.setDebugMode(true);
}
```

## 🐛 **Troubleshooting**

### **No Performance Improvement**
- Ensure sequencer mode is actually enabled (check Status: Active)
- Try with more complex geometry (increase segments/copies)
- Check that events are being scheduled (Events/sec > 0)

### **Timing Issues**
- Reduce Look-ahead Time for more precision
- Reduce Timing Precision threshold
- Enable Debug Mode to see detailed logs

### **Memory Issues**
- Reduce Max Queue Size
- Check Queue size in metrics (should stay reasonable)
- Enable Debug Mode to monitor queue growth

### **UI Not Responding**
- Check browser console for errors
- Ensure you're on the TIME tab
- Try refreshing the page

## 🎵 **Best Practices**

1. **Start with defaults** and adjust as needed
2. **Monitor performance metrics** to verify improvements
3. **Use debug mode** when troubleshooting
4. **Lower look-ahead time** for live performance
5. **Higher look-ahead time** for studio work
6. **Enable for complex geometries** only
7. **Keep real-time mode** for simple setups

The sequencer provides significant performance improvements for complex geometric patterns while maintaining sample-accurate timing precision! 