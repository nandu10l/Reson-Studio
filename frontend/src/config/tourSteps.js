export const tourSteps = {
    main: [
        {
            title: 'Welcome to Reson Studio',
            content: 'Let\'s take a quick look around the interface to get you started.',
            selector: null
        },
        {
            title: 'Transport Controls',
            content: 'Play, pause, record, and keep track of time here.',
            selector: '.transport-center'
        },
        {
            title: 'Pattern Selector',
            content: 'Create and switch between different patterns (e.g., Drums, Bass, Melody).',
            selector: '.transport-left'
        },
        {
            title: 'Tools',
            content: 'Use these tools to Draw, Paint, Delete, or Slice notes and clips.',
            selector: '.transport-tools'
        },
        {
            title: 'Window Views',
            content: 'Toggle the Playlist, Piano Roll, Mixer, and other main windows.',
            selector: '.transport-views-cluster'
        },
        {
            title: 'AI Studio',
            content: 'Generate full audio tracks using Lyria, or compose MIDI using the AI assistant.',
            selector: 'button[title*="AI Studio"]'
        },
        {
            title: 'Midify Tool',
            content: 'Convert your recorded audio or samples directly into MIDI notes.',
            selector: '.transport-midify-btn'
        },
        {
            title: 'Session Browser',
            content: 'Find your projects, samples, and presets here. Drag and drop to use them.',
            selector: '.session-browser'
        },
        {
            title: 'Playlist / Arrangement',
            content: 'This is where you arrange your patterns and audio clips to create a full song.',
            selector: '.track-area'
        },
        {
            title: 'You\'re Ready!',
            content: 'That\'s the basics. Have fun creating music!',
            selector: null
        }
    ],
    pianoRoll: [
        {
            title: 'Piano Roll Overview',
            content: 'Compose melodies and chords here.',
            selector: '.piano-roll-window'
        },
        {
            title: 'Header Controls',
            content: 'Rename your pattern, select the active channel, and see snap settings.',
            selector: '.piano-header'
        },
        {
            title: 'Tools',
            content: 'Pencil to draw notes, Eraser to remove them, Select to move multiple notes.',
            selector: '.piano-toolbar'
        },
        {
            title: 'Chord Generator',
            content: 'Instantly construct and preview chord progressions for your track.',
            selector: 'button[title="Generate chord progression"]'
        },
        {
            title: 'Piano Keys',
            content: 'Click keys to preview sounds or drag to select rows.',
            selector: '.piano-keys-column'
        },
        {
            title: 'Note Grid',
            content: 'Click in the grid to add notes. Drag the ends of notes to resize them.',
            selector: '.piano-grid-content'
        }
    ],
    channelRack: [
        {
            title: 'Channel Rack Overview',
            content: 'Manage your instruments and create beat patterns here.',
            selector: '.channel-rack-window'
        },
        {
            title: 'Rack Controls',
            content: 'Play just this pattern, filter channels, or access options.',
            selector: '.rack-header'
        },
        {
            title: 'Channels',
            content: 'Each row is an instrument. Click the name to open settings or rename.',
            selector: '.channel-row:first-child .channel-controls-left'
        },
        {
            title: 'Step Sequencer',
            content: 'Click buttons to create a beat.',
            selector: '.step-sequencer'
        },
        {
            title: 'Add Channel',
            content: 'Click + to add new instruments or samples.',
            selector: '.rack-footer'
        }
    ],
    mixer: [
        {
            title: 'Mixer Overview',
            content: 'Adjust volume, panning, and effects for each channel.',
            selector: '.mixer'
        },
        {
            title: 'Mixer Channel',
            content: 'Each strip represents an audio channel.',
            selector: '.mixer-channel:not(.master)'
        },
        {
            title: 'Effects Slots',
            content: 'Add reverb, delay, EQ and other effects (Coming soon!).',
            selector: '.mixer-channel:not(.master) .effects-section'
        },
        {
            title: 'Volume Fader',
            content: 'Control the level of the audio.',
            selector: '.mixer-channel:not(.master) .fader-section'
        },
        {
            title: 'Master Track',
            content: 'The final output of your song. Effects here apply to everything.',
            selector: '.mixer-channel.master'
        }
    ]
};
