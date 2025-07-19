# Chess.com Hints Userscript

A powerful userscript that provides chess hints on chess.com with adjustable engine strength and customizable settings.

## Features

- **Adjustable Engine Strength**: Set the engine ELO from 800 to 3200
- **Real-time Hints**: Get best move suggestions as you play
- **Visual Highlights**: See suggested moves highlighted on the board
- **Position Evaluation**: View the current position evaluation
- **Customizable Settings**: Adjust hint delay, display options, and more
- **Persistent Settings**: Your preferences are saved between sessions

## Installation

### Prerequisites
- A userscript manager extension (Tampermonkey, Greasemonkey, Violentmonkey, etc.)
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Steps
1. Install a userscript manager:
   - **Tampermonkey**: [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - **Greasemonkey**: [Firefox](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)
   - **Violentmonkey**: [Chrome](https://chrome.google.com/webstore/detail/violentmonkey/jinjaccalgkegednnccheecnodfkdoha) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/)

2. Install the userscript:
   - Copy the entire content of `chess-hints-userscript.user.js`
   - Open your userscript manager
   - Create a new script
   - Paste the code and save

3. Visit chess.com and start playing!

## Usage

### Basic Usage
1. Navigate to any chess.com game page
2. Look for the "Chess Hints Settings" panel in the top-right corner
3. Click "Enable" to start receiving hints
4. The engine will analyze the current position and show the best move

### Settings Panel

#### Engine Strength (ELO)
- **Range**: 800 - 3200
- **Default**: 1500
- **Lower ELO**: Easier hints, more mistakes
- **Higher ELO**: Stronger hints, fewer mistakes

#### Hint Delay
- **Range**: 0 - 5000ms
- **Default**: 1000ms
- Controls how often the engine analyzes the position

#### Display Options
- **Show Best Move**: Highlight the suggested move on the board
- **Show Evaluation**: Display position evaluation (e.g., +1.5, M3)
- **Show Move Number**: Include move numbers in notation

### Visual Indicators

- **Yellow Highlight**: Starting square of the suggested move
- **Green Highlight**: Target square of the suggested move
- **Center Popup**: Shows the move notation (e.g., "E2 → E4")

## Technical Details

### Dependencies
- **Stockfish 15.1**: Chess engine for analysis
- **Chess.js**: Chess logic and move validation
- **CDN Sources**: All dependencies are loaded from CDN for reliability

### Browser Compatibility
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Performance
- Engine analysis runs in a Web Worker to avoid blocking the UI
- Analysis depth is limited to 15 plies for reasonable performance
- Settings are cached locally for faster loading

## Safety and Fair Play

⚠️ **Important**: This userscript is for educational and training purposes only.

- **Do not use in rated games** - This violates chess.com's terms of service
- **Use responsibly** - Only use for learning and practice
- **Respect fair play** - Don't use against other players without their knowledge

## Troubleshooting

### Common Issues

**Script doesn't load:**
- Check that your userscript manager is enabled
- Verify the script is installed correctly
- Check browser console for errors

**No hints appearing:**
- Make sure hints are enabled in the settings panel
- Check that you're on a chess.com game page
- Try refreshing the page

**Engine not responding:**
- Check your internet connection (Stockfish is loaded from CDN)
- Try disabling and re-enabling hints
- Check browser console for error messages

**Board position not detected:**
- Make sure you're on an active game page
- Try moving a piece to trigger position detection
- The script may need a moment to initialize

### Debug Mode
Open browser console (F12) to see debug messages and error information.

## Customization

### Modifying Default Settings
Edit the `config` object in the script to change default values:

```javascript
const config = {
    defaultEngineElo: 1500,        // Default engine strength
    maxEngineElo: 3200,           // Maximum ELO setting
    minEngineElo: 800,            // Minimum ELO setting
    defaultHintDelay: 1000,       // Default analysis delay
    // ... other settings
};
```

### Styling
The script includes comprehensive CSS styling. You can modify the `GM_addStyle` section to customize the appearance.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve the script.

## License

This project is open source and available under the MIT License.

## Disclaimer

This userscript is provided as-is for educational purposes. Use at your own risk and in accordance with chess.com's terms of service.