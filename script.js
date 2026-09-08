/* =========================================================================
   VOZ ANÔNIMA — lógica do site
   -------------------------------------------------------------------------
   Diferente da versão anterior, este arquivo NÃO cria a página inteira.
   Todo o HTML fixo (formulários, botões, containers) já existe no index.html.
   Aqui a gente só faz três coisas:
     1) Mostrar/esconder as seções certas (classe .hidden)
     2) Ler o que a pessoa digitou (inputs) e reagir a cliques
     3) Preencher listas cujo tamanho muda (perguntas, respostas, gráficos) —
        isso é a única parte que "gera" pedaços de HTML, porque não dá pra
        saber com antecedência quantas perguntas vão existir.

   Os dados ficam no localStorage do navegador (funciona 100% offline).
   Num site publicado de verdade, "loadData"/"saveData" seriam trocados por
   chamadas a uma API que fala com um banco de dados no servidor.
========================================================================= */

const KEYS = {
  questions: 'fb_questions',
  responses: 'fb_responses',
  deviceAnswered: 'fb_device_answered', // marca local: este dispositivo já respondeu
};

// Hash fixo que identifica o link único do funcionário (não é mais um token
// individual — é o mesmo link para toda a equipe).
const EMPLOYEE_HASH = 'responder';

const HR_USER = 'rh';
const HR_PASS = 'rh2026';

let state = {
  questions: [],
  responses: [],
  employeeAnswers: {},
  testMode: false, // true quando o RH está espiando o formulário como teste
};

/* ---------- localStorage: ler e gravar ---------- */
function loadData(key, fallback){
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}
function saveData(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}
function loadAll(){
  state.questions = loadData(KEYS.questions, []);
  state.responses = loadData(KEYS.responses, []);
}

function uid(len = 8){
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for(let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

// Embaralha uma cópia do array (Fisher–Yates), sem alterar o original.
// Usado para sortear exemplos de texto sem repetir.
function shuffleArray(arr){
  const copy = [...arr];
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* =========================================================================
   NAVEGAÇÃO ENTRE TELAS
   Cada "tela" é uma <section class="view"> no HTML, com um id fixo.
   showView esconde todas e mostra só a pedida.
========================================================================= */
const VIEW_IDS = [
  'view-landing', 'view-hr-login', 'view-hr-dashboard',
  'view-employee-welcome', 'view-employee-form', 'view-employee-thanks',
  'view-already-answered'
];

function showView(id){
  VIEW_IDS.forEach(vid => {
    document.getElementById(vid).classList.toggle('hidden', vid !== id);
  });
}

function showTab(tabName){
  // Alterna qual botão de aba está marcado como ativo
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  // Alterna qual painel de conteúdo aparece
  document.getElementById('panel-perguntas').classList.toggle('hidden', tabName !== 'perguntas');
  document.getElementById('panel-link').classList.toggle('hidden', tabName !== 'link');
  document.getElementById('panel-resultados').classList.toggle('hidden', tabName !== 'resultados');

  if(tabName === 'perguntas'){ renderQuestionList(); renderProgressHeader(); updatePreview(); }
  if(tabName === 'link') renderAccessLink();
  if(tabName === 'resultados') renderResults();
}

/* ---------- Decide qual tela mostrar quando a página carrega ----------
   Se a URL for o link único do funcionário (#responder), checamos se ESTE
   dispositivo já respondeu antes (aviso local, sem ligação com a resposta
   em si). Qualquer outra URL cai na página inicial (entrada do RH). */
function detectEntry(){
  const hash = window.location.hash || '';
  if(hash.replace('#', '') === EMPLOYEE_HASH){
    const alreadyAnswered = loadData(KEYS.deviceAnswered, false);
    if(alreadyAnswered){
      showView('view-already-answered');
      return;
    }
    state.employeeAnswers = {};
    renderEmployeeQuestions();
    showView('view-employee-welcome');
    return;
  }
  showView('view-landing');
}

/* =========================================================================
   TELA: LOGIN DO RH
========================================================================= */
function tryHrLogin(){
  const u = document.getElementById('hr-user').value.trim();
  const p = document.getElementById('hr-pass').value;
  const errorBox = document.getElementById('hr-login-error');

  if(u === HR_USER && p === HR_PASS){
    errorBox.textContent = '';
    showView('view-hr-dashboard');
    showTab('perguntas');
  } else {
    errorBox.textContent = 'Usuário ou senha incorretos.';
  }
}

/* =========================================================================
   PAINEL: PERGUNTAS
========================================================================= */
function addQuestion(){
  const textInput = document.getElementById('new-q-text');
  const typeSelect = document.getElementById('new-q-type');
  const text = textInput.value.trim();
  if(!text) return;

  state.questions.push({ id: uid(6), text, type: typeSelect.value });
  saveData(KEYS.questions, state.questions);

  textInput.value = '';
  updatePreview();
  renderQuestionList();
  renderProgressHeader();
}

function removeQuestion(id){
  state.questions = state.questions.filter(q => q.id !== id);
  saveData(KEYS.questions, state.questions);
  renderQuestionList();
  renderProgressHeader();
}

function clearAllQuestions(){
  if(state.questions.length === 0) return;
  const hasResponses = state.responses.length > 0;
  const ok = confirm(
    hasResponses
      ? `Tem certeza que quer apagar TODAS as perguntas? Isso também vai apagar as ${state.responses.length} resposta(s) já coletadas, já que elas pertencem a este formulário. Essa ação não pode ser desfeita.`
      : 'Tem certeza que quer apagar TODAS as perguntas? Essa ação não pode ser desfeita.'
  );
  if(!ok) return;

  state.questions = [];
  saveData(KEYS.questions, state.questions);
  renderQuestionList();
  updatePreview();

  // As respostas já coletadas ficam "órfãs" (vinculadas a perguntas que não
  // existem mais), então são apagadas junto — automaticamente, sem pedir
  // confirmação de novo, pra não dar a entender que dá pra "limpar
  // resultados" à parte, como se fosse manipular o que a equipe respondeu.
  if(hasResponses){
    state.responses = [];
    saveData(KEYS.responses, state.responses);
    renderResults();
  }
  renderProgressHeader();
}

function moveQuestion(id, direction){
  const idx = state.questions.findIndex(q => q.id === id);
  const swapWith = idx + direction;
  if(idx < 0 || swapWith < 0 || swapWith >= state.questions.length) return;
  const arr = state.questions;
  [arr[idx], arr[swapWith]] = [arr[swapWith], arr[idx]];
  saveData(KEYS.questions, arr);
  renderQuestionList();
}

// Preenche o container #question-list com uma linha por pergunta cadastrada.
// Esta é a parte "dinâmica": o número de perguntas muda, então o HTML
// de cada linha precisa ser montado aqui. Cada linha é arrastável (drag
// and drop) e também tem setinhas ▲▼ como alternativa acessível.
function renderQuestionList(){
  const list = document.getElementById('question-list');
  const qs = state.questions;
  document.getElementById('question-count').textContent = qs.length;
  document.getElementById('reorder-hint').classList.toggle('hidden', qs.length < 2);

  if(qs.length === 0){
    list.innerHTML = '<div class="empty-state">Nenhuma pergunta ainda. Adicione a primeira ao lado.</div>';
    return;
  }

  list.innerHTML = qs.map((q, i) => `
    <div class="question-row" draggable="true" data-qid="${q.id}">
      <div class="reorder-controls">
        <button class="reorder-btn" title="Mover para cima" onclick="moveQuestion('${q.id}', -1)" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="reorder-btn" title="Mover para baixo" onclick="moveQuestion('${q.id}', 1)" ${i === qs.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
      <div style="flex:1;">
        <span class="qtag">Pergunta ${i + 1}</span>
        <span class="pill">${q.type === 'scale' ? 'Escala 1–5' : 'Texto livre'}</span>
        <div style="margin-top:4px;">${escapeHtml(q.text)}</div>
      </div>
      <button class="btn danger" style="padding:6px 12px;font-size:12px;" onclick="removeQuestion('${q.id}')">Remover</button>
    </div>
  `).join('');

  setupDragToReorder(list);
}

// Drag-and-drop simples entre linhas de pergunta.
function setupDragToReorder(list){
  let draggedId = null;

  list.querySelectorAll('.question-row').forEach(row => {
    row.addEventListener('dragstart', () => {
      draggedId = row.dataset.qid;
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      draggedId = null;
    });
    row.addEventListener('dragover', e => e.preventDefault());
    row.addEventListener('drop', () => {
      const targetId = row.dataset.qid;
      if(!draggedId || draggedId === targetId) return;
      const arr = state.questions;
      const fromIdx = arr.findIndex(q => q.id === draggedId);
      const toIdx = arr.findIndex(q => q.id === targetId);
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      saveData(KEYS.questions, arr);
      renderQuestionList();
    });
  });
}

/* ---------- Cabeçalho de progresso do formulário ---------- */
function renderProgressHeader(){
  const dot = document.getElementById('progress-dot');
  const text = document.getElementById('progress-text');
  const responses = document.getElementById('progress-responses');
  if(!dot) return;

  const n = state.questions.length;
  dot.classList.toggle('progress-dot-ok', n > 0);
  text.textContent = n === 0
    ? 'Nenhuma pergunta ainda'
    : `Formulário ativo · ${n} pergunta${n > 1 ? 's' : ''}`;
  responses.textContent = `${state.responses.length} resposta${state.responses.length === 1 ? '' : 's'} coletada${state.responses.length === 1 ? '' : 's'}`;

  renderFormSummary();
}

/* ---------- Resumo do formulário: quantas perguntas de cada tipo ---------- */
function renderFormSummary(){
  const scaleEl = document.getElementById('summary-scale-count');
  const textEl = document.getElementById('summary-text-count');
  if(!scaleEl) return;
  scaleEl.textContent = state.questions.filter(q => q.type === 'scale').length;
  textEl.textContent = state.questions.filter(q => q.type === 'text').length;
}

/* ---------- Sugestões rápidas de pergunta (chips clicáveis) ---------- */
const SUGGESTED_QUESTIONS = [
  { text: 'Você se sente ouvido(a) pela liderança?', type: 'scale' },
  { text: 'Como está seu equilíbrio entre vida pessoal e trabalho?', type: 'scale' },
  { text: 'Você recomendaria a empresa para um amigo trabalhar aqui?', type: 'scale' },
  { text: 'O que mais te incomoda no dia a dia de trabalho?', type: 'text' },
  { text: 'O que a empresa poderia fazer para melhorar?', type: 'text' },
];

function renderSuggestionChips(){
  const wrap = document.getElementById('suggestion-chips');
  if(!wrap) return;
  wrap.innerHTML = SUGGESTED_QUESTIONS.map((s, i) => `
    <button type="button" class="chip" onclick="useSuggestion(${i})">${escapeHtml(s.text)}</button>
  `).join('');
}

function useSuggestion(i){
  const s = SUGGESTED_QUESTIONS[i];
  document.getElementById('new-q-text').value = s.text;
  document.getElementById('new-q-type').value = s.type;
  updatePreview();
}

/* ---------- Preview ao vivo: mostra como a pergunta vai aparecer ---------- */
function updatePreview(){
  const textEl = document.getElementById('preview-question-text');
  const answerEl = document.getElementById('preview-answer-area');
  if(!textEl) return;

  const text = document.getElementById('new-q-text').value.trim();
  const type = document.getElementById('new-q-type').value;

  textEl.textContent = text || 'Sua pergunta aparece aqui...';

  answerEl.innerHTML = type === 'scale'
    ? `<div class="scale-btns preview-scale">
         <div class="scale-btn">1</div><div class="scale-btn">2</div><div class="scale-btn">3</div><div class="scale-btn">4</div><div class="scale-btn">5</div>
       </div>`
    : `<textarea class="preview-textarea" rows="3" placeholder="Escreva sua resposta..." disabled></textarea>`;
}

/* =========================================================================
   PAINEL: LINK DE ACESSO (link único, compartilhado com toda a equipe)
========================================================================= */
function getAccessLink(){
  const baseUrl = window.location.href.split('#')[0];
  return `${baseUrl}#${EMPLOYEE_HASH}`;
}

function renderAccessLink(){
  const el = document.getElementById('access-link-text');
  if(el) el.textContent = getAccessLink();
}

function copyAccessLink(){
  const link = getAccessLink();
  const feedback = document.getElementById('copy-feedback');
  navigator.clipboard.writeText(link).then(() => {
    if(feedback) feedback.textContent = 'Link copiado!';
    setTimeout(() => { if(feedback) feedback.textContent = ''; }, 2500);
  }).catch(() => {
    if(feedback) feedback.textContent = 'Não foi possível copiar automaticamente — selecione o link acima.';
  });
}

// Abre o formulário de teste no painel do RH, exatamente como um
// funcionário chegaria pelo link único — mas em "modo de teste": não passa
// pela checagem de dispositivo, mostra um aviso visível, e o envio não
// grava nenhuma resposta real (ver submitEmployeeForm).
function testEmployeeForm(){
  state.testMode = true;
  state.employeeAnswers = {};
  renderEmployeeQuestions();
  showView('view-employee-welcome');
  toggleTestModeUI(true);
}

function toggleTestModeUI(show){
  ['test-badge-welcome', 'test-badge-form', 'btn-back-panel-welcome', 'btn-back-panel-form'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.toggle('hidden', !show);
  });
}

// Volta pro painel do RH, saindo do modo de teste.
function backToPanelFromTest(){
  state.testMode = false;
  toggleTestModeUI(false);
  showView('view-hr-dashboard');
  showTab('link');
}

// Limpa o aviso local de "já respondi" deste dispositivo, só para permitir
// testar o formulário de novo durante o desenvolvimento/demo.
function resetDeviceAnswered(){
  localStorage.removeItem(KEYS.deviceAnswered);
  const feedback = document.getElementById('copy-feedback');
  if(feedback){
    feedback.textContent = 'Teste reiniciado — este dispositivo pode responder de novo.';
    setTimeout(() => { feedback.textContent = ''; }, 3000);
  }
}

/* =========================================================================
   PAINEL: RESULTADOS
========================================================================= */
// Média das respostas de uma pergunta de escala (1 a 5). Retorna null se
// ninguém respondeu essa pergunta ainda.
function getQuestionAverage(q){
  const values = state.responses.map(r => r.answers[q.id]).filter(v => v >= 1 && v <= 5);
  if(values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Resumo geral no topo dos resultados: uma leitura rápida do clima da
// equipe, calculada como a média das médias de cada pergunta de escala
// (assim, cada pergunta pesa igual, não importa quantas respostas cada
// uma teve).
function renderClimateSummary(scaleQs){
  const card = document.getElementById('climate-summary');
  const averages = scaleQs.map(getQuestionAverage).filter(avg => avg !== null);

  if(averages.length === 0){
    card.classList.add('hidden');
    return;
  }

  const overall = averages.reduce((sum, avg) => sum + avg, 0) / averages.length;

  let level, desc;
  if(overall >= 4){
    level = 'good';
    desc = 'As respostas mostram um clima positivo. Vale reforçar o que está funcionando bem 🌿';
  } else if(overall >= 3){
    level = 'mid';
    desc = 'O clima está razoável, mas alguns pontos abaixo merecem atenção.';
  } else {
    level = 'low';
    desc = 'Vários pontos pedem atenção — vale a pena investigar as causas com a equipe.';
  }

  card.classList.remove('hidden', 'good', 'mid', 'low');
  card.classList.add(level);
  document.getElementById('climate-score').textContent = overall.toFixed(1);
  document.getElementById('climate-desc').textContent = desc;
}

// Decide o "nível" de uma média (1 a 5): cor, rótulo e uma dica de ação
// pro líder de RH — é isso que transforma o gráfico cru em um insight.
function getScoreLevel(avg){
  if(avg === null){
    return {
      level: 'neutral', label: 'Sem respostas', color: '#9AA5AE',
      tip: 'Ainda não há respostas suficientes para essa pergunta.'
    };
  }
  if(avg >= 4){
    return {
      level: 'good', label: 'Ponto forte', color: '#2F7A5E',
      tip: '🌿 As respostas indicam que isso está funcionando bem. Vale reconhecer e manter essa prática.'
    };
  }
  if(avg >= 3){
    return {
      level: 'mid', label: 'Atenção moderada', color: '#9A6A1E',
      tip: '🔎 Está razoável, mas com espaço pra melhorar. Pode valer conversar com a equipe sobre esse tema.'
    };
  }
  return {
    level: 'low', label: 'Precisa de ação', color: '#C4573B',
    tip: '⚠️ Essa nota está baixa e pode indicar um problema real — vale investigar as causas com a equipe o quanto antes.'
  };
}

function renderResults(){
  const total = state.responses.length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-questions').textContent = state.questions.length;

  const container = document.getElementById('charts-container');
  const scaleQs = state.questions.filter(q => q.type === 'scale');
  const textQs = state.questions.filter(q => q.type === 'text');

  renderClimateSummary(scaleQs);

  if(total === 0 && state.questions.length === 0){
    container.innerHTML = '<div class="card empty-state">Cadastre perguntas e colete respostas para ver os resultados.</div>';
    return;
  }

  // Calcula a média de cada pergunta de escala uma única vez, e ordena com
  // a pior nota primeiro — assim o líder já vê de cara onde focar, sem
  // precisar rolar a tela procurando os pontos de atenção.
  const scaleQsWithAvg = scaleQs
    .map(q => ({ q, avg: getQuestionAverage(q) }))
    .sort((a, b) => {
      if(a.avg === null && b.avg === null) return 0;
      if(a.avg === null) return 1;
      if(b.avg === null) return -1;
      return a.avg - b.avg;
    });

  let html = '';
  scaleQsWithAvg.forEach(({ q, avg }) => {
    const info = getScoreLevel(avg);
    html += `
      <div class="card">
        <div class="question-result-header">
          <div>
            <div class="eyebrow" style="margin-bottom:2px;">Escala 1 a 5</div>
            <h3 style="margin:0;">${escapeHtml(q.text)}</h3>
          </div>
          <div class="score-badge ${info.level}">
            <span>${avg === null ? '—' : avg.toFixed(1)}</span>
            <span class="score-badge-label">${info.label}</span>
          </div>
        </div>
        <div class="chart-wrap"><canvas id="chart-${q.id}"></canvas></div>
        <p class="insight-text ${info.level}">${info.tip}</p>
      </div>
    `;
  });
  textQs.forEach(q => {
    const answers = state.responses
      .filter(r => r.answers[q.id] && r.answers[q.id].trim())
      .map(r => ({ text: r.answers[q.id], demo: !!r.demo }));
    html += `
      <div class="card">
        <div class="eyebrow">Texto livre</div>
        <h3 style="margin-top:0;">${escapeHtml(q.text)}</h3>
        ${answers.length === 0
          ? '<div class="empty-state">Sem respostas de texto ainda.</div>'
          : answers.map(a => `<div class="text-response">${escapeHtml(a.text)}${a.demo ? ' <span class="demo-tag">exemplo</span>' : ''}</div>`).join('')}
      </div>
    `;
  });
  container.innerHTML = html;

  // Os gráficos precisam ser criados DEPOIS que os <canvas> já estão no DOM
  scaleQsWithAvg.forEach(({ q }) => {
    const counts = [0, 0, 0, 0, 0];
    state.responses.forEach(r => {
      const v = r.answers[q.id];
      if(v >= 1 && v <= 5) counts[v - 1]++;
    });
    const ctx = document.getElementById('chart-' + q.id);
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['1', '2', '3', '4', '5'],
        datasets: [{ label: 'Nº de respostas', data: counts, backgroundColor: '#4C6E91', borderRadius: 6 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  });
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* =========================================================================
   RESPOSTAS DE DEMONSTRAÇÃO (para apresentar os gráficos funcionando,
   sem precisar coletar respostas reais da equipe)
========================================================================= */
const DEMO_TEXT_SAMPLES = [
  'Acho que a comunicação entre as equipes poderia ser mais clara.',
  'Gosto do ambiente, mas às vezes os prazos ficam apertados.',
  'Sinto que meu trabalho é reconhecido pela liderança.',
  'Poderia ter mais espaço para dar feedback no dia a dia.',
  'Estou satisfeito com o suporte que recebo da equipe.',
  'Às vezes falta alinhamento entre o que é pedido e o que é entregue.',
  'A liderança tem sido bem acessível ultimamente.',
  'Gostaria de mais oportunidades de crescimento por aqui.',
  'As reuniões poderiam ser mais objetivas e menos demoradas.',
  'Sinto que tenho autonomia pra tomar decisões no meu trabalho.',
  'Faltam recursos adequados para algumas tarefas do dia a dia.',
  'O clima entre os colegas é leve e colaborativo.',
];

// Padrões fixos de nota (1 a 5) para as primeiras perguntas de escala
// cadastradas, pensados pra sempre resultar em uma média baixa (vermelho),
// uma média mediana (amarelo) e uma média alta (verde) — assim, ao
// apresentar pro professor, os três níveis de cor aparecem de uma vez nos
// gráficos, sem depender de sorte no random. Se houver mais de 3 perguntas
// de escala, as demais continuam usando notas aleatórias normalmente.
const DEMO_SCALE_PATTERNS = [
  [2, 3, 4, 3, 2, 4, 3, 3, 4, 2], // média 3.0 → "Atenção moderada" (amarelo)
  [1, 2, 3, 2, 1, 3, 2, 2, 3, 2], // média 2.1 → "Precisa de ação" (vermelho)
  [5, 4, 5, 4, 5, 4, 5, 4, 5, 4], // média 4.5 → "Ponto forte" (verde)
];

// Gera ~10 respostas fictícias para as perguntas já cadastradas, marcadas
// com "demo: true" para nunca se misturarem com respostas reais.
function generateDemoResponses(){
  if(state.questions.length === 0){
    alert('Cadastre pelo menos uma pergunta antes de gerar respostas de demonstração.');
    return;
  }

  // Mapeia cada pergunta de escala à sua posição entre as perguntas de
  // escala (0ª, 1ª, 2ª...), na ordem em que aparecem no formulário — é
  // essa posição que decide se ela usa um padrão fixo ou nota aleatória.
  let scaleIndex = 0;
  const scalePosition = {};
  state.questions.forEach(q => {
    if(q.type === 'scale'){
      scalePosition[q.id] = scaleIndex;
      scaleIndex++;
    }
  });

  const NUM_DEMO = 10;

  // Pra cada pergunta de texto, decide de antemão QUAIS das 10 respostas
  // vão vir preenchidas (as outras ficam em branco, pra parecer mais real)
  // e sorteia um exemplo DIFERENTE pra cada uma — embaralhando a lista em
  // vez de sortear índice aleatório toda vez. Assim nunca sai a mesma frase
  // duas vezes dentro da mesma pergunta.
  const textPlan = {}; // qid -> { índiceDaResposta: frase }
  state.questions.forEach(q => {
    if(q.type !== 'text') return;
    const filledIndexes = [];
    for(let i = 0; i < NUM_DEMO; i++){
      if(Math.random() < 0.85) filledIndexes.push(i);
    }
    // Embaralha o banco de frases; se precisar de mais preenchidas do que
    // frases disponíveis, embaralha de novo (evitando repetir a última usada
    // logo em seguida) em vez de voltar ao sorteio aleatório simples.
    let pool = shuffleArray(DEMO_TEXT_SAMPLES);
    const plan = {};
    filledIndexes.forEach((respIdx, k) => {
      if(k > 0 && k % pool.length === 0){
        let next;
        do { next = shuffleArray(DEMO_TEXT_SAMPLES); }
        while(next[0] === pool[pool.length - 1]);
        pool = pool.concat(next);
      }
      plan[respIdx] = pool[k];
    });
    textPlan[q.id] = plan;
  });

  for(let i = 0; i < NUM_DEMO; i++){
    const answers = {};
    state.questions.forEach(q => {
      if(q.type === 'scale'){
        const pos = scalePosition[q.id];
        const pattern = DEMO_SCALE_PATTERNS[pos];
        answers[q.id] = pattern ? pattern[i] : 1 + Math.floor(Math.random() * 5);
      } else {
        const text = textPlan[q.id][i];
        if(text) answers[q.id] = text;
      }
    });
    state.responses.push({ id: uid(10), answers, demo: true });
  }
  saveData(KEYS.responses, state.responses);
  renderProgressHeader();
  renderResults();
}

// Remove só as respostas marcadas como demonstração, preservando qualquer
// resposta real que já tenha sido coletada.
function clearDemoResponses(){
  const hasDemo = state.responses.some(r => r.demo);
  if(!hasDemo) return;
  state.responses = state.responses.filter(r => !r.demo);
  saveData(KEYS.responses, state.responses);
  renderProgressHeader();
  renderResults();
}

/* =========================================================================
   TELA: FORMULÁRIO DO FUNCIONÁRIO
========================================================================= */
function renderEmployeeQuestions(){
  const container = document.getElementById('employee-questions');
  const qs = state.questions;

  if(qs.length === 0){
    container.innerHTML = '<div class="empty-state">Nenhuma pergunta foi cadastrada ainda.</div>';
    document.getElementById('btn-submit-feedback').classList.add('hidden');
    return;
  }
  document.getElementById('btn-submit-feedback').classList.remove('hidden');

  container.innerHTML = qs.map(q => `
    <div class="field" id="field-${q.id}">
      <label style="color:var(--ink);font-size:14.5px;">${escapeHtml(q.text)}</label>
      ${q.type === 'scale' ? `
        <div class="scale-btns" id="scale-${q.id}" role="radiogroup" aria-label="${escapeHtml(q.text)}">
          ${[1,2,3,4,5].map(n => `<div class="scale-btn" role="radio" aria-checked="false" tabindex="0" onclick="setScaleAnswer('${q.id}', ${n})" onkeydown="handleScaleKeydown(event, '${q.id}', ${n})">${n}</div>`).join('')}
        </div>
        <div class="scale-hint"><span>Discordo totalmente</span><span>Concordo totalmente</span></div>
      ` : `
        <textarea rows="3" placeholder="Escreva sua resposta..." oninput="setTextAnswer('${q.id}', this.value)"></textarea>
      `}
    </div>
  `).join('');
}

// Permite responder a pergunta de escala pelo teclado: Enter/Espaço seleciona
// o botão focado; setas movem o foco entre os botões (padrão de radiogroup).
function handleScaleKeydown(e, qid, n){
  if(e.key === 'Enter' || e.key === ' '){
    e.preventDefault();
    setScaleAnswer(qid, n);
    return;
  }
  const group = document.getElementById('scale-' + qid);
  const buttons = [...group.children];
  const idx = buttons.indexOf(e.target);
  if(e.key === 'ArrowRight' || e.key === 'ArrowDown'){
    e.preventDefault();
    buttons[Math.min(idx + 1, buttons.length - 1)].focus();
  } else if(e.key === 'ArrowLeft' || e.key === 'ArrowUp'){
    e.preventDefault();
    buttons[Math.max(idx - 1, 0)].focus();
  }
}

function setScaleAnswer(qid, n){
  state.employeeAnswers[qid] = n;
  // Marca visualmente qual número foi escolhido, sem redesenhar tudo de novo
  const group = document.getElementById('scale-' + qid);
  [...group.children].forEach((btn, i) => {
    const isSelected = i + 1 === n;
    btn.classList.toggle('selected', isSelected);
    btn.setAttribute('aria-checked', String(isSelected));
  });
  // Se essa pergunta estava marcada como faltando, remove o destaque de erro
  const field = document.getElementById('field-' + qid);
  if(field) field.classList.remove('field-error');
}
function setTextAnswer(qid, val){
  state.employeeAnswers[qid] = val;
}

function submitEmployeeForm(){
  const missingQuestions = state.questions.filter(q => q.type === 'scale' && !state.employeeAnswers[q.id]);

  // Limpa destaques de erro de uma tentativa anterior antes de reavaliar
  state.questions.forEach(q => {
    const field = document.getElementById('field-' + q.id);
    if(field) field.classList.remove('field-error');
  });

  if(missingQuestions.length > 0){
    missingQuestions.forEach(q => {
      const field = document.getElementById('field-' + q.id);
      if(field) field.classList.add('field-error');
    });
    const errorBox = document.getElementById('submit-error');
    errorBox.textContent = missingQuestions.length === 1
      ? 'Falta responder a pergunta destacada abaixo antes de enviar.'
      : `Faltam responder ${missingQuestions.length} perguntas destacadas abaixo antes de enviar.`;
    document.getElementById('field-' + missingQuestions[0].id)
      .scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  document.getElementById('submit-error').textContent = '';

  // Modo de teste: o RH está só espiando o formulário. Não grava resposta
  // nenhuma nem marca o dispositivo como respondido — só volta pro painel.
  if(state.testMode){
    backToPanelFromTest();
    const feedback = document.getElementById('copy-feedback');
    if(feedback){
      feedback.textContent = 'Teste concluído — nenhuma resposta foi salva.';
      setTimeout(() => { feedback.textContent = ''; }, 3000);
    }
    return;
  }

  // Grava a resposta SEM nenhuma referência a este dispositivo
  state.responses.push({ id: uid(10), answers: { ...state.employeeAnswers } });
  saveData(KEYS.responses, state.responses);

  // Marca ESTE DISPOSITIVO como "já respondeu" — gravação separada, local,
  // sem nenhuma chave que ligue esse aviso à resposta acima.
  saveData(KEYS.deviceAnswered, true);

  showView('view-employee-thanks');
}

/* =========================================================================
   LIGANDO OS EVENTOS (equivalente a "addEventListener" em vez de onclick
   espalhado, para os botões que já existem fixos no HTML)
========================================================================= */
function setupEventListeners(){
  document.getElementById('btn-goto-hr-login').addEventListener('click', () => showView('view-hr-login'));
  document.getElementById('btn-back-to-landing').addEventListener('click', () => showView('view-landing'));
  document.getElementById('btn-hr-login').addEventListener('click', tryHrLogin);
  document.getElementById('btn-hr-logout').addEventListener('click', () => showView('view-landing'));

  document.querySelectorAll('.tab').forEach(tabEl => {
    tabEl.addEventListener('click', () => showTab(tabEl.dataset.tab));
  });

  document.getElementById('btn-add-question').addEventListener('click', addQuestion);
  document.getElementById('btn-copy-link').addEventListener('click', copyAccessLink);
  document.getElementById('btn-test-form').addEventListener('click', testEmployeeForm);
  document.getElementById('btn-reset-device').addEventListener('click', resetDeviceAnswered);
  document.getElementById('btn-back-panel-welcome').addEventListener('click', backToPanelFromTest);
  document.getElementById('btn-back-panel-form').addEventListener('click', backToPanelFromTest);
  document.getElementById('btn-submit-feedback').addEventListener('click', submitEmployeeForm);

  document.getElementById('btn-start-form').addEventListener('click', () => showView('view-employee-form'));

  document.getElementById('new-q-text').addEventListener('input', updatePreview);
  document.getElementById('new-q-type').addEventListener('change', updatePreview);
  renderSuggestionChips();

  document.getElementById('btn-clear-questions').addEventListener('click', clearAllQuestions);
  document.getElementById('btn-generate-demo').addEventListener('click', generateDemoResponses);
  document.getElementById('btn-clear-demo').addEventListener('click', clearDemoResponses);
}


/* =========================================================================
   TELA DE BOAS-VINDAS: carrossel de fotos de cachorrinhos
   Troca a imagem automaticamente a cada alguns segundos, com uma legenda
   gentil variando junto. Só para dar uma acalmada antes de responder —
   não afeta em nada o feedback enviado.
========================================================================= */
function startPuppyCarousel(){
  const track = document.getElementById('puppy-track');
  if(!track) return;
  const slides = track.querySelectorAll('.puppy-slide');
  const caption = document.getElementById('puppy-caption');
  const captions = [
    'Respire fundo... 🐾',
    'Tudo bem no seu ritmo 🐶',
    'Só mais um segundinho...',
    'Quase pronto(a) pra seguir 🐕',
  ];

  let current = 0;
  setInterval(() => {
    slides[current].classList.remove('active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('active');
    if(caption) caption.textContent = captions[current % captions.length];
  }, 3200);
}

/* ---------- Ponto de entrada: roda assim que a página carrega ---------- */
loadAll();
setupEventListeners();
detectEntry();
startPuppyCarousel();
