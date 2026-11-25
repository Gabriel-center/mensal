# Mensalinha (MVP)

Cobrança de mensalidade pelo WhatsApp com Pix, para três nichos: aulas, transporte escolar e aluguel.
É um site estático, sem servidor e sem banco de dados.

## O que tem aqui

| Arquivo | O que é |
|---|---|
| `index.html` | Landing geral com a escolha do nicho |
| `aulas.html`, `van.html`, `aluguel.html` | Uma landing por nicho, com textos e exemplo de mensagem próprios. É para elas que os anúncios apontam. |
| `app.html` | O app. Abre já configurado para o nicho com `app.html?nicho=van` (ou `aulas`, `aluguel`). |
| `assets/config.js` | **Edite antes de publicar:** seu WhatsApp e os preços mostrados nas landings |
| `assets/app.js` | Toda a lógica do app |
| `assets/pix.js` | Gera o código Pix copia e cola (BR Code), conferido contra o exemplo oficial do Banco Central |
| `assets/qrcode.js` | Biblioteca de QR Code (Kazuhiko Arase, licença MIT) |

## O que o app faz

- Cadastro de alunos ou inquilinos: valor, dia de vencimento, WhatsApp e mês de início
- Lista "Cobrar agora": quem vence nos próximos dias, quem vence hoje e quem está atrasado (até 6 meses para trás)
- "Cobrar no WhatsApp": abre a conversa com a mensagem pronta e o Pix copia e cola com o valor certo
- Multa e juros por dia de atraso, com a conta explicada na mensagem
- QR Code Pix na tela, para quem paga pessoalmente
- Marcar como pago e enviar recibo pelo WhatsApp
- Meses sem cobrança (férias)
- Relatório do mês: imprimir, salvar em PDF ou baixar CSV
- Textos das mensagens editáveis
- Backup e restauração em JSON
- Botão "Carregar exemplo" para demonstrar

## Publicar

Qualquer hospedagem estática serve. Com Cloudflare Pages:

```
npx wrangler pages deploy . --project-name mensalinha
```

Também funciona arrastando a pasta no painel do Cloudflare Pages ou do Netlify, ou subindo no GitHub Pages.

## Limites desta versão (de propósito)

- **Os dados ficam no navegador de quem usa.** Se a pessoa limpar o navegador ou trocar de celular sem backup, perde os cadastros. Para um teste de validação está ok. Quando houver clientes pagando, o próximo passo é login e sincronização (Worker + D1).
- **Ninguém é cobrado pelo uso ainda.** O preço nas landings é só vitrine. Para cobrar a assinatura, use um link de pagamento do Asaas, Hotmart ou Kiwify, ou libere o acesso manualmente para os primeiros clientes.
- **Sem baixa automática do Pix.** O Pix cai direto na conta do usuário, então o app não fica sabendo do pagamento. A pessoa marca "Pago" na mão. A baixa automática (e o Pix Automático) exigem um gateway como o Asaas.
- **O envio é manual.** Cada cobrança abre o WhatsApp e a pessoa toca em enviar. O envio 100% automático exige a API oficial do WhatsApp e um servidor.

## Para o teste com anúncios

1. Coloque seu número em `assets/config.js`. Os botões "Falar no WhatsApp" aparecem sozinhos, com uma mensagem que diz de qual nicho a pessoa veio.
2. Cole o Meta Pixel no `<head>` das landings (o lugar está marcado com um comentário).
3. Rode um conjunto de anúncios por nicho, cada um apontando para a landing do nicho.
