(function() {
    'use strict';

    // ---------------------------------------------------------------------
    // FASE 0: LIMPEZA NUCLEAR ANTES DA PÁGINA CARREGAR (Simula Ctrl+Shift+R)
    // ---------------------------------------------------------------------
    const urlParams = new URLSearchParams(window.location.search);
    const lojaURL = urlParams.get('auto_loja');

    if (lojaURL) {
        // Verifica se já fizemos a limpeza profunda para ESTA loja na sessão atual (evita loop infinito)
        const jaLimpou = sessionStorage.getItem('pm_loja_limpa') === lojaURL;

        if (!jaLimpou) {
            console.log(`[AutoSearch] 🧹 Limpeza NUCLEAR ativada! Destruindo cache da loja antiga...`);

            // 1. Para o carregamento atual da página imediatamente
            window.stop();

            // 2. Apaga todo o Session Storage e Local Storage (Limpa estados do React/Redux)
            sessionStorage.clear();
            localStorage.clear();

            // 3. Apaga todos os Cookies (Descomente a linha abaixo se quiser limpar cookies também)
            // document.cookie.split(";").forEach(c => document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"));

            // 4. Remove os Service Workers (Desativa cache agressivo de PWAs)
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for (let registration of registrations) {
                        registration.unregister();
                    }
                });
            }

            // 5. Salva a flag avisando que a limpeza já foi feita para esta loja
            sessionStorage.setItem('pm_loja_limpa', lojaURL);
            sessionStorage.setItem('pm_loja_pendente', lojaURL);

            // 6. Força o Reload ignorando o cache do navegador (O verdadeiro Ctrl+Shift+R)
            window.location.reload(true);

            return; // Encerra a execução deste ciclo. O script rodará de novo na página limpa.
        }
    }

    // ---------------------------------------------------------------------
    // FASE 1: APLICAÇÃO VISUAL E PREENCHIMENTO (Roda após o Reload Limpo)
    // ---------------------------------------------------------------------

    function aplicarZoom() {
        if (document.getElementById('pm-zoom-style')) return;
        const style = document.createElement('style');
        style.id = 'pm-zoom-style';
        style.innerHTML = `body { transform: scale(0.8); transform-origin: top left; width: 125vw; height: 125vh; overflow-x: hidden; }`;
        if (document.head) {
            document.head.appendChild(style);
        } else {
            document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
        }
    }

    aplicarZoom();

    // Aguarda o sistema desenhar a tela
    window.addEventListener('load', iniciarPreenchimento);
    setTimeout(iniciarPreenchimento, 500);

    function iniciarPreenchimento() {
        aplicarZoom();

        const lojaPendente = sessionStorage.getItem('pm_loja_pendente');
        if (!lojaPendente) return;

        console.log(`[AutoSearch] 🚀 Executando preenchimento na página 100% limpa. Loja: ${lojaPendente}`);

        let tentativas = 0;
        const intervalo = setInterval(() => {
            tentativas++;

            // Procura o campo de busca
            const inputBusca = document.querySelector('input[type="search"]') ||
                               document.querySelector('input.form-control') ||
                               document.querySelector('.search-box input') ||
                               document.querySelector('input[placeholder*="Loja"]') ||
                               document.querySelector('input[placeholder*="busca"]');

            if (inputBusca) {
                clearInterval(intervalo);
                sessionStorage.removeItem('pm_loja_pendente'); // Remove a pendência para não repetir

                // Tenta clicar no botão "X" de limpar busca do próprio painel (se houver)
                const clearBtn = document.querySelector('button[aria-label="Clear"]') ||
                                 document.querySelector('.clear-search') ||
                                 document.querySelector('svg[data-testid="ClearIcon"]')?.parentNode;
                if (clearBtn && typeof clearBtn.click === 'function') {
                    clearBtn.click();
                }

                inputBusca.focus();

                // Hack para atualizar o valor ignorando o bloqueio do React
                const prototype = Object.getPrototypeOf(inputBusca) || window.HTMLInputElement.prototype;
                const nativeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set ||
                                          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

                // Força campo em branco primeiro
                if (nativeValueSetter) {
                    nativeValueSetter.call(inputBusca, '');
                    inputBusca.dispatchEvent(new Event('input', { bubbles: true }));
                }

                setTimeout(() => {
                    // Insere o número novo
                    if (nativeValueSetter) {
                        nativeValueSetter.call(inputBusca, lojaPendente);
                    } else {
                        inputBusca.value = lojaPendente;
                    }

                    // Acorda o painel
                    inputBusca.dispatchEvent(new Event('input', { bubbles: true }));
                    inputBusca.dispatchEvent(new Event('change', { bubbles: true }));

                    // Dispara o Enter
                    setTimeout(() => {
                        dispararEnter(inputBusca);
                        setTimeout(() => dispararEnter(inputBusca), 200); // 2º disparo de segurança
                    }, 300);
                }, 100);
            }

            if (tentativas > 40) {
                clearInterval(intervalo);
                console.log("[AutoSearch] Input não encontrado a tempo.");
            }
        }, 100);
    }

    function dispararEnter(elemento) {
        elemento.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        elemento.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        elemento.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        console.log("[AutoSearch] Tecla Enter simulada com sucesso!");
    }

})();