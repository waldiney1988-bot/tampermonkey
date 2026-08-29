(function() {
    'use strict';

    const VIEW_ID = '40407424469645';
    const REFRESH_INTERVAL = 60000; // Atualiza a cada 1 minuto

    // ==========================================
    // CSS DO DASHBOARD
    // ==========================================
    const style = document.createElement('style');
    style.innerHTML = `
        #pm-dash-trigger { position: fixed; bottom: 100px; left: 0; z-index: 99999; font-family: system-ui, -apple-system, sans-serif; }
        #pm-dash-btn { background: #1f73b7; color: #fff; width: 46px; height: 46px; border-radius: 0 10px 10px 0; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 2px 2px 10px rgba(0,0,0,0.3); border: none; transition: background 0.2s; }
        #pm-dash-btn:hover { background: #145b94; }
        
        #pm-dash-panel { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; max-height: 85vh; background: #1b202b; z-index: 100000; border-radius: 12px; display: none; flex-direction: column; overflow: hidden; box-shadow: 0 15px 50px rgba(0,0,0,0.5); border: 1px solid #323946; font-family: system-ui, -apple-system, sans-serif; color: #e9ebed; }
        #pm-dash-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 99998; display: none; backdrop-filter: blur(3px); }
        
        .pm-dash-header { padding: 20px; background: #151c24; border-bottom: 1px solid #323946; display: flex; justify-content: space-between; align-items: center; }
        .pm-dash-header h2 { margin: 0; font-size: 18px; color: #fff; display: flex; align-items: center; gap: 10px; }
        .pm-dash-close { background: none; border: none; color: #aaa; font-size: 24px; cursor: pointer; padding: 0; line-height: 1; }
        .pm-dash-close:hover { color: #fff; }
        
        .pm-dash-content { padding: 20px; overflow-y: auto; flex-grow: 1; }
        
        .pm-dash-summary { display: flex; gap: 15px; margin-bottom: 25px; }
        .pm-dash-card { flex: 1; background: #232a35; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #323946; }
        .pm-dash-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #87929d; text-transform: uppercase; }
        .pm-dash-card .pm-num { font-size: 32px; font-weight: bold; }
        .pm-num-open { color: #ffb124; }
        .pm-num-solved { color: #4caf50; }
        
        .pm-dash-table { width: 100%; border-collapse: collapse; }
        .pm-dash-table th { background: #151c24; color: #87929d; font-size: 12px; text-transform: uppercase; padding: 10px; text-align: left; border-bottom: 2px solid #323946; }
        .pm-dash-table td { padding: 12px 10px; border-bottom: 1px solid #2f3b4b; font-size: 14px; }
        .pm-dash-table tr:hover td { background: #2a3644; }
        .pm-agent-name { font-weight: 500; display: flex; align-items: center; gap: 8px; }
        .pm-agent-avatar { width: 24px; height: 24px; background: #3091ec; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; }
        
        .pm-badge-count { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; display: inline-block; min-width: 25px; text-align: center; }
        .pm-bg-open { background: rgba(255, 177, 36, 0.15); color: #ffb124; border: 1px solid rgba(255, 177, 36, 0.3); }
        .pm-bg-solved { background: rgba(76, 175, 80, 0.15); color: #4caf50; border: 1px solid rgba(76, 175, 80, 0.3); }
        
        .pm-loading-state { text-align: center; padding: 40px; color: #87929d; font-style: italic; }
        .pm-last-update { font-size: 11px; color: #687383; margin-top: 15px; text-align: right; }
    `;
    document.head.appendChild(style);

    // ==========================================
    // ESTRUTURA HTML DO DASHBOARD
    // ==========================================
    const trigger = document.createElement('div'); trigger.id = 'pm-dash-trigger';
    trigger.innerHTML = `<button id="pm-dash-btn" title="Dashboard da Equipe">📊</button>`;
    
    const backdrop = document.createElement('div'); backdrop.id = 'pm-dash-backdrop';
    
    const panel = document.createElement('div'); panel.id = 'pm-dash-panel';
    panel.innerHTML = `
        <div class="pm-dash-header">
            <h2>📊 Monitoramento da Equipe</h2>
            <button class="pm-dash-close">&times;</button>
        </div>
        <div class="pm-dash-content" id="pm-dash-body">
            <div class="pm-loading-state">Carregando dados da operação...</div>
        </div>
    `;
    
    document.body.append(backdrop, panel, trigger);

    // ==========================================
    // LÓGICA DE DADOS (ZENDESK API COM PAGINAÇÃO)
    // ==========================================
    async function fetchDashboardData() {
        try {
            let todosTickets = [];
            let todosUsers = [];
            
            // Força a API a trazer de 100 em 100 para ser mais rápido
            let url = `/api/v2/views/${VIEW_ID}/tickets.json?include=users&per_page=100`;

            // Loop de paginação: continua buscando enquanto houver uma "próxima página"
            while (url) {
                const res = await fetch(url);
                if (!res.ok) throw new Error('Falha ao buscar view');
                const data = await res.json();
                
                todosTickets = todosTickets.concat(data.tickets || []);
                todosUsers = todosUsers.concat(data.users || []);
                
                url = data.next_page; // Se tiver mais páginas, a URL muda. Se não, fica nula e quebra o loop.
            }
            
            processarDados(todosTickets, todosUsers);
        } catch (error) {
            document.getElementById('pm-dash-body').innerHTML = `<div class="pm-loading-state" style="color: #e34f32;">Erro ao carregar dados. Verifique o ID da View e sua conexão.</div>`;
        }
    }

    function processarDados(tickets, users) {
        // Mapeia os usuários para pegar o nome pelo ID facilmente
        const mapUsuarios = {};
        users.forEach(u => mapUsuarios[u.id] = u.name);
        
        let stats = {
            totalAbertos: 0,
            totalResolvidos: 0,
            agentes: {}
        };

        tickets.forEach(t => {
            // Agora o script confia 100% no seu Filtro. Se o ticket está na View, ele será contado.
            // Separamos apenas o Status:
            
            const isAberto = ['new', 'open', 'pending', 'hold'].includes(t.status);
            const isResolvido = ['solved', 'closed'].includes(t.status);

            // Adicionando qualquer ticket ao painel geral (mesmo se for "cancelado", vai entrar como resolvido se estiver na categoria)
            if (isResolvido || (!isAberto && !isResolvido)) {
                stats.totalResolvidos++;
            } else if (isAberto) {
                stats.totalAbertos++;
            }

            if (t.assignee_id) {
                const nomeAgente = mapUsuarios[t.assignee_id] || 'Desconhecido';
                
                if (!stats.agentes[nomeAgente]) {
                    stats.agentes[nomeAgente] = { abertos: 0, resolvidos: 0 };
                }

                if (isResolvido || (!isAberto && !isResolvido)) {
                    stats.agentes[nomeAgente].resolvidos++;
                } else if (isAberto) {
                    stats.agentes[nomeAgente].abertos++;
                }
            }
        });

        renderizarPainel(stats);
    }

    function gerarIniciais(nome) {
        const partes = nome.trim().split(' ');
        if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
        return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    }

    function renderizarPainel(stats) {
        const tbody = Object.keys(stats.agentes).sort().map(nome => {
            const ag = stats.agentes[nome];
            return `
                <tr>
                    <td>
                        <div class="pm-agent-name">
                            <div class="pm-agent-avatar">${gerarIniciais(nome)}</div>
                            ${nome}
                        </div>
                    </td>
                    <td style="text-align: center;"><span class="pm-badge-count pm-bg-open">${ag.abertos}</span></td>
                    <td style="text-align: center;"><span class="pm-badge-count pm-bg-solved">${ag.resolvidos}</span></td>
                </tr>
            `;
        }).join('');

        const tableHTML = Object.keys(stats.agentes).length > 0 
            ? `<table class="pm-dash-table">
                <thead>
                    <tr>
                        <th>Analista</th>
                        <th style="text-align: center;">Abertos / Pendentes</th>
                        <th style="text-align: center;">Resolvidos / Fechados</th>
                    </tr>
                </thead>
                <tbody>${tbody}</tbody>
               </table>`
            : `<div class="pm-loading-state">Nenhum chamado listado nesta view no momento.</div>`;

        const agora = new Date();
        const horaAtual = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');

        document.getElementById('pm-dash-body').innerHTML = `
            <div class="pm-dash-summary">
                <div class="pm-dash-card">
                    <h3>Em Atendimento</h3>
                    <div class="pm-num pm-num-open">${stats.totalAbertos}</div>
                </div>
                <div class="pm-dash-card">
                    <h3>Finalizados</h3>
                    <div class="pm-num pm-num-solved">${stats.totalResolvidos}</div>
                </div>
            </div>
            ${tableHTML}
            <div class="pm-last-update">Última atualização: ${horaAtual} (Total capturado: ${stats.totalAbertos + stats.totalResolvidos})</div>
        `;
    }

    // ==========================================
    // CONTROLES DE INTERFACE
    // ==========================================
    function fecharPainel() { 
        panel.style.display = 'none'; 
        backdrop.style.display = 'none'; 
    }
    
    document.querySelector('.pm-dash-close').onclick = fecharPainel;
    backdrop.onclick = fecharPainel;
    
    document.getElementById('pm-dash-btn').onclick = () => {
        panel.style.display = 'flex';
        backdrop.style.display = 'block';
        document.getElementById('pm-dash-body').innerHTML = `<div class="pm-loading-state">Lendo todas as páginas da view...</div>`;
        fetchDashboardData();
    };

    // Auto-refresh silencioso em background
    setInterval(() => {
        if (panel.style.display === 'flex') {
            fetchDashboardData();
        }
    }, REFRESH_INTERVAL);

})();
