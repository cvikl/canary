# How the demo video was made

An animated concept explainer: problem, then method, then solution. Everything is drawn in code from real values; no video editor was used.

1. **Narration.** Nine blocks in `narration.txt`, synthesised with edge-tts (voice en-GB-RyanNeural), trimmed and loudness-normalised with ffmpeg.
2. **Real run.** `npm run loop -- --tool summarize_repository --approve` was run on the Vultr VM on 8 November 2026 at 20:12 UTC (run 1047deb6). The terminal scene replays its output line by line, the probe scene types the probe the model actually wrote, and the contract scene's table carries the values that run produced.
3. **Remotion project.** React + Remotion 4. Nine scenes, one per narration block, all drawn in React and SVG: eased reveals, spring pops and arrows driven by `useCurrentFrame` and `interpolate`, no CSS animation. Rendered with `npx remotion render`.
4. **Mix.** A synthesised ambient pad ducked under the voice with a sidechain compressor in ffmpeg, AAC 192 kb/s.

Nothing in the film is staged. The hero table, labels and error codes are the ones the deployment produced for that run.
