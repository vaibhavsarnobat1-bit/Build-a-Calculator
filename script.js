/**
 * NeoCalc Pro — Advanced Mathematical Engine & UI Controller
 */

(function () {
  'use strict';

  // State
  const state = {
    expression: '',         // Raw math string e.g. "12+3*4"
    displayExpr: '',        // Formatted for screen e.g. "12 + 3 × 4"
    currentResult: '0',     // Active computed result
    lastAnswer: 0,          // Last computed answer (Ans)
    memory: 0,              // Memory register
    isEvaluated: false,     // Flag when '=' was just pressed
    angleUnit: 'DEG',       // 'DEG' or 'RAD'
    mode: 'standard',       // 'standard' or 'scientific'
    soundEnabled: true,     // Web Audio SFX enabled
    history: []             // Calculation tape items
  };

  // DOM Selectors
  const appWrapper = document.querySelector('.app-wrapper');
  const expressionDisplay = document.getElementById('expressionDisplay');
  const resultDisplay = document.getElementById('resultDisplay');
  const displayContainer = document.getElementById('displayContainer');
  const copyResultBtn = document.getElementById('copyResultBtn');
  const angleUnitBtn = document.getElementById('angleUnitBtn');
  const memoryIndicator = document.getElementById('memoryIndicator');
  
  const modeStdBtn = document.getElementById('modeStdBtn');
  const modeSciBtn = document.getElementById('modeSciBtn');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const themeDropdownBtn = document.getElementById('themeDropdownBtn');
  const themeMenu = document.getElementById('themeMenu');
  
  const historyToggleBtn = document.getElementById('historyToggleBtn');
  const historyDrawer = document.getElementById('historyDrawer');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const historyList = document.getElementById('historyList');
  const emptyHistoryMsg = document.getElementById('emptyHistoryMsg');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const exportHistoryBtn = document.getElementById('exportHistoryBtn');
  const historyDot = document.getElementById('historyDot');

  const toolsToggleBtn = document.getElementById('toolsToggleBtn');
  const toolsDrawer = document.getElementById('toolsDrawer');
  const closeToolsBtn = document.getElementById('closeToolsBtn');
  
  const toastNotice = document.getElementById('toastNotice');
  const toastMsg = document.getElementById('toastMsg');

  // ==========================================
  // Web Audio Synthesizer for Tactile Feedback
  // ==========================================
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
  }

  function playSound(type = 'num') {
    if (!state.soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === 'num') {
        // High crisp subtle click
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'operator') {
        // Dual pop
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(550, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'equals') {
        // Melodic positive chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.04); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.08); // G5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'clear') {
        // Sweep down
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'error') {
        // Low buzz
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      }
    } catch (e) {
      // Audio fallback silent
    }
  }

  // ==========================================
  // Display & UI Helpers
  // ==========================================
  function showToast(message) {
    toastMsg.textContent = message;
    toastNotice.classList.add('show');
    setTimeout(() => {
      toastNotice.classList.remove('show');
    }, 2200);
  }

  function formatDisplayExpression(raw) {
    return raw
      .replace(/\*/g, ' × ')
      .replace(/\//g, ' ÷ ')
      .replace(/\+/g, ' + ')
      .replace(/(?<![eE])\-/g, ' − ')
      .replace(/\^/g, ' ^ ');
  }

  function updateDisplay() {
    expressionDisplay.textContent = formatDisplayExpression(state.expression);
    resultDisplay.textContent = state.currentResult;
    
    // Auto-scroll long expressions to right
    expressionDisplay.scrollLeft = expressionDisplay.scrollWidth;
  }

  function updateMemoryBadge() {
    if (state.memory !== 0) {
      memoryIndicator.classList.add('active');
      memoryIndicator.textContent = `M [${state.memory}]`;
    } else {
      memoryIndicator.classList.remove('active');
      memoryIndicator.textContent = 'M [0]';
    }
  }

  // ==========================================
  // Safe Mathematical Evaluation Engine
  // ==========================================
  function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= Math.min(n, 170); i++) {
      res *= i;
    }
    return res;
  }

  function parseExpression(expr) {
    let parsed = expr;

    // Convert Constants
    parsed = parsed.replace(/\bpi\b/g, `(${Math.PI})`);
    parsed = parsed.replace(/\be\b/g, `(${Math.E})`);
    parsed = parsed.replace(/\bAns\b/g, `(${state.lastAnswer})`);

    // Handle Degree/Radian for trig
    const toRad = (angle) => (state.angleUnit === 'DEG' ? (angle * Math.PI) / 180 : angle);
    const fromRad = (val) => (state.angleUnit === 'DEG' ? (val * 180) / Math.PI : val);

    // Replace Scientific Functions
    parsed = parsed.replace(/asin\(([^()]+)\)/g, (_, val) => `(${fromRad(Math.asin(Number(val)))})`);
    parsed = parsed.replace(/acos\(([^()]+)\)/g, (_, val) => `(${fromRad(Math.acos(Number(val)))})`);
    parsed = parsed.replace(/atan\(([^()]+)\)/g, (_, val) => `(${fromRad(Math.atan(Number(val)))})`);

    parsed = parsed.replace(/sin\(([^()]+)\)/g, (_, val) => `(${Math.sin(toRad(Number(val)))})`);
    parsed = parsed.replace(/cos\(([^()]+)\)/g, (_, val) => `(${Math.cos(toRad(Number(val)))})`);
    parsed = parsed.replace(/tan\(([^()]+)\)/g, (_, val) => `(${Math.tan(toRad(Number(val)))})`);

    parsed = parsed.replace(/log\(([^()]+)\)/g, (_, val) => `(${Math.log10(Number(val))})`);
    parsed = parsed.replace(/ln\(([^()]+)\)/g, (_, val) => `(${Math.log(Number(val))})`);
    parsed = parsed.replace(/sqrt\(([^()]+)\)/g, (_, val) => `(${Math.sqrt(Number(val))})`);
    parsed = parsed.replace(/cbrt\(([^()]+)\)/g, (_, val) => `(${Math.cbrt(Number(val))})`);
    parsed = parsed.replace(/abs\(([^()]+)\)/g, (_, val) => `(${Math.abs(Number(val))})`);
    parsed = parsed.replace(/fact\(([^()]+)\)/g, (_, val) => `(${factorial(Number(val))})`);

    // Powers
    parsed = parsed.replace(/\^/g, '**');

    return parsed;
  }

  function liveCalculate() {
    if (!state.expression) {
      state.currentResult = '0';
      return;
    }

    try {
      // Don't evaluate if trailing operator
      const trailing = state.expression.slice(-1);
      if (['+', '-', '*', '/', '^', '.'].includes(trailing)) {
        return;
      }

      const parsed = parseExpression(state.expression);
      // Validate safe characters only
      if (/[^0-9\+\-\*\/\(\)\.\s\*\*,eE]/.test(parsed)) {
        return;
      }

      // Safe evaluation using Function
      const evalResult = Function(`'use strict'; return (${parsed})`)();

      if (typeof evalResult === 'number' && !isNaN(evalResult) && isFinite(evalResult)) {
        // Clean float precision issues
        const formatted = Number(evalResult.toPrecision(12)) / 1;
        state.currentResult = String(formatted);
      }
    } catch (e) {
      // Keep previous result on syntax incomplete
    }
  }

  function finalizeCalculation() {
    if (!state.expression) return;
    try {
      const parsed = parseExpression(state.expression);
      const evalResult = Function(`'use strict'; return (${parsed})`)();

      if (!isFinite(evalResult) || isNaN(evalResult)) {
        if (evalResult === Infinity || evalResult === -Infinity) {
          state.currentResult = 'Cannot divide by 0';
        } else {
          state.currentResult = 'Error';
        }
        playSound('error');
        updateDisplay();
        return;
      }

      const formatted = Number(evalResult.toPrecision(12)) / 1;
      const formattedStr = String(formatted);

      // Save into history
      addHistoryItem(formatDisplayExpression(state.expression), formattedStr);

      state.lastAnswer = formatted;
      state.expression = formattedStr;
      state.currentResult = formattedStr;
      state.isEvaluated = true;
      playSound('equals');
      updateDisplay();

    } catch (e) {
      state.currentResult = 'Error';
      playSound('error');
      updateDisplay();
    }
  }

  // ==========================================
  // Calculator Actions & Input Handlers
  // ==========================================
  function inputDigit(digit) {
    playSound('num');
    if (state.isEvaluated) {
      state.expression = '';
      state.isEvaluated = false;
    }
    state.expression += digit;
    liveCalculate();
    updateDisplay();
  }

  function inputDecimal() {
    playSound('num');
    if (state.isEvaluated) {
      state.expression = '0';
      state.isEvaluated = false;
    }
    
    // Prevent double decimals in the current token
    const lastNumber = state.expression.split(/[\+\-\*\/\^]/).pop();
    if (lastNumber && lastNumber.includes('.')) {
      return;
    }

    if (!state.expression || /[\+\-\*\/\^]$/.test(state.expression)) {
      state.expression += '0.';
    } else {
      state.expression += '.';
    }
    updateDisplay();
  }

  function inputOperator(op) {
    playSound('operator');
    if (state.isEvaluated) {
      state.isEvaluated = false;
    }

    if (!state.expression) {
      if (op === '-') {
        state.expression = '-';
        updateDisplay();
        return;
      }
      state.expression = '0';
    }

    const lastChar = state.expression.slice(-1);
    if (['+', '-', '*', '/', '^'].includes(lastChar)) {
      // Replace operator
      state.expression = state.expression.slice(0, -1) + op;
    } else {
      state.expression += op;
    }
    updateDisplay();
  }

  function clearAll() {
    playSound('clear');
    state.expression = '';
    state.currentResult = '0';
    state.isEvaluated = false;
    updateDisplay();
  }

  function backspace() {
    playSound('clear');
    if (state.isEvaluated) {
      clearAll();
      return;
    }
    state.expression = state.expression.slice(0, -1);
    liveCalculate();
    if (!state.expression) {
      state.currentResult = '0';
    }
    updateDisplay();
  }

  function inputPercent() {
    playSound('operator');
    if (!state.expression) return;
    try {
      const parsed = parseExpression(state.expression);
      const val = Function(`'use strict'; return (${parsed})`)();
      const pct = val / 100;
      state.expression = String(pct);
      state.currentResult = String(pct);
      state.isEvaluated = true;
      updateDisplay();
    } catch (e) {
      state.currentResult = 'Error';
      updateDisplay();
    }
  }

  function toggleNegate() {
    playSound('operator');
    if (!state.expression) return;
    if (state.expression.startsWith('-(') && state.expression.endsWith(')')) {
      state.expression = state.expression.slice(2, -1);
    } else if (state.expression.startsWith('-')) {
      state.expression = state.expression.slice(1);
    } else {
      state.expression = `-(${state.expression})`;
    }
    liveCalculate();
    updateDisplay();
  }

  function handleScientific(func) {
    playSound('operator');
    if (state.isEvaluated) {
      state.isEvaluated = false;
    }

    switch (func) {
      case 'sin':
      case 'cos':
      case 'tan':
      case 'asin':
      case 'acos':
      case 'atan':
      case 'log':
      case 'ln':
      case 'sqrt':
      case 'cbrt':
      case 'abs':
        if (state.expression && !/[\+\-\*\/\^]$/.test(state.expression)) {
          state.expression = `${func}(${state.expression})`;
        } else {
          state.expression += `${func}(`;
        }
        break;
      case 'pow':
        inputOperator('^');
        return;
      case 'sq':
        if (state.expression) {
          state.expression = `(${state.expression})^2`;
        }
        break;
      case 'fact':
        if (state.expression) {
          state.expression = `fact(${state.expression})`;
        }
        break;
      case 'pi':
        state.expression += 'pi';
        break;
      case 'e':
        state.expression += 'e';
        break;
      case 'inv':
        if (state.expression) {
          state.expression = `(1/(${state.expression}))`;
        }
        break;
      case 'exp':
        state.expression += '*10^';
        break;
      case 'ans':
        state.expression += 'Ans';
        break;
      case 'rand':
        const randomNum = Number(Math.random().toFixed(4));
        state.expression += String(randomNum);
        break;
    }

    liveCalculate();
    updateDisplay();
  }

  function handleMemory(action) {
    playSound('operator');
    const currentNum = parseFloat(state.currentResult) || 0;

    switch (action) {
      case 'mc':
        state.memory = 0;
        showToast('Memory Cleared (MC)');
        break;
      case 'mr':
        if (state.isEvaluated) {
          state.expression = '';
          state.isEvaluated = false;
        }
        state.expression += String(state.memory);
        liveCalculate();
        showToast(`Recalled Memory: ${state.memory}`);
        break;
      case 'm-plus':
        state.memory += currentNum;
        showToast(`Added to Memory: ${state.memory}`);
        break;
      case 'm-minus':
        state.memory -= currentNum;
        showToast(`Subtracted from Memory: ${state.memory}`);
        break;
      case 'ms':
        state.memory = currentNum;
        showToast(`Stored in Memory: ${state.memory}`);
        break;
    }
    updateMemoryBadge();
    updateDisplay();
  }

  // ==========================================
  // Calculation Tape / History Drawer
  // ==========================================
  function loadHistory() {
    try {
      const saved = localStorage.getItem('neocalc_history');
      if (saved) {
        state.history = JSON.parse(saved);
      }
    } catch (e) {
      state.history = [];
    }
    renderHistory();
  }

  function saveHistory() {
    try {
      localStorage.setItem('neocalc_history', JSON.stringify(state.history));
    } catch (e) {}
  }

  function addHistoryItem(formula, result) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const item = { formula, result, time: timeStr, id: Date.now() };
    state.history.unshift(item);
    if (state.history.length > 50) state.history.pop();
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    if (state.history.length === 0) {
      emptyHistoryMsg.style.display = 'flex';
      historyList.innerHTML = '';
      historyList.appendChild(emptyHistoryMsg);
      historyDot.classList.remove('has-history');
      return;
    }

    emptyHistoryMsg.style.display = 'none';
    historyDot.classList.add('has-history');
    historyList.innerHTML = '';

    state.history.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.title = 'Click to reuse this result';
      card.innerHTML = `
        <div class="hist-top">
          <span class="hist-time">${item.time}</span>
          <span class="hist-expr">${item.formula} =</span>
        </div>
        <div class="hist-res">${item.result}</div>
      `;

      card.addEventListener('click', () => {
        state.expression = item.result;
        state.currentResult = item.result;
        state.isEvaluated = true;
        updateDisplay();
        historyDrawer.classList.remove('open');
        showToast(`Loaded ${item.result}`);
      });

      historyList.appendChild(card);
    });
  }

  function clearHistory() {
    state.history = [];
    saveHistory();
    renderHistory();
    showToast('Calculation tape cleared');
  }

  function exportHistory() {
    if (state.history.length === 0) {
      showToast('No history to export');
      return;
    }
    let text = '=== NeoCalc Pro Calculation Tape ===\n\n';
    state.history.forEach((item) => {
      text += `[${item.time}]  ${item.formula} = ${item.result}\n`;
    });
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NeoCalc_History_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported history as .txt');
  }

  // ==========================================
  // Quick Converter & Tip/Tax Tools
  // ==========================================
  const convCategory = document.getElementById('convCategory');
  const convFromUnit = document.getElementById('convFromUnit');
  const convToUnit = document.getElementById('convToUnit');
  const convFromVal = document.getElementById('convFromVal');
  const convToVal = document.getElementById('convToVal');
  const convSwapBtn = document.getElementById('convSwapBtn');
  const pushToCalcBtn = document.getElementById('pushToCalcBtn');

  const unitUnits = {
    length: {
      Meter: 1,
      Kilometer: 1000,
      Centimeter: 0.01,
      Millimeter: 0.001,
      Mile: 1609.344,
      Yard: 0.9144,
      Foot: 0.3048,
      Inch: 0.0254
    },
    weight: {
      Kilogram: 1,
      Gram: 0.001,
      Milligram: 0.000001,
      Pound: 0.453592,
      Ounce: 0.0283495,
      MetricTon: 1000
    },
    temp: {
      'Celsius (°C)': 'C',
      'Fahrenheit (°F)': 'F',
      'Kelvin (K)': 'K'
    },
    data: {
      Byte: 1,
      Kilobyte: 1024,
      Megabyte: 1048576,
      Gigabyte: 1073741824,
      Terabyte: 1099511627776
    }
  };

  function populateUnitSelects() {
    const cat = convCategory.value;
    const units = Object.keys(unitUnits[cat]);

    convFromUnit.innerHTML = units.map((u, i) => `<option value="${u}" ${i === 0 ? 'selected' : ''}>${u}</option>`).join('');
    convToUnit.innerHTML = units.map((u, i) => `<option value="${u}" ${i === 1 ? 'selected' : ''}>${u}</option>`).join('');
    convertUnits();
  }

  function convertUnits() {
    const cat = convCategory.value;
    const val = parseFloat(convFromVal.value) || 0;
    const from = convFromUnit.value;
    const to = convToUnit.value;

    if (cat === 'temp') {
      let cVal = val;
      if (from.includes('°F')) cVal = (val - 32) * (5 / 9);
      else if (from.includes('K')) cVal = val - 273.15;

      let result = cVal;
      if (to.includes('°F')) result = (cVal * 9) / 5 + 32;
      else if (to.includes('K')) result = cVal + 273.15;

      convToVal.value = Number(result.toFixed(4));
    } else {
      const fromRatio = unitUnits[cat][from];
      const toRatio = unitUnits[cat][to];
      const base = val * fromRatio;
      const result = base / toRatio;
      convToVal.value = Number(result.toFixed(6));
    }
  }

  // Tip & Split Calculator
  const tipBillAmount = document.getElementById('tipBillAmount');
  const tipRange = document.getElementById('tipRange');
  const tipPercentLabel = document.getElementById('tipPercentLabel');
  const splitCountDisplay = document.getElementById('splitCountDisplay');
  const splitCountLabel = document.getElementById('splitCountLabel');
  const decPersonBtn = document.getElementById('decPersonBtn');
  const incPersonBtn = document.getElementById('incPersonBtn');
  const tipAmountResult = document.getElementById('tipAmountResult');
  const totalWithTipResult = document.getElementById('totalWithTipResult');
  const perPersonResult = document.getElementById('perPersonResult');

  let splitPeople = 2;

  function calculateTip() {
    const bill = parseFloat(tipBillAmount.value) || 0;
    const tipPct = parseFloat(tipRange.value) || 0;
    tipPercentLabel.textContent = `${tipPct}%`;
    splitCountLabel.textContent = splitPeople;
    splitCountDisplay.textContent = splitPeople;

    const tipAmount = (bill * tipPct) / 100;
    const total = bill + tipAmount;
    const perPerson = total / splitPeople;

    tipAmountResult.textContent = `$${tipAmount.toFixed(2)}`;
    totalWithTipResult.textContent = `$${total.toFixed(2)}`;
    perPersonResult.textContent = `$${perPerson.toFixed(2)}`;
  }

  // Tax / GST Calculator
  const taxBasePrice = document.getElementById('taxBasePrice');
  const taxCustomRate = document.getElementById('taxCustomRate');
  const taxAmountResult = document.getElementById('taxAmountResult');
  const taxTotalResult = document.getElementById('taxTotalResult');

  function calculateTax() {
    const base = parseFloat(taxBasePrice.value) || 0;
    const rate = parseFloat(taxCustomRate.value) || 0;
    const tax = (base * rate) / 100;
    const total = base + tax;

    taxAmountResult.textContent = `$${tax.toFixed(2)}`;
    taxTotalResult.textContent = `$${total.toFixed(2)}`;
  }

  // ==========================================
  // Event Listeners & Keybindings
  // ==========================================
  function setupEventListeners() {
    // Mode Switcher
    modeStdBtn.addEventListener('click', () => {
      state.mode = 'standard';
      modeStdBtn.classList.add('active');
      modeSciBtn.classList.remove('active');
      appWrapper.classList.remove('scientific-active');
      playSound('num');
    });

    modeSciBtn.addEventListener('click', () => {
      state.mode = 'scientific';
      modeSciBtn.classList.add('active');
      modeStdBtn.classList.remove('active');
      appWrapper.classList.add('scientific-active');
      playSound('num');
    });

    // DEG / RAD Toggle
    angleUnitBtn.addEventListener('click', () => {
      state.angleUnit = state.angleUnit === 'DEG' ? 'RAD' : 'DEG';
      angleUnitBtn.textContent = state.angleUnit;
      playSound('num');
      showToast(`Angle unit set to ${state.angleUnit}`);
    });

    // Sound Toggle
    soundToggleBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      soundToggleBtn.classList.toggle('active-state', state.soundEnabled);
      soundToggleBtn.innerHTML = state.soundEnabled
        ? '<i class="fa-solid fa-volume-high"></i>'
        : '<i class="fa-solid fa-volume-xmark"></i>';
      showToast(`Sound FX ${state.soundEnabled ? 'Enabled' : 'Muted'}`);
      if (state.soundEnabled) playSound('num');
    });

    // Theme Switcher Dropdown
    themeDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      themeMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      themeMenu.classList.remove('show');
    });

    document.querySelectorAll('.theme-opt').forEach((opt) => {
      opt.addEventListener('click', () => {
        const themeVal = opt.dataset.themeVal;
        document.documentElement.setAttribute('data-theme', themeVal);
        document.querySelectorAll('.theme-opt').forEach((o) => o.classList.remove('active'));
        opt.classList.add('active');
        localStorage.setItem('neocalc_theme', themeVal);
        showToast(`Theme: ${opt.textContent.trim()}`);
      });
    });

    // Drawer Toggles
    historyToggleBtn.addEventListener('click', () => {
      toolsDrawer.classList.remove('open');
      historyDrawer.classList.toggle('open');
      playSound('num');
    });

    closeHistoryBtn.addEventListener('click', () => {
      historyDrawer.classList.remove('open');
    });

    toolsToggleBtn.addEventListener('click', () => {
      historyDrawer.classList.remove('open');
      toolsDrawer.classList.toggle('open');
      playSound('num');
    });

    closeToolsBtn.addEventListener('click', () => {
      toolsDrawer.classList.remove('open');
    });

    clearHistoryBtn.addEventListener('click', clearHistory);
    exportHistoryBtn.addEventListener('click', exportHistory);

    // Copy Result Button & Display Click
    const copyHandler = () => {
      const textToCopy = state.currentResult;
      if (textToCopy && textToCopy !== 'Error') {
        navigator.clipboard.writeText(textToCopy).then(() => {
          showToast(`Copied ${textToCopy} to clipboard!`);
          playSound('num');
        });
      }
    };

    copyResultBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyHandler();
    });

    displayContainer.addEventListener('click', copyHandler);

    // Keypad Click Delegation
    document.getElementById('keypadWrapper').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      if (btn.classList.contains('num-key')) {
        const key = btn.dataset.key;
        if (key === '.') inputDecimal();
        else inputDigit(key);
      } else if (btn.classList.contains('operator-key')) {
        const key = btn.dataset.key;
        inputOperator(key);
      } else if (btn.classList.contains('func-key')) {
        const action = btn.dataset.action;
        if (action === 'all-clear') clearAll();
        else if (action === 'backspace') backspace();
        else if (action === 'percent') inputPercent();
        else if (action === 'negate') toggleNegate();
        else if (action === 'decimal') inputDecimal();
      } else if (btn.classList.contains('equals-key')) {
        finalizeCalculation();
      } else if (btn.classList.contains('sci-key')) {
        const sci = btn.dataset.sci;
        handleScientific(sci);
      }
    });

    // Memory Bar Delegation
    document.querySelector('.memory-bar').addEventListener('click', (e) => {
      const btn = e.target.closest('.mem-btn');
      if (!btn) return;
      handleMemory(btn.dataset.action);
    });

    // Unit Converter Listeners
    convCategory.addEventListener('change', populateUnitSelects);
    convFromUnit.addEventListener('change', convertUnits);
    convToUnit.addEventListener('change', convertUnits);
    convFromVal.addEventListener('input', convertUnits);
    convSwapBtn.addEventListener('click', () => {
      const temp = convFromUnit.value;
      convFromUnit.value = convToUnit.value;
      convToUnit.value = temp;
      convertUnits();
      playSound('num');
    });

    pushToCalcBtn.addEventListener('click', () => {
      const result = convToVal.value;
      if (result) {
        state.expression = result;
        state.currentResult = result;
        state.isEvaluated = true;
        updateDisplay();
        toolsDrawer.classList.remove('open');
        showToast(`Sent ${result} to calculator`);
      }
    });

    // Tool Tabs
    document.querySelectorAll('.tool-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tool-tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.tool-pane').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        const targetPane = tab.dataset.tab === 'converter' ? 'paneConverter' : tab.dataset.tab === 'tip' ? 'paneTip' : 'paneTax';
        document.getElementById(targetPane).classList.add('active');
        playSound('num');
      });
    });

    // Tip split listeners
    tipBillAmount.addEventListener('input', calculateTip);
    tipRange.addEventListener('input', calculateTip);
    document.querySelectorAll('.tip-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.tip-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        tipRange.value = pill.dataset.pct;
        calculateTip();
      });
    });

    decPersonBtn.addEventListener('click', () => {
      if (splitPeople > 1) {
        splitPeople--;
        calculateTip();
      }
    });

    incPersonBtn.addEventListener('click', () => {
      if (splitPeople < 50) {
        splitPeople++;
        calculateTip();
      }
    });

    // Tax listeners
    taxBasePrice.addEventListener('input', calculateTax);
    taxCustomRate.addEventListener('input', calculateTax);
    document.querySelectorAll('.tax-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.tax-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        taxCustomRate.value = pill.dataset.tax;
        calculateTax();
      });
    });

    // Global Keyboard Support
    document.addEventListener('keydown', handleKeyboardInput);
  }

  function handleKeyboardInput(e) {
    // If user is typing inside drawer inputs, don't intercept calculator keys
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      return;
    }

    const key = e.key;

    // Visual button glow highlight helper
    const highlightButton = (selector) => {
      const btn = document.querySelector(selector);
      if (btn) {
        btn.classList.add('keyboard-pressed');
        setTimeout(() => btn.classList.remove('keyboard-pressed'), 140);
      }
    };

    if (/^[0-9]$/.test(key)) {
      e.preventDefault();
      inputDigit(key);
      highlightButton(`.num-key[data-key="${key}"]`);
    } else if (key === '.') {
      e.preventDefault();
      inputDecimal();
      highlightButton('.num-key[data-key="."]');
    } else if (['+', '-', '*', '/'].includes(key)) {
      e.preventDefault();
      inputOperator(key);
      highlightButton(`.operator-key[data-key="${key}"]`);
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      finalizeCalculation();
      highlightButton('#keyEquals');
    } else if (key === 'Backspace') {
      e.preventDefault();
      backspace();
      highlightButton('#keyDel');
    } else if (key === 'Escape') {
      e.preventDefault();
      clearAll();
      highlightButton('#keyAC');
    } else if (key === '%') {
      e.preventDefault();
      inputPercent();
      highlightButton('.func-key[data-action="percent"]');
    } else if (key === '(' || key === ')') {
      e.preventDefault();
      state.expression += key;
      liveCalculate();
      updateDisplay();
      playSound('operator');
    } else if (key.toLowerCase() === 'h') {
      // Toggle History Tape
      historyDrawer.classList.toggle('open');
      toolsDrawer.classList.remove('open');
    } else if (key.toLowerCase() === 't') {
      // Toggle Tools Drawer
      toolsDrawer.classList.toggle('open');
      historyDrawer.classList.remove('open');
    } else if (key.toLowerCase() === 's') {
      // Toggle Sound
      soundToggleBtn.click();
    }
  }

  // ==========================================
  // Initialization
  // ==========================================
  function init() {
    // Load saved theme
    const savedTheme = localStorage.getItem('neocalc_theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
      document.querySelectorAll('.theme-opt').forEach((o) => {
        o.classList.toggle('active', o.dataset.themeVal === savedTheme);
      });
    }

    loadHistory();
    populateUnitSelects();
    calculateTip();
    calculateTax();
    setupEventListeners();
    updateDisplay();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
