# 🚀 Master Boilerplate Prompt

*Copy and paste the entire block below into a fresh conversation with me or any other AI to instantly rebuild this robust Electron + Next.js architecture.*

---

**Prompt:**

"I want to create a robust Windows desktop application utilizing a Next.js (App Router), Tailwind CSS, and Electron.js stack. Please act as an expert agent and execute these specifications exactly in order to prevent file-path and symlink issues.

Follow these execution steps:

### 1. Web Scaffold
- Generate a new Next.js application in the root folder using:
  `npx.cmd -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`

### 2. Static Configuration
- Update [next.config.ts](file:///d:/projects/apogee/next.config.ts) (or [.js](file:///d:/projects/apogee/main.js)) and immediately inject `output: 'export'`. This forces Next.js to dump fully static HTML/JS/CSS assets that Electron can natively parse without a node server.

### 3. Dependencies & Build Scripts
- Install backend dev dependencies: `npm.cmd install --save-dev electron electron-packager electron-serve`
  *(Note: Do not use electron-builder unless you handle its code-signing symlink privileges properly. electron-packager is safer for quick Windows .exe scaffolding)*
- Add `"main": "main.js"` to [package.json](file:///d:/projects/apogee/package.json).
- Add these scripts to [package.json](file:///d:/projects/apogee/package.json): 
  `"electron": "electron ."`
  `"electron-build": "next build && npx electron-packager . AppName --platform=win32 --arch=x64 --out=dist --overwrite"`

### 4. Electron Core & File Routing
- Create [preload.js](file:///d:/projects/apogee/preload.js) with a generic basic DOMContentLoaded event listener.
- Create [main.js](file:///d:/projects/apogee/main.js). **Critical Pathing Fix:** To intercept and route static Next.js assets that normally crash with `ERR_FILE_NOT_FOUND` on the `file://` protocol, use `electron-serve`.
  - Since `electron-serve` is an ES module, require it using the default property to prevent `serve is not a function` panics:
    ```js
    const serve = require('electron-serve').default || require('electron-serve');
    const loadURL = serve({ directory: 'out' });
    ```
  - Call `await loadURL(win)` when spawning the BrowserWindow instead of standard `win.loadFile()`.

### 5. High-Aesthetic UI Initialization
- Ditch the standard Next.js index page. Overwrite [src/app/page.tsx](file:///d:/projects/apogee/src/app/page.tsx) with a highly premium and aesthetic modern landing page. Leverage custom Tailwind CSS tricks like `backdrop-blur`, animated gradient spheres in absolute background divs, sleek typography, micro-glows, hover-lifts on buttons, and dark mode base styling.
- Add some custom CSS keyframes into [src/app/globals.css](file:///d:/projects/apogee/src/app/globals.css) (like `fade-in-up`) so I have custom `.animate-*` utility classes right out of the box.

### 6. Executable Assembly
- Execute the build sequence `npm.cmd run electron-build` and verify that the AppName.exe is cleanly compiled inside of the `dist` folder."
