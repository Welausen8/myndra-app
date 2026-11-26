# MyndraLife (app)

PWA estática (HTML, CSS e JavaScript puro, sem etapa de build) ligada ao Supabase.

- `index.html`, `css/app.css`, `js/app.js`: o app
- `js/config.js`: URL e chave pública do Supabase (a segurança fica nas regras RLS do banco)
- `js/vendor/supabase.js`: biblioteca do Supabase (cópia local)
- `sw.js` e `manifest.webmanifest`: instalação na tela do celular

## Testar localmente
`python3 -m http.server 8080` e abrir http://localhost:8080

## Publicar
Hostinger, Websites, Gerenciar, Avançado, Git: ligar este repositório (branch `main`, pasta raiz `/`) e ativar o deploy automático.

## Login
Link mágico por e-mail. No Supabase, em Authentication, URL Configuration, adicionar o endereço final do app em "Redirect URLs".
