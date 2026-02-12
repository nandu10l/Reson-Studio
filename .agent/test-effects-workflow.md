# Mixer Effects Testing Workflow

## Quick Test to Verify Effects Are Working

### Test 1: Reverb Effect (Most Obvious)

1. **Setup**:
   - Open Reson Studio
   - Go to the Mixer view
   - Select Channel 1 (Grand Piano or any instrument)

2. **Add Reverb**:
   - From the Plugin toolbar, drag "Reverb" effect onto Channel 1
   - OR click an empty effect slot in the detail panel and select "Reverb"

3. **Configure Reverb**:
   - Click on the Reverb effect slot to open the editor
   - Set these EXTREME values to make it obvious:
     - **Decay**: 20s (maximum)
     - **Wet**: 1.0 (100% wet)
     - **Dry**: 0.0 (0% dry)
   - Close the editor

4. **Test**:
   - Go to Channel Rack
   - Click on Channel 1 pad to trigger a sound
   - **Expected**: You should hear a VERY long reverb tail (20 seconds)
   - **If working**: The sound will ring out for 20 seconds
   - **If broken**: Sound stops immediately

### Test 2: Delay Effect (Very Obvious)

1. **Setup**:
   - Select Channel 2 (808 Kick or Clap)

2. **Add Delay**:
   - Add "Delay" effect to Channel 2

3. **Configure Delay**:
   - Click the Delay effect slot
   - Set these values:
     - **Delay Time**: 0.5s
     - **Feedback Vol**: 0.8 (80%)
     - **Dry Vol**: 0.5
   - Close the editor

4. **Test**:
   - Click Channel 2 pad
   - **Expected**: You should hear distinct echoes every 0.5 seconds
   - **If working**: Multiple repeating echoes
   - **If broken**: Single sound, no echoes

### Test 3: Parametric EQ (Frequency Boost)

1. **Setup**:
   - Select Channel 3 (any channel)

2. **Add EQ**:
   - Add "Parametric EQ" effect

3. **Configure EQ**:
   - Click the EQ effect slot
   - Drag the LOW band token UP to +18dB
   - OR use the fader on the left side

4. **Test**:
   - Play audio through the channel
   - **Expected**: Significant bass boost
   - **If working**: Much louder, boomy bass
   - **If broken**: No change in sound

### Test 4: Distortion (Obvious Saturation)

1. **Setup**:
   - Select any channel with audio

2. **Add Distortion**:
   - Add "Distortion" effect

3. **Configure**:
   - **Pre Gain**: 2.0 (maximum)
   - **Mix**: 1.0 (100% wet)

4. **Test**:
   - Play audio
   - **Expected**: Heavily distorted, crunchy sound
   - **If working**: Obvious distortion/clipping
   - **If broken**: Clean sound

## Common Issues & Solutions

### Issue: "I don't hear any effects"

**Solution 1: Check Audio is Playing**
- Effects only work when audio passes through the channel
- Make sure you're playing a pattern or triggering sounds

**Solution 2: Check Effect is Enabled**
- Look for the power button (●) on the effect slot
- Green/Active = enabled
- Gray = bypassed

**Solution 3: Check Mix Levels**
- Open the effect editor
- Ensure Wet/Mix is not at 0%
- Try setting to 100% for testing

**Solution 4: Restart Audio Context**
- Stop playback
- Refresh the page
- Click Play to initialize audio context

### Issue: "Effects are too subtle"

**Solution:**
- Use EXTREME parameter values for testing
- Reverb Decay = 20s (not 2s)
- Delay Feedback = 80% (not 40%)
- EQ Gain = +18dB (not +3dB)

### Issue: "Console shows errors"

**Check for:**
```
"Channel [id] not found" - Channel not initialized
"Effect node is null" - Effect creation failed
"Cannot read property 'rampTo'" - Tone.js issue
```

**Solution:**
- Ensure audio engine is initialized (click Play first)
- Check browser console for specific errors
- Try removing and re-adding the effect

## Debugging Checklist

- [ ] Audio context started (clicked Play at least once)
- [ ] Channel has audio source (instrument/sample)
- [ ] Effect is added to channel (visible in slot)
- [ ] Effect is enabled (power button active)
- [ ] Effect parameters are set to extreme values
- [ ] Audio is actually playing through the channel
- [ ] Browser console shows no errors
- [ ] Volume faders are up (channel and master)

## Expected Console Messages

When effects are working, you should see:
```
"Added reverb effect to channel 0 slot 0"
"Audio Engine Started"
"BPM set to: 120"
```

## Advanced Test: Effect Chain

1. Add multiple effects to one channel:
   - Slot 0: Compressor
   - Slot 1: EQ
   - Slot 2: Reverb
   - Slot 3: Delay

2. Configure each with obvious settings

3. Play audio - should hear all effects in series

## If Effects Still Don't Work

1. **Check AudioEngine.js line 743**:
   ```javascript
   audioEngine.addChannelEffect(channelId, plugin.type, slot);
   ```
   - Set a breakpoint here
   - Verify it's being called

2. **Check AudioEngine.js line 1463**:
   ```javascript
   updateEffectParams(channelId, slotIndex, params)
   ```
   - Set a breakpoint here
   - Verify parameters are being updated

3. **Check browser audio**:
   - Try in different browser (Chrome vs Firefox)
   - Check system audio settings
   - Verify Web Audio API is supported

## Success Criteria

✅ **Effects are working if:**
- Reverb creates long tails
- Delay creates distinct echoes
- EQ changes frequency balance
- Distortion adds saturation
- Parameters changes are audible in real-time
- Console shows no errors

❌ **Effects are broken if:**
- No audible change regardless of parameters
- Console shows errors about audio nodes
- Effects don't appear in slots
- Parameter changes have no effect
