# Implementation Plan - Fix EQ State and Improve Distortion

## Problem Description
1.  **Parametric EQ State Reset**: When adjusting one band in the EQ editor, other bands reset to their initial values. This is caused by `Mixer.js` overwriting the entire effect parameter state with a partial update from the editor, instead of merging the changes.
2.  **Distortion Bypass/Mix**: The Distortion effect implementation in `AudioEngine.js` uses a mock `wet` parameter. This prevents the generic "Bypass" (Enable/Disable) feature from working correctly, as it relies on ramping the `wet` parameter to 0.

## Proposed Changes

### Frontend Components

#### [MODIFY] [Mixer.js](file:///d:/New%20folder/Reson-Studio/frontend/src/components/Mixer.js)
-   Update `handleUpdateParams` to correctly merge the new partial `params` with the existing `editingEffect.params`.
    -   Change: `setEditingEffect(prev => prev ? { ...prev, params } : null);`
    -   To: `setEditingEffect(prev => prev ? { ...prev, params: { ...prev.params, ...params } } : null);`

### Audio Engine

#### [MODIFY] [AudioEngine.js](file:///d:/New%20folder/Reson-Studio/frontend/src/audio/AudioEngine.js)
-   **Update `createDistortionEffect`**:
    -   Replace the manual `dryNode` / `wetChain` gain setting with `Tone.Gain` nodes that support ramping.
    -   Implement a real `wet` interface that maps to the internal mix logic. This ensures that when the generic `updateEffectEnabled` calls `effect.wet.rampTo(0)`, it correctly fades to the dry signal.
    -   Ensure `setMix` uses `rampTo` for smooth transitions.

## Verification Plan

### Automated Tests
-   None available for this UI/Audio interaction.

### Manual Verification
1.  **EQ State Test**:
    -   Open Mixer.
    -   Add Parametric EQ.
    -   Move Band 1 (Low Shelf) freq/gain.
    -   Move Band 2 (Peaking) freq/gain.
    -   **Pass Criteria**: Band 1 stays at its new position and does NOT reset when Band 2 is moved.
2.  **Distortion Test**:
    -   Add Distortion effect.
    -   Adjust "Mix" knob. Verify audio changes from Dry -> Distorted.
    -   Toggle "Enable/Bypass" button.
    -   **Pass Criteria**:
        -   Bypass turns off distortion (hear clean dry signal).
        -   Enable restores distortion at the previous Mix level.
