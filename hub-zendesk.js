(function() {
    'use strict';

    // ==========================================
    // VARIÁVEIS GLOBAIS E CONFIG DE TEMPO
    // ==========================================
    let ultimoTicketId = null;
    let dadosResumoAtual = null;

    const FILTER_TITLE = '📋 Filtro Rápido';
    const CHECK_INTERVAL = 30000; // Checa novos chamados a cada 30s

    // --- MOTORES SEPARADOS ---
    const INATIVIDADE_CHECK_INTERVAL = 60000; // O "olho" do script vasculha a fila a cada 1 minuto
    const TEMPO_REPETICAO_ALERTA = 300000; // A regra bloqueia o spam e só repete o toast a cada 5 minutos

    const STORAGE_KEY = 'pm_opened_web_tickets';

    let VIEW_ID = GM_getValue('pmFiltroViewId_User', null);
    let openedTickets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    let ultimoAlertaInatividade = new Map();
    let idNovoFormWeb = null;

    // ==========================================
    // INJEÇÃO DA INTERFACE UNIFICADA E CSS
    // ==========================================
    function injetarInterface() {
        if (!document.body || document.getElementById('tm-painel-flutuante')) return;

        if (!document.getElementById('tm-custom-style')) {
            const style = document.createElement('style');
            style.id = 'tm-custom-style';
            style.innerHTML = `
                /* ================= CSS DO RESUMO ================= */
                #tm-modal-body { color: #111111 !important; font-size: 15px !important; }
                .tm-info-card { background: #fafafa; border: 2px solid #ccc; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
                .tm-info-linha { margin-bottom: 10px; border-bottom: 1px dashed #ddd; padding-bottom: 6px; }
                .tm-info-linha:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
                .tm-info-label { font-weight: bold; color: #1f73b7; display: inline-block; width: 110px; }
                .tm-info-valor { color: #222; font-weight: 500; }

                /* ================= CSS DO PAINEL ARRASTÁVEL ================= */
                #tm-painel-flutuante {
                    position: fixed; z-index: 999999; background-color: #1b202b; border: 1px solid #323946;
                    border-radius: 6px; box-shadow: 0 6px 12px rgba(0,0,0,0.5); display: flex; flex-direction: row;
                    align-items: stretch; width: max-content; font-family: system-ui, -apple-system, sans-serif; overflow: hidden;
                }
                #tm-drag-handle {
                    background-color: #232a35; color: #6b7280; padding: 0 10px; font-size: 14px; font-weight: bold;
                    cursor: grab; user-select: none; border-right: 1px solid #323946; display: flex; justify-content: center; align-items: center;
                }
                #tm-drag-handle:active { cursor: grabbing; }
                #tm-botoes-container { padding: 6px; display: flex; gap: 6px; align-items: center; }

                /* ================= CSS DOS BOTÕES DO HUB ================= */
                .tm-btn-loja-dark { background-color: #343b49; color: #ffffff; border: none; border-radius: 4px; padding: 6px 12px; font-weight: 600; font-size: 12px; cursor: pointer; transition: background 0.2s; }
                .tm-btn-loja-dark:hover { background-color: #424a5c; }
                .tm-btn-ver-blue { background-color: #2a62ff; color: #ffffff; border: none; border-radius: 4px; padding: 6px 12px; font-weight: 600; font-size: 12px; cursor: pointer; transition: background 0.2s; }
                .tm-btn-ver-blue:hover { background-color: #1852f0; }
                .tm-btn-filtro-indigo { background-color: #4f46e5; color: #ffffff; border: none; border-radius: 4px; padding: 6px 12px; font-weight: 600; font-size: 12px; cursor: pointer; transition: background 0.2s; position: relative; }
                .tm-btn-filtro-indigo:hover { background-color: #4338ca; }

                .tm-btn-filtro-alert { background-color: #ef4444 !important; color: #ffffff !important; box-shadow: 0 0 10px rgba(239, 68, 68, 0.8); }

                /* ================= CSS DA GAVETA DO FILTRO ================= */
                #tm-drawer {
                    position: fixed; top: 0; right: -550px; width: 520px; height: 100vh; background-color: #1f2a36; color: #c2c8d0;
                    box-shadow: -5px 0 20px rgba(0,0,0,0.5); transition: right 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                    z-index: 9999999; display: flex; flex-direction: column; font-family: system-ui, -apple-system, sans-serif; border-left: 1px solid #3e4b5b;
                }
                #tm-drawer.active { right: 0; }
                #tm-header { padding: 15px 20px; border-bottom: 1px solid #3e4b5b; display: flex; justify-content: space-between; align-items: center; background-color: #151c24; }
                #tm-header h3 { margin: 0; font-size: 16px; color: #fff; display: flex; align-items: center; }
                #tm-close { background: none; border: none; color: #aaa; font-size: 20px; cursor: pointer; }
                #tm-close:hover { color: #fff; }
                #tm-content { flex: 1; overflow-y: auto; padding: 0; }
                .tm-ticket-item { padding: 12px 20px; border-bottom: 1px solid #2f3b4b; cursor: pointer; transition: background 0.2s; display: flex; align-items: flex-start; gap: 12px; text-decoration: none !important; color: inherit !important; }
                .tm-ticket-item:hover { background-color: #2a3644; }
                .tm-meta-col { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 65px; }
                .tm-badge { font-size: 9px; padding: 2px 0; width: 100%; border-radius: 3px; text-transform: uppercase; font-weight: bold; text-align: center; display: block; }
                .status-new { background-color: #ffc107; color: #000; } .status-open { background-color: #e34f32; color: #fff; } .status-pending { background-color: #3091ec; color: #fff; } .status-solved { background-color: #4caf50; color: #fff; } .status-hold { background-color: #2f3b4b; color: #ccc; border: 1px solid #555; }
                .prio-urgent { border: 1px solid #e34f32; color: #e34f32; } .prio-high { border: 1px solid #ffb124; color: #ffb124; } .prio-normal { border: 1px solid #3091ec; color: #3091ec; } .prio-low { border: 1px solid #4caf50; color: #4caf50; } .prio-none { border: 1px solid #666; color: #888; }
                .channel-whatsapp { background-color: rgba(37, 211, 102, 0.15); color: #25D366; } .channel-web { background-color: rgba(48, 145, 236, 0.15); color: #3091ec; } .channel-email { background-color: rgba(227, 79, 50, 0.15); color: #e34f32; } .channel-other { background-color: rgba(136, 136, 136, 0.15); color: #aaa; }
                .tm-ticket-info { flex: 1; } .tm-ticket-id { font-size: 11px; color: #687383; margin-bottom: 2px; } .tm-ticket-subject { font-size: 13px; color: #e9ebed; font-weight: 500; line-height: 1.4; } .tm-ticket-meta { font-size: 11px; color: #87929d; margin-top: 4px; }
                #tm-footer { padding: 15px; border-top: 1px solid #3e4b5b; text-align: center; background-color: #151c24; } #tm-full-view-btn { background: none; border: 1px solid #3091ec; color: #3091ec; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; text-decoration: none; display: inline-block; }
                .tm-loading { text-align: center; padding: 20px; color: #888; font-style: italic; }

                /* ================= CSS DA COLUNA ATUALIZADO ================= */
                .tm-col-updated { display: flex; flex-direction: column; align-items: flex-end; justify-content: center; min-width: 65px; margin-left: auto; }
                .tm-updated-label { font-size: 9px; color: #687383; text-transform: uppercase; margin-bottom: 4px; font-weight: 600; text-align: right; }
                .tm-min-badge { font-size: 11px; padding: 3px 6px; border-radius: 4px; background-color: #2a3644; color: #87929d; border: 1px solid #3e4b5b; font-weight: bold; text-align: center; display: inline-block; }
                .tm-min-badge.alert { background-color: rgba(227, 79, 50, 0.1); color: #e34f32; border-color: rgba(227, 79, 50, 0.3); }

                /* ================= CSS DO TOAST (NOTIFICAÇÃO) ================= */
                #tm-toast-container { position: fixed; top: 20px; right: 20px; z-index: 9999999; display: flex; flex-direction: column; gap: 10px; pointer-events: none; }
                .tm-toast { pointer-events: auto; background-color: #e34f32; color: white; padding: 15px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 500; animation: tm-slide-in 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) forwards; display: flex; align-items: center; justify-content: space-between; min-width: 300px; border-left: 5px solid #ffb124; cursor: pointer;}
                .tm-toast-close { background: none; border: none; color: white; font-weight: bold; cursor: pointer; margin-left: 15px; font-size: 18px; opacity: 0.8; transition: opacity 0.2s;}
                .tm-toast-close:hover { opacity: 1; }
                @keyframes tm-slide-in { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes tm-fade-out { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
            `;
            document.head.appendChild(style);
        }

        const painel = document.createElement('div');
        painel.id = 'tm-painel-flutuante';

        const handle = document.createElement('div');
        handle.id = 'tm-drag-handle';
        handle.innerHTML = '⋮⋮';
        painel.appendChild(handle);

        const containerBotoes = document.createElement('div');
        containerBotoes.id = 'tm-botoes-container';

        const btnLoja = document.createElement('button');
        btnLoja.id = 'tm-btn-loja';
        btnLoja.className = 'tm-btn-loja-dark';
        btnLoja.innerText = 'Loja: ...';
        btnLoja.style.display = 'none';
        btnLoja.onclick = () => { window.open('http://localhost:8080/', '_blank'); };
        containerBotoes.appendChild(btnLoja);

        const btnResumo = document.createElement('button');
        btnResumo.id = 'tm-btn-resumo';
        btnResumo.className = 'tm-btn-ver-blue';
        btnResumo.innerText = 'Ver Resumo';
        btnResumo.style.display = 'none';
        btnResumo.onclick = abrirModalResumo;
        containerBotoes.appendChild(btnResumo);

        const btnFiltro = document.createElement('button');
        btnFiltro.id = 'pm-filtro-btn';
        btnFiltro.className = 'tm-btn-filtro-indigo';
        btnFiltro.innerText = FILTER_TITLE;
        btnFiltro.onclick = toggleDrawer;
        btnFiltro.oncontextmenu = (e) => { e.preventDefault(); configurarViewID(); };
        containerBotoes.appendChild(btnFiltro);

        painel.appendChild(containerBotoes);
        document.body.appendChild(painel);

        const posSalva = localStorage.getItem('tm-hub-posicao-v6');
        if (posSalva) {
            const pos = JSON.parse(posSalva);
            painel.style.top = pos.top; painel.style.left = pos.left;
        } else {
            painel.style.top = (window.innerHeight - 100) + 'px';
            painel.style.left = (window.innerWidth - 350) + 'px';
        }
        tornarArrastavel(painel, handle);

        // --- GAVETA LATERAL ---
        const linkView = VIEW_ID ? `/agent/filters/${VIEW_ID}` : '#';
        const drawer = document.createElement('div');
        drawer.id = 'tm-drawer';
        drawer.innerHTML = `
            <div id="tm-header">
                <h3 style="display: flex; align-items: center;">${FILTER_TITLE}<span id="tm-count" style="font-size: 11px; background: #3091ec; padding: 2px 8px; border-radius: 12px; margin-left: 10px; display: none;">0</span></h3>
                <button id="tm-close">✕</button>
            </div>
            <div id="tm-content"><div class="tm-loading">Aguardando...</div></div>
            <div id="tm-footer"><a href="${linkView}" target="_blank" id="tm-full-view-btn">Abrir Visualização Completa ↗</a></div>
        `;
        document.body.appendChild(drawer);
        drawer.querySelector('#tm-close').onclick = () => drawer.classList.remove('active');
        document.addEventListener('click', (e) => {
            if (!drawer.contains(e.target) && e.target !== btnFiltro && drawer.classList.contains('active')) {
                drawer.classList.remove('active');
            }
        });

        // --- MODAL CENTRAL ---
        const overlay = document.createElement('div');
        overlay.id = 'tm-modal-overlay';
        overlay.style.position = 'fixed'; overlay.style.top = '0'; overlay.style.left = '0';
        overlay.style.width = '100vw'; overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        overlay.style.zIndex = '9999999'; overlay.style.display = 'none';
        overlay.style.justifyContent = 'center'; overlay.style.alignItems = 'center';

        const modalBox = document.createElement('div');
        modalBox.style.backgroundColor = '#ffffff'; modalBox.style.width = '60%'; modalBox.style.maxWidth = '600px';
        modalBox.style.maxHeight = '80vh'; modalBox.style.borderRadius = '8px';
        modalBox.style.display = 'flex'; modalBox.style.flexDirection = 'column';

        const modalHeader = document.createElement('div');
        modalHeader.style.padding = '12px 20px'; modalHeader.style.borderBottom = '2px solid #ccc';
        modalHeader.style.display = 'flex'; modalHeader.style.justifyContent = 'space-between';
        modalHeader.style.backgroundColor = '#f1f1f1'; modalHeader.style.borderTopLeftRadius = '8px'; modalHeader.style.borderTopRightRadius = '8px';

        const titulo = document.createElement('h2');
        titulo.id = 'tm-modal-titulo'; titulo.style.margin = '0'; titulo.style.fontSize = '16px'; titulo.style.color = '#222222';

        const btnFecharModal = document.createElement('button');
        btnFecharModal.innerText = '✖ Fechar'; btnFecharModal.style.background = 'none'; btnFecharModal.style.border = 'none';
        btnFecharModal.style.cursor = 'pointer'; btnFecharModal.style.color = '#d93f3c'; btnFecharModal.style.fontWeight = 'bold';
        btnFecharModal.onclick = fecharModalResumo;

        modalHeader.appendChild(titulo); modalHeader.appendChild(btnFecharModal);
        const modalBody = document.createElement('div');
        modalBody.id = 'tm-modal-body'; modalBody.style.padding = '20px'; modalBody.style.overflowY = 'auto'; modalBody.style.flexGrow = '1';

        modalBox.appendChild(modalHeader); modalBox.appendChild(modalBody); overlay.appendChild(modalBox);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharModalResumo(); });
    }

    function tornarArrastavel(elemento, gatilho) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        gatilho.onmousedown = (e) => {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;

            document.onmouseup = () => {
                document.onmouseup = null;
                document.onmousemove = null;
                localStorage.setItem('tm-hub-posicao-v6', JSON.stringify({ top: elemento.style.top, left: elemento.style.left }));
            };

            document.onmousemove = (e) => {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;

                let novoTop = elemento.offsetTop - pos2;
                let novoLeft = elemento.offsetLeft - pos1;

                // Definindo os limites máximos baseados no tamanho da janela e do próprio elemento
                const maxTop = window.innerHeight - elemento.offsetHeight;
                const maxLeft = window.innerWidth - elemento.offsetWidth;

                // Aplicando as travas (impede de passar de 0 e do limite máximo)
                novoTop = Math.max(0, Math.min(novoTop, maxTop));
                novoLeft = Math.max(0, Math.min(novoLeft, maxLeft));

                elemento.style.top = novoTop + "px";
                elemento.style.left = novoLeft + "px";
            };
        };
    }

    function abrirTicketZendesk(ticketId) {
        const a = document.createElement('a');
        a.href = `/agent/tickets/${ticketId}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function mostrarToastInatividade(ticketId, minutos) {
        let container = document.getElementById('tm-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'tm-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'tm-toast';
        toast.innerHTML = `
            <div>
                <span style="font-size: 18px; margin-right: 8px;">⚠️</span>
                Ticket <strong>#${ticketId}</strong> sem atualização há ${minutos} min!
            </div>
            <button class="tm-toast-close">&times;</button>
        `;

        toast.onclick = (e) => {
            if (e.target.className !== 'tm-toast-close') {
                abrirTicketZendesk(ticketId);
                fecharToast();
            }
        };

        const fecharToast = () => {
            toast.style.animation = 'tm-fade-out 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) forwards';
            setTimeout(() => toast.remove(), 300);
        };

        toast.querySelector('.tm-toast-close').onclick = (e) => {
            e.stopPropagation();
            fecharToast();
        };

        container.appendChild(toast);
        // Desaparece automaticamente da tela após 8 segundos
        setTimeout(() => { if(document.body.contains(toast)) fecharToast(); }, 8000);
    }

    function extrairDadosHibridos(audits, comments) {
        let info = { nome: "Não encontrado", matricula: "Não encontrado", loja: "---", telefone: "Não encontrado", assunto: "Não encontrado", detalhes: "Não encontrado" };
        let nomePlanoB = "";

        audits.forEach(audit => {
            audit.events.forEach(evento => {
                if (evento.type === "Create" || evento.type === "Change") {
                    if (evento.value) {
                        if (evento.field_name === "31426614109581") info.loja = evento.value;
                        if (evento.field_name === "32094176752141") info.matricula = evento.value;
                        if (evento.field_name === "38912103878925") info.assunto = evento.value;
                        if (evento.field_name === "45285259627149") info.detalhes = evento.value; // Busca direcionada ao ID do campo
                        if (evento.field_name === "tags") {
                            const match = evento.value.toString().match(/bcr-comma-phone-55(\d+)/);
                            if (match) info.telefone = match[1];
                        }
                        if (evento.field_name === "subject" && typeof evento.value === "string" && evento.value.startsWith("Conversa com ")) {
                            nomePlanoB = evento.value.replace("Conversa com ", "").trim();
                        }
                    }
                }
            });
        });

        let todasAsLinhas = [];
        audits.forEach(audit => {
            audit.events.forEach(evento => {
                if (evento.type === "Comment" && evento.body) {
                    let textoLimpo = evento.body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
                    todasAsLinhas = todasAsLinhas.concat(textoLimpo.split('\n'));
                }
            });
        });

        if (todasAsLinhas.length < 5) {
            comments.forEach(c => {
                let textoLimpo = (c.body || "").replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
                todasAsLinhas = todasAsLinhas.concat(textoLimpo.split('\n'));
            });
        }

        todasAsLinhas = todasAsLinhas.map(l => l.trim()).filter(l => l.length > 0);

        if (info.nome === "Não encontrado") {
            for (let i = 0; i < todasAsLinhas.length; i++) {
                if (todasAsLinhas[i].includes("Matrícula validada com sucesso!")) {
                    let proximaLinha = todasAsLinhas[i + 1];
                    if (proximaLinha) {
                        let matchNome = proximaLinha.match(/Olá,?\s+([^!👋\n]+)/i);
                        if (matchNome) { info.nome = matchNome[1].trim(); break; }
                    }
                }
            }
            if (info.nome === "Não encontrado") {
                for (let linha of todasAsLinhas) {
                    let matchNome = linha.match(/Olá,?\s+([^!👋\n\.,]+)/i);
                    if (matchNome) { info.nome = matchNome[1].trim(); break; }
                }
            }
        }

        if (info.nome === "Não encontrado" && nomePlanoB !== "") info.nome = nomePlanoB;
        if (info.detalhes === "Não encontrado" && info.assunto !== "Não encontrado") { info.detalhes = "Assunto: " + info.assunto; }
        return info;
    }

    async function buscarEventosDoTicket(ticketId) {
        const btnResumo = document.getElementById('tm-btn-resumo');
        const btnLoja = document.getElementById('tm-btn-loja');
        btnResumo.innerText = 'Buscando...';
        try {
            const [resAudits, resComments] = await Promise.all([
                fetch(`/api/v2/tickets/${ticketId}/audits.json`), fetch(`/api/v2/tickets/${ticketId}/comments.json`)
            ]);
            if (!resAudits.ok || !resComments.ok) throw new Error();
            dadosResumoAtual = extrairDadosHibridos((await resAudits.json()).audits || [], (await resComments.json()).comments || []);
            if (btnLoja) btnLoja.innerText = `Loja: ${dadosResumoAtual.loja}`;
            if (btnResumo) btnResumo.innerText = 'Ver Resumo';
        } catch (e) { if (btnResumo) btnResumo.innerText = 'Erro'; }
    }

    function abrirModalResumo() {
        const overlay = document.getElementById('tm-modal-overlay');
        const corpo = document.getElementById('tm-modal-body');
        document.getElementById('tm-modal-titulo').innerText = `Resumo do Ticket #${ultimoTicketId}`;

        if (!dadosResumoAtual) {
            corpo.innerHTML = '<strong>Carregando dados...</strong>';
        } else {
            const d = dadosResumoAtual;
            corpo.innerHTML =
                '<div class="tm-info-card">\n' +
                '    <div class="tm-info-linha"><span class="tm-info-label">🆔Matrícula:</span><span class="tm-info-valor">' + d.matricula + '</span></div>\n' +
                '    <div class="tm-info-linha"><span class="tm-info-label">🏪 Loja:</span><span class="tm-info-valor">' + d.loja + '</span></div>\n' +
                '    <div class="tm-info-linha"><span class="tm-info-label">📱 Telefone: </span><span class="tm-info-valor">' + d.telefone + '</span></div>\n' +
                '    <div class="tm-info-linha"><span class="tm-info-label">📌 Assunto:</span><span class="tm-info-valor">' + d.assunto + '</span></div>\n' +
                '    <div class="tm-info-linha"><span class="tm-info-label">📝 Detalhes:</span><span class="tm-info-valor">' + d.detalhes + '</span></div>\n' + // Inserido para renderizar os detalhes no HTML do modal
                '</div>';
        }
        overlay.style.display = 'flex';
    }

    function fecharModalResumo() { document.getElementById('tm-modal-overlay').style.display = 'none'; }
    function obterTicketIdDaURL() { const m = window.location.href.match(/\/tickets\/(\d+)/); return m ? m[1] : null; }

    function configurarViewID() {
        const input = prompt("⚙️ Configuração do Filtro Rápido:\nCole o ID ou link da visualização:", VIEW_ID || "");
        if (input !== null) {
            const cleanId = input.replace(/\D/g, '');
            if (cleanId && cleanId.length > 5) {
                VIEW_ID = cleanId; GM_setValue('pmFiltroViewId_User', VIEW_ID); alert("✅ ID salvo!");
                const drawer = document.getElementById('tm-drawer');
                if (drawer && drawer.classList.contains('active')) fetchTickets();
                const lnk = document.getElementById('tm-full-view-btn'); if (lnk) lnk.href = `/agent/filters/${VIEW_ID}`;
            } else alert("❌ ID inválido.");
        }
    }

    function toggleDrawer() {
        if (!VIEW_ID) return configurarViewID();
        const drawer = document.getElementById('tm-drawer');
        const btnFiltro = document.getElementById('pm-filtro-btn');

        if (btnFiltro && btnFiltro.classList.contains('tm-btn-filtro-alert') && idNovoFormWeb) {
            abrirTicketZendesk(idNovoFormWeb);
            btnFiltro.classList.remove('tm-btn-filtro-alert');
            btnFiltro.innerText = FILTER_TITLE;
            idNovoFormWeb = null;
            return;
        }

        if (drawer.classList.contains('active')) {
            drawer.classList.remove('active');
        } else {
            drawer.classList.add('active');
            if (btnFiltro) {
                btnFiltro.classList.remove('tm-btn-filtro-alert');
                btnFiltro.innerText = FILTER_TITLE;
                idNovoFormWeb = null;
            }
            fetchTickets();
        }
    }

    function formatarDataAtualizacao(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString); const now = new Date();
        const diffMs = now - date; const diffMins = Math.floor(diffMs / 60000); const diffHours = Math.floor(diffMins / 60);
        if (diffMins < 1) return 'menos de 1 min atrás';
        if (diffMins === 1) return '1 min atrás';
        if (diffMins < 60) return `${diffMins} min atrás`;
        if (date.toDateString() === now.toDateString()) { return `Hoje ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }
        if (diffHours < 24) return `aprox. ${diffHours} h atrás`;
        return date.toLocaleDateString('pt-BR');
    }

    async function fetchTickets() {
        if (!VIEW_ID) return;
        const contentDiv = document.querySelector('#tm-content');
        const countBadge = document.querySelector('#tm-count');
        contentDiv.innerHTML = '<div class="tm-loading">Atualizando...</div>';
        try {
            const res = await fetch(`/api/v2/views/${VIEW_ID}/tickets.json?sort_by=created_at&sort_order=desc&_=${new Date().getTime()}`);
            if (!res.ok) throw new Error();
            const data = await res.json(); const tickets = data.tickets;
            if (countBadge) { countBadge.textContent = data.count !== undefined ? data.count : tickets.length; countBadge.style.display = 'inline-block'; }
            if (tickets.length > 0) GM_setValue('pmLastSeenTicket', tickets[0].id);
            contentDiv.innerHTML = '';
            const agora = new Date();

            tickets.forEach(t => {
                const el = document.createElement('a'); el.className = 'tm-ticket-item'; el.href = `/agent/tickets/${t.id}`;
                const ch = getChannelInfo(t); const pr = getPriorityInfo(t.priority);
                const minSemAtualizacao = Math.floor((agora - new Date(t.updated_at)) / 60000);
                const isAlert = minSemAtualizacao > 30;

                el.innerHTML = `
                    <div class="tm-meta-col">
                        <span class="tm-badge ${getStatusClass(t.status)}">${translateStatus(t.status)}</span>
                        <span class="tm-badge ${pr.class}">${pr.label}</span>
                        <span class="tm-badge ${ch.class}">${ch.icon} ${ch.label}</span>
                    </div>
                    <div class="tm-ticket-info">
                        <div class="tm-ticket-id">#${t.id}</div>
                        <div class="tm-ticket-subject">${t.subject}</div>
                        <div class="tm-ticket-meta">${new Date(t.created_at).toLocaleDateString('pt-BR')} • ID: ${t.requester_id}</div>
                    </div>
                    <div class="tm-col-updated">
                        <span class="tm-updated-label">Atualizado</span>
                        <span class="tm-min-badge ${isAlert ? 'alert' : ''}" title="Atualizado: ${formatarDataAtualizacao(t.updated_at)}">${minSemAtualizacao}m</span>
                    </div>
                `;
                contentDiv.appendChild(el);
            });
        } catch (e) { contentDiv.innerHTML = `<div class="tm-loading" style="color: #e34f32">Erro no ID.</div>`; }
    }

    async function checkNewTickets() {
        if (!VIEW_ID) return;
        try {
            const res = await fetch(`/api/v2/views/${VIEW_ID}/tickets.json?sort_by=created_at&sort_order=desc&_=${new Date().getTime()}`);
            if (!res.ok) return;
            const tickets = (await res.json()).tickets || [];
            if (tickets.length > 0) {
                const latestId = tickets[0].id;
                const storedId = parseInt(GM_getValue('pmLastSeenTicket', '0'), 10);

                if (latestId > storedId) {
                    GM_setValue('pmLastSeenTicket', latestId);
                    GM_notification({
                        title: 'Novo Chamado!', text: `#${latestId}: ${tickets[0].subject}`, timeout: 5000,
                        onclick: () => { window.focus(); toggleDrawer(); }
                    });
                }

                let hasNew = false;
                let hasNewWebForm = false;
                let ultimoIdCapturado = null;

                tickets.forEach(t => {
                    if (!openedTickets.includes(t.id)) {
                        openedTickets.push(t.id);
                        hasNew = true;

                        const ch = t.via ? t.via.channel : '';
                        if (['web', 'help_center', 'web_widget', 'api'].includes(ch)) {
                            hasNewWebForm = true;
                            if (!ultimoIdCapturado) ultimoIdCapturado = t.id;
                        }
                    }
                });

                if (hasNewWebForm && ultimoIdCapturado) {
                    idNovoFormWeb = ultimoIdCapturado;
                    const btnFiltro = document.getElementById('pm-filtro-btn');
                    if (btnFiltro) {
                        btnFiltro.classList.add('tm-btn-filtro-alert');
                        btnFiltro.innerText = '⚠️ Novo Form Web';
                    }
                }

                if (hasNew) {
                    if (openedTickets.length > 200) openedTickets = openedTickets.slice(-200);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(openedTickets));
                }
            }
        } catch(e) {}
    }

    async function verificarTicketsInativos() {
        if (!VIEW_ID) return;
        try {
            const res = await fetch(`/api/v2/views/${VIEW_ID}/tickets.json?_=${new Date().getTime()}`);
            if (!res.ok) return;
            const tickets = (await res.json()).tickets || [];
            const agora = new Date();

            tickets.forEach(t => {
                const minSemAtualizacao = Math.floor((agora - new Date(t.updated_at)) / 60000);

                if (minSemAtualizacao > 15) { // O alerta é para > 30 minutos
                    const tempoUltimoAlerta = ultimoAlertaInatividade.get(t.id) || 0;

                    // Como o script checa a cada 1 minuto, em algum momento a diferença de tempo
                    // será >= 5 minutos, garantindo que nenhum ticket seja pulado
                    if (agora.getTime() - tempoUltimoAlerta >= TEMPO_REPETICAO_ALERTA) {
                        mostrarToastInatividade(t.id, minSemAtualizacao);
                        ultimoAlertaInatividade.set(t.id, agora.getTime());
                    }
                } else {
                    // Se o ticket for respondido, apaga a memória dele para recomeçar o ciclo se ele ficar parado de novo
                    ultimoAlertaInatividade.delete(t.id);
                }
            });
        } catch(e) {}
    }

    function getStatusClass(s) { const m = {'new':'status-new','open':'status-open','pending':'status-pending','solved':'status-solved'}; return m[s]||'status-hold'; }
    function translateStatus(s) { const m = {'new':'Novo','open':'Aberto','pending':'Pendente','solved':'Resolvido','hold':'Espera'}; return m[s]||s; }
    function getPriorityInfo(p) { if(!p) return {class:'prio-none',label:'-'}; const m = {'urgent':{class:'prio-urgent',label:'Urgente'},'high':{class:'prio-high',label:'Alta'},'normal':{class:'prio-normal',label:'Normal'},'low':{class:'prio-low',label:'Baixa'}}; return m[p]||{class:'prio-none',label:p}; }
    function getChannelInfo(t) { const c = t.via ? t.via.channel : ''; if(c==='whatsapp'||c==='messaging') return {class:'channel-whatsapp',label:'ZAP',icon:'📱'}; if(c==='web') return {class:'channel-web',label:'WEB',icon:'🌐'}; if(c==='email') return {class:'channel-email',label:'MAIL',icon:'📧'}; return {class:'channel-other',label:'OUTRO',icon:'⚙️'}; }

    // ==========================================
    // LOOP PRINCIPAL
    // ==========================================
    setInterval(() => {
        injetarInterface();
        const ticketIdAtual = obterTicketIdDaURL();
        const btnLoja = document.getElementById('tm-btn-loja');
        const btnResumo = document.getElementById('tm-btn-resumo');
        if (ticketIdAtual) {
            if (btnLoja) btnLoja.style.display = 'block';
            if (btnResumo) btnResumo.style.display = 'block';
            if (ticketIdAtual !== ultimoTicketId) {
                ultimoTicketId = ticketIdAtual; dadosResumoAtual = null;
                if (btnLoja) btnLoja.innerText = 'Loja: ...';
                buscarEventosDoTicket(ticketIdAtual);
            }
        } else {
            if (btnLoja) btnLoja.style.display = 'none';
            if (btnResumo) btnResumo.style.display = 'none';
            ultimoTicketId = null;
        }
    }, 1500);

    setInterval(checkNewTickets, CHECK_INTERVAL);
    setTimeout(checkNewTickets, 5000);

    // Motor de inatividade independente rodando em um intervalo diferente
    setInterval(verificarTicketsInativos, INATIVIDADE_CHECK_INTERVAL);
    setTimeout(verificarTicketsInativos, 10000);

})();