document.addEventListener('DOMContentLoaded', () => {
  const displayCurrent = document.getElementById('calc-current');
  const displayHistory = document.getElementById('calc-history');
  const sciGrid = document.getElementById('sci-grid');
  const btnToggleSci = document.getElementById('btn-toggle-sci');

  let expression = '';
  let memory = 0;
  let isResultShown = false;

  function updateDisplay() {
    displayCurrent.innerText = expression || '0';
  }

  function appendValue(val) {
    if (isResultShown && !isNaN(val)) {
      expression = '';
      isResultShown = false;
    }
    isResultShown = false;
    expression += val;
    updateDisplay();
  }

  function evaluateExpression() {
    try {
      if (!expression) return;
      displayHistory.innerText = expression + ' =';

      // Safe JS math evaluation
      let sanitized = expression
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/\^2/g, '**2');

      // Functions support
      sanitized = sanitized
        .replace(/sin\(/g, 'Math.sin(')
        .replace(/cos\(/g, 'Math.cos(')
        .replace(/tan\(/g, 'Math.tan(')
        .replace(/log\(/g, 'Math.log10(')
        .replace(/ln\(/g, 'Math.log(')
        .replace(/√\(/g, 'Math.sqrt(');

      const result = Function(`'use strict'; return (${sanitized})`)();
      expression = String(parseFloat(result.toFixed(8)));
      isResultShown = true;
      updateDisplay();
    } catch (e) {
      displayCurrent.innerText = 'Error';
      expression = '';
      isResultShown = true;
    }
  }

  // Button clicks
  document.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.val;
      const action = btn.dataset.action;
      const fn = btn.dataset.fn;

      if (val !== undefined) {
        appendValue(val);
      } else if (fn) {
        appendValue(`${fn}(`);
      } else if (action) {
        switch (action) {
          case 'clear':
            expression = '';
            displayHistory.innerText = '';
            updateDisplay();
            break;
          case 'equals':
            evaluateExpression();
            break;
          case 'add':
            appendValue('+');
            break;
          case 'subtract':
            appendValue('−');
            break;
          case 'multiply':
            appendValue('×');
            break;
          case 'divide':
            appendValue('÷');
            break;
          case 'paren-open':
            appendValue('(');
            break;
          case 'paren-close':
            appendValue(')');
            break;
          case 'negate':
            if (expression) {
              if (expression.startsWith('-')) expression = expression.slice(1);
              else expression = '-' + expression;
              updateDisplay();
            }
            break;
        }
      }
    });
  });

  // Memory buttons
  document.querySelectorAll('.mem-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const currentNum = parseFloat(displayCurrent.innerText) || 0;

      if (action === 'mc') memory = 0;
      else if (action === 'mr') appendValue(String(memory));
      else if (action === 'm-plus') memory += currentNum;
      else if (action === 'm-minus') memory -= currentNum;
    });
  });

  // Scientific Mode Toggle
  btnToggleSci.addEventListener('click', () => {
    const isHidden = sciGrid.style.display === 'none';
    sciGrid.style.display = isHidden ? 'grid' : 'none';
    btnToggleSci.classList.toggle('active', isHidden);
  });

  // Keyboard support
  window.addEventListener('keydown', (e) => {
    if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
      appendValue(e.key);
    } else if (e.key === '+') appendValue('+');
    else if (e.key === '-') appendValue('−');
    else if (e.key === '*') appendValue('×');
    else if (e.key === '/') { e.preventDefault(); appendValue('÷'); }
    else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); evaluateExpression(); }
    else if (e.key === 'Backspace') {
      expression = expression.slice(0, -1);
      updateDisplay();
    } else if (e.key === 'Escape') {
      expression = '';
      displayHistory.innerText = '';
      updateDisplay();
    }
  });

  EndroidIcons.render();
});
