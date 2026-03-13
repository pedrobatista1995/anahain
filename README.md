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
- O arquivo `Dockerfile` instala PHP + Apache + SQLite.
- O projeto usa `MEDICAL_DATA_DIR` para gravar `app.sqlite` e `verse-cache.json` fora da pasta publica.

Passos:

1. Entre no Render e conecte o repositorio `pedrobatista1995/anahain`.
2. Crie o servico usando o Blueprint do repositorio ou `New > Web Service`.
3. Mantenha o runtime `Docker`.
4. Use um plano pago com disco persistente e confirme o `mountPath` em `/var/data`.
5. Defina `MEDICAL_ADMIN_PASSWORD` no painel do Render.
6. Faca o deploy.
7. Ao final, acesse a URL `onrender.com` gerada e depois abra `/admin.html`.

Depois do primeiro deploy:

- entre no painel administrativo;
- configure `public_base_url` com a URL publica do Render;
- ajuste SMTP se quiser que cancelamentos e avisos por email funcionem.

## Publicacao para demo do cliente

Se o objetivo e o cliente usar o sistema e nao apenas ver o codigo:

- publique este repositorio em um servidor com PHP;
- mantenha o repositorio privado se houver codigo ou regras internas do cliente;
- troque as credenciais administrativas antes de abrir a demo para terceiros;
- configure a URL publica correta nas configuracoes do painel, se necessario.
