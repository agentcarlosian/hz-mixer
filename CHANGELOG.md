# Changelog

## [0.1.0] - Release Candidate

Initial Hz Mixer release, rebranded from the local Beat Mixer prototype.

- Static web mixer with lazy-loaded assets, plus optional self-contained offline HTML.
- Binaural, monaural and isochronic synthesis with hundredth-hertz beat entry and 20-2000 Hz carrier pitch.
- 37 band-grouped presets, search, method filters and favorites.
- Audio-clock sweeps, pause/resume and reusable hold/sweep stages.
- Four CC0 field recordings with crossfaded loops; white, pink and brown noise.
- Layer level/mute/solo/balance, fades, pulse shaping and waveform/spectrum monitoring.
- Named mix storage, JSON export/import/backup and stereo WAV/MP3 rendering with progress/cancel and optional direct-to-file saving.
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

- Zero fade-out now holds level until the final stop, including across offline render blocks.
- Cancelling export detaches from held recording/encoder loads while preserving shared playback/cache consumers.
- Session editing preserves keyboard focus; stage-only timer options cannot change a Fixed timer unexpectedly.
- Save, Export, Import, Privacy and Credits dialogs expose accessible names.
- Library replacement clears mismatched saved selections; capacity-aware import previews support full 30-mix backups safely.
- Release verification checks both built outputs against current source, with regressions for stale/tampered files.
- Preview path checks cover canonical Windows aliases as well as letter case, preserving loopback-only serving.
