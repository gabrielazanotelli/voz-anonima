# Voz Anônima — Feedback de RH

Aplicação web para coleta de feedback anônimo de equipes, com painel de RH para criação de perguntas, geração de um link único de acesso e visualização de resultados agregados em gráficos.

**[Live Demo](https://gabrielazanotelli.github.io/voz-anonima/)**

## Contexto

Projeto autoral desenvolvido para explorar, na prática, um problema real de gestão de pessoas: como coletar feedback sincero de uma equipe sem expor quem respondeu o quê. A solução foi concebida e arquitetada por mim — da definição do problema à lógica de anonimato e ao fluxo de uso — com apoio de ferramentas de IA generativa na implementação do código.

## Funcionalidades

- **Painel de RH**: criação de perguntas (escala de 1 a 5 ou texto livre), reordenação por arrastar, geração de um único link de acesso para toda a equipe
- **Formulário do funcionário**: fluxo de resposta anônima, com tela de boas-vindas e confirmação de envio
- **Prevenção de respostas duplicadas**: cada dispositivo guarda localmente um aviso de "já respondido", sem qualquer vínculo com a resposta enviada
- **Resultados agregados**: painel com clima geral da equipe, gráficos por pergunta (Chart.js) e respostas de texto livre — nunca dados individuais
- **Modo de teste**: o próprio RH pode simular o preenchimento do formulário e gerar respostas de demonstração para visualizar os gráficos funcionando, sem afetar dados reais
- **Login de RH** (ambiente de demonstração): usuário `rh`, senha `rh2026`

## Como o anonimato é garantido

Existe um único link de acesso, compartilhado com toda a equipe — não há links individuais por pessoa. O aviso de "já respondeu", salvo no navegador de quem responde, existe apenas para evitar múltiplos envios do mesmo dispositivo e não carrega nenhuma informação que ligue esse aviso à resposta enviada. O RH visualiza apenas dados agregados (médias, distribuições, textos), nunca respostas atribuídas a uma pessoa.

## Tecnologias

- HTML5, CSS3, JavaScript
- [Chart.js](https://www.chartjs.org/) para visualização de dados
- `localStorage` do navegador para persistência dos dados (versão de demonstração — em produção, seria substituído por um backend com banco de dados e autenticação real)

## Observação sobre esta versão

Esta é uma versão de demonstração: todos os dados ficam salvos apenas no navegador de quem acessa (não há servidor nem banco de dados), o que é suficiente para apresentar o conceito e o fluxo completo da solução, mas não deve ser usado com dados reais de uma equipe.

## Autoria

Desenvolvido por **Gabriela Falbo Zanotelli** — [LikedIn](https://linkedin.com/in/gabriela-falbo-zanotelli)
