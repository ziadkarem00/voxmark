<div align="center"><img src="icons/icon128.png" alt="VoxMark Logo" width="96" height="96">VoxMarkInstant right-click text-to-speech for Chrome, Brave, and Edge.
Highlight any text on the web, right-click, and listen—with zero setup, zero API keys, and 100% local privacy.


License: MIT</div>OverviewVoxMark turns any article, blog post, or documentation page into a hands-free listening experience. Built on Manifest V3, it uses your browser's native speech synthesis engine directly on your device—giving you instant playback without accounts, subscriptions, or external servers.Key FeaturesInstant Right-Click Trigger: Highlight any text on any webpage and start listening straight from the context menu.Floating Glassmorphism HUD: A clean, lightweight on-page controller shows playback status and lets you stop audio with one click.No 15-Second Chrome Freezes: Automatically splits long text into sentence chunks to bypass Chrome's built-in TTS timeout bug.Voice & Speed Controls: Pick your preferred system voice and adjust playback speed from the extension popup (VoxMark AI Settings).100% Private & Offline-Ready: Everything runs locally in your browser—nothing you highlight is ever sent to the cloud.ScreenshotsAdd your captured screenshots into a screenshots/ folder in the repository root using the filenames below so they render automatically on GitHub.Right-Click Context MenuFloating Audio HUDExtension Settings PopupHighlight text and click VoxMarkMinimalist on-page playback barChoose your voice and speedHow to InstallVoxMark can be loaded directly into any Chromium-based browser (Google Chrome, Brave, or Microsoft Edge) in under a minute:Download the extension:Option A (ZIP): Click the green Code button at the top of this repository, select Download ZIP, and extract the folder.Option B (Git):git clone https://github.com/ziadkarem00/voxmark.git
Open the Extensions page:Chrome: go to chrome://extensionsBrave: go to brave://extensionsEdge: go to edge://extensionsEnable Developer mode using the toggle in the top-right corner.Click Load unpacked and select the extracted voxmark folder (the folder containing manifest.json).(Optional) Click the puzzle-piece icon in your browser toolbar and Pin VoxMark for quick access to voice and speed settings.How to UseHighlight any sentence or paragraph on a webpage.Right-click the selection and choose VoxMark from the context menu.Listen & Control: Use the Floating HUD on the page to monitor or stop playback, or click the VoxMark toolbar icon to change your voice and reading speed.How to UninstallIf you ever want to remove VoxMark:Open your browser's Extensions page (chrome://extensions, brave://extensions, or edge://extensions).Find VoxMark AI - Read Aloud with AI Voice.Click Remove and confirm.Project Structurevoxmark/
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── screenshots/          # Add your UI screenshots here
├── background.js         # Context menu & background service worker
├── content.css           # Floating HUD styling
├── content.js            # Sentence chunking & on-page HUD logic
├── manifest.json         # Manifest V3 configuration
├── popup.html            # Extension settings UI
├── popup.js              # Voice & playback speed controls
└── README.md
AuthorBuilt by ziadkarem00.
