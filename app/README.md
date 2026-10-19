# App (React + Vite + TypeScript)

Por enquanto contém só a **página de teste do OpenCV.js** (seção 8.5 da documentação): carrega uma foto, roda as etapas pesadas da leitura num Web Worker e mostra o tempo de cada uma.

```bash
npm install
npm run dev        # serve em https://<ip-do-pc>:5173 na rede local
```

## Testar no celular
1. O celular precisa estar no **mesmo Wi-Fi** que o PC.
2. Abra o endereço `Network` que o `npm run dev` mostra, por exemplo `https://192.168.18.5:5173`.
3. O navegador vai avisar que o certificado não é confiável, porque é um certificado próprio, gerado pelo `@vitejs/plugin-basic-ssl`. Toque em **Avançado → Continuar** (Chrome) ou **Mostrar detalhes → visitar este site** (Safari).
4. Espere o OpenCV carregar, toque em **Escolher ou tirar foto** e depois em **Rodar de novo** umas 2 ou 3 vezes.
5. Copie o texto de "Para enviar ao grupo" e mande no grupo.

Se não abrir, o Firewall do Windows pode estar bloqueando o Node.js na rede privada.
