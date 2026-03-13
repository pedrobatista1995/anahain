# Dra. Ana Hain | Demo web em PHP + SQLite

Projeto de demonstracao para apresentacao comercial da clinica, com site institucional, captacao de leads, agendamento online e painel administrativo. O frontend e estatico, o backend roda em PHP com SQLite, e a camada de social proof foi internalizada para evitar dependencia de widgets pagos.

## O que este projeto entrega

- pagina publica responsiva para a Dra. Ana Hain;
- captacao de leads e CTA para WhatsApp;
- agendamento online com regras de disponibilidade;
- painel administrativo em `admin.html`;
- agenda, metricas, notificacoes, configuracoes e seguranca;
- prontuarios vinculados aos atendimentos;
- reviews do Google por scraping interno com cache;
- Instagram publico com dados e feed carregados pelo backend;
- fallback automatico para Doctoralia se o Google nao responder.

## Stack

- HTML, CSS e JavaScript no frontend;
- PHP + SQLite no backend;
- Python + Playwright + Chromium para scraping do Google;
- Docker para deploy no Render.

## Estrutura resumida

- `index.html`: pagina principal;
- `leads.html`: entrada dedicada para captacao;
- `admin*.html`: telas do painel administrativo;
- `api/`: endpoints PHP, autenticacao, agenda, metricas e scrapers;
- `js/` e `css/`: comportamento e estilos do frontend;
- `assets/` e `images/`: midias e identidade visual;
- `data/`: base SQLite, caches e arquivos locais nao versionados.

## Rodar localmente com XAMPP

1. Coloque a pasta dentro de `htdocs`.
2. Inicie o Apache no XAMPP.
3. Acesse `http://localhost/medical/`.

Na primeira execucao em ambiente limpo, o projeto cria automaticamente `data/app.sqlite`.

Para acessar o painel:

- URL: `http://localhost/medical/admin.html`
- usuario padrao: `medico`, se `MEDICAL_ADMIN_USER` nao estiver definido;
- senha: defina `MEDICAL_ADMIN_PASSWORD` antes de subir o Apache, ou consulte `data/app.sqlite.initial-admin.txt` se a base foi criada sem senha explicita.

Se o scraping do Google nao funcionar localmente, confirme que o ambiente tem:

```powershell
python -m pip install playwright
python -m playwright install chromium
```

## Configuracao rapida

O arquivo `config.js` concentra os links publicos usados pela pagina:

- `WHATSAPP_PUBLIC_URL`
- `INSTAGRAM_URL`
- `GOOGLE_BUSINESS_URL`
- `DOCTORALIA_URL`
- `API_BASE`

No painel administrativo, ajuste `public_base_url` depois do primeiro deploy para que links publicos e cancelamentos apontem para a URL correta.

## Social proof sem widget terceiro

O projeto nao depende mais de Trustindex ou servicos equivalentes.

- Google Reviews: carregados no backend por scraping com Playwright, usando o link publico configurado em `GOOGLE_BUSINESS_URL`;
- Instagram: perfil e posts publicos carregados internamente e servidos com proxy local para as imagens;
- Doctoralia: usado apenas como fallback quando o Google bloqueia ou falha.

O scraper do Google usa cache local. Se o Google nao responder em uma execucao, o site tenta servir o ultimo cache valido.

## Deploy no Render Free

O repositorio ja esta preparado com `render.yaml` e `Dockerfile`.

Passos:

1. Conecte o repositorio `pedrobatista1995/anahain` no Render.
2. Crie o servico com `Blueprint` ou `New > Web Service`.
3. Mantenha `runtime: docker`.
4. Use o plano `Free`.
5. Defina `MEDICAL_ADMIN_PASSWORD` como secret no Render.
6. Faca o deploy.
7. Ao final, abra a URL gerada e depois `https://SUA-URL/admin.html`.

Variaveis importantes no deploy:

- `MEDICAL_DATA_DIR=/tmp/medical-data`
- `MEDICAL_ADMIN_USER=medico`
- `MEDICAL_ADMIN_PASSWORD=<secret>`

## Limitacoes reais da demo no plano Free

- o servico entra em idle apos alguns minutos sem trafego;
- o primeiro acesso depois do idle pode demorar;
- o filesystem e efemero, entao SQLite e caches podem ser perdidos em restart ou redeploy;
- nao ha disco persistente no plano `Free`;
- SMTP nas portas padrao nao deve funcionar nesse plano.

Para uma demonstracao comercial isso costuma ser suficiente. Para uso estavel, o caminho correto e hospedar em ambiente com armazenamento persistente ou migrar o banco para Postgres.

## Boas praticas antes de mostrar para cliente

- nao publique `data/app.sqlite` no Git;
- troque a senha administrativa antes de compartilhar a demo;
- mantenha o repositorio privado se houver regras internas ou dados sensiveis;
- cadastre dados de teste perto da apresentacao, porque o plano Free pode resetar o armazenamento;
- abra a URL alguns minutos antes da reuniao para evitar atraso no primeiro carregamento.

## Observacao importante

GitHub mostra o codigo, mas nao executa o projeto PHP/SQLite. Se o objetivo e o cliente testar as funcionalidades, voce precisa publicar a aplicacao em uma hospedagem que suporte PHP ou no deploy Docker ja preparado neste repositorio.
