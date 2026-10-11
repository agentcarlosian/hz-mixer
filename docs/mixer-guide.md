# Hz Mixer

A local browser mixer for binaural, monaural, and isochronic tones with independent nature-sound layers.

## Run

Double-click [Hz Mixer.html](<Hz Mixer.html>) to launch the standalone mixer in your browser. All four recordings, icons, code, and credits are embedded, so this file can be moved to another folder and used offline without a local server or companion files. It is approximately 24.6 MB.

Audio starts only after pressing Play. Use stereo headphones for binaural mode. Saved mixes belong to the browser and file location you use; they do not automatically transfer from the previous localhost version. File storage behavior can vary between browsers, and moving or renaming the file may give it a separate saved library.

To rebuild the standalone file after editing the source:

```powershell
node scripts/build-standalone.mjs
```

For development with separate source files, run:

```powershell
node serve.mjs
```

Then open `http://127.0.0.1:5173/`.

The page is local-only, with no remote backend, account, or telemetry. The standalone file loads no external resources. The development server serves browser modules and bundled recordings. Audio rights are documented in [assets/audio/SOURCES.md](assets/audio/SOURCES.md), and icon notices in [assets/icons/SOURCES.md](assets/icons/SOURCES.md); the standalone file also includes these notices in its Credits dialog.

## Mixer controls

- Thirty-seven presets grouped by Delta, Theta, Alpha, Beta, Gamma, and nature-only, with band/method filters, search and preset favorites. This adds four new presets per frequency band while retaining the original preset IDs.
- Up to 30 named mixes in browser storage. Saving an existing name updates that mix. Saved snapshots include frequency programs, stages, fades, pulse shaping and every channel setting; old snapshots receive compatible defaults.
- System, Light, and Dark themes. The preference is saved separately from audio settings; System follows the device's appearance, including changes while the mixer is open.
- Automatic restoration of current settings, without autoplay. Clearing this browser's site data removes saved settings and mixes.
- Numeric or slider frequency controls: beat rate 0.50-40.00 Hz in 0.01 Hz steps, and carrier pitch 20-2000 Hz in whole-hertz steps. Two-tone modes use the carrier as the center frequency and display the individual tones to three decimal places.
- Rhythm mute/solo and master mute.
- Independent environment and white/pink/brown noise level, mute/solo, and left/right balance. Clicking the balance readout resets it to center. Noise is generated locally, without extra recording downloads.
- Multiple soloed layers can play together. Mute takes precedence, and disabling a layer clears its solo flag.
- Session timer, waveform/spectrum monitor, and a digital RMS meter. The meter measures the downmixed digital signal, not acoustic sound pressure at the listener.
- Fixed, Sweep, and Session frequency programs. Sweeps have start/end rates, duration, linear/smooth curves and once-then-hold or ping-pong operation. A session combines up to 16 hold/sweep stages, at most two hours total. Session duration comes from its stages, not the independent timer.
- Frequency automation runs on the audio clock. Pause freezes its progress; resume continues. Volume, mute, solo and pan edits do not restart a sweep. Typing or sliding the fixed beat rate switches back to Fixed. Editing a sweep/stage or selecting a new mix restarts the program clock. Method, carrier and pulse changes retain elapsed time.
- Fade-in/out from 0 to 30 seconds. Timer endings fade automatically; manual Stop fades out, and pressing Stop again stops immediately. Fades longer than half a finite session are shortened to fit.
- Isochronic width, softness and modulation depth controls. Even the crisp setting retains short softened edges.
- Environmental recordings use equal-power crossfaded loop buffers at runtime. The original bundled MP3 bytes are unchanged; processed loop durations are slightly shorter.

## Import and export

The download button opens WAV audio, Mix JSON and Library backup options. WAV exports render the current settings from the beginning, not a recording of previous live edits. They include the selected fixed/sweep/staged frequency program, audible layers, balance, pulse shaping, master level and fades. They respect mute/solo and reject an entirely silent mix. A once-only sweep defaults to its sweep duration; a session uses the sum of its stages. Other exports can have a custom duration from one second to two hours.

WAV output is stereo, signed 16-bit PCM at 44.1 or 48 kHz. Rendering uses bounded 20-second blocks, phase-aligned oscillators and compressor warm-up, with progress and cancellation. A two-hour 48 kHz file is about 1.38 GB. When the browser exposes a file-save picker, the default direct-to-file path streams encoded blocks to disk. Otherwise the browser retains encoded blocks for a normal download, so large exports can consume substantial memory. Cancellation can take until the current render/decode finishes; direct-file writes are committed only on successful completion. Browser audio rendering and compressor state can introduce small differences between partial and single-pass renders.

Mix JSON preserves one mix. A library backup includes saved mixes, the current mix and built-in preset favorites. The import button accepts these version 2 JSON formats, previews names and offers Merge or Replace. Import does not change live audio. You can include the backup's current mix as an additional saved entry. Files are bounded to 1 MB and libraries to 30 saved mixes; invalid formats/stages are rejected, numeric settings are normalized to supported ranges, and unknown sources cannot add URLs or scripts. Identical ID/name/settings entries are skipped on merge, and conflicting names/IDs are made distinct. A full 30-mix backup needs the additional current-mix checkbox cleared unless a slot is available.

## Checks

```powershell
node --test tests/*.test.mjs
```

The app uses native Web Audio and has no runtime package dependencies.

Node checks cover persisted-state compatibility, presets, noise, pulse envelopes, crossfade continuity, automation/phase integration, short-session fades, import bounds and PCM framing. Local HTTP source-browser checks exercise stereo routing, all recordings/noise channels, mute/solo/pan, sweep pause/resume, stage editing/completion, saving/reload, JSON round trips, WAV downloads/cancellation, a streaming writer, export chunk comparisons and 320/390/768/1365px layouts. Screenshots and browser evidence are in ignored `output/playwright/`.

The standalone build is checked for embedded asset hashes, script compilation, inline controls and absence of automatic network or companion-file dependencies. Direct `file://` launch could not be automated because the in-app browser's security policy blocks that protocol; the browser checks use the editable source over loopback HTTP, not a workaround for the file-origin restriction.

## Scope

The three modes synthesize the selected rhythm using the Web Audio API. The environment tracks are locally bundled MP3 recordings. A browser cannot calibrate the acoustic level at your headphones, so start with a low device volume. This prototype does not include pulsed-light visuals.
