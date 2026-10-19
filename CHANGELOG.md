# Changelog

## [0.1.0] - Release Candidate

- Permanent Restore previous mix command beside Reset/Dice. It retains one in-memory settings snapshot, restores matching preset/saved selection metadata, preserves playback state and leaves the saved library/favorites untouched.
- Editable percentage boxes accompany all channel/master/tone level sliders. Richer tone/program summaries, metadata-aware preset search, theme-aware hover/keyboard tooltips, reduced-motion-aware reset/dice feedback and an original logs-and-flames campfire icon complete the UI polish.
- Dice-button random mixes beside Reset, with bounded, sample-rate-checked settings and Simple/Advanced behavior. Master/mute, fades, timer and program timing are preserved; saved mixes and favorites are unchanged.
- Manual Beat rate is shown only in Fixed; Sweep and Session cannot accidentally switch to Fixed through that control.
- Session stages now edit inline in Generator, with contextual Hold/Sweep fields, minute/second durations and collapsible advanced parameter changes.
- Fresh/reset mixes leave every recording, noise channel and bell off; presets and explicit saved channel selections are preserved.
- Enlarged Reset mixer and moved it from the library row into the playback controls.
- Simplified the header by replacing Band/Method filters with a larger current-mix readout. Listening safety remains in the info popup and documentation instead of a repeated mixer banner.
- Restored classic mixer layout in default Simple mode; Advanced reveals tone-layer tabs, shaping, contextual effects popups and stage changes without replacing the full Environment mixer.
- Opt-in per-source sine/triangle/square/rounded-pulse AM, separate stereo envelopes, binaural-plus-AM, auto-pan/balance, FM/PM and general audio filters.
- Main generator plus two additional tone layers, fixed/follow/sweep programs, carrier bookmarks, finite-harmonic waveforms, harmonic blending and generator headroom trim.
- Envelope preview and monitor-only AM/dry A/B with optional RMS matching; inline per-stage From/To changes for level/crossfades, carrier, balance, AM depth and filter cutoff.
- Non-default effects and tone-layer settings use version 6 JSON; older imports and ordinary-mix export versions remain supported. JSON import and local restoration bounds are 4 MB for dense session libraries.

Initial Hz Mixer release, rebranded from the local Beat Mixer prototype.

- Static web mixer with lazy-loaded assets, plus optional self-contained offline HTML.
- Binaural, monaural and isochronic synthesis with 0.10-120.00 Hz beat entry in hundredth-hertz steps and 1-5000 Hz carrier pitch. Pulse synthesis and preset settings are unchanged; live sample-rate checks protect unsupported combinations.
- 61 band-grouped presets, search and favorites. The 24 additional mixes include ten layered fixed-rate mixes, five sweeps, three staged sessions and six environment-only combinations; the original 37 presets are unchanged.
- Audio-clock sweeps, pause/resume and reusable hold/sweep stages.
- Six CC0 environmental recordings with crossfaded loops, including Campfire and Window rain; white, pink and brown noise.
- Window rain includes a dedicated window-and-raindrops icon and version 5 JSON for non-default channel settings, preserving imports from versions 2-4.
- Two CC0 Tibetan bowl bells with independent minute-based repeat intervals, channel controls, clock-aligned playback and WAV/MP3 export. Bell sources are converted losslessly from AIFF to WAV. Non-default new-layer settings use version 4 JSON, with older-version import retained.
- Layer level/mute/solo/balance, fades, pulse shaping and waveform/spectrum monitoring.
- Named mix storage, JSON export/import/backup and stereo WAV/MP3 rendering with progress/cancel and optional direct-to-file saving.
- Version 3 JSON for expanded-frequency settings, with version 2 import/export compatibility for ordinary-range mixes.
- MP3 bitrate selection (128, 192, 256, 320 kbps) at 44.1/48 kHz, using a separately replaceable LGPL-3.0 encoder with full licences and exact upstream source.
- System, black/purple Dark, Light, Green, Blue and Matrix themes with responsive controls. Previous explicit Dark selections migrate to Green; appearance changes do not alter audio settings.
- Blue is the renamed Cyberpunk palette with saved-choice compatibility. Matrix has gentle kanji/kana code rain and vertical mixer vocabulary, pause/resume, reduced-motion support and no hidden-tab rendering.
- Pink and brown noise wave icons use matching colors in both themes and remain visible in the desktop noise mixer.
- Simplified Hz Mixer header, an original mixer-and-waves mark and literal environment artwork, and a monitor-first layout with unnumbered Generator and Environment headings.
- Locked development tooling, automated checks and reproducible, checksummed release packaging.
- Header information dialog, a comprehensive guide embedded in both builds, and a visible listening-safety warning.
- Public privacy documentation, archive/source link validation and a manual-only, main-restricted Pages deployment workflow.

See the release runbook for validation and manual acceptance requirements.

### Audit Fixes

- Generator export-block overlaps smooth low-carrier PCM joins while preserving exact sample counts and stereo routing.
- Playback revalidates and uses the latest settings after asynchronous startup, keeping preset/field changes aligned with actual audio.
- Direct-file exports check cancellation before commit and expose a non-cancellable Finalizing phase with recoverable error handling.
- Zero fade-out now holds level until the final stop, including across offline render blocks.
- Cancelling export detaches from held recording/encoder loads while preserving shared playback/cache consumers.
- Session editing preserves keyboard focus; stage-only timer options cannot change a Fixed timer unexpectedly.
- Save, Export, Import, Privacy and Credits dialogs expose accessible names.
- Library replacement clears mismatched saved selections; capacity-aware import previews support full 30-mix backups safely.
- Release verification checks both built outputs against current source, with regressions for stale/tampered files.
- Preview path checks cover canonical Windows aliases as well as letter case, preserving loopback-only serving.
