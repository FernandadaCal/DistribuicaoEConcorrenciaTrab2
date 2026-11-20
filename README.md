# Sebo Online

Projeto desenvolvido para o segundo trabalho da disciplina de **Distribuição e Concorrência — 2026.2**, da PUC-Rio.

## Sobre o projeto

O Sebo Online é uma aplicação de livraria desenvolvida utilizando serviços da AWS. O sistema permite que os clientes consultem os livros disponíveis e solicitem um título de interesse.

Se o livro estiver disponível, o cliente recebe um e-mail orientando que compareça à livraria para realizar a compra. Caso esteja indisponível, seu interesse fica registrado e ele é notificado quando novas unidades chegam ao estoque.

Também desenvolvemos uma área para o colaborador, onde é possível atualizar a quantidade de livros disponíveis.

## Tecnologias utilizadas

- **Frontend:** HTML, CSS e JavaScript.
- **Backend:** Python com AWS Lambda.
- **DynamoDB:** armazenamento dos livros, clientes e interesses.
- **Amazon SNS:** envio das notificações por e-mail.
- **API Gateway:** comunicação entre o frontend e as funções Lambda.

## Estrutura do projeto

```text
sebo-aws/
├── .vscode/
│   └── settings.json
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── config.js
├── lambdas/
│   ├── listar_livros.py
│   ├── solicitar_livro.py
│   └── atualizar_estoque.py
├── relatorio/
│   ├── Relatorio_Sebo_Online
└── README.md
```

O backend foi dividido em três funções Lambda: uma para consultar os livros, outra para processar as solicitações dos clientes e a última para atualizar o estoque e notificar os interessados.

## Como executar

O frontend foi desenvolvido com HTML, CSS e JavaScript puro, portanto não é necessário instalar bibliotecas ou dependências adicionais.

Para executar o projeto, é possível utilizar uma das opções abaixo:

**Opção 1 — Live Server (VS Code)**

1. Abrir o projeto no VS Code.
2. Instalar a extensão **Live Server**, caso ainda não esteja instalada.
3. Abrir o arquivo `frontend/index.html` com a opção **Open with Live Server**.

**Opção 2 — Python**

É necessário ter o Python instalado. No terminal, dentro da pasta principal do projeto, executar:

```bash
python -m http.server 5500 --bind 127.0.0.1
```

Em seguida, acessar:

`http://127.0.0.1:5500/frontend/index.html`

**Configuração**

O arquivo `frontend/config.js` permite escolher entre dois modos de execução:

- `aws`: utiliza os serviços configurados na AWS Academy. Para funcionar, o ambiente AWS precisa estar disponível.
- `local`: utiliza dados simulados, armazenados no navegador, sem depender dos serviços da AWS.

O projeto já está configurado para utilizar nossa API Gateway no modo `aws`. Caso seja necessário executar em outra conta AWS, basta configurar os serviços e atualizar a URL da API no `config.js`.

## Como utilizar

**Cliente:** na aba Cliente, é possível consultar os livros, selecionar um título e informar um e-mail para receber notificações. O e-mail precisa estar previamente cadastrado no DynamoDB e inscrito no SNS.

**Colaborador:** na aba Colaborador, é possível selecionar um livro e adicionar novas unidades ao estoque. Caso existam clientes aguardando esse título, o sistema publica notificações pelo SNS.

## Observações

A aplicação não realiza vendas ou reservas. A compra é feita presencialmente, portanto a solicitação de um livro não reduz o estoque.

A área do colaborador não possui autenticação, e o cadastro de clientes para notificações é realizado previamente na AWS. Essas funcionalidades foram mantidas simples para atender ao escopo do trabalho.