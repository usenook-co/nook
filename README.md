# Nook

Nook is a lightweight online collaboration tool inspired by [Around.co](https://around.co). It provides a minimalist, floating interface for video calls and collaboration, designed to be unobtrusive while keeping you connected with your team.

## Features

- Floating, frameless window that stays on top
- Draggable interface
- Maintains 2:1 aspect ratio when resizing
- System-level mouse event tracking for smooth interactions
- Native OS integration (opens links in default browser)
- Modern, minimal UI with hover effects

## Development

This app is built with:

- Electron
- Vue 3
- Native C bindings for system-level mouse tracking

### Prerequisites

- Node.js (v18 or higher recommended)
- npm
- For Windows:
  - MinGW-w64 (via [MSYS2](https://www.msys2.org/) recommended)
  - Make sure to add MinGW to your PATH (typically `C:\msys64\mingw64\bin`)
- For macOS:
  - Xcode Command Line Tools (`xcode-select --install`)
- For Linux:
  - gcc and make (`sudo apt-get install build-essential`)

### Setup

1. Clone the repository:

```bash
git clone https://github.com/usenook-co/nook.git
cd nook
```

2. If you're on Windows, install required MSYS2 packages:
```bash
# Open MSYS2 terminal and run:
pacman -S mingw-w64-x86_64-gcc make
```

3. Install dependencies:

```bash
npm install
```

This will also automatically build the native mouse tracking module.

4. Start the development server:

```bash
npm start
```

### Building

To create a production build:

```bash
npm run make
```

## Architecture

- `src/mouse_tracker.c`: Native module for system-level mouse event tracking
- `src/main.js`: Electron main process
- `src/renderer.js`: Electron renderer process
- `src/App.vue`: Main Vue component
- `src/preload.js`: Electron preload script for IPC

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

MIT License

Copyright (c) 2025 usenook-co

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
