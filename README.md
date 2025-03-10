![Nook](./public/nook-banner.webp)

Nook is a lightweight online collaboration tool inspired by [Around.co](https://around.co). It provides a minimalist, floating interface for video calls and collaboration, designed to be unobtrusive while keeping you connected with your team.

## Features

- Floating, frameless window that stays on top
- Draggable interface
- Maintains 2:1 aspect ratio when resizing
- System-level mouse event tracking for smooth interactions
- Native OS integration (opens links in default browser)
- Modern, minimal UI with hover effects
- Giphy search with click on avatar by @bitbrain
- Chatting with participants

## Supported OS

- [x] MacOS
- [ ] Linux
- [ ] Windows

## Development

This app is built with:

- Electron
- Vue 3
- Native C bindings for system-level mouse tracking

and uses:

- [Ngrok](https://ngrok.com/) as a reverse proxy for a secure connection
- [Twilio](https://www.twilio.com/) for video conferencing capabilities
- [Giphy](https://giphy.com/) for fun gifs

### Prerequisites

- Node.js (v18 or higher recommended)
- npm
- Make and Clang (for building the native mouse tracking module)
- A twilio account -> create an api key
- A ngrok account -> follow the easy setup instructions
- A giphy account -> create an api key

### Setup

1. Clone the repository:

```bash
git clone https://github.com/usenook-co/nook.git
cd nook
```

2. Install dependencies:

```bash
npm install
```

This will also automatically build the native mouse tracking module.

3. Start the token server for twilio:

```bash
npm run start-token-server
```

4. Start ngrok reverse proxy tunnel with your credentials installed from the instructions:

```bash
ngrok http --url=<your-unique-id>.ngrok-free.app 3000 
```

5. Start the development server:

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
