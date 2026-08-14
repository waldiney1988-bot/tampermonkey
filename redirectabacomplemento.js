(function () {
    'use strict';

    const STORE_FIELD_ID = "31426614109581";
    const FALLBACK_STORE_FIELD_ID = "tags";

    // 1. Pega o ID do ticket na URL
    function obterTicketId() {
        const m = window.location.href.match(/\/tickets\/(\d+)/);
        return m ? m[1] : null;
    }

    // 2. Sua lógica clássica e confiável de buscar na API
    async function buscarLojaAPI(ticketId) {
        try {
            const res = await fetch(`/api/v2/tickets/${ticketId}/audits.json`);
            if (!res.ok) return null;
            const data = await res.json();

            let lojaPrincipal = "";
            let lojaSecundaria = "";

            data.audits.forEach(audit => {
                audit.events.forEach(evento => {
                    if (evento.type === "Create" || evento.type === "Change") {
                        const fieldName = String(evento.field_name || "");

                        if (fieldName.includes(STORE_FIELD_ID)) {
                            lojaPrincipal = String(evento.value);
                        }
                        else if (fieldName.includes(FALLBACK_STORE_FIELD_ID) && evento.value) {
                            const match = String(evento.value).match(/\d+/);
                            lojaSecundaria = match ? match[0] : String(evento.value);
                        }
                    }
                });
            });

            return lojaPrincipal || lojaSecundaria || null;
        } catch (e) {
            console.warn("[Localhost] Erro ao buscar API", e);
            return null;
        }
    }

    // 3. Criação do botão e abertura da janela
    function criarBotao() {
        if (document.getElementById('pm-local-tab')) return;

        const btn = document.createElement('button');
        btn.id = "pm-local-tab";
        btn.innerHTML = "🚀";
        btn.style = `
            position: fixed; right: 0; top: calc(70% + 85px); z-index: 999999;
            width: 44px; height: 50px; background: #038153; color: white;
            border: none; border-radius: 8px 0 0 8px; cursor: pointer; font-size: 22px;
            box-shadow: -2px 0 8px rgba(0,0,0,0.3); transition: background 0.2s;
        `;

        btn.onclick = async () => {
            // Evita duplos cliques
            if (btn.disabled) return;

            const ticketId = obterTicketId();
            if (!ticketId) {
                alert("Não foi possível identificar o ID do ticket na URL.");
                return;
            }

            // Feedback de que está buscando na API
            const originalHtml = btn.innerHTML;
            btn.innerHTML = "⏳";
            btn.style.background = "#555";
            btn.disabled = true;

            const lojaNum = await buscarLojaAPI(ticketId);

            // Restaura o botão
            btn.innerHTML = originalHtml;
            btn.style.background = "#038153";
            btn.disabled = false;

            if (!lojaNum) {
                alert("A loja não foi encontrada no histórico deste ticket.");
                return;
            }

            // Passa para a URL do popup para o Script 2 ler e limpar o cache
            const targetUrl = `http://localhost:8080/?auto_loja=${lojaNum}&_t=${Date.now()}`;

            // Configurações: Abre como popup encostado na direita
            const popupWidth = 850;
            const popupHeight = window.screen.availHeight - 80;
            const left = window.screen.availWidth - popupWidth - 20;
            const top = 20;

            window.open(targetUrl, 'FerramentaLocalPopup', `width=${popupWidth},height=${popupHeight},top=${top},left=${left},resizable=yes,scrollbars=yes`);
        };

        document.body.appendChild(btn);
    }

    setInterval(criarBotao, 2000);
})();