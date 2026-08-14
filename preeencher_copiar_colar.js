(function () {
    'use strict';

    console.log('[PM-Logic] Motor v11.0 - Monitoramento, Resiliência, Gatilho Manual e Função Copiar/Colar Ativados.');

    let isProcessing = false;
    const ticketsProcessados = new Set();

    // =================================================================
    // 1. UTILITÁRIOS DE INJEÇÃO E VALIDAÇÃO
    // =================================================================

    function isElementVisible(el) {
        return el && el.offsetParent !== null &&
               window.getComputedStyle(el).visibility !== 'hidden' &&
               window.getComputedStyle(el).display !== 'none';
    }

    function setReactInputValue(el, value) {
        if (!el) return;
        el.click();
        el.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(el, value);
        } else {
            el.value = value;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
    }

    async function waitFor(f, t = 8000, i = 300) {
        const s = Date.now();
        while (Date.now() - s < t) {
            try { const v = f(); if (v) return v; } catch (e) {}
            await new Promise(r => setTimeout(r, i));
        }
        return null;
    }

    async function getTextInputByZendeskLabel(regexLabel) {
        const labelElement = await waitFor(() =>
            Array.from(document.querySelectorAll('label')).find(el =>
                regexLabel.test(el.textContent.trim()) && isElementVisible(el)
            ), 5000, 300);

        if (!labelElement) return null;
        const fieldContainer = labelElement.closest('div[data-garden-id="forms.field"]');
        if (fieldContainer) {
            const input = fieldContainer.querySelector('input');
            if (input && isElementVisible(input)) return input;
        }
        return null;
    }

    async function obterValorAtualDropdown(labelText) {
        const label = await waitFor(() =>
            Array.from(document.querySelectorAll('label')).find(el =>
                el.textContent.trim().startsWith(labelText) && isElementVisible(el)
            ), 3000, 300);

        if (!label) return '';
        let field = label.nextElementSibling;
        if (!field || !isElementVisible(field)) {
            const container = label.closest('div[data-garden-id="forms.field"]');
            field = container ? container.querySelector('div[id^="downshift-"]') || container.querySelector('input')?.parentElement : null;
        }
        if (!field) return '';
        const input = field.querySelector('input');
        let valorAtual = (input && input.value) ? input.value : (field.textContent || '');
        return valorAtual.replace(/[\n\r]+/g, ' ').trim().toUpperCase();
    }

    // =================================================================
    // 2. EXTRAÇÃO E LÓGICA DE PREENCHIMENTO
    // =================================================================

    async function extrairDadosViaAPI(ticketId) {
        let dados = { loja: null, telefone: null };
        try {
            const response = await fetch(`/api/v2/tickets/${ticketId}/audits.json`);
            if (!response.ok) throw new Error('Falha na comunicação com a API');

            const data = await response.json();
            data.audits.forEach(audit => {
                audit.events.forEach(evento => {
                    if (evento.type === "Create" || evento.type === "Change") {
                        if (evento.field_name === "31426614109581") {
                            dados.loja = String(evento.value);
                        }
                        if (evento.field_name === "tags") {
                            const tags = Array.isArray(evento.value) ? evento.value.join(',') : String(evento.value);
                            const m = tags.match(/bcr-comma-phone-55(\d+)/i);
                            if (m) dados.telefone = m[1];
                        }
                    }
                });
            });
            console.log(`[PM-Logic] Dados extraídos da API para o ticket ${ticketId}:`, dados);
            return dados;
        } catch (e) {
            console.warn(`[PM-Logic] Erro ao extrair dados do ticket ${ticketId}:`, e);
            return dados;
        }
    }

    async function selectDropdownByPartialLabel(labelText, optionTextToSelect) {
        const label = await waitFor(() =>
            Array.from(document.querySelectorAll('label')).find(el =>
                el.textContent.trim().startsWith(labelText) && isElementVisible(el)
            ));
        if (!label) return false;

        let field = label.nextElementSibling;
        if (!field || !isElementVisible(field)) {
            const container = label.closest('div[data-garden-id="forms.field"]');
            field = container ? container.querySelector('div[id^="downshift-"]') || container.querySelector('input')?.parentElement : null;
        }
        if (!field) return false;

        const target = field.querySelector('input') || field;
        target.click();
        await new Promise(r => setTimeout(r, 1000));

        const list = Array.from(document.querySelectorAll('[role="listbox"]')).find(isElementVisible);
        if (!list) return false;

        const opt = Array.from(list.querySelectorAll('[role="option"]')).find(o =>
            o.textContent.toUpperCase().includes(optionTextToSelect.trim().toUpperCase())
        );

        if (opt) {
            opt.scrollIntoView({ block: 'nearest' });
            await new Promise(r => setTimeout(r, 200));
            opt.click();
            return true;
        }
        return false;
    }

    // Função separada apenas para inserir dados na tela
    async function preencherCampos(dados) {
        // 1. TELEFONES
        if (dados.telefone) {
            const tLoja = await getTextInputByZendeskLabel(/Telefone Loja/i);
            if (tLoja && (tLoja.value || '').trim() === '') {
                setReactInputValue(tLoja, dados.telefone);
                await new Promise(r => setTimeout(r, 500));
            }

            const tGer = await getTextInputByZendeskLabel(/Telefone Gerente/i);
            if (tGer && (tGer.value || '').trim() === '') {
                setReactInputValue(tGer, dados.telefone);
                await new Promise(r => setTimeout(r, 500));
            }
        }

        // 2. LOJAS
        if (dados.loja) {
            const valorCampoLojas = await obterValorAtualDropdown('Lojas');
            const jaPreenchido = valorCampoLojas.includes('PAGUE MENOS') || valorCampoLojas.includes('EXTRAFARMA');

            if (!jaPreenchido) {
                const rede = parseInt(dados.loja, 10) >= 7000 ? "ExtraFarma" : "Pague Menos";
                const okRede = await selectDropdownByPartialLabel('Lojas', rede);
                if (okRede) {
                    await new Promise(r => setTimeout(r, 800));
                    await selectDropdownByPartialLabel('Nº da Loja', dados.loja);
                }
            }
        }
    }

    // Rotina automática / Gatilho manual nativo
    async function rotinaDePreenchimento(ticketId) {
        if (ticketsProcessados.has(ticketId) || isProcessing) return;
        if (ticketId !== getCurrentTicketId()) return;

        isProcessing = true;
        try {
            console.log(`[PM-Logic] Iniciando preenchimento do Ticket #${ticketId}`);
            const dados = await extrairDadosViaAPI(ticketId);

            if (ticketId !== getCurrentTicketId()) {
                isProcessing = false;
                return;
            }

            if (!dados.loja && !dados.telefone) {
                console.log(`[PM-Logic] Nenhum dado válido encontrado para o Ticket #${ticketId}. Pulando...`);
                ticketsProcessados.add(ticketId);
                return;
            }

            await preencherCampos(dados);

            ticketsProcessados.add(ticketId);
            console.log(`[PM-Logic] Finalizado com sucesso #${ticketId}`);
        } catch (e) {
            console.error('[PM-Logic] Erro durante o preenchimento:', e);
        } finally {
            isProcessing = false;
        }
    }

    // =================================================================
    // 3. UI - BARRA DE FERRAMENTAS (AUTO, COPIAR, COLAR)
    // =================================================================

    function criarBotoesInterativos() {
        const style = document.createElement('style');
        style.innerHTML = `
            #pm-toolbar { position: fixed; bottom: 210px; left: 0; z-index: 99999; font-family: sans-serif; display: flex; flex-direction: column; gap: 5px; }
            .pm-btn { background: #1a7f37; color: #fff; width: 46px; height: 46px; border-radius: 0 10px 10px 0; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 2px 2px 10px rgba(0,0,0,0.3); transition: background 0.2s; user-select: none; border: none; padding: 0; margin: 0; }
            .pm-btn:hover { background: #23a045; }
            .pm-btn:active { background: #135c27; }
        `;
        document.head.appendChild(style);

        const toolbar = document.createElement('div');
        toolbar.id = 'pm-toolbar';
        toolbar.innerHTML = `
            <div id="pm-btn-auto" class="pm-btn" title="Forçar Preenchimento Automático">⚡</div>
            <div id="pm-btn-copy" class="pm-btn" title="Copiar dados deste ticket">📥</div>
            <div id="pm-btn-paste" class="pm-btn" title="Colar dados gravados neste ticket">📤</div>
        `;
        document.body.appendChild(toolbar);

        // AÇÃO: AUTO PREENCHER (Lógica Original)
        document.getElementById('pm-btn-auto').addEventListener('click', () => {
            const currentId = getCurrentTicketId();
            if (currentId) {
                console.log(`[PM-Logic] Disparo MANUAL acionado para o ticket #${currentId}`);
                ticketsProcessados.delete(currentId);
                animarBotao('pm-btn-auto', '⌛', '⚡');
                rotinaDePreenchimento(currentId);
            }
        });

        // AÇÃO: COPIAR DADOS
        document.getElementById('pm-btn-copy').addEventListener('click', async () => {
            const currentId = getCurrentTicketId();
            if (!currentId) return;

            const btn = document.getElementById('pm-btn-copy');
            btn.innerText = '⌛';

            const dados = await extrairDadosViaAPI(currentId);

            if (dados.loja || dados.telefone) {
                // Salva na memória do navegador
                sessionStorage.setItem('pm_dados_copiados', JSON.stringify(dados));
                console.log('[PM-Logic] Dados COPIADOS para a memória:', dados);
                animarBotao('pm-btn-copy', '✅', '📥');
            } else {
                console.warn('[PM-Logic] Nenhum dado útil encontrado para copiar.');
                animarBotao('pm-btn-copy', '❌', '📥');
            }
        });

        // AÇÃO: COLAR DADOS
        document.getElementById('pm-btn-paste').addEventListener('click', async () => {
            const dadosSalvos = sessionStorage.getItem('pm_dados_copiados');
            const btn = document.getElementById('pm-btn-paste');

            if (!dadosSalvos) {
                console.warn('[PM-Logic] Não há dados salvos na memória para colar.');
                animarBotao('pm-btn-paste', '❌', '📤');
                return;
            }

            btn.innerText = '⌛';
            const dados = JSON.parse(dadosSalvos);
            console.log('[PM-Logic] COLANDO dados da memória:', dados);

            try {
                await preencherCampos(dados);
                animarBotao('pm-btn-paste', '✅', '📤');
            } catch (e) {
                console.error('[PM-Logic] Erro ao colar dados:', e);
                animarBotao('pm-btn-paste', '❌', '📤');
            }
        });
    }

    function animarBotao(id, textoTemp, textoOriginal) {
        const btn = document.getElementById(id);
        if(!btn) return;
        btn.innerText = textoTemp;
        setTimeout(() => btn.innerText = textoOriginal, 1500);
    }

    // =================================================================
    // 4. MONITORAMENTO DE NAVEGAÇÃO
    // =================================================================

    function getCurrentTicketId() {
        const m = window.location.pathname.match(/\/tickets\/(\d+)/);
        return m ? m[1] : null;
    }

    function oCampoEstaPronto() {
        return !!Array.from(document.querySelectorAll('label')).find(el =>
            (/(Telefone Gerente|Telefone Loja|Lojas)/i).test(el.textContent.trim()) && isElementVisible(el)
        );
    }

    function monitorar() {
        const currentId = getCurrentTicketId();
        if (!currentId) return;

        if (!ticketsProcessados.has(currentId) && !isProcessing) {
            if (oCampoEstaPronto()) {
                rotinaDePreenchimento(currentId);
            }
        }
    }

    // Inicialização
    criarBotoesInterativos();

    (function(h){
        const p = h.pushState;
        h.pushState = function(){
            p.apply(h, arguments);
            setTimeout(monitorar, 500);
        };
    })(window.history);

    window.addEventListener('popstate', () => setTimeout(monitorar, 500));
    setInterval(monitorar, 1500);

})();