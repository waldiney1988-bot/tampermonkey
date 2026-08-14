(function() {
    'use strict';

    function isElementVisible(el) {
        return el &&
               el.offsetParent !== null &&
               window.getComputedStyle(el).visibility !== 'hidden' &&
               window.getComputedStyle(el).display !== 'none';
    }

    const whatsappSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#25D366" viewBox="0 0 24 24">
          <path d="M20.52 3.48a11.81 11.81 0 0 0-16.7 0 11.8 11.8 0 0 0-2.7 12.94L.05 24l7.7-1.98a11.84 11.84 0 0 0 5.65 1.44h.01c6.52 0 11.82-5.3 11.82-11.82a11.8 11.8 0 0 0-3.71-8.16Zm-8.7 17.17c-1.79 0-3.55-.48-5.09-1.39l-.37-.22-4.57 1.18 1.22-4.45-.24-.37a9.77 9.77 0 0 1 1.45-12.3 9.77 9.77 0 0 1 13.8 0 9.73 9.73 0 0 1 2.86 6.92c0 5.39-4.38 9.83-9.82 9.83Zm5.39-7.34c-.29-.14-1.71-.84-1.97-.94-.27-.1-.46-.14-.65.14s-.75.94-.92 1.13c-.17.2-.34.22-.63.07-.29-.14-1.23-.45-2.34-1.45-.86-.77-1.44-1.72-1.61-2-.17-.29-.02-.45.13-.6.14-.14.29-.34.44-.51.14-.17.19-.29.29-.48.1-.2.05-.37-.02-.51-.07-.14-.65-1.56-.89-2.14-.23-.56-.47-.49-.65-.5h-.56c-.2 0-.51.07-.78.37-.27.29-1.02.99-1.02 2.41s1.05 2.8 1.2 2.99c.15.2 2.06 3.14 4.99 4.4.7.3 1.25.48 1.68.62.71.23 1.35.2 1.86.12.57-.08 1.71-.7 1.95-1.37.24-.68.24-1.26.17-1.37-.07-.12-.26-.19-.55-.33Z"/>
        </svg>
    `;

    function saudacao() {
        const hora = new Date().getHours();
        if (hora < 12) return "Bom dia";
        if (hora < 18) return "Boa tarde";
        return "Boa noite";
    }

    function pegarDescricaoChamado() {
        const allSubjectFields = Array.from(document.querySelectorAll('[data-test-id="omni-header-subject"]'));
        const visibleFields = allSubjectFields.filter(isElementVisible);
        if (visibleFields.length > 0) {
            const activeField = visibleFields[visibleFields.length - 1];
            return activeField.value.trim();
        }
        return "";
    }

    function pegarStatusDoTicket() {
        const selector = '[data-test-id="tabs-section-nav-item-ticket"][aria-current="page"]';
        const allCurrentTabs = Array.from(document.querySelectorAll(selector));
        const visibleCurrentTabs = allCurrentTabs.filter(isElementVisible);
        if (visibleCurrentTabs.length > 0) {
            const activeTab = visibleCurrentTabs[visibleCurrentTabs.length - 1];
            return activeTab.innerText.replace(/\s+/g, ' ').trim();
        }
        return "";
    }

    // --- NOVA FUNÇÃO PARA GERENCIAR O NOME DO ANALISTA ---
    function obterNomeAnalista(forcarTroca = false) {
        let nomeSalvo = localStorage.getItem('pm_nome_analista_wa');
        
        if (!nomeSalvo || forcarTroca) {
            let promptText = forcarTroca 
                ? "⚙️ Troca de Nome:\nDigite seu novo nome:" 
                : "⚙️ Configuração Inicial do WhatsApp:\nQual é o seu nome? (Ele será salvo para as próximas mensagens)";
                
            let novoNome = prompt(promptText, nomeSalvo || "");
            
            if (novoNome && novoNome.trim() !== "") {
                localStorage.setItem('pm_nome_analista_wa', novoNome.trim());
                nomeSalvo = novoNome.trim();
            } else {
                // Se o usuário cancelar ou deixar em branco, usa um genérico provisório
                nomeSalvo = nomeSalvo || "Analista de Suporte"; 
            }
        }
        return nomeSalvo;
    }

    function criarBotao(input, labelText) {
        const btn = document.createElement("button");
        btn.innerHTML = whatsappSVG;
        btn.title = "Abrir WhatsApp (Segure SHIFT ao clicar para trocar seu nome)";
        btn.style.marginLeft = "5px";
        btn.style.cursor = "pointer";
        btn.style.border = "none";
        btn.style.background = "transparent";
        btn.style.padding = "0";
        btn.style.display = "inline-flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";

        btn.addEventListener("click", function(e) {
            e.preventDefault();
            
            let numero = input.value.trim();
            if (!numero) {
                alert("O campo " + labelText + " está vazio!");
                return;
            }
            numero = numero.replace(/\D/g, "");
            if (!numero.startsWith("55")) numero = "55" + numero;

            // Verifica se o usuário segurou SHIFT para trocar de nome
            const forcarTroca = e.shiftKey;
            const nomeAnalista = obterNomeAnalista(forcarTroca);

            const statusTicket = pegarStatusDoTicket();
            const assuntoTicket = pegarDescricaoChamado();
            
            // Mensagem atualizada com a variável do nome dinâmico
            const mensagem = `${saudacao()}, meu nome é ${nomeAnalista}, sou suporte técnico do setor de Operações de TI da Pague Menos/Extrafarma, referente ao chamado: ${statusTicket} (${assuntoTicket})`;

            navigator.clipboard.writeText(mensagem);
            window.open("https://wa.me/" + numero + "?text=" + encodeURIComponent(mensagem), "_blank");
        });

        input.parentNode.insertBefore(btn, input.nextSibling);
    }

    function adicionarBotoes() {
        const labels = Array.from(document.querySelectorAll("label")).filter(isElementVisible);

        labels.forEach(label => {
            const texto = label.textContent.trim();
            if (texto === "Telefone Gerente*" || texto === "Telefone Loja*" || texto === "Telefone do Solicitante*") {
                const input = label.parentElement.querySelector("input");
                if (input && isElementVisible(input) && !input.dataset.whatsappBtn) {
                    criarBotao(input, texto);
                    input.dataset.whatsappBtn = "true";
                }
            }
        });
    }

    setInterval(adicionarBotoes, 1500);

})();