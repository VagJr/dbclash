# Dragon Ball Clash — Dedicated Render Backend Server

Servidor dedicado Node.js + Socket.io 100% isolado e pronto para ser publicado no **Render.com**.

## 🚀 Como subir para o GitHub / Render

1. Inicialize o repositório Git nesta pasta:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Dedicated Render Server"
   ```
2. Crie um novo repositório no seu GitHub (ex: `dbtcg-render-server`) e faça o push:
   ```bash
   git remote add origin https://github.com/seu-usuario/dbtcg-render-server.git
   git branch -M main
   git push -u origin main
   ```
3. No Render.com:
   - Crie um novo **Web Service** conectado a este repositório.
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
