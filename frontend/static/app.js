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

// Active call agent name refs
const cvAvatar     = document.getElementById('cvAvatar');
const cvLabel      = document.getElementById('cvLabel');
const ciAgentName  = document.getElementById('ciAgentName');

// Summary card
const summaryCard    = document.getElementById('summaryCard');
const sumOutcome     = document.getElementById('sumOutcome');
const sumNextAction  = document.getElementById('sumNextAction');
const sumSentiment   = document.getElementById('sumSentiment');

// History panel
const historyEmpty     = document.getElementById('historyEmpty');
const historyTableWrap = document.getElementById('historyTableWrap');
const historyBody      = document.getElementById('historyBody');
const historyCountEl   = document.getElementById('historyCount');

const pipeNodes = {
  call:   { icon: document.querySelector('.ps-call'),   dot: document.getElementById('psd-call')   },
  listen: { icon: document.querySelector('.ps-listen'), dot: document.getElementById('psd-listen') },
  think:  { icon: document.querySelector('.ps-think'),  dot: document.getElementById('psd-think')  },
  speak:  { icon: document.querySelector('.ps-speak'),  dot: document.getElementById('psd-speak')  },
};
const pipeLines = [
  document.getElementById('psl-1'),
  document.getElementById('psl-2'),
  document.getElementById('psl-3'),
];

// Business profile + preset refs
const presetSelect = document.getElementById('presetSelect');
const bizName      = document.getElementById('bizName');
const bizKnowledge = document.getElementById('bizKnowledge');

// Calendar refs
const calendarGrid    = document.getElementById('calendarGrid');
const calendarDateEl  = document.getElementById('calendarDate');
const calBookingCount = document.getElementById('calBookingCount');

// ── App state ─────────────────────────────────────────────────────────
let selectedScenario = null;
let durationTimer    = null;
let startTs          = null;
let msgCount         = 0;
let vapiInstance     = null;
let callTranscript   = [];
let callHistory      = [];
let callActive       = false;   // guards teardown so a call is logged only once
let calendar         = [];      // today's bookable time slots

// ── Scenario card selection ───────────────────────────────────────────
function selectScenario(value) {
  selectedScenario = value;
  document.querySelectorAll('.sc-card').forEach(c => {
    const isMatch = c.querySelector('input').value === value;
    c.classList.toggle('selected', isMatch);
    c.querySelector('input[type="radio"]').checked = isMatch;
  });
  document.querySelectorAll('.detail-block').forEach(b => b.classList.add('hidden'));
  document.getElementById(`fields-${value}`)?.classList.remove('hidden');
  validate();
}

document.querySelectorAll('.sc-card').forEach(card => {
  card.addEventListener('click', () => selectScenario(card.querySelector('input').value));
});

function validate() {
  startBtn.disabled = !selectedScenario;
}

// ── Business presets (one-click demo fill) ────────────────────────────
const PRESETS = {
  dental: {
    goal: 'appointment_reminder',
    business_name: 'BrightSmile Dental Clinic',
    knowledge_base:
`Services: Teeth cleaning, fillings, whitening, Invisalign, root canal, dental implants
Hours: Mon–Fri 9AM–6PM, Sat 9AM–1PM, closed Sunday
Location: 123 Main Street, Suite 200, Downtown
Insurance: Accepts Blue Cross, Aetna, Cigna, Delta Dental
Pricing: Cleaning $90, Whitening from $350, Invisalign from $3,500
Cancellation: Free rescheduling up to 24 hours before the appointment
New patients welcome — first consultation is free.`,
    appt: { name: 'John Smith', date: '', time: '10:00', provider: 'Dr. Sarah Johnson', service: 'Teeth Cleaning' },
    lead: { name: 'Emily Carter', interest: 'Invisalign treatment' },
  },
  medical: {
    goal: 'appointment_reminder',
    business_name: 'HealthFirst Medical Center',
    knowledge_base:
`Departments: General Medicine, Cardiology, Pediatrics, Dermatology, Orthopedics
Hours: Mon–Sat 8AM–8PM, Emergency 24/7
Location: 456 Wellness Avenue, Medical District
Insurance: Most major providers accepted including Medicare and Medicaid
Parking: Free patient parking available on-site
Please bring your insurance card and a photo ID to every appointment.`,
    appt: { name: 'Michael Brown', date: '', time: '14:30', provider: 'Dr. Patel', service: 'Cardiology Consultation' },
    lead: { name: 'Lisa Wong', interest: 'annual health checkup package' },
  },
  saas: {
    goal: 'lead_qualification',
    business_name: 'CloudFlow CRM',
    knowledge_base:
`Product: CloudFlow is an all-in-one CRM for small and mid-size businesses
Pricing: Starter $49/mo (5 users), Pro $99/mo (20 users), Enterprise custom
Free trial: 14 days, no credit card required
Key features: Lead tracking, automated follow-ups, sales analytics, email integration
Integrations: Gmail, Outlook, Slack, Zapier, QuickBooks
Onboarding: Free guided setup and data migration for all plans.`,
    appt: { name: 'David Lee', date: '', time: '11:00', provider: 'Solutions Team', service: 'Product Demo' },
    lead: { name: 'Jane Doe', interest: 'CloudFlow CRM for her sales team' },
  },
  realestate: {
    goal: 'lead_qualification',
    business_name: 'Prime Realty',
    knowledge_base:
`Services: Residential buying & selling, property management, rental listings
Areas served: Downtown, Westside, Lakeview, and surrounding suburbs
Commission: 2.5% on home sales, competitive rates for sellers
Current listings: Condos from $250K, family homes from $480K
Free home valuation for sellers, no obligation
Office hours: Mon–Sat 9AM–7PM. Virtual tours available on request.`,
    appt: { name: 'Robert Davis', date: '', time: '16:00', provider: 'Agent Maria Lopez', service: 'Property Viewing' },
    lead: { name: 'Tom Wilson', interest: 'buying a 3-bedroom family home' },
  },
  salon: {
    goal: 'appointment_reminder',
    business_name: 'Luxe Beauty Salon & Spa',
    knowledge_base:
`Services: Haircut & styling, hair coloring, manicure/pedicure, facials, massage, spa packages
Hours: Tue–Sun 10AM–8PM, closed Monday
Location: 789 Elegance Boulevard, Uptown
Pricing: Haircut from $45, Color from $120, Spa packages from $180
Booking: Walk-ins welcome but appointments recommended on weekends
Cancellation: Please give 12 hours notice to avoid a fee. First-time clients get 15% off.`,
    appt: { name: 'Sophia Martinez', date: '', time: '15:00', provider: 'Stylist Anna', service: 'Hair Color & Cut' },
    lead: { name: 'Rachel Green', interest: 'a weekend spa package' },
  },
  homeservices: {
    goal: 'appointment_reminder',
    business_name: 'SwiftFix Home Services',
    knowledge_base:
`Services: AC repair & install, heating, plumbing, drain cleaning, water heaters, electrical
Hours: Mon–Sat 7AM–7PM, 24/7 emergency service available
Service area: Greater metro area within 30 miles
Pricing: Service call/diagnostic $89 (waived if you book the repair), upfront flat-rate quotes
Emergency: After-hours emergency call-out $149
Warranty: 1-year warranty on all parts and labor. Licensed and insured.`,
    appt: { name: 'Mark Thompson', date: '', time: '09:00', provider: 'Technician Carlos', service: 'AC Maintenance Visit' },
    lead: { name: 'Karen Hill', interest: 'a quote for a new AC unit installation' },
  },
  legal: {
    goal: 'lead_qualification',
    business_name: 'Sterling Legal Associates',
    knowledge_base:
`Practice areas: Personal injury, family law, criminal defense, estate planning, business law
Consultation: Free 20-minute initial consultation, in-person or by phone
Hours: Mon–Fri 9AM–5:30PM
Location: 200 Justice Plaza, Suite 1500, Downtown
Fees: Personal injury cases handled on a no-win, no-fee basis; other matters quoted per case
Languages: English and Spanish. Over 20 years of combined experience.`,
    appt: { name: 'James Anderson', date: '', time: '13:00', provider: 'Attorney Rebecca Stern', service: 'Case Consultation' },
    lead: { name: 'Daniel Moore', interest: 'a personal injury claim after a car accident' },
  },
  fitness: {
    goal: 'lead_qualification',
    business_name: 'PowerHouse Fitness',
    knowledge_base:
`Services: Gym membership, group classes (HIIT, yoga, spin), personal training, nutrition coaching
Hours: Mon–Fri 5AM–11PM, Sat–Sun 7AM–9PM
Location: 50 Energy Street, Midtown
Membership: Basic $39/mo, Premium $69/mo (includes classes), Personal training from $45/session
Free trial: 7-day free pass for new members, no commitment
Amenities: Sauna, locker rooms, free parking. First month 50% off this quarter.`,
    appt: { name: 'Olivia Bennett', date: '', time: '18:00', provider: 'Trainer Mike', service: 'Free Trial Session' },
    lead: { name: 'Chris Taylor', interest: 'a gym membership with personal training' },
  },
};

presetSelect.addEventListener('change', () => {
  const p = PRESETS[presetSelect.value];
  if (!p) return;

  // Section 1 — shared business profile
  bizName.value      = p.business_name;
  bizKnowledge.value = p.knowledge_base;

  // Pre-fill BOTH goals' details so the user can switch freely
  document.getElementById('ar-patientName').value     = p.appt.name;
  document.getElementById('ar-appointmentDate').value = p.appt.date;
  document.getElementById('ar-appointmentTime').value = p.appt.time;
  document.getElementById('ar-doctorName').value      = p.appt.provider;
  document.getElementById('ar-department').value      = p.appt.service;
  document.getElementById('lq-leadName').value        = p.lead.name;
  document.getElementById('lq-productInterest').value = p.lead.interest;

  // Auto-select the best-fit goal
  selectScenario(p.goal);
  toast(`Loaded "${p.business_name}" — ready to call!`, 'success');
});

// ── Helpers ───────────────────────────────────────────────────────────
const val = id => document.getElementById(id)?.value.trim() || '';

function toAMPM(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

function collectDetails(type) {
  // Shared business profile (Section 1) injected into every call
  const shared = {
    business_name:  val('bizName') || 'our business',
    knowledge_base: val('bizKnowledge'),
  };

  if (type === 'appointment_reminder') return {
    ...shared,
    patient_name:     val('ar-patientName')     || 'the customer',
    appointment_date: val('ar-appointmentDate') || 'your scheduled date',
    appointment_time: toAMPM(val('ar-appointmentTime')) || 'your scheduled time',
    doctor_name:      val('ar-doctorName')      || 'our team',
    department:       val('ar-department')      || 'your appointment',
  };
  if (type === 'lead_qualification') return {
    ...shared,
    lead_name:        val('lq-leadName')        || 'the prospect',
    product_interest: val('lq-productInterest') || 'our solution',
  };
  if (type === 'booking_assistant') return {
    ...shared,
    today_label:     todayLabel(),
    business_hours:  '9:00 AM to 6:00 PM',
    available_slots: calendar.filter(s => s.status === 'free').map(s => s.label).join(', ') || 'none',
    booked_slots:    calendar.filter(s => s.status === 'booked').map(s => s.label).join(', ') || 'none',
  };
  return shared;
}

// ── Live Booking Calendar ─────────────────────────────────────────────
const BIZ_START = 9, BIZ_END = 18;   // 9 AM → 6 PM (last slot 5 PM)

function hourLabel(h) {
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:00 ${ap}`;
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function initCalendar() {
  calendar = [];
  for (let h = BIZ_START; h < BIZ_END; h++) {
    calendar.push({ time24: `${String(h).padStart(2, '0')}:00`, label: hourLabel(h), status: 'free', customer: '', service: '' });
  }
  // Pre-seed a couple of bookings so the calendar looks live from the start
  seedBooked('11:00', 'Existing Client', 'Consultation');
  seedBooked('15:00', 'Existing Client', 'Follow-up');
  calendarDateEl.textContent = todayLabel();
  renderCalendar();
}

function seedBooked(time24, customer, service) {
  const slot = calendar.find(s => s.time24 === time24);
  if (slot) { slot.status = 'booked'; slot.customer = customer; slot.service = service; }
}

function renderCalendar(highlight = null) {
  calendarGrid.innerHTML = calendar.map(s => `
    <div class="cal-slot ${s.status}${s.time24 === highlight ? ' just-booked' : ''}">
      <span class="cal-time">${s.label}</span>
      <span class="cal-status">${s.status === 'booked' ? s.customer : 'Available'}</span>
      ${s.status === 'booked' && s.service ? `<span class="cal-service">${s.service}</span>` : ''}
    </div>
  `).join('');
  const booked = calendar.filter(s => s.status === 'booked').length;
  calBookingCount.textContent = `${booked} booked today`;
}

// Map an AI-spoken time ("2 PM", "2:00 PM", "14:00") to an hourly slot key
function parseToTime24(str) {
  if (!str) return null;
  const m = String(str).toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const ap = m[3];
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:00`;
}

// Called when the AI fires the book_appointment client-side tool
function handleBooking(args) {
  const name    = (args?.customer_name || 'Customer').trim();
  const service = (args?.service || 'Appointment').trim();
  const t24     = parseToTime24(args?.time);

  let slot = calendar.find(s => s.time24 === t24 && s.status === 'free');
  if (!slot) slot = calendar.find(s => s.status === 'free'); // safety fallback
  if (!slot) { toast('Calendar is full — could not book', 'error'); return; }

  slot.status   = 'booked';
  slot.customer = name;
  slot.service  = service;
  renderCalendar(slot.time24);
  toast(`✅ Booked ${name} — ${service} at ${slot.label}`, 'success');
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

// ── Vapi SDK events ───────────────────────────────────────────────────
function bindVapiEvents() {
  vapiInstance.on('call-start', () => {
    applyStatus('in_progress');
    setPipelineActive(true);
  });

  vapiInstance.on('call-end', () => {
    teardown('completed');
  });

  vapiInstance.on('error', err => {
    console.error('Vapi error:', err);
    toast(`Agent error: ${err?.message || String(err)}`, 'error');
    teardown('failed');
  });

  vapiInstance.on('message', msg => {
    if (msg.type === 'transcript' && msg.transcriptType === 'final') {
      const role = msg.role === 'assistant' ? 'assistant' : 'user';
      addMessage(role, msg.transcript);
      callTranscript.push({ role, content: msg.transcript });
    }
    if (msg.type === 'speech-update') {
      waveform.classList.toggle('visible', msg.role === 'assistant' && msg.status === 'started');
    }
    // Client-side tool call → update the live calendar
    if (msg.type === 'tool-calls' || msg.type === 'function-call') {
      const calls = msg.toolCalls || msg.toolCallList ||
                    (msg.functionCall ? [{ function: msg.functionCall }] : []);
      for (const c of calls) {
        const fn = c.function || c;
        if (fn?.name === 'book_appointment') {
          let a = fn.arguments ?? fn.parameters;
          if (typeof a === 'string') { try { a = JSON.parse(a); } catch { a = {}; } }
          handleBooking(a);
        }
      }
    }
  });
}

// ── End call ─────────────────────────────────────────────────────────
endBtn.addEventListener('click', () => {
  if (vapiInstance) {
    try { vapiInstance.stop(); } catch (_) {}
  }
  toast('Call ended by user.', 'info');
  teardown('ended_by_user');
});

// ── Activate live view ────────────────────────────────────────────────
const AGENT_PERSONAS = {
  appointment_reminder: { name: 'Emma',   initial: 'E', title: 'Scheduling Coordinator' },
  lead_qualification:   { name: 'Olivia', initial: 'O', title: 'Sales Representative' },
  booking_assistant:    { name: 'Sarah',  initial: 'S', title: 'AI Receptionist' },
};

function activateView(scenario) {
  startTs        = Date.now();
  msgCount       = 0;
  callTranscript = [];
  callActive     = true;

  // Set agent persona
  const persona = AGENT_PERSONAS[scenario] || { name: 'AI Agent', initial: 'A', title: 'Agent' };
  cvAvatar.textContent     = persona.initial;
  cvLabel.textContent      = persona.title;
  ciAgentName.textContent  = `${persona.name} — ${persona.title}`;

  summaryCard.classList.add('hidden');
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
  ringing:      { dot:'ringing', label:'Connecting…', ring:'ringing', global:'ringing', globalLabel:'Connecting…' },
  in_progress:  { dot:'active',  label:'Active',       ring:'active',  global:'active',  globalLabel:'Call Active'  },
  completed:    { dot:'done',    label:'Completed',    ring:'',        global:'done',    globalLabel:'Ready'        },
  failed:       { dot:'failed',  label:'Failed',       ring:'',        global:'done',    globalLabel:'Ready'        },
  ended_by_user:{ dot:'done',    label:'Ended',        ring:'',        global:'done',    globalLabel:'Ready'        },
};

function applyStatus(status) {
  const cfg = STATE_CFG[status] || STATE_CFG.completed;
  applyState(cfg.dot, cfg.ring);
  ciLabel.textContent = cfg.label;
  setGlobal(cfg.global, cfg.globalLabel);
  if (status !== 'in_progress') waveform.classList.remove('visible');
  if (status === 'in_progress') cvCenter.classList.add('active');
}

function applyState(dotClass, ringClass = '') {
  ciDot.className = `ci-dot ${dotClass}`;
  cvr1.className  = `cv-ring cvr-1 ${ringClass}`;
  cvr2.className  = `cv-ring cvr-2 ${ringClass}`;
  cvr3.className  = `cv-ring cvr-3 ${ringClass}`;
}

function setGlobal(dotClass, label) {
  gpDot.className     = `gp-dot ${dotClass}`;
  gpLabel.textContent = label;
}

// ── Chat messages ─────────────────────────────────────────────────────
function addMessage(role, content) {
  if (!content?.trim()) return;
  chatMessages.querySelector('.chat-empty')?.remove();

  const cls  = role === 'assistant' ? 'agent' : 'customer';
  const name = role === 'assistant' ? 'AI Agent' : 'Caller';

  const wrap   = document.createElement('div');
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

// ── Call summary generation (rule-based, no API needed) ───────────────
function generateSummary(scenario, transcript) {
  const text = transcript.map(m => m.content).join(' ').toLowerCase();

  let outcome    = 'Call completed';
  let nextAction = 'No action required';
  let sentiment  = 'neutral';

  if (scenario.includes('appointment')) {
    if (text.includes('reschedule') || text.includes('new time')) {
      outcome    = 'Customer requested reschedule';
      nextAction = 'Office to call back with new time';
    } else if (text.includes('cancel')) {
      outcome    = 'Customer cancelled appointment';
      nextAction = 'Update scheduling system';
      sentiment  = 'negative';
    } else if (/confirm|attend|yes|will be there/.test(text)) {
      outcome    = 'Customer confirmed appointment';
      nextAction = 'Send 24-hour reminder';
      sentiment  = 'positive';
    }
  } else if (scenario.includes('lead')) {
    if (/demo|schedule|interest|yes|love/.test(text)) {
      outcome    = 'Lead qualified — demo requested';
      nextAction = 'Schedule product demo';
      sentiment  = 'positive';
    } else if (/not interested|no thank|busy/.test(text)) {
      outcome    = 'Lead not interested';
      nextAction = 'Mark as disqualified in CRM';
      sentiment  = 'negative';
    } else {
      outcome    = 'Lead partially qualified';
      nextAction = 'Follow up with more information';
    }
  } else if (scenario.includes('booking')) {
    if (/book|confirmed|scheduled|see you|all set/.test(text)) {
      outcome    = 'Appointment booked';
      nextAction = 'Added to calendar — send confirmation';
      sentiment  = 'positive';
    } else {
      outcome    = 'Booking call handled';
      nextAction = 'Review calendar';
    }
  }

  // Refine sentiment from overall tone
  const positives = (text.match(/thank|great|wonder|perfect|yes|confirm|interest|love|happy/g) || []).length;
  const negatives = (text.match(/cancel|not interested|problem|issue|no |wrong|fail/g) || []).length;
  if (sentiment === 'neutral') {
    if (positives > negatives + 1) sentiment = 'positive';
    else if (negatives > positives) sentiment = 'negative';
  }

  return { outcome, nextAction, sentiment };
}

function showSummary(scenario) {
  if (callTranscript.length === 0) return;
  const { outcome, nextAction, sentiment } = generateSummary(scenario, callTranscript);

  sumOutcome.textContent    = outcome;
  sumNextAction.textContent = nextAction;
  sumSentiment.textContent  = sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
  sumSentiment.className    = `summary-badge ${sentiment}`;
  summaryCard.classList.remove('hidden');
}

// ── Call history ──────────────────────────────────────────────────────
function saveToHistory(scenario, durationSecs, summary) {
  const entry = {
    scenario,
    duration: `${Math.floor(durationSecs / 60)}:${String(durationSecs % 60).padStart(2, '0')}`,
    outcome:  summary?.outcome    || '—',
    sentiment:summary?.sentiment  || 'neutral',
    nextAction:summary?.nextAction || '—',
    time:     new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
  callHistory.unshift(entry);
  renderHistory();
}

function renderHistory() {
  historyCountEl.textContent = `${callHistory.length} call${callHistory.length !== 1 ? 's' : ''} this session`;
  historyEmpty.classList.add('hidden');
  historyTableWrap.classList.remove('hidden');

  const badgeClass = s =>
    s.includes('appointment') ? 'appt' :
    s.includes('booking')     ? 'booking' : 'lead';

  historyBody.innerHTML = callHistory.map(e => `
    <tr>
      <td><span class="sc-badge ${badgeClass(e.scenario)}">${e.scenario.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></td>
      <td>${e.duration}</td>
      <td style="color:var(--text)">${e.outcome}</td>
      <td><span class="summary-badge ${e.sentiment}">${e.sentiment.charAt(0).toUpperCase()+e.sentiment.slice(1)}</span></td>
      <td>${e.nextAction}</td>
      <td style="color:var(--text-3)">${e.time}</td>
    </tr>
  `).join('');
}

// ── Teardown ──────────────────────────────────────────────────────────
function teardown(reason) {
  if (!callActive) return;   // already torn down — ignore duplicate call-end/error events
  callActive = false;

  clearInterval(durationTimer);
  const durationSecs = Math.floor((Date.now() - (startTs || Date.now())) / 1000);
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

  // Show summary and save history
  const summary = generateSummary(selectedScenario || '', callTranscript);
  showSummary(selectedScenario || '');
  saveToHistory(selectedScenario || 'unknown', durationSecs, summary);

  setTimeout(() => {
    summaryCard.classList.add('hidden');
    activeView.classList.add('hidden');
    idleView.classList.remove('hidden');
    startBtn.disabled = false;
    ctaLabel.textContent = 'Initiate Call';
  }, 5000);
}

// ── Init ──────────────────────────────────────────────────────────────
initCalendar();
