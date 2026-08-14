(function() {
    'use strict';

    const SHORTCUTS_KEY = 'zd-shortcuts-v44';
    const getSaved = () => JSON.parse(localStorage.getItem(SHORTCUTS_KEY) || '{}');
    const save = (k, v) => {
        const c = getSaved();
        for(let key in c) { if(c[key] === v) delete c[key]; }
        c[k] = v;
        localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(c));
    };
    const remove = (k) => { const c = getSaved(); delete c[k]; localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(c)); };

    const style = document.createElement('style');
    style.innerHTML = `
        #zd-wrapper { position: fixed; bottom: 150px; left: 0; z-index: 99999; font-family: sans-serif; }
        #zd-remote-trigger { background: #000; color: #fff; width: 46px; height: 46px; border-radius: 0 10px 10px 0; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 2px 2px 10px rgba(0,0,0,0.3); }
        #zd-remote-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 99998; display: none; backdrop-filter: blur(2px); }
        #zd-remote-overlay { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 480px; max-height: 80vh; background: #fff; z-index: 100000; border-radius: 12px; display: none; flex-direction: column; overflow: hidden; box-shadow: 0 15px 50px rgba(0,0,0,0.3); border: 1px solid #ccc; }

        .zd-header { padding: 20px; background: #1a1a1a; border-bottom: 1px solid #333; }
        #zd-remote-search { width: 100%; padding: 12px; border: 1px solid #444; border-radius: 8px; font-size: 16px; font-weight: bold; color: #ffffff !important; background: #333 !important; box-sizing: border-box; outline: none; }
        #zd-remote-search::placeholder { color: #aaa; font-weight: normal; }

        #zd-remote-list { list-style: none; padding: 10px 20px 20px; overflow-y: auto; flex-grow: 1; }
        .zd-item { padding: 12px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 8px; cursor: pointer; display: flex; align-items: center; background: #fff; color: #000; font-weight: 500; }
        .zd-item:hover { background: #f0f7ff; border-color: #0066ff; }
        .zd-badge { background: #333; color: #fff; padding: 2px 8px; border-radius: 4px; margin-right: 12px; font-weight: bold; font-size: 13px; }
        .zd-badge-saved { background: #1a7f37; }
        .zd-sep { font-size: 11px; color: #666; text-transform: uppercase; margin: 15px 0 8px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 4px; }
        .zd-pin-btn { margin-left: auto; background: #f5f5f5; border: 1px solid #ddd; padding: 4px 8px; border-radius: 6px; font-size: 12px; cursor: pointer; color: #444; }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div'); overlay.id = 'zd-remote-overlay';
    overlay.innerHTML = `<div class="zd-header"><input type="text" id="zd-remote-search" placeholder="Digite ou aperte um número..." autocomplete="off"></div><ul id="zd-remote-list"></ul>`;
    const backdrop = document.createElement('div'); backdrop.id = 'zd-remote-backdrop';
    const trigger = document.createElement('div'); trigger.id = 'zd-wrapper';
    trigger.innerHTML = `<div id="zd-remote-trigger">🔍</div>`;
    document.body.append(overlay, backdrop, trigger);

    function getFormElement() {
        const label = Array.from(document.querySelectorAll('label')).find(l => l.innerText.includes('Formulário'));
        if (!label) return null;
        const container = label.closest('[data-test-id*="ticket-fields"]') || label.parentElement;
        return container.querySelector('button, [role="combobox"], input');
    }

    async function selectOption(text) {
        const el = getFormElement();
        if (!el) return;
        close();
        el.focus();
        el.click();
        await new Promise(r => setTimeout(r, 450));

        // Filtra os itens fantasma do React (pega só os visíveis)
        const options = Array.from(document.querySelectorAll('[role="option"]'))
                             .filter(o => o.offsetHeight > 0);

        const target = options.find(o => o.innerText.trim().toLowerCase().includes(text.toLowerCase().trim()));

        if (target) {
            ['mousedown', 'mouseup', 'click'].forEach(name => {
                target.dispatchEvent(new MouseEvent(name, { bubbles: true, cancelable: true, view: window }));
            });
        } else {
            el.click();
        }
    }

    async function scrapeOptions() {
        const el = getFormElement();
        if (!el) return [];
        el.click();
        await new Promise(r => setTimeout(r, 600));

        // Filtra os itens fantasma do React (pega só os visíveis)
        const items = Array.from(document.querySelectorAll('[role="option"]'))
                           .filter(o => o.offsetHeight > 0);

        const texts = [...new Set(items.map(i => i.innerText.split('\n')[0].trim()))].filter(t => t.length > 1);
        el.click();
        return texts.sort();
    }

    function createSeparator(text) {
        const sep = document.createElement('div');
        sep.className = 'zd-sep';
        sep.innerText = text;
        return sep;
    }

    function render(filter = '') {
        const list = document.getElementById('zd-remote-list');
        list.innerHTML = '';
        const saved = getSaved();
        const lowFilter = filter.toLowerCase();

        if(!filter) {
            list.appendChild(createSeparator('Atalhos Fixados'));
            for(let i=0; i<=9; i++) {
                if(saved[i]) addItem(saved[i], i, true);
            }
            list.appendChild(createSeparator('Todos'));
        }

        (window.cachedOptions || []).forEach((t, i) => {
            if(!filter || t.toLowerCase().includes(lowFilter)) {
                addItem(t, (filter && i <= 9 ? i : null), false);
            }
        });
    }

    function addItem(text, num, isSaved) {
        const li = document.createElement('li');
        li.className = 'zd-item';
        li.innerHTML = `${num !== null ? `<span class="zd-badge ${isSaved ? 'zd-badge-saved' : ''}">${num}</span>` : ''} <span>${text}</span> <button class="zd-pin-btn">${isSaved ? '🗑️' : '📌'}</button>`;

        li.querySelector('.zd-pin-btn').onclick = (e) => {
            e.stopPropagation();
            if(isSaved) remove(num);
            else { const n = prompt("Número (0-9):"); if(n !== null && n >= 0 && n <= 9) save(n, text); }
            render(document.getElementById('zd-remote-search').value);
        };

        li.onclick = () => selectOption(text);
        document.getElementById('zd-remote-list').appendChild(li);
    }

    function close() { overlay.style.display = 'none'; backdrop.style.display = 'none'; }
    backdrop.onclick = close;

    document.getElementById('zd-remote-trigger').onclick = async () => {
        document.getElementById('zd-remote-trigger').innerText = '⌛';
        window.cachedOptions = await scrapeOptions();
        document.getElementById('zd-remote-trigger').innerText = '🔍';
        document.getElementById('zd-remote-search').value = '';
        overlay.style.display = 'flex';
        backdrop.style.display = 'block';
        render();
        document.getElementById('zd-remote-search').focus();
    };

    document.getElementById('zd-remote-search').oninput = (e) => render(e.target.value);

    // LÓGICA DE TECLADO MELHORADA
    document.addEventListener('keydown', (e) => {
        if (overlay.style.display !== 'flex') return;

        if (e.key === 'Escape') {
            close();
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            const firstItem = document.querySelector('.zd-item');
            if (firstItem) firstItem.click();
            return;
        }

        // CAPTURA DE NÚMERO DIRETO (0-9)
        const n = parseInt(e.key);
        if (!isNaN(n) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            const saved = getSaved();
            // Se existir um atalho para esse número, executa e bloqueia a digitação
            if (saved[n]) {
                e.preventDefault();
                e.stopPropagation();
                selectOption(saved[n]);
            }
        }
    }, true); // O "true" aqui garante que capturamos antes do input processar a tecla
})();