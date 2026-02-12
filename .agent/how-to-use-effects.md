# Complete Guide: Playing Music with Mixer Effects

## Step-by-Step Tutorial

### Method 1: Using Channel Rack (Drums/Percussion)

#### Step 1: Open Channel Rack
1. Click on **Channel Rack** tab at the bottom
2. You'll see channels like "Grand Piano", "808 Kick", "808 Clap", etc.

#### Step 2: Create a Simple Beat
1. Click on the **808 Kick** pad (Channel 1)
2. In the step sequencer, click steps: **1, 5, 9, 13** (creates a 4-on-the-floor kick pattern)
3. Click on the **808 Clap** pad (Channel 2)
4. Click steps: **5, 13** (adds claps on beats 2 and 4)
5. Click on the **808 HiHat** pad (Channel 3)
6. Click every other step: **1, 3, 5, 7, 9, 11, 13, 15** (creates hi-hat rhythm)

#### Step 3: Add Effects to a Channel
1. Click on **Mixer** tab at the bottom
2. Click on **Channel 1** (808 Kick) in the mixer
3. In the right panel, you'll see 10 effect slots (Slot 1, Slot 2, etc.)
4. Click on **Slot 1** (empty slot)
5. Select **Reverb** from the effect selector popup
6. The Reverb effect is now added!

#### Step 4: Configure the Effect
1. Click on the **Reverb** slot again to open the editor
2. Adjust parameters:
   - **Decay**: Drag up to increase (try 5.0s for a big room sound)
   - **Wet**: Drag up to 0.8 (80% wet signal)
   - **Damping**: Adjust to taste
3. Close the editor (click X or click outside)

#### Step 5: Play Your Beat
1. Click the **Play** button (▶) in the transport bar at the top
2. Listen to your kick drum with reverb!
3. Adjust effect parameters in real-time while playing

### Method 2: Using Piano Roll (Melodies)

#### Step 1: Create a Melody
1. In Channel Rack, click the **piano icon** next to "Grand Piano" (Channel 0)
2. The Piano Roll opens
3. Click on the grid to add notes:
   - Add a C4 note at step 0 (length 4 steps)
   - Add an E4 note at step 4 (length 4 steps)
   - Add a G4 note at step 8 (length 4 steps)
   - Add a C5 note at step 12 (length 4 steps)

#### Step 2: Add Effects to Piano Channel
1. Go to **Mixer** tab
2. Click on **Channel 0** (Grand Piano)
3. Add effects:
   - **Slot 1**: Reverb (for space)
   - **Slot 2**: Delay (for echo)
   - **Slot 3**: Chorus (for width)

#### Step 3: Configure Multiple Effects
1. Click **Reverb** slot:
   - Decay: 3.0s
   - Wet: 0.5
2. Click **Delay** slot:
   - Delay Time: 0.375s (dotted eighth note)
   - Feedback: 0.4
   - Dry Vol: 0.7
3. Click **Chorus** slot:
   - Depth: 5ms
   - LFO 1: 0.8 Hz

#### Step 4: Play
1. Click **Play** button
2. Hear your melody with all three effects!

### Method 3: Using Audio Files (Playlist)

#### Step 1: Import Audio
1. Click **File** → **Import Audio** (or use import button)
2. Select an audio file (MP3, WAV, etc.)
3. The file appears in the Playlist timeline

#### Step 2: Route Audio to Mixer Channel
1. The audio clip is automatically routed to a playlist track
2. Each playlist track can be routed to a mixer channel
3. Go to **Mixer** tab

#### Step 3: Add Effects to the Track's Channel
1. Select the mixer channel that corresponds to your audio track
2. Add effects (Reverb, Delay, EQ, etc.)
3. Configure as desired

#### Step 4: Play
1. Click **Play** button in transport
2. The audio file plays through the effects!

## Effect Combinations Guide

### For Drums (Kick, Snare, Claps)
**Recommended Effects**:
1. **Compressor** (Slot 1)
   - Threshold: -20dB
   - Ratio: 4:1
   - Attack: 5ms
   - Release: 100ms
2. **EQ** (Slot 2)
   - Boost Low band +6dB (for punch)
3. **Reverb** (Slot 3)
   - Decay: 1.5s (short for drums)
   - Wet: 0.3 (subtle)

### For Piano/Keys
**Recommended Effects**:
1. **Chorus** (Slot 1)
   - Depth: 3ms
   - LFO rates: 0.5, 1.0, 2.0 Hz
2. **Reverb** (Slot 2)
   - Decay: 4.0s (medium hall)
   - Wet: 0.6
3. **Delay** (Slot 3)
   - Time: 0.5s
   - Feedback: 0.3
   - Mix with dry

### For Bass
**Recommended Effects**:
1. **Distortion** (Slot 1)
   - Pre Gain: 1.5
   - Mix: 0.4 (blend with clean)
2. **Compressor** (Slot 2)
   - Threshold: -15dB
   - Ratio: 6:1
3. **EQ** (Slot 3)
   - Boost Low band +3dB
   - Cut Mid band -2dB

### For Vocals (if using audio import)
**Recommended Effects**:
1. **Compressor** (Slot 1)
   - Threshold: -18dB
   - Ratio: 3:1
   - Attack: 10ms
   - Release: 200ms
2. **EQ** (Slot 2)
   - Cut Low band -6dB (remove rumble)
   - Boost High band +3dB (add air)
3. **Reverb** (Slot 3)
   - Decay: 2.5s
   - Wet: 0.4
4. **Delay** (Slot 4)
   - Time: 0.375s
   - Feedback: 0.25

## Quick Test Workflow

### 5-Minute Effect Test:

1. **Open Reson Studio**
2. **Go to Channel Rack**
3. **Click "808 Kick" pad** → Click steps 1, 5, 9, 13
4. **Go to Mixer** → Select Channel 1
5. **Add Reverb** → Click Slot 1 → Select Reverb
6. **Open Reverb editor** → Set Decay = 10s, Wet = 100%
7. **Click Play** → You should hear a MASSIVE reverb tail
8. **Adjust in real-time** → Drag Decay down while playing

If you hear the reverb tail, effects are working! ✅

## Troubleshooting

### "I don't hear any effects"

**Check 1: Is audio playing?**
- Make sure you clicked Play button
- Check that you have notes/steps activated
- Verify channel volume is up

**Check 2: Is effect enabled?**
- Look for green power button (●) on effect slot
- If gray, click to enable

**Check 3: Are parameters set correctly?**
- Open effect editor
- Check Wet/Mix is not at 0%
- Try extreme values (Reverb Decay = 20s)

**Check 4: Is channel routed correctly?**
- In Mixer, verify channel is not muted
- Check master volume is up

### "Effects are too subtle"

**Solution**: Use extreme values for testing:
- Reverb Decay: 20s (not 2s)
- Delay Feedback: 80% (not 40%)
- EQ Gain: +18dB (not +3dB)
- Distortion Pre Gain: 2.0 (maximum)

### "Effect editor won't open"

**Solution**:
- Make sure effect is added to slot first
- Click directly on the slot (not empty space)
- Check console for errors (F12)

## Advanced Tips

### Effect Chain Order Matters

**Good Order**:
1. Dynamics (Compressor) - Controls peaks
2. EQ - Shapes frequency
3. Modulation (Chorus/Phaser) - Adds movement
4. Time-based (Delay/Reverb) - Adds space

**Why**: You want to compress and EQ before adding reverb, otherwise you'll compress/EQ the reverb tail too.

### Parallel Processing

1. Add effect to Slot 1
2. Set Mix/Wet to 50%
3. This blends dry (original) with wet (effected) signal
4. Great for subtle effects

### Effect Bypass

- Click the power button (●) on any effect slot
- Green = Active
- Gray = Bypassed
- Use to A/B compare with/without effect

### Reordering Effects

- Hover over effect slot
- Scroll mouse wheel up/down
- Effect moves between slots
- Chain rebuilds automatically

## Keyboard Shortcuts

- **Space**: Play/Pause
- **Escape**: Close effect editor
- **Click outside editor**: Close effect editor

## Next Steps

Once effects are working:
1. Experiment with different combinations
2. Try all 7 effect types
3. Create effect chains (3-4 effects per channel)
4. Save your project to keep effect settings
5. Export your mix with effects baked in

## Effect Types Quick Reference

| Effect | Best For | Key Parameters |
|--------|----------|----------------|
| **Reverb** | Space, depth | Decay, Wet, Damping |
| **Delay** | Echoes, rhythm | Time, Feedback |
| **Chorus** | Width, shimmer | Depth, LFO rates |
| **Phaser** | Sweeping, movement | Sweep Freq, Depth |
| **Distortion** | Grit, saturation | Pre Gain, Mix |
| **Compressor** | Dynamics, punch | Threshold, Ratio |
| **Parametric EQ** | Tone shaping | Band Gain, Frequency |

---

**Remember**: Effects only work when audio is playing through the channel! Make sure to click Play and have notes/audio on that channel.
