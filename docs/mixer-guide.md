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

- **Beat rate:** 0.50-40.00 Hz, in 0.01 Hz steps.
- **Carrier pitch:** 20-2000 Hz, in whole-hertz steps.
- **Tone level:** generator level, independent of the environment and Master.

The two-tone modes require carrier pitch to be greater than half the highest beat rate in the program. Invalid combinations show an error because the lower tone would reach zero or a negative frequency. For sweeps and sessions, this check covers their rates too.

The library has 37 starting presets. Band and method filters, search and Favorites narrow the list. The band filters use these beat-rate ranges:

| Band | Range |
| --- | --- |
| Delta | 0.50 Hz to below 4 Hz |
| Theta | 4 Hz to below 8 Hz |
| Alpha | 8 Hz to below 13 Hz |
| Beta | 13 Hz to below 30 Hz |
| Gamma | 30-40 Hz |

Environment-only presets appear under Nature. Selecting a preset loads its generator, program, layer and level settings and resets the frequency-program clock. It does not start playback. Editing settings makes the selection Custom; saving creates your own named mix. Reset restores the starting mix without deleting your library.

## Isochronic Pulse Shape

Pulse controls appear only in Isochronic mode:

- **Width, 10-90%:** the portion of each beat cycle occupied by the pulse, including its softened edges. A wider pulse lasts longer; a narrower one is shorter. The beat rate itself stays unchanged.
- **Softness, 0-100%:** the amount of smoothing at the start and end of each pulse. Higher values use longer, gentler transitions. Low values make the pulse more abrupt.
- **Depth, 0-100%:** how far the amplitude falls between pulses. At 100%, the intended envelope falls to silence; at 0%, the carrier is continuous. Intermediate depths keep a background level of the carrier.

Pulse shape changes both timbre and average signal energy. At the same Tone level and full depth, wider pulses carry more average energy than narrower pulses. Width is not automatically loudness-normalized. Lower the tone first when experimenting with a wider or more abrupt pulse.

Pulse shaping applies only to the generator. Recordings and noise have independent level controls.

## Frequency Programs

**Fixed** holds the manual beat rate. Editing the main Beat rate field or slider selects Fixed, even if a different program was active.

**Sweep** moves between Start Hz and End Hz over 5-7200 seconds. Linear changes at a constant rate; Smooth eases the transition at the ends. Once, then hold keeps the end rate after the sweep finishes. Ping-pong alternates forward and return sweeps. The selected session timer still determines when playback ends; No timer permits continuing playback.

**Session** plays an ordered list of Hold and Sweep stages. A Hold uses its Start Hz throughout. A Sweep uses Start Hz, End Hz and its selected curve. Add, remove or move stages with the stage buttons. A session contains 1-16 stages, each 5-3600 seconds, with a combined maximum of two hours. Its timer comes from the stage total and cannot be selected separately.

The program monitor shows the rate path, current position and current stage. Editing sweep settings, editing/reordering stages or changing program type resets the program clock. Ordinary level, mute and balance changes do not reset it. Pause preserves the current clock position.

## Playback and Fades

Play starts a stopped mix, or resumes a paused one. Pause holds the program position and suspends playback. Selecting a different mix resets its frequency-program clock.

Stop uses the selected fade-out and resets the position. Press Stop again during that fade to end immediately. A finite timer stops automatically at its endpoint. No timer keeps playback running until you stop it.

Fade in and Fade out accept 0-30 seconds. They apply to the whole mix. For short timed sessions, fades are limited to fit within half the session length. A zero-second fade-out holds the level until the endpoint instead of gradually fading across the session.

Master changes the whole mix; Master mute silences all channels without changing their individual levels. Output processing includes a shared compressor to manage peaks, so very loud combined layers can change the mix's dynamics. Neither the compressor nor Master measures the listening volume produced by your headphones or speakers.

## Environment and Noise

The recordings are Waterfall, Stream, Thunderstorm and Sea waves. Waterfall is mono; the other recordings are stereo. The displayed duration is the original recording length. Playback uses a derived, crossfaded loop, so the repeat interval is slightly shorter. The source MP3 recordings are unchanged.

White, pink and brown noise are generated locally. White has a broad spectrum; pink and brown place progressively more emphasis on lower frequencies. They use the same channel controls as recordings.

Each layer has:

- **Enable:** include or remove the channel.
- **Level:** adjust its contribution to the mix.
- **Mute:** silence it without changing its level or enable state.
- **Solo:** hear only enabled, soloed channels. Selecting Solo also enables that channel.
- **Balance:** move its signal left or right. Select the balance readout to reset it to Center.

Mute wins over solo. Disabling a channel clears its solo flag. Clear solo removes all solo flags while leaving enabled layers on. A Loading state means the recording is being fetched or decoded; Unavailable indicates a load failure. Website recordings are loaded only when needed. The portable HTML already contains them.

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

Import accepts version 2 Hz Mixer JSON files smaller than 1 MB. It validates and previews entries before making changes. Merge keeps existing saved mixes and adds imported entries; Replace replaces the saved library with the previewed entries. Conflicting names receive an import suffix instead of silently overwriting an unrelated entry.

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

The progress indicator shows loading, rendering and encoding. Cancel detaches from pending recording or encoder downloads without cancelling a load shared with playback. An already-running native render finishes its current block; MP3 encoding yields between smaller batches. Shared downloads may finish for cache reuse.

Ordinary downloads keep encoded chunks in browser memory. Long exports can still use substantial memory. Save directly to file appears only where the browser supports that API and uses its native file picker. A cancelled direct writer is aborted instead of committed; inspect the destination if a browser or operating system reports an error.

The MP3 encoder loads only when needed on the website. It is embedded in the portable HTML. An audio export is not a JSON settings backup.

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

The four field recordings are by Joseph Sardin / BigSoundBank and retain their CC0 terms. White, pink and brown noise are synthesized. Original Hz Mixer code and artwork use MIT; Lucide utility icons retain their separate notices. The lamejs MP3 encoder remains LGPL-3.0 and is independently replaceable.

Credits in the mixer footer contains full notices, recording provenance, encoder replacement instructions and an exact upstream encoder-source download. Those notices and the source download are embedded in the portable file as well as supplied with the release package. The original-code MIT license does not replace component or recording terms.
