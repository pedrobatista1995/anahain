Este diretorio guarda dados locais do ambiente, como o arquivo `app.sqlite`.

O banco real nao deve ser versionado no GitHub.

Ao executar o projeto em um ambiente limpo, o arquivo `data/app.sqlite` e recriado automaticamente.

Se a base iniciar vazia e a variavel `MEDICAL_ADMIN_PASSWORD` nao estiver definida, o sistema cria uma senha inicial e grava em `data/app.sqlite.initial-admin.txt`.
