/* ══════════════════════════════════════════════════════════════════════
   VoiceAI Agent — Frontend Controller (Vapi Web SDK)
   ══════════════════════════════════════════════════════════════════════ */
import Vapi from 'https://esm.sh/@vapi-ai/web@2';

const API = '';

// ── DOM refs ──────────────────────────────────────────────────────────
const callForm     = document.getElementById('callForm');
const startBtn     = document.getElementById('startCallBtn');
const ctaLabel     = document.getElementById('ctaLabel');
const endBtn       = document.getElementById('endCallBtn');

const idleView     = document.getElementById('idleView');
const activeView   = document.getElementById('activeView');
const liveBadge    = document.getElementById('liveBadge');

const gpDot        = document.getElementById('gpDot');
const gpLabel      = document.getElementById('gpLabel');

const cvCenter     = document.getElementById('cvCenter');
const cvr1         = document.getElementById('cvr1');
const cvr2         = document.getElementById('cvr2');
const cvr3         = document.getElementById('cvr3');

const ciScenario   = document.getElementById('ciScenario');
const ciDot        = document.getElementById('ciDot');
const ciLabel      = document.getElementById('ciLabel');
const ciTimer      = document.getElementById('ciTimer');

const waveform     = document.getElementById('waveform');
const chatMessages = document.getElementById('chatMessages');
const chatCount    = document.getElementById('chatCount');

const pipeNodes = {
  vapi: { icon: document.querySelector('.ps-vapi'), dot: document.getElementById('psd-vapi') },
  stt:  { icon: document.querySelector('.ps-stt'),  dot: document.getElementById('psd-stt')  },
  llm:  { icon: document.querySelector('.ps-llm'),  dot: document.getElementById('psd-llm')  },
  tts:  { icon: document.querySelector('.ps-tts'),  dot: document.getElementById('psd-tts')  },
};
const pipeLines = [
  document.getElementById('psl-1'),
  document.getElementById('psl-2'),
  document.getElementById('psl-3'),
];

// ── App state ─────────────────────────────────────────────────────────
let selectedScenario = null;
let durationTimer    = null;
let startTs          = null;
let msgCount         = 0;
let vapiInstance     = null;

// ── Scenario card selection ───────────────────────────────────────────
document.querySelectorAll('.sc-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.sc-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    card.querySelector('input[type="radio"]').checked = true;
    selectedScenario = card.querySelector('input').value;
    document.querySelectorAll('.detail-block').forEach(b => b.classList.add('hidden'));
    document.getElementById(`fields-${selectedScenario}`)?.classList.remove('hidden');
    validate();
  });
});

function validate() {
  startBtn.disabled = !selectedScenario;
}

// ── Helpers ───────────────────────────────────────────────────────────
const val = id => document.getElementById(id)?.value.trim() || '';

function toAMPM(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

function collectDetails(type) {
  if (type === 'appointment_reminder') return {
    patient_name:     val('ar-patientName')     || 'the patient',
    appointment_date: val('ar-appointmentDate') || 'your scheduled date',
    appointment_time: toAMPM(val('ar-appointmentTime')) || 'your scheduled time',
    doctor_name:      val('ar-doctorName')      || 'your doctor',
    department:       val('ar-department')      || 'General Medicine',
    clinic_name:      val('ar-clinicName')      || 'HealthFirst Medical Center',
  };
  if (type === 'lead_qualification') return {
    lead_name:        val('lq-leadName')        || 'the prospect',
    product_interest: val('lq-productInterest') || 'our solution',
    company_name:     val('lq-companyName')     || 'our company',
  };
  return {};
}

// ── Toast ─────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '❌' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Pipeline helpers ──────────────────────────────────────────────────
function setPipelineActive(on) {
  Object.values(pipeNodes).forEach(({ icon, dot }) => {
    icon?.classList.toggle('active', on);
    dot?.classList.toggle('active', on);
  });
  pipeLines.forEach(l => l?.classList.toggle('flowing', on));
  document.querySelectorAll('.sb').forEach(b => b.classList.toggle('active', on));
}

// ── Form submit ───────────────────────────────────────────────────────
callForm.addEventListener('submit', async e => {
  e.preventDefault();
  startBtn.disabled = true;
  ctaLabel.textContent = 'Connecting…';

  try {
    // Fetch assistant config + public key from backend
    const res = await fetch(`${API}/api/calls/web-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario_type:    selectedScenario,
        scenario_details: collectDetails(selectedScenario),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const { public_key, assistant } = await res.json();

    // Start Vapi web call
    vapiInstance = new Vapi(public_key);
    bindVapiEvents();
    await vapiInstance.start(assistant);

    activateView(selectedScenario);
    toast('AI agent connected — allow microphone access if prompted', 'success');
  } catch (err) {
    toast(`Failed: ${err.message}`, 'error');
    startBtn.disabled = false;
    ctaLabel.textContent = 'Initiate Call';
    vapiInstance = null;
  }
});

// ── Vapi SDK event bindings ───────────────────────────────────────────
function bindVapiEvents() {
  vapiInstance.on('call-start', () => {
    applyStatus('in_progress');
    setPipelineActive(true);
  });

  vapiInstance.on('call-end', () => {
    teardown('Completed');
  });

  vapiInstance.on('error', err => {
    console.error('Vapi error:', err);
    toast(`Agent error: ${err?.message || String(err)}`, 'error');
    teardown('Failed');
  });

  vapiInstance.on('message', msg => {
    // Final transcript line
    if (msg.type === 'transcript' && msg.transcriptType === 'final') {
      addMessage(msg.role === 'assistant' ? 'assistant' : 'user', msg.transcript);
    }
    // Waveform reflects agent speaking
    if (msg.type === 'speech-update') {
      const agentSpeaking = msg.role === 'assistant' && msg.status === 'started';
      waveform.classList.toggle('visible', agentSpeaking);
    }
  });
}

// ── End call ─────────────────────────────────────────────────────────
endBtn.addEventListener('click', () => {
  if (vapiInstance) {
    try { vapiInstance.stop(); } catch (_) {}
  }
  toast('Call ended by user.', 'info');
  teardown('Ended by user');
});

// ── Activate live view ────────────────────────────────────────────────
function activateView(scenario) {
  startTs  = Date.now();
  msgCount = 0;

  idleView.classList.add('hidden');
  activeView.classList.remove('hidden');
  liveBadge.classList.remove('hidden');

  ciScenario.textContent = scenario.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  chatMessages.innerHTML = '<div class="chat-empty"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Connecting…</div>';
  chatCount.textContent = '0 exchanges';

  applyState('ringing', 'ringing');
  setGlobal('ringing', 'Connecting…');

  clearInterval(durationTimer);
  durationTimer = setInterval(() => {
    const s = Math.floor((Date.now() - startTs) / 1000);
    ciTimer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
}

// ── State machine ─────────────────────────────────────────────────────
const STATE_CFG = {
  ringing:     { dot: 'ringing', label: 'Connecting…', ring: 'ringing', global: 'ringing', globalLabel: 'Connecting…'  },
  in_progress: { dot: 'active',  label: 'Active',       ring: 'active',  global: 'active',  globalLabel: 'Call Active'  },
  completed:   { dot: 'done',    label: 'Completed',    ring: '',        global: 'done',    globalLabel: 'Ready'        },
  failed:      { dot: 'failed',  label: 'Failed',       ring: '',        global: 'done',    globalLabel: 'Ready'        },
};

function applyStatus(status) {
  const cfg = STATE_CFG[status] || STATE_CFG.completed;
  applyState(cfg.dot, cfg.ring);
  ciLabel.textContent = cfg.label;
  setGlobal(cfg.global, cfg.globalLabel);
  waveform.classList.toggle('visible', status === 'in_progress');
  if (status === 'in_progress') cvCenter.classList.add('active');
}

function applyState(dotClass, ringClass = '') {
  ciDot.className = `ci-dot ${dotClass}`;
  cvr1.className  = `cv-ring cvr-1 ${ringClass}`;
  cvr2.className  = `cv-ring cvr-2 ${ringClass}`;
  cvr3.className  = `cv-ring cvr-3 ${ringClass}`;
}

function setGlobal(dotClass, label) {
  gpDot.className  = `gp-dot ${dotClass}`;
  gpLabel.textContent = label;
}

// ── Add a single chat message ─────────────────────────────────────────
function addMessage(role, content) {
  if (!content?.trim()) return;
  chatMessages.querySelector('.chat-empty')?.remove();

  const cls  = role === 'assistant' ? 'agent' : 'customer';
  const name = role === 'assistant' ? 'AI Agent' : 'You';

  const wrap = document.createElement('div');
  wrap.className = `msg ${cls}`;

  const roleEl = document.createElement('span');
  roleEl.className = 'msg-role';
  roleEl.textContent = name;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = content;

  wrap.append(roleEl, bubble);
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  msgCount++;
  const exchanges = Math.floor(msgCount / 2);
  chatCount.textContent = `${exchanges} exchange${exchanges !== 1 ? 's' : ''}`;
}

// ── Teardown ──────────────────────────────────────────────────────────
function teardown(_reason) {
  clearInterval(durationTimer);
  durationTimer = null;

  if (vapiInstance) {
    try { vapiInstance.stop(); } catch (_) {}
    vapiInstance = null;
  }

  applyStatus('completed');
  setPipelineActive(false);
  liveBadge.classList.add('hidden');
  waveform.classList.remove('visible');
  cvCenter.classList.remove('active');
  endBtn.disabled = false;

  setTimeout(() => {
    activeView.classList.add('hidden');
    idleView.classList.remove('hidden');
    startBtn.disabled = false;
    ctaLabel.textContent = 'Initiate Call';
  }, 4500);
}
