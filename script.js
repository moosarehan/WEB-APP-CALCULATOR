"use strict";

/**
 * PREMIUM CALCULATOR LOGIC
 * Follows Casio fx-series behavior: Postfix trig/log, Infix operators.
 */

const state = {
    expression: '',
    display: '0',
    lastResult: null,
    angleMode: 'DEG',
    isNewInput: true, // If true, next digit replaces display
    activeTrig: null // Track if the current display is a result of a trig function
};

// DOM Elements
const exprEl = document.getElementById('expression-line');
const resultEl = document.getElementById('result-line');
const angleEl = document.getElementById('angle-mode');
const themeToggle = document.getElementById('theme-toggle');
const buttons = document.querySelectorAll('.btn');

/**
 * THEME MANAGEMENT
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
});

initTheme();

/**
 * HELPER: Floating-point cleanup
 */
function cleanNum(value) {
    if (typeof value !== 'number' || !isFinite(value)) return 'Error';
    if (Math.abs(value) < 1e-10) return 0;
    const rounded = parseFloat(value.toPrecision(10));
    return rounded;
}

/**
 * HELPER: Display formatting
 */
function formatDisplay(value) {
    if (value === 'Error') return 'Error';
    const num = Number(value);
    if (isNaN(num)) return 'Error';
    
    if (Math.abs(num) >= 1e10 || (Math.abs(num) < 1e-6 && num !== 0)) {
        return num.toExponential(6);
    }
    // Remove trailing zeros after decimal
    return parseFloat(num.toPrecision(10)).toString();
}

/**
 * UI UPDATE
 */
function updateUI() {
    exprEl.textContent = state.expression;
    resultEl.textContent = formatDisplay(state.display);
    angleEl.textContent = state.angleMode;
}

/**
 * SAFE EVALUATOR (No eval)
 */
function safeEvaluate(expression) {
    try {
        let expr = expression
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/\^/g, '**')
            .replace(/−/g, '-')
            .replace(/%/g, '/100');

        // Validate: only allow digits, operators, parentheses, dots, spaces, %
        if (!/^[\d\s\+\-\*\/\.\(\)\%\*]+$/.test(expr)) throw new Error('Invalid');

        const result = Function('"use strict"; return (' + expr + ')')();
        return cleanNum(result);
    } catch (e) {
        return 'Error';
    }
}

/**
 * TRIG/LOG FUNCTION HANDLER (POSTFIX)
 */
function applyFunction(fn) {
    const num = parseFloat(state.display);
    if (isNaN(num)) return;

    let result;
    let exprPart;

    switch(fn) {
        case 'sin': {
            const angle = state.angleMode === 'DEG' ? num * Math.PI / 180 : num;
            result = Math.sin(angle);
            exprPart = `sin(${num})`;
            break;
        }
        case 'cos': {
            const angle = state.angleMode === 'DEG' ? num * Math.PI / 180 : num;
            result = Math.cos(angle);
            exprPart = `cos(${num})`;
            break;
        }
        case 'tan': {
            if (state.angleMode === 'DEG' && Math.abs(num % 180) === 90) {
                result = 'Error';
            } else {
                const angle = state.angleMode === 'DEG' ? num * Math.PI / 180 : num;
                result = Math.tan(angle);
                if (!isFinite(result)) result = 'Error';
            }
            exprPart = `tan(${num})`;
            break;
        }
        case 'log': {
            if (num <= 0) result = 'Error';
            else result = Math.log10(num);
            exprPart = `log(${num})`;
            break;
        }
    }

    const cleaned = cleanNum(result);
    state.display = cleaned.toString();
    state.lastResult = cleaned;
    state.isNewInput = true;
    state.activeTrig = { fn, input: num }; // Store for DEG/RAD toggle recalculation
    
    // For chaining, we don't necessarily append to expression string until operator is pressed
    // but the prompt says: "update expression line to show e.g. sin(30)"
    state.expression += exprPart;
}

/**
 * INPUT HANDLER
 */
function handleInput(val) {
    // Visual feedback
    const btn = document.querySelector(`.btn[data-val="${val}"]`);
    if (btn) {
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 100);
    }

    // Logic
    if (!isNaN(val) || val === '.') {
        // Number Input
        if (state.isNewInput) {
            state.display = val === '.' ? '0.' : val;
            state.isNewInput = false;
        } else {
            if (state.display.replace('.', '').length < 12) {
                if (val === '.' && state.display.includes('.')) return;
                if (state.display === '0' && val !== '.') {
                    state.display = val;
                } else {
                    state.display += val;
                }
            }
        }
        state.activeTrig = null;
    } else if (['+', '-', '*', '/', 'pow'].includes(val)) {
        // Operator Input
        const opMap = { '+': '+', '-': '−', '*': '×', '/': '÷', 'pow': '^' };
        const symbol = opMap[val];

        // Check if we are replacing an existing operator
        if (state.isNewInput && /[\+\−\×\÷\^]\s*$/.test(state.expression)) {
             state.expression = state.expression.trim().slice(0, -1) + ' ' + symbol + ' ';
        } else {
            // Append current display if not already represented in expression by trig/log or bracket
            if (state.activeTrig || /\)\s*$/.test(state.expression)) {
                state.expression += ' ' + symbol + ' ';
            } else {
                state.expression += state.display + ' ' + symbol + ' ';
            }
        }
        state.isNewInput = true;
        state.activeTrig = null;
    } else if (['sin', 'cos', 'tan', 'log'].includes(val)) {
        applyFunction(val);
    } else if (val === 'pi') {
        state.display = Math.PI.toString();
        state.isNewInput = true;
        state.activeTrig = null;
    } else if (val === 'e') {
        state.display = Math.E.toString();
        state.isNewInput = true;
        state.activeTrig = null;
    } else if (val === '(') {
        state.expression += ' ( ';
        state.isNewInput = true;
        state.activeTrig = null;
    } else if (val === ')') {
        if (state.activeTrig) {
            state.expression += ' ) ';
        } else {
            state.expression += state.display + ' ) ';
        }
        state.isNewInput = true;
        state.activeTrig = null;
    } else if (val === '%') {
        const num = parseFloat(state.display);
        const result = cleanNum(num / 100);
        state.display = result.toString();
        state.isNewInput = true;
    } else if (val === 'ac') {
        state.expression = '';
        state.display = '0';
        state.lastResult = null;
        state.isNewInput = true;
        state.activeTrig = null;
    } else if (val === 'backspace') {
        if (state.isNewInput) return;
        if (state.display.length > 1) {
            state.display = state.display.slice(0, -1);
        } else {
            state.display = '0';
            state.isNewInput = true;
        }
    } else if (val === '=') {
        let finalExpr = state.expression;
        
        // Add current display if not a trig result and not ending in ')'
        if (!state.activeTrig && !/\)\s*$/.test(finalExpr)) {
             if (finalExpr === '' || /[\+\−\×\÷\^\(]\s*$/.test(finalExpr)) {
                 finalExpr += state.display;
             }
        }

        const result = safeEvaluate(finalExpr);
        state.expression = finalExpr + ' =';
        state.display = result.toString();
        state.lastResult = result;
        state.isNewInput = true;
        state.activeTrig = null;
    }

    updateUI();
}

/**
 * ANGLE MODE TOGGLE
 */
angleEl.addEventListener('click', () => {
    state.angleMode = state.angleMode === 'DEG' ? 'RAD' : 'DEG';
    
    // Recalculate if trig result is showing
    if (state.activeTrig) {
        const { fn, input } = state.activeTrig;
        // Temporary state to re-run applyFunction correctly
        state.display = input.toString();
        // Remove the previous trig string from expression
        const trigStrings = ['sin(', 'cos(', 'tan(', 'log('];
        let lastTrigIndex = -1;
        trigStrings.forEach(ts => {
            const idx = state.expression.lastIndexOf(ts);
            if (idx > lastTrigIndex) lastTrigIndex = idx;
        });
        if (lastTrigIndex !== -1) {
            state.expression = state.expression.substring(0, lastTrigIndex);
        }
        applyFunction(fn);
    }
    updateUI();
});

/**
 * CLICK EVENTS
 */
buttons.forEach(btn => {
    btn.addEventListener('click', () => {
        handleInput(btn.getAttribute('data-val'));
    });
});

/**
 * KEYBOARD SUPPORT
 */
window.addEventListener('keydown', (e) => {
    const key = e.key;
    
    if (key >= '0' && key <= '9') handleInput(key);
    else if (key === '.') handleInput('.');
    else if (key === '+') handleInput('+');
    else if (key === '-') handleInput('-');
    else if (key === '*') handleInput('*');
    else if (key === '/') handleInput('/');
    else if (key === 'Enter' || key === '=') { e.preventDefault(); handleInput('='); }
    else if (key === 'Backspace') handleInput('backspace');
    else if (key === 'Escape') handleInput('ac');
    else if (key === '%') handleInput('%');
    else if (key === '(') handleInput('(');
    else if (key === ')') handleInput(')');
    else if (key === 's') handleInput('sin');
    else if (key === 'c') handleInput('cos');
    else if (key === 't') handleInput('tan');
    else if (key === 'l') handleInput('log');
    else if (key === 'p') handleInput('pi');
    else if (key === '^') handleInput('pow');
});

// Initial UI sync
updateUI();
