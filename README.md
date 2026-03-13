# Medical

Projeto web com frontend estatico e backend PHP + SQLite.

## Antes de subir para o GitHub

- Nao publique o banco `data/app.sqlite`. Ele pode conter dados reais, credenciais e historico de uso.
- O `.gitignore` deste projeto ja foi configurado para ignorar o banco local e arquivos temporarios de captura.
- O GitHub mostra o codigo, mas nao executa PHP/SQLite. Para o cliente testar todas as funcionalidades, voce tambem vai precisar publicar o projeto em uma hospedagem com PHP.

## Rodar localmente

1. Coloque a pasta dentro do `htdocs`.
2. Inicie Apache no XAMPP.
3. Acesse `http://localhost/medical/`.

Na primeira execucao em ambiente limpo, o arquivo `data/app.sqlite` sera criado automaticamente.

Se a base iniciar vazia:

- defina `MEDICAL_ADMIN_USER` e `MEDICAL_ADMIN_PASSWORD` antes de abrir o projeto; ou
- deixe sem essas variaveis e veja as credenciais iniciais geradas em `data/app.sqlite.initial-admin.txt`.

## Deploy no Render

Este projeto foi preparado para deploy no Render com Docker.

- O arquivo `render.yaml` cria um Web Service com `runtime: docker`.
- O arquivo `Dockerfile` instala PHP + Apache + SQLite e o runtime de scraping do Google com Python + Playwright.
- O projeto usa `MEDICAL_DATA_DIR` para gravar `app.sqlite` e `verse-cache.json` fora da pasta publica.
- Os reviews do Google sao buscados no backend por scraping com cache local; se o Google falhar no momento, o site usa o ultimo cache valido.

Passos:

1. Entre no Render e conecte o repositorio `pedrobatista1995/anahain`.
2. Crie o servico usando o Blueprint do repositorio ou `New > Web Service`.
3. Mantenha o runtime `Docker`.
4. Use o plano `Free`.
5. Defina `MEDICAL_ADMIN_PASSWORD` no painel do Render.
6. Faca o deploy.
7. Ao final, acesse a URL `onrender.com` gerada e depois abra `/admin.html`.

Depois do primeiro deploy:

- entre no painel administrativo;
- configure `public_base_url` com a URL publica do Render;

Limitacoes importantes do plano Free no Render:

- o servico entra em idle apos 15 minutos sem trafego e pode levar cerca de 1 minuto para voltar;
- arquivos locais sao perdidos em redeploy, restart e spin down, incluindo o banco SQLite;
- o plano Free nao aceita disco persistente;
- o plano Free nao permite envio SMTP nas portas 25, 465 e 587.

Para uma demo temporaria isso pode servir. Para uma demo estavel com dados preservados, o caminho correto e usar plano pago com disco persistente ou migrar o banco para Postgres.

## Reviews e redes sociais

- Instagram publico: carregado internamente pelo backend e servido com proxy local para as imagens.
- Google reviews: carregados internamente por um scraper com Playwright a partir do link publico configurado em `GOOGLE_BUSINESS_URL`.
- Doctoralia: mantido como fallback automatico se o Google bloquear ou nao responder.

Se voce rodar localmente e o Google nao carregar:

- confirme que `python` ou `python3` esta disponivel no sistema;
- instale `playwright`;
- instale o navegador Chromium do Playwright.

## Publicacao para demo do cliente

Se o objetivo e o cliente usar o sistema e nao apenas ver o codigo:

- publique este repositorio em um servidor com PHP;
- mantenha o repositorio privado se houver codigo ou regras internas do cliente;
- troque as credenciais administrativas antes de abrir a demo para terceiros;
- configure a URL publica correta nas configuracoes do painel, se necessario.
