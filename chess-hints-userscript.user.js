// ==UserScript==
// @name         Chess.com Hints with Adjustable Settings
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Provides chess hints on chess.com with adjustable engine strength and settings
// @author       You
// @match        https://*.chess.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/chess.js/1.0.0-beta.6/chess.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/stockfish/15.1/stockfish.js
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const config = {
        defaultEngineElo: 1500,
        maxEngineElo: 3200,
        minEngineElo: 800,
        defaultHintDelay: 1000,
        defaultShowBestMove: true,
        defaultShowEvaluation: true,
        defaultShowMoveNumber: true
    };

    // State management
    let state = {
        engine: null,
        chess: null,
        isEnabled: false,
        currentFen: '',
        settings: {
            engineElo: GM_getValue('engineElo', config.defaultEngineElo),
            hintDelay: GM_getValue('hintDelay', config.defaultHintDelay),
            showBestMove: GM_getValue('showBestMove', config.defaultShowBestMove),
            showEvaluation: GM_getValue('showEvaluation', config.defaultShowEvaluation),
            showMoveNumber: GM_getValue('showMoveNumber', config.defaultShowMoveNumber)
        }
    };

    // Initialize chess engine
    function initEngine() {
        if (typeof Stockfish === 'undefined') {
            console.error('Stockfish engine not loaded');
            return;
        }

        state.engine = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish/15.1/stockfish.js');
        
        state.engine.onmessage = function(event) {
            const message = event.data;
            
            if (message.includes('bestmove')) {
                const bestMove = message.split(' ')[1];
                if (bestMove && bestMove !== '(none)') {
                    showHint(bestMove);
                }
            } else if (message.includes('score')) {
                // Parse evaluation
                const scoreMatch = message.match(/score (cp|mate) (-?\d+)/);
                if (scoreMatch) {
                    const type = scoreMatch[1];
                    const value = parseInt(scoreMatch[2]);
                    updateEvaluation(type, value);
                }
            }
        };

        // Set engine strength
        setEngineStrength(state.settings.engineElo);
    }

    // Set engine strength (ELO)
    function setEngineStrength(elo) {
        if (!state.engine) return;
        
        state.engine.postMessage('setoption name UCI_LimitStrength value true');
        state.engine.postMessage(`setoption name UCI_Elo value ${elo}`);
        state.engine.postMessage('setoption name MultiPV value 1');
    }

    // Initialize chess.js
    function initChess() {
        if (typeof Chess === 'undefined') {
            console.error('Chess.js not loaded');
            return;
        }
        state.chess = new Chess();
    }

    // Get current board position from chess.com
    function getCurrentPosition() {
        const board = document.querySelector('.board');
        if (!board) return null;

        // Try to get FEN from chess.com's internal state
        const gameData = window.chesscom && window.chesscom.gameData;
        if (gameData && gameData.fen) {
            return gameData.fen;
        }

        // Fallback: try to parse the board visually
        return parseBoardVisually();
    }

    // Parse board visually (fallback method)
    function parseBoardVisually() {
        const squares = document.querySelectorAll('.square-55d63');
        if (squares.length !== 64) return null;

        let fen = '';
        let emptyCount = 0;

        for (let i = 0; i < 64; i++) {
            const square = squares[i];
            const piece = square.querySelector('.piece');
            
            if (!piece) {
                emptyCount++;
            } else {
                if (emptyCount > 0) {
                    fen += emptyCount;
                    emptyCount = 0;
                }
                
                const pieceClass = piece.className;
                let pieceChar = '';
                
                if (pieceClass.includes('wp')) pieceChar = 'P';
                else if (pieceClass.includes('wr')) pieceChar = 'R';
                else if (pieceClass.includes('wn')) pieceChar = 'N';
                else if (pieceClass.includes('wb')) pieceChar = 'B';
                else if (pieceClass.includes('wq')) pieceChar = 'Q';
                else if (pieceClass.includes('wk')) pieceChar = 'K';
                else if (pieceClass.includes('bp')) pieceChar = 'p';
                else if (pieceClass.includes('br')) pieceChar = 'r';
                else if (pieceClass.includes('bn')) pieceChar = 'n';
                else if (pieceClass.includes('bb')) pieceChar = 'b';
                else if (pieceClass.includes('bq')) pieceChar = 'q';
                else if (pieceClass.includes('bk')) pieceChar = 'k';
                
                fen += pieceChar;
            }
            
            if ((i + 1) % 8 === 0) {
                if (emptyCount > 0) {
                    fen += emptyCount;
                    emptyCount = 0;
                }
                if (i < 63) fen += '/';
            }
        }

        // Add remaining FEN components (turn, castling, en passant, etc.)
        fen += ' w KQkq - 0 1';
        return fen;
    }

    // Show hint on the board
    function showHint(bestMove) {
        if (!state.settings.showBestMove) return;

        // Remove existing hints
        removeHints();

        // Parse move
        const from = bestMove.substring(0, 2);
        const to = bestMove.substring(2, 4);
        const promotion = bestMove.substring(4, 5);

        // Highlight squares
        highlightSquare(from, 'hint-from');
        highlightSquare(to, 'hint-to');

        // Show move notation
        showMoveNotation(bestMove);
    }

    // Highlight a square
    function highlightSquare(square, className) {
        const squareElement = document.querySelector(`[data-square="${square}"]`);
        if (squareElement) {
            squareElement.classList.add(className);
        }
    }

    // Remove all hints
    function removeHints() {
        document.querySelectorAll('.hint-from, .hint-to').forEach(el => {
            el.classList.remove('hint-from', 'hint-to');
        });
        
        const hintBox = document.getElementById('chess-hint-box');
        if (hintBox) {
            hintBox.remove();
        }
    }

    // Show move notation
    function showMoveNotation(move) {
        const hintBox = document.createElement('div');
        hintBox.id = 'chess-hint-box';
        hintBox.innerHTML = `
            <div class="hint-title">Best Move</div>
            <div class="hint-move">${formatMove(move)}</div>
        `;
        
        document.body.appendChild(hintBox);
    }

    // Format move for display
    function formatMove(move) {
        const from = move.substring(0, 2);
        const to = move.substring(2, 4);
        const promotion = move.substring(4, 5);
        
        let notation = `${from.toUpperCase()} → ${to.toUpperCase()}`;
        if (promotion) {
            notation += `=${promotion.toUpperCase()}`;
        }
        
        return notation;
    }

    // Update evaluation display
    function updateEvaluation(type, value) {
        if (!state.settings.showEvaluation) return;

        let evaluation = '';
        if (type === 'mate') {
            evaluation = value > 0 ? `M${Math.ceil(value/2)}` : `M${Math.ceil(-value/2)}`;
        } else {
            const pawns = (value / 100).toFixed(1);
            evaluation = value > 0 ? `+${pawns}` : pawns;
        }

        const evalBox = document.getElementById('chess-eval-box');
        if (evalBox) {
            evalBox.textContent = evaluation;
        }
    }

    // Request engine analysis
    function requestAnalysis() {
        if (!state.engine || !state.chess) return;

        const fen = getCurrentPosition();
        if (!fen || fen === state.currentFen) return;

        state.currentFen = fen;
        state.chess.load(fen);

        state.engine.postMessage('position fen ' + fen);
        state.engine.postMessage('go depth 15');
    }

    // Create settings panel
    function createSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'chess-hints-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h3>Chess Hints Settings</h3>
                <button id="toggle-hints" class="toggle-btn">${state.isEnabled ? 'Disable' : 'Enable'}</button>
            </div>
            <div class="panel-content">
                <div class="setting-group">
                    <label for="engine-elo">Engine Strength (ELO):</label>
                    <input type="range" id="engine-elo" min="${config.minEngineElo}" max="${config.maxEngineElo}" value="${state.settings.engineElo}">
                    <span id="elo-display">${state.settings.engineElo}</span>
                </div>
                <div class="setting-group">
                    <label for="hint-delay">Hint Delay (ms):</label>
                    <input type="number" id="hint-delay" min="0" max="5000" value="${state.settings.hintDelay}">
                </div>
                <div class="setting-group">
                    <label>
                        <input type="checkbox" id="show-best-move" ${state.settings.showBestMove ? 'checked' : ''}>
                        Show Best Move
                    </label>
                </div>
                <div class="setting-group">
                    <label>
                        <input type="checkbox" id="show-evaluation" ${state.settings.showEvaluation ? 'checked' : ''}>
                        Show Evaluation
                    </label>
                </div>
                <div class="setting-group">
                    <label>
                        <input type="checkbox" id="show-move-number" ${state.settings.showMoveNumber ? 'checked' : ''}>
                        Show Move Number
                    </label>
                </div>
            </div>
            <div class="panel-footer">
                <button id="save-settings">Save Settings</button>
                <button id="reset-settings">Reset to Default</button>
            </div>
        `;

        document.body.appendChild(panel);
        setupEventListeners();
    }

    // Setup event listeners
    function setupEventListeners() {
        // Toggle hints
        document.getElementById('toggle-hints').addEventListener('click', () => {
            state.isEnabled = !state.isEnabled;
            const btn = document.getElementById('toggle-hints');
            btn.textContent = state.isEnabled ? 'Disable' : 'Enable';
            
            if (state.isEnabled) {
                startAnalysis();
            } else {
                stopAnalysis();
            }
        });

        // Engine ELO slider
        const eloSlider = document.getElementById('engine-elo');
        const eloDisplay = document.getElementById('elo-display');
        
        eloSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            eloDisplay.textContent = value;
            state.settings.engineElo = parseInt(value);
        });

        // Save settings
        document.getElementById('save-settings').addEventListener('click', () => {
            saveSettings();
        });

        // Reset settings
        document.getElementById('reset-settings').addEventListener('click', () => {
            resetSettings();
        });

        // Checkbox listeners
        document.getElementById('show-best-move').addEventListener('change', (e) => {
            state.settings.showBestMove = e.target.checked;
        });

        document.getElementById('show-evaluation').addEventListener('change', (e) => {
            state.settings.showEvaluation = e.target.checked;
        });

        document.getElementById('show-move-number').addEventListener('change', (e) => {
            state.settings.showMoveNumber = e.target.checked;
        });
    }

    // Save settings
    function saveSettings() {
        GM_setValue('engineElo', state.settings.engineElo);
        GM_setValue('hintDelay', state.settings.hintDelay);
        GM_setValue('showBestMove', state.settings.showBestMove);
        GM_setValue('showEvaluation', state.settings.showEvaluation);
        GM_setValue('showMoveNumber', state.settings.showMoveNumber);
        
        setEngineStrength(state.settings.engineElo);
        
        showNotification('Settings saved!');
    }

    // Reset settings
    function resetSettings() {
        state.settings = {
            engineElo: config.defaultEngineElo,
            hintDelay: config.defaultHintDelay,
            showBestMove: config.defaultShowBestMove,
            showEvaluation: config.defaultShowEvaluation,
            showMoveNumber: config.defaultShowMoveNumber
        };
        
        // Update UI
        document.getElementById('engine-elo').value = state.settings.engineElo;
        document.getElementById('elo-display').textContent = state.settings.engineElo;
        document.getElementById('hint-delay').value = state.settings.hintDelay;
        document.getElementById('show-best-move').checked = state.settings.showBestMove;
        document.getElementById('show-evaluation').checked = state.settings.showEvaluation;
        document.getElementById('show-move-number').checked = state.settings.showMoveNumber;
        
        setEngineStrength(state.settings.engineElo);
        
        showNotification('Settings reset to default!');
    }

    // Show notification
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'chess-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Start analysis
    function startAnalysis() {
        if (!state.isEnabled) return;
        
        requestAnalysis();
        
        // Set up periodic analysis
        state.analysisInterval = setInterval(() => {
            if (state.isEnabled) {
                requestAnalysis();
            }
        }, state.settings.hintDelay);
    }

    // Stop analysis
    function stopAnalysis() {
        if (state.analysisInterval) {
            clearInterval(state.analysisInterval);
            state.analysisInterval = null;
        }
        removeHints();
    }

    // Add CSS styles
    GM_addStyle(`
        #chess-hints-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            background: #2c3e50;
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: Arial, sans-serif;
        }

        .panel-header {
            padding: 15px;
            border-bottom: 1px solid #34495e;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .panel-header h3 {
            margin: 0;
            font-size: 16px;
        }

        .toggle-btn {
            background: #3498db;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }

        .toggle-btn:hover {
            background: #2980b9;
        }

        .panel-content {
            padding: 15px;
        }

        .setting-group {
            margin-bottom: 15px;
        }

        .setting-group label {
            display: block;
            margin-bottom: 5px;
            font-size: 14px;
        }

        .setting-group input[type="range"] {
            width: 100%;
            margin-right: 10px;
        }

        .setting-group input[type="number"] {
            width: 80px;
            padding: 4px;
            border-radius: 4px;
            border: 1px solid #34495e;
            background: #34495e;
            color: white;
        }

        .setting-group input[type="checkbox"] {
            margin-right: 8px;
        }

        .panel-footer {
            padding: 15px;
            border-top: 1px solid #34495e;
            display: flex;
            gap: 10px;
        }

        .panel-footer button {
            flex: 1;
            padding: 8px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }

        #save-settings {
            background: #27ae60;
            color: white;
        }

        #save-settings:hover {
            background: #229954;
        }

        #reset-settings {
            background: #e74c3c;
            color: white;
        }

        #reset-settings:hover {
            background: #c0392b;
        }

        .hint-from {
            background-color: rgba(255, 255, 0, 0.3) !important;
        }

        .hint-to {
            background-color: rgba(0, 255, 0, 0.3) !important;
        }

        #chess-hint-box {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #2c3e50;
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10001;
            text-align: center;
        }

        .hint-title {
            font-size: 14px;
            margin-bottom: 10px;
            opacity: 0.8;
        }

        .hint-move {
            font-size: 18px;
            font-weight: bold;
        }

        .chess-notification {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #27ae60;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 10002;
            animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
            from {
                transform: translateX(-50%) translateY(-100%);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
    `);

    // Initialize everything
    function init() {
        initEngine();
        initChess();
        createSettingsPanel();
        
        // Start analysis if enabled
        if (state.isEnabled) {
            startAnalysis();
        }
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();