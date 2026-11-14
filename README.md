# Focus Desk

A mixed-reality morning desk for Meta Quest: pinch to tick off 3 small tasks, run a focus burst, and keep your daily streak going.

Built with [IWSDK](https://iwsdk.dev) (WebXR) for the Meta VR Start Developer Competition 2026 (Productivity).

## Features

- **Morning Plan**: three small tasks. Click, point and pinch, or use a controller trigger to tick them off. "New tasks" swaps the unfinished ones.
- **Focus Burst**: a 5, 10 or 25 minute timer with start, pause and reset. Pressing the orb also starts or pauses it.
- **Focus orb**: glows from blue to gold as you make progress and pulses while you focus.
- **Today panel**: daily streak, tasks done and focus minutes. Saved in the browser, so it's still there tomorrow.
- **Mixed reality**: passthrough AR session with hand tracking. "Bring desk to me" places the desk 60 cm in front of you.

## Run it

```bash
npm install
npm run dev          # dev server + Quest emulator (IWER) in the browser
npm run build        # production build in dist/
```

Add `?demo` to the URL to run the timer 12x faster (good for demos).

On a Quest 3, open the HTTPS URL from the dev server in the Meta Quest Browser and press **Enter XR**.

## Tech

TypeScript, Vite, IWSDK 1.1 (ECS + Three.js), UIKitML spatial panels, WebXR hand tracking, anchors and plane detection.

## License

MIT
