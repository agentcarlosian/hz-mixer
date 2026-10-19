# Hz Mixer Guide

Hz Mixer combines binaural beats, monaural beats or isochronic pulses with field recordings and generated noise. This guide covers the mixer, frequency programs, saved mixes, audio export and offline use.

## Listening Safety

**Use Hz Mixer only while sitting or lying down in a safe place. Do not use it while driving, operating machinery, or where reduced alertness or altered awareness could cause injury.**

Start with low device and mixer volumes, then adjust to a comfortable level. Pause and remove your headphones if the sound is uncomfortable or you feel unwell. Do not raise the volume just because a very low carrier is difficult to hear.

Hearing risk depends on sound level, listening duration and repeated exposure. The Monitor measures digital audio in dBFS, not sound pressure at your ears. A mixer percentage or meter reading cannot establish a safe headphone volume. For general hearing guidance, see the [World Health Organization's safe-listening advice](https://www.who.int/news-room/questions-and-answers/item/deafness-and-hearing-loss-safe-listening).

Use stereo headphones for binaural playback. Monaural, isochronic and environment-only mixes do not require separate signals at each ear.

## Quick Start

1. Sit or lie down, lower your device volume, and connect stereo headphones if using binaural mode.
2. Choose a preset from Mix library, or set a generator mode, beat rate and carrier pitch.
3. Enable the environment tracks or noise you want and set their levels.
4. Select a session timer or No timer, then press Play. Hz Mixer never starts restored audio automatically.
5. Adjust Tone level, individual layer levels and Master gradually. Pause preserves progress; Stop returns the program to its beginning.

The information button in the header opens a short reference and the full guide. The guide opens inside the current mixer without changing playback or settings; select Mixer to return. The website also provides a dedicated `guide.html` page for direct links.

Reset mixer is the larger circular-arrow button in the playback controls. It restores a tone-only default with every recording, noise channel and bell off, without deleting saved mixes or changing interface/theme preferences. Fresh sessions use the same default; restored and imported mixes retain their saved channel selections.

## Generator Modes

| Mode | Signal | Listening setup |
| --- | --- | --- |
| Binaural | One tone at carrier minus half the beat rate in the left channel, and one at carrier plus half the beat rate in the right. | Stereo headphones. |
| Monaural | Those two tones mixed into both channels. | Headphones or speakers. |
| Isochronic | One carrier whose amplitude repeats at the beat rate. | Headphones or speakers. |
| Off | No generator tone; enabled recordings and noise remain available. | Headphones or speakers. |

For example, a 200 Hz carrier and 8 Hz binaural beat use 196 Hz on the left and 204 Hz on the right. Monaural mode mixes those frequencies together; isochronic mode pulses a 200 Hz carrier eight times per second.

Generator mute silences only the tone. Generator solo isolates it from other enabled layers, unless another layer is also soloed. Turning the generator Off clears its solo state.

## Frequencies and Presets

Type a value directly or use its slider:

- **Beat rate:** 0.10-120.00 Hz, in 0.01 Hz steps.
- **Carrier pitch:** 1-5000 Hz, in whole-hertz steps.
- **Tone level:** generator level, independent of the environment and Master.

The two-tone modes require carrier pitch to be greater than half the highest beat rate in the program. Invalid combinations show an error because the lower tone would reach zero or a negative frequency. For sweeps and sessions, this check covers their rates too.

The carrier range includes infrasonic frequencies below 20 Hz; a generated signal is not a guarantee that the playback system reproduces its fundamental. Modulation can introduce audible higher-frequency components. The selectable range describes signal settings, not whether a binaural beat will be perceptible at every combination. High pulse rates can sound like a buzz or rough texture instead of separate pulses.

Live playback checks the audio context's sample rate against the generator's frequency budget. If a device uses a lower sample rate that cannot accommodate the settings, the generator shows an error rather than silently changing the frequencies. WAV and MP3 exports use their selected 44.1 or 48 kHz rate.

The library has 61 presets, grouped by band. Search matches names, bands, enabled methods, programs and active sound layers, including saved mixes. Multiple words (such as `theta isochronic sweep`) and Favorites narrow the results. The band ranges are:

| Band | Range |
| --- | --- |
| Delta | 0.10 Hz to below 4 Hz |
| Theta | 4 Hz to below 8 Hz |
| Alpha | 8 Hz to below 13 Hz |
| Beta | 13 Hz to below 30 Hz |
| Gamma | 30-120 Hz |

Environment-only presets appear under Environment only. Selecting a preset loads its generator, program, layer and level settings and resets the frequency-program clock. It does not start playback. Editing settings makes the selection Custom; saving creates your own named mix. Reset restores the starting mix without deleting your library.

The readout lists enabled tones, methods and fixed/sweep/Session rates. Independent programs show separate rates. Muted or solo-excluded tones remain in this configuration summary.

The dice button beside Reset generates a new random mix rather than selecting a random preset. It varies the generator method, rates, carrier, pulse shape and a limited selection of environment, noise and bowl layers. Master level, master mute, fades, timer and the current Fixed/Sweep/Session selection are retained. Sweep timing and repeat behavior, or session stage types, durations and transitions, are also retained while their rates change. Session parameter changes are cleared. Applying a roll restarts the program clock but does not start stopped or paused playback, change your theme, or alter saved mixes and favorites. Save mix keeps a roll you like.

The permanent **Restore previous mix** arrow beside Dice restores the settings from immediately before the last Reset or Dice action. It is disabled until one of those actions creates a restore point. Another Reset or Dice replaces that point; editing or loading a mix, restoring it, or reloading the page clears it. This is one-step restoration, not redo or audio rewind. Playback remains playing or paused, with the restored program clock starting at zero. Saved mixes and favorites are not changed. A previously selected preset or saved mix is reselected only if that entry still matches the restored settings; otherwise the restored mix is Custom.

Simple mode generates a single tone layer without source effects. Advanced mode can add up to two following tone layers, waveform changes, AM, slow panning, gentle pitch modulation and filtering. Randomization uses moderate channel levels and checks the known audio sample-rate budget; it does not randomly raise the master or remove a master mute. The existing playback and export validation still applies.

The library includes fixed-rate mixes, five sweeps and three staged sessions. A moving program is grouped by its starting beat rate, even if it later crosses into another band. Examples include:

| Preset | Mix |
| --- | --- |
| Three carriers / 7.83 Hz | Three binaural pairs at 174, 348 and 522 Hz, with light pitch modulation, pink noise and surf. |
| Binaural + AM / 10 Hz | A binaural pair with sine-wave amplitude modulation over sea waves. |
| Pink AM / 40 Hz | Monaural tones and pink noise with opposite-phase left/right amplitude modulation. |
| Rain dual sweep / 7.83 to 4.5 Hz | Binaural and isochronic tones follow the same 15-minute sweep in each direction, over window rain and pink noise. |
| Current dual sweep / 22 to 14 Hz | Binaural and isochronic tones descend together over ten minutes, then hold for the rest of the 20-minute session. |
| Current to embers / 18 to 6 Hz | A 20-minute staged program that crossfades a stream into a campfire as the rate descends. |
| Stream & Singing Bowl I | Environment-only stream with a bowl every three minutes. |
| Filtered white drift | Environment-only low-pass-filtered white noise with slow stereo movement. |

Simple mode plays the complete preset; an **Advanced settings in mix** indicator appears when it includes extra tones, effects or parameter changes. Switch to Advanced to edit those settings. Selecting a preset does not change your interface mode.

## Isochronic Pulse Shape

Pulse controls appear only in Isochronic mode:

- **Width, 10-90%:** the portion of each beat cycle occupied by the pulse, including its softened edges. A wider pulse lasts longer; a narrower one is shorter. The beat rate itself stays unchanged.
- **Softness, 0-100%:** the amount of smoothing at the start and end of each pulse. Higher values use longer, gentler transitions. Low values make the pulse more abrupt.
- **Depth, 0-100%:** how far the amplitude falls between pulses. At 100%, the intended envelope falls to silence; at 0%, the carrier is continuous. Intermediate depths keep a background level of the carrier.

Pulse shape changes both timbre and average signal energy. At the same Tone level and full depth, wider pulses carry more average energy than narrower pulses. Width is not automatically loudness-normalized. Lower the tone first when experimenting with a wider or more abrupt pulse.

Pulse shaping applies only to the generator. Recordings and noise have independent level controls.

## Frequency Programs

**Fixed** holds the manual beat rate. The Beat rate number and slider appear only in Fixed. Sweep and Session use their own rate controls, while Carrier pitch remains available in every program. Returning to Fixed restores its last manual rate.

**Sweep** moves between Start Hz and End Hz over 5-7200 seconds. Linear changes at a constant rate; Smooth eases the transition at the ends. Once, then hold keeps the end rate after the sweep finishes. Ping-pong alternates forward and return sweeps. The selected session timer still determines when playback ends; No timer permits continuing playback.

**Session** opens the stage editor inside Generator, beside the environmental mixer rather than beneath all its tracks. A Hold shows one Rate Hz. A Sweep shows Start Hz, End Hz and a Linear or Smooth transition. Enter each duration as minutes and seconds. Add, remove or move stages with the stage buttons. A session contains 1-16 stages, each 5 seconds to 60 minutes, with a combined maximum of two hours. Its timer comes from the stage total and cannot be selected separately.

The program monitor shows the rate path, current position and current stage. Editing sweep settings, editing/reordering stages or changing program type resets the program clock. Ordinary level, mute and balance changes do not reset it. Pause preserves the current clock position.

## Playback and Fades

Play starts a stopped mix, or resumes a paused one. Pause holds the program position and suspends playback. Selecting a different mix resets its frequency-program clock.

Stop uses the selected fade-out and resets the position. Press Stop again during that fade to end immediately. A finite timer stops automatically at its endpoint. No timer keeps playback running until you stop it.

Fade in and Fade out accept 0-30 seconds. They apply to the whole mix. For short timed sessions, fades are limited to fit within half the session length. A zero-second fade-out holds the level until the endpoint instead of gradually fading across the session.

Master changes the whole mix; Master mute silences all channels without changing their individual levels. Output processing includes a shared compressor to manage peaks, so very loud combined layers can change the mix's dynamics. Neither the compressor nor Master measures the listening volume produced by your headphones or speakers.

## Environment and Noise

The environmental recordings are Waterfall, Stream, Thunderstorm, Sea waves, Campfire and Window rain. Waterfall is mono; the others are stereo. Window rain is rain against glass, separate from the rain-and-thunder recording. The displayed duration is the source recording length, rounded to seconds. Playback uses a derived, crossfaded loop, so the repeat interval is slightly shorter. The four original MP3 recordings are unchanged; Campfire and Window rain are converted from source WAV files.

White, pink and brown noise are generated locally. White has a broad spectrum; pink and brown place progressively more emphasis on lower frequencies. They use the same channel controls as recordings.

Each layer has:

- **Enable:** include or remove the channel.
- **Level:** adjust its contribution to the mix.
- **Mute:** silence it without changing its level or enable state.
- **Solo:** hear only enabled, soloed channels. Selecting Solo also enables that channel.
- **Balance:** move its signal left or right. Select the balance readout to reset it to Center.

Every level slider has a percentage box. Type 0-100, then press Enter or leave the field to apply. Invalid or empty entries revert; Escape discards an edit. Main/master and environment levels use whole percentages; extra tones can retain fractions. Editing does not enable, unmute or solo a source.

Mute wins over solo. Disabling a channel clears its solo flag. Clear solo removes all solo flags while leaving enabled layers on. A Loading state means the recording is being fetched or decoded; Unavailable indicates a load failure. Website recordings are loaded only when needed. The portable HTML already contains them.

## Interval Bells

Singing Bowl I and Singing Bowl II are two Tibetan bowl recordings. Each is off by default and has its own level, mute, solo, balance and **Repeat every** field in minutes. Enter `1` for every minute, `5` for every five minutes, or another interval from 0.25 to 120 minutes. The adjacent arrows, or the Up and Down keys while editing the field, adjust the interval by 15 seconds. For example, `0.75`, `0.5` and `0.25` minutes are 45, 30 and 15 seconds. Typed intervals are stored to the nearest second.

An enabled bell strikes at the beginning of the session and at each interval multiple. It plays its recorded decay once, followed by silence, rather than looping the bell continuously. There is no automatic final bell. Normal master level, mute, session fades and timer apply, so a session's fade-in can soften the initial strike and its end can cut off a decay.

On initial loading, the first strike starts from the beginning of its recording as soon as it is available; later strikes retain their session-clock positions. If loading takes an entire interval, missed strikes are skipped instead of replayed in a burst.

The interval follows elapsed session time, not wall-clock time. Pause freezes that clock; Resume continues the current decay or the remaining interval without an extra strike. Stop resets the clock. Applying a preset or saved mix also restarts the program clock. Enabling a bell or changing its interval during playback aligns it to the current session clock, including any decay already in progress. Hidden-tab delays do not create a burst of missed strikes.

Bells remain independent of the generator's beat rate and pulse envelope. They use the same mute/solo rules as environment and noise channels. Saved mixes and JSON backups retain both intervals, and WAV/MP3 exports include the same scheduled strikes, with no extra strike exactly at the export endpoint. The lossless PCM WAV files preserve the supplied AIFF samples without crossfading or resampling the source files.

## Monitor

The Monitor above Generator displays the combined output as a waveform or a spectrum. Select the view using its two buttons. The RMS readout and bar show a digital signal level in dBFS; they are not a calibrated measurement of headphone volume.

The session clock shows the time remaining, or a placeholder when no timer is selected. The generator readout shows the two intended tone frequencies or the current isochronic pulse rate. For active programs, the rate changes as the program advances.

## Saved Mixes and Favorites

Save mix stores a named snapshot in this browser. Up to 30 named mixes are supported, with names up to 40 characters. Saving an existing name updates that entry; the dialog tells you when this will happen. Built-in presets are not overwritten.

Choose a saved entry from Mix library to load it. Delete removes the selected saved entry but retains the settings currently in the mixer. Favorites apply to built-in presets and are included in library backups.

Current settings, saved mixes, favorites, theme and Matrix pause state use local browser storage. Private browsing, clearing site data, changing browsers or moving the portable file can affect what is available. A saved mix in one browser or file location is not automatically shared with another.

## Import and Backup

Export has separate Mix JSON and Library backup tabs. Mix JSON contains the current mix and program settings. Library backup includes named mixes, the current mix and built-in preset favorites. Neither includes theme or Matrix motion preferences.

To transfer your library, export a backup from the old location, then import it in the new one. Audio exports cannot restore editable mixer settings; use JSON for that.

Import accepts version 2-6 Hz Mixer JSON files smaller than 4 MB. It validates and previews entries before making changes. Merge keeps existing saved mixes and adds imported entries; Replace replaces the saved library with the previewed entries. Conflicting names receive an import suffix instead of silently overwriting an unrelated entry.

Exports that contain beat rates outside 0.50-40.00 Hz or carriers outside 20-2000 Hz use version 3, including expanded values in inactive sweeps/stages. Older builds reject these files instead of silently clamping their frequencies. Mixes that fit the older limits still export as version 2.

Mixes with non-default Campfire or bell settings use version 4 instead, including changed settings on disabled channels. Older builds reject version 4 rather than silently discarding those layers. Versions 2 and 3 import with the new channels off by default.

Non-default Window rain settings use version 5, including changed settings while the channel is disabled. This prevents older builds from dropping the channel silently. Version 2-4 files import with Window rain off by default.

Non-default effects, tone-layer settings or stage parameter changes use version 6, including configured but disabled effects and tone layers. Version 2-5 files restore with effects off, the original sine carrier and no additional tones. Unchanged mixes keep the previous export-version rules.

The preview shows the resulting count against the 30-mix limit. A library backup's current mix can optionally become a saved entry. That option is initially unchecked if including it would exceed capacity while the saved library itself fits. An overflowing or invalid import cannot be applied.

Import does not start playback or load the imported settings into the current audio automatically. Select the imported entry from Mix library afterward. If a replaced entry no longer matches the current settings, the current selection becomes Custom rather than silently changing the sound.

## Audio Export

Choose Export, then Audio, and select a format:

| Setting | Options |
| --- | --- |
| WAV | Stereo 16-bit PCM, uncompressed |
| MP3 | Stereo, lossy, 128/192/256/320 kbps; default 256 kbps |
| Sample rate | 44.1 or 48 kHz |
| Duration | 1 second to two hours |

Exports render a snapshot of the current settings from the beginning of the program, not a recording of past live edits or the current playhead. Live changes after export starts do not alter that snapshot. The render includes mute/solo, balance, levels, pulse shape, sweeps/stages, fades and output processing.

Session exports use the stage total. Other programs let you edit export duration. The suggested length follows the current program or timer; a one-way sweep initially suggests its sweep duration. Export rejects a silent mix or invalid two-tone frequency combination.

WAV is the uncompressed reference and has an exact PCM sample count. MP3 is smaller but adds codec delay/padding, so decoded duration can be slightly longer. Both preserve left/right channels. Converting a binaural export to mono elsewhere removes its separate-ear routing.

Generator exports use a short matching-time overlap at render-block boundaries to smooth small native oscillator restart differences. This does not add or remove samples or change the pulse-shape settings.

The progress indicator shows loading, rendering and encoding. Cancel detaches from pending recording or encoder downloads without cancelling a load shared with playback. An already-running native render finishes its current block; MP3 encoding yields between smaller batches. Shared downloads may finish for cache reuse.

Ordinary downloads keep encoded chunks in browser memory. Long exports can still use substantial memory. Save directly to file appears only where the browser supports that API and uses its native file picker. Before finalization, a cancelled direct writer is aborted instead of committed. Once writing is complete, Finalizing commits the file; Cancel is disabled and Escape does not dismiss the dialog until this finishes. A commit error is shown in the dialog and the controls become available again. Inspect the destination if a browser or operating system reports an error.

The MP3 encoder loads only when needed on the website. It is embedded in the portable HTML. An audio export is not a JSON settings backup.

## Mixer Workspace

Simple is the default interface. It keeps Generator and all Environment tracks together below the Monitor, side by side on desktop and stacked on smaller screens. Fades remain in Generator. Choosing Session as the frequency program shows its stage editor inline in Generator.

Advanced keeps that same arrangement and reveals additional tone layers, carrier shaping, source effects and stage parameter changes. The Simple/Advanced selection is remembered on this browser, separately from saved mixes. Switching interfaces does not change the sound, clear hidden settings, reset playback or alter exports. Simple displays Advanced settings in mix when a mix contains extended settings.

### Tone Layers

Advanced adds Tone 1, Tone 2 and Tone 3 tabs to Generator. Tone 1 has the original Generator controls, carrier bookmarks, waveform and balance. Tone 2 and Tone 3 each have an enable switch, method, program, carrier, beat rate, waveform, level, mute, solo and balance. Additional tones and effects are off by default. Solo and Clear solo operate across all tones, environment, noise and bells. Settings are included in saved mixes, JSON backups and audio exports unless explicitly described as monitor-only.

Follow Tone 1 uses the main frequency program. Fixed shows the selected tone's own Beat Hz. Sweep uses its own start/end rates, duration, curve and Hold end or Ping-pong repeat behavior. The manual Beat Hz field is hidden for Follow and Sweep. All tones use the same transport clock and overall session timer; Pause/Resume preserves progress and Stop resets it.

Carrier bookmarks include 174, 200, 250, 285, 300, 396, 400, 417, 432, 528, 639, 741, 852 and 963 Hz. These select a numeric carrier; they do not retune recordings. In binaural/monaural methods, carrier remains the center of the two component frequencies.

Sine uses the original carrier. Triangle, Square and Sawtooth are finite-harmonic versions with up to eight partials. Harmonic blend exposes H2/H3/H4 amplitudes relative to a fixed fundamental. Combined absolute partial amplitudes are normalized for headroom. Waveforms and modulation settings must fit the actual audio sample rate; invalid combinations show an error rather than silently changing the controls.

Generator trim is `1/N` for N enabled tones included by mute/solo. Its decibel value appears as Tone headroom next to the tone tabs. Enabled zero-level tones still count, keeping trim stable during crossfades. Environmental/noise/bell levels are not included in that trim.

### Effects

In Advanced, the sliders icon beside each tone, recording or noise source opens its effects popup. The button is highlighted when that source has effects enabled. Effects for can switch directly to another source. Each retains its own settings, grouped into AM, Movement, Pitch and Filter. The reset button resets only that source's effects, not its level, waveform or program. Close or Escape returns to the source button. Bells keep their independent interval playback and are not included in the effects selector.

Amplitude modulation uses a nonnegative volume envelope. Depth is the dip from the unmodulated peak: 0% leaves amplitude unchanged and 100% applies the full envelope. Shape selects Sine, Triangle, Square or Rounded pulse. Width changes square/pulse duty cycle; Softness controls rounded-pulse edges. Sharp shapes use a 64-harmonic smoothed reconstruction, so their transitions are band-limited rather than mathematically instantaneous.

Timing can follow the source's beat program or use an independent 0.10-120.00 Hz rate. Generator sources follow their own Follow/Fixed/Sweep selection; recordings and noise follow the main program. Phase is in degrees. Linked channels use the same envelope. Phase offset adds Right phase to the right channel. Independent channels also use Right rate; the left channel can still follow its selected timing. Mono noise/recordings are duplicated to stereo before separate envelopes are applied.

Combining a binaural generator with AM keeps the carrier tones in separate ears. Square or Rounded pulse provides a binaural-plus-pulse combination. Isochronic mode retains its original Width/Softness/Depth shaping; its optional AM block adds another envelope after that shaping.

Auto pan / balance has a rate, depth and phase. Environmental/noise sources use stereo panning. Generated sources use separate left/right gains without crossfeeding the carrier channels. Static and automated balance remain available; movement is clamped at the channel extremes.

Pitch modulation is available on generators. FM uses deviation in Hz; PM uses phase depth in degrees. Both have their own rate and are applied equally to both carrier channels, preserving their fundamental frequency difference. FM/PM depth, carrier harmonics and amplitude modulation contribute to the frequency-budget check.

Filter selects Off, Low-pass, High-pass, Band-pass or Notch, with Frequency Hz and the native Web Audio Q parameter. Filtering occurs before AM and is a general sound-shaping control. Filters retain stereo channels. Resonant settings can increase peaks; layer and Master controls still determine the mix level.

The AM envelope preview shows the selected source's current shape/depth and channel relationship over two left-channel cycles. Monitor A/B switches between processed AM and dry amplitude for listening only. Match level attenuates the dry signal using the envelope's RMS factor; it is disabled when depth is automated. Closing the popup, switching source or leaving AM ends the dry audition. A/B never changes saved settings or exports: audio exports always use the configured processed mix, even while B: Dry is selected.

### Session Changes

Choosing Session in Generator's frequency program activates its inline stage editor. Hold stages show a single rate and duration; Sweep stages also show an end rate and transition. Duration has separate minutes and seconds inputs. In Advanced, the editor stays in the Generator area when switching tone tabs. Fade-in/out remain in Generator.

In Advanced, expand Parameter changes on a stage to reveal Add change and its configured changes. The count remains visible while collapsed; collapsing does not disable or remove anything. Choose a Setting, enter From and To values, then select a Linear or Smooth transition. Each stage supports up to 16 unique settings: source Level, Balance, AM depth, Filter Hz and tone Carrier Hz. Bell levels are available, but strike intervals remain independent.

For a layer crossfade, enable both sources and add opposing Level changes in the same stage, for example one from 40 to 0 and the other from 0 to 40. A source or effect must be enabled separately: a stage change does not enable a disabled channel, AM block or filter. Changes configured while session stages are off remain inactive.

Parameters hold their last endpoint until another stage changes them. Transitions between different stage endpoints include a 20 ms dezipper. Source levels, carrier phase, modulation phase and filter scheduling use the same timeline in live playback and chunked exports. Editing active stages or their changes resets the session clock. Moving/removing a stage moves/removes its changes with it.

## Themes and Motion

The header offers System, Dark, Light, Green, Blue and Matrix. Green is the original dark-green palette. Dark uses near-black with purple accents; Blue uses cyan/yellow/magenta accents. Matrix uses a black/green palette and falling background code, mixing kanji, katakana, letters/numbers and vertical mixer vocabulary such as BINAURAL, BEAT and MIXER. Monitor colors follow the selected theme.

System follows the device's light/dark preference.

Matrix has its own pause/resume button. Reduced-motion preferences disable the rain, and hidden tabs or other themes stop its animation. This preference is separate from mix backups. The rain is decorative and is not synchronized to the beat.

## Privacy and Offline Use

Generation, mixing, audio export, encoding and JSON import happen in the browser. Hz Mixer has no account system, analytics, microphone capture or upload endpoint. It does not upload your settings, imported JSON or exported audio.

The website requests static app files, enabled recordings and the MP3 encoder from its host. Hosting still receives those normal requests; GitHub Pages records visitor IP addresses for security. There is no service worker or automatic offline installation.

The portable `Hz Mixer.html` embeds the application, recordings, icons, guide, encoder, notices and corresponding encoder source. It needs no companion files or local server and makes no automatic runtime network requests. Links to outside websites open only when selected. Play is still required before audio starts.

Website and portable-file storage are separate. Moving or renaming a portable file may also create separate storage. Export a Library backup before changing locations, and import it afterward. Browser/operating-system background and lock-screen behavior varies; verify listening on the device you intend to use.

## Troubleshooting

- **No sound:** press Play, check device output and volume, then inspect Master mute, generator/layer mute, enable switches and solo flags. In Off mode, at least one environment/noise channel must be enabled and raised.
- **Only one part of the mix is audible:** check Solo first. Clear solo restores all otherwise-enabled, unmuted layers.
- **Two-tone error:** raise carrier pitch above half the program's highest beat rate or lower that rate.
- **A pulse sounds too abrupt or dominates the recording:** lower Tone level, increase Softness, or reduce Depth. Width also changes average tone energy. Adjust one control at a time.
- **Recording unavailable on the website:** check the connection, then disable/re-enable that channel to retry. The portable build includes recordings locally.
- **Saved mixes appear missing:** return to the same browser and website/file location, or import a previously exported Library backup.
- **Import is disabled:** review the error, preview and effective count. Deselect the optional current entry or change the library action if appropriate.
- **Export fails:** check for a silent mix, invalid frequencies, unavailable recordings or memory pressure. Try a shorter export and use WAV to separate rendering from MP3 encoding issues.
- **Audio pauses in the background:** check the browser/device's media and power behavior. Layout testing does not establish uninterrupted listening on every mobile or desktop platform.

## Credits and Licenses

The four original environmental recordings by Joseph Sardin / BigSoundBank, Campfire by Nox_Sound, Window rain by alxl, and Singing Bowl I / Singing Bowl II by ganapataye retain their CC0 terms. White, pink and brown noise are synthesized. Original Hz Mixer code and artwork use MIT; Lucide utility icons retain their separate notices. The lamejs MP3 encoder remains LGPL-3.0 and is independently replaceable.

Credits in the mixer footer contains full notices, recording provenance, encoder replacement instructions and an exact upstream encoder-source download. Those notices and the source download are embedded in the portable file as well as supplied with the release package. The original-code MIT license does not replace component or recording terms.
