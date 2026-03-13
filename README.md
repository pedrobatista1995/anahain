# Medical

Projeto web com frontend estatico e backend PHP + SQLite.

## Antes de subir para o GitHub

- Nao publique o banco `data/app.sqlite`. Ele pode conter dados reais, credenciais e historico de uso.
- O `.gitignore` deste projeto ja foi configurado para ignorar o banco local e arquivos temporarios de captura.
- O GitHub mostra o codigo, mas nao executa PHP/SQLite. Para o cliente testar todas as funcionalidades, voce tambem vai precisar publicar o projeto em uma hospedagem com PHP.

## Subir para o GitHub

No terminal, dentro de `C:\xampp\htdocs\medical`:

```powershell
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

## Rodar localmente

1. Coloque a pasta dentro do `htdocs`.
2. Inicie Apache no XAMPP.
3. Acesse `http://localhost/medical/`.

Na primeira execucao em ambiente limpo, o arquivo `data/app.sqlite` sera criado automaticamente.

Se a base iniciar vazia:

- defina `MEDICAL_ADMIN_USER` e `MEDICAL_ADMIN_PASSWORD` antes de abrir o projeto; ou
- deixe sem essas variaveis e veja as credenciais iniciais geradas em `data/app.sqlite.initial-admin.txt`.

## Publicacao para demo do cliente

Se o objetivo e o cliente usar o sistema e nao apenas ver o codigo:

- publique este repositorio em um servidor com PHP;
- mantenha o repositorio privado se houver codigo ou regras internas do cliente;
- troque as credenciais administrativas antes de abrir a demo para terceiros;
- configure a URL publica correta nas configuracoes do painel, se necessario.
