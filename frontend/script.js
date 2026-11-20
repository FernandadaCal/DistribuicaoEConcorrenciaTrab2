
const livrosIniciais = [
    {
        id: "001",
        titulo: "Amiga Genial",
        autor: "Elena Ferrante",
        quantidade: 2
    },
    {
        id: "002",
        titulo: "A natureza da mordida",
        autor: "Carla Madeira",
        quantidade: 0
    },
    {
        id: "003",
        titulo: "O alquimista",
        autor: "Paulo Coelho",
        quantidade: 1
    }
];

const config = window.APP_CONFIG || {
    mode: "local",
    apiBaseUrl: ""
};

const modoAWS = config.mode === "aws";

const CHAVE_LIVROS = "sebo_livros_v2";
const CHAVE_INTERESSES = "sebo_interesses_v2";

let livros = [];
let interesses = [];

const listaLivros = document.getElementById("listaLivros");
const selectLivro = document.getElementById("livro");
const selectEstoque = document.getElementById("livroEstoque");

const formulario = document.getElementById("formSolicitacao");
const formularioEstoque = document.getElementById("formEstoque");

const mensagem = document.getElementById("mensagem");
const mensagemEstoque = document.getElementById("mensagemEstoque");

// Navegação entre as abas

const btnCliente = document.getElementById("btnCliente");
const btnColaborador = document.getElementById("btnColaborador");

const areaCliente = document.getElementById("areaCliente");
const areaColaborador = document.getElementById("areaColaborador");

function mostrarAba(aba) {
    const clienteAtivo = aba === "cliente";

    areaCliente.hidden = !clienteAtivo;
    areaColaborador.hidden = clienteAtivo;

    btnCliente.classList.toggle("ativa", clienteAtivo);
    btnColaborador.classList.toggle("ativa", !clienteAtivo);

    btnCliente.setAttribute("aria-pressed", clienteAtivo);
    btnColaborador.setAttribute("aria-pressed", !clienteAtivo);
}

btnCliente.addEventListener("click", () => {
    mostrarAba("cliente");
});

btnColaborador.addEventListener("click", async () => {
    mostrarAba("colaborador");

    try {
        await buscarLivros();
    } catch (erro) {
        mensagemEstoque.textContent =
            `Erro ao carregar estoque: ${erro.message}`;
    }
});

// Armazenamento local

function lerArmazenamento(chave, padrao) {
    try {
        const valor = JSON.parse(localStorage.getItem(chave));

        return Array.isArray(valor) ? valor : padrao;
    } catch {
        return padrao;
    }
}

function iniciarModoLocal() {
    livros = lerArmazenamento(CHAVE_LIVROS, livrosIniciais);
    interesses = lerArmazenamento(CHAVE_INTERESSES, []);
}

function salvarDadosLocais() {
    localStorage.setItem(
        CHAVE_LIVROS,
        JSON.stringify(livros)
    );

    localStorage.setItem(
        CHAVE_INTERESSES,
        JSON.stringify(interesses)
    );
}

// Comunicação com a AWS

async function requisitarAPI(caminho, opcoes = {}) {
    const base = String(config.apiBaseUrl || "")
        .replace(/\/+$/, "");

    if (!base) {
        throw new Error(
            "Configure apiBaseUrl no arquivo config.js."
        );
    }

    const resposta = await fetch(`${base}${caminho}`, {
        ...opcoes,
        headers: {
            "Content-Type": "application/json",
            ...(opcoes.headers || {})
        }
    });

    let dados;

    try {
        dados = await resposta.json();
    } catch {
        throw new Error("A API não retornou um JSON válido.");
    }

    if (!resposta.ok) {
        if (
            dados.mensagem ===
            "Cliente sem tópico SNS cadastrado."
        ) {
            throw new Error(
                "Este e-mail ainda não está cadastrado " +
                "para receber notificações da livraria."
            );
        }

        throw new Error(
            dados.mensagem || `Erro HTTP ${resposta.status}.`
        );
    }

    return dados;
}

// Exibição dos livros

function carregarLivrosNaTela() {
    const livroSelecionado = selectLivro.value;
    const livroEstoqueSelecionado = selectEstoque.value;

    listaLivros.innerHTML = "";
    selectLivro.innerHTML = "";
    selectEstoque.innerHTML = "";

    livros.forEach(livro => {
        const item = document.createElement("div");
        item.className = "livro";

        const titulo = document.createElement("strong");
        titulo.textContent = livro.titulo;

        const autor = document.createElement("p");
        autor.textContent = livro.autor;

        const status = document.createElement("span");
        status.className = "status";

        if (livro.quantidade > 0) {
            status.classList.add("disponivel");
            status.textContent =
                `${livro.quantidade} unidade(s) disponível(is)`;
        } else {
            status.classList.add("indisponivel");
            status.textContent = "Indisponível";
        }

        item.append(titulo, autor, status);
        listaLivros.appendChild(item);

        const opcaoCliente = document.createElement("option");
        opcaoCliente.value = livro.id;
        opcaoCliente.textContent = livro.titulo;

        selectLivro.appendChild(opcaoCliente);

        const opcaoEstoque = document.createElement("option");
        opcaoEstoque.value = livro.id;
        opcaoEstoque.textContent = livro.titulo;

        selectEstoque.appendChild(opcaoEstoque);
    });

    if (livros.some(l => l.id === livroSelecionado)) {
        selectLivro.value = livroSelecionado;
    }

    if (livros.some(l => l.id === livroEstoqueSelecionado)) {
        selectEstoque.value = livroEstoqueSelecionado;
    }

    if (livros.length === 0) {
        listaLivros.textContent = "Nenhum livro cadastrado.";
    }

    atualizarResumoEstoque();
}

// Resumo para o colaborador

function atualizarResumoEstoque() {
    const totalLivros = livros.length;

    const totalUnidades = livros.reduce(
        (total, livro) => total + Number(livro.quantidade),
        0
    );

    document.getElementById("totalLivros").textContent =
        totalLivros;

    document.getElementById("totalUnidades").textContent =
        totalUnidades;
}

// Busca os livros

async function buscarLivros() {
    if (modoAWS) {
        const resultado = await requisitarAPI("/livros");

        if (!Array.isArray(resultado)) {
            throw new Error(
                "Formato inesperado na resposta de /livros."
            );
        }

        livros = resultado;
    }

    carregarLivrosNaTela();
}

// Solicitação de livros

async function solicitarLivro(idLivro, email) {
    if (modoAWS) {
        return requisitarAPI("/solicitacoes", {
            method: "POST",
            body: JSON.stringify({
                livroId: idLivro,
                email: email
            })
        });
    }

    const livro = livros.find(
        item => item.id === idLivro
    );

    if (!livro) {
        throw new Error("Livro não encontrado.");
    }

    if (livro.quantidade > 0) {
        console.log(
            `E-mail simulado para ${email}: ` +
            `${livro.titulo} está disponível.`
        );

        return {
            mensagem:
                "Livro disponível! Notificação simulada no console."
        };
    }

    const jaRegistrado = interesses.some(
        item =>
            item.livroId === idLivro &&
            item.email === email &&
            item.status === "aguardando"
    );

    if (jaRegistrado) {
        return {
            mensagem: "Seu interesse já estava registrado."
        };
    }

    const interesseAnterior = interesses.find(
        item =>
            item.livroId === idLivro &&
            item.email === email
    );

    if (interesseAnterior) {
        interesseAnterior.status = "aguardando";
    } else {
        interesses.push({
            livroId: idLivro,
            email: email,
            status: "aguardando"
        });
    }

    salvarDadosLocais();

    return {
        mensagem:
            "Livro indisponível. Seu interesse foi registrado localmente!"
    };
}

// Atualização de estoque

async function atualizarEstoque(idLivro, quantidade) {
    if (modoAWS) {
        return requisitarAPI("/estoque", {
            method: "POST",
            body: JSON.stringify({
                livroId: idLivro,
                quantidade: quantidade
            })
        });
    }

    const livro = livros.find(
        item => item.id === idLivro
    );

    if (!livro) {
        throw new Error("Livro não encontrado.");
    }

    livro.quantidade += quantidade;

    const aguardando = interesses.filter(
        item =>
            item.livroId === idLivro &&
            item.status === "aguardando"
    );

    aguardando.forEach(item => {
        console.log(
            `E-mail simulado para ${item.email}: ` +
            `O livro "${livro.titulo}" chegou ao estoque!`
        );

        item.status = "notificado";
    });

    salvarDadosLocais();

    return {
        mensagem: "Estoque atualizado localmente.",
        quantidadeAtual: livro.quantidade,
        notificacoesPublicadas: aguardando.length,
        notificacoesPendentes: 0
    };
}

// Formulário do cliente

formulario.addEventListener("submit", async function(event) {
    event.preventDefault();

    const idLivro = selectLivro.value;

    const email = document.getElementById("email")
        .value.trim().toLowerCase();

    const botao = formulario.querySelector(
        'button[type="submit"]'
    );

    if (!idLivro || !email) {
        return;
    }

    botao.disabled = true;
    mensagem.textContent = "Processando solicitação...";

    try {
        const resultado = await solicitarLivro(idLivro, email);

        mensagem.textContent = resultado.mensagem;

    } catch (erro) {
        mensagem.textContent =
            `Não foi possível solicitar o livro: ${erro.message}`;

    } finally {
        botao.disabled = false;
    }
});

// Formulário do colaborador

formularioEstoque.addEventListener("submit", async function(event) {
    event.preventDefault();

    const idLivro = selectEstoque.value;

    const quantidade = Number(
        document.getElementById("quantidade").value
    );

    const botao = formularioEstoque.querySelector(
        'button[type="submit"]'
    );

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
        mensagemEstoque.textContent =
            "Informe uma quantidade inteira positiva.";
        return;
    }

    botao.disabled = true;
    mensagemEstoque.textContent = "Atualizando estoque...";

    try {
        const resultado = await atualizarEstoque(
            idLivro,
            quantidade
        );

        await buscarLivros();

        mensagemEstoque.textContent =
            `${resultado.mensagem} ` +
            `${resultado.notificacoesPublicadas || 0} ` +
            `notificação(ões) publicada(s)/simulada(s); ` +
            `${resultado.notificacoesPendentes || 0} pendente(s).`;

    } catch (erro) {
        mensagemEstoque.textContent =
            `Erro ao atualizar estoque: ${erro.message}`;

    } finally {
        botao.disabled = false;
    }
});

// Inicialização da aplicação

async function iniciar() {
    if (!modoAWS) {
        iniciarModoLocal();
    }

    try {
        await buscarLivros();

    } catch (erro) {
        listaLivros.textContent =
            `Não foi possível carregar os livros: ${erro.message}`;

        console.error(erro);
    }
}

iniciar();
