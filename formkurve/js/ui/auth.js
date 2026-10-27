// Anmeldung, Konto anlegen, PIN vergessen und die ersten Schritte nach dem Anlegen.
import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { state, update, authGo, createAccount, signIn, recoverAccount, tryDemo, finishOnboarding, useCurrentLocation, saveSettings, toast } from './state.js';
import { Icon } from './icons.js';

function Brand({ sub }) {
  return html`<div class="auth-brand">
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0c0f14" />
      <path d="M 18.1 46 A 20 20 0 1 1 49.3 23.3" fill="none" stroke="#eef2f6" stroke-width="5.5" stroke-linecap="round" />
      <path d="M 49.3 23.3 A 20 20 0 0 1 45.9 46" fill="none" stroke="#262f3b" stroke-width="5.5" stroke-linecap="round" />
      <circle cx="49.3" cy="23.3" r="4.6" fill="#d95926" stroke="#0c0f14" stroke-width="2" />
    </svg>
    <h1>Formkurve</h1>
    ${sub ? html`<p class="ink2">${sub}</p>` : null}
  </div>`;
}

function Avatar({ a, size = 40 }) {
  return html`<span class="avatar" style=${`--c:${a.color};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px`} aria-hidden="true">${(a.name || '?').slice(0, 1).toUpperCase()}</span>`;
}

function PinField({ id, label, value, onInput, autoFocus }) {
  const ref = useRef(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, []);
  return html`<label class="field-label" for=${id}>${label}
    <input ref=${ref} id=${id} class="field pin" type="password" inputmode="numeric" autocomplete="off" pattern="[0-9]*" maxlength="8" value=${value}
      onInput=${(e) => onInput(e.currentTarget.value.replace(/\D/g, '').slice(0, 8))} />
  </label>`;
}

function Remember({ value, onChange }) {
  return html`<label class="check-row"><input type="checkbox" checked=${value} onChange=${(e) => onChange(e.currentTarget.checked)} /> Auf diesem Gerät angemeldet bleiben</label>`;
}

function Welcome() {
  const list = state.accounts;
  return html`<div class="auth-card stack">
    <${Brand} sub="Deine Tagesform aus dem Helio Strap. Dein Konto und deine Daten bleiben auf diesem Gerät." />
    ${list.length ? html`<div class="stack">
      <div class="eyebrow">Konten auf diesem Gerät</div>
      ${list.map((a) => html`<button class="account-btn" onClick=${() => authGo('login', a.id)}><${Avatar} a=${a} /><span class="grow">${a.name}</span><${Icon} name="right" size=${18} /></button>`)}
    </div>` : null}
    <button class=${`btn block ${list.length ? '' : 'primary'}`} onClick=${() => authGo('create', null)}><${Icon} name="plus" size=${18} />Neues Konto anlegen</button>
    <button class="linkbtn" style="justify-self:center" onClick=${tryDemo}>Ohne Konto ausprobieren (Beispieldaten)</button>
    <p class="tiny muted center">Freunde öffnen denselben Link auf ihrem eigenen Gerät und legen dort ihr Konto an. Es gibt keinen Server und keine <span class="nowrap">E-Mail-Adresse</span>.</p>
  </div>`;
}

function Create() {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (pin !== pin2) return setErr('Die beiden PINs stimmen nicht überein.');
    try {
      await createAccount(name, pin, remember);
    } catch (x) {
      setErr(x.message);
    }
  };
  return html`<form class="auth-card stack" onSubmit=${submit}>
    <${Brand} sub="Konto anlegen: ein Name und eine PIN genügen." />
    <label class="field-label" for="acc-name">Name
      <input id="acc-name" class="field" autocomplete="nickname" maxlength="24" value=${name} onInput=${(e) => setName(e.currentTarget.value)} placeholder="z. B. Lukas" />
    </label>
    <${PinField} id="acc-pin" label="PIN (4 bis 8 Ziffern)" value=${pin} onInput=${setPin} />
    <${PinField} id="acc-pin2" label="PIN wiederholen" value=${pin2} onInput=${setPin2} />
    <${Remember} value=${remember} onChange=${setRemember} />
    ${err ? html`<p class="small error-text" role="alert">${err}</p>` : null}
    <button class="btn primary block" type="submit" disabled=${!name.trim() || pin.length < 4 || pin2.length < 4}>Konto anlegen</button>
    <p class="tiny muted">Die PIN verschlüsselt deine Daten auf diesem Gerät. Gleich bekommst du einen Wiederherstellungscode für den Fall, dass du die PIN vergisst.</p>
    <button type="button" class="linkbtn" style="justify-self:start" onClick=${() => authGo('welcome')}>Zurück</button>
  </form>`;
}

function Login() {
  const a = state.accounts.find((x) => x.id === state.authAccountId);
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState(null);
  if (!a) return html`<${Welcome} />`;
  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      await signIn(a.id, pin, remember);
    } catch (x) {
      setPin('');
      setErr(x.message);
    }
  };
  return html`<form class="auth-card stack" onSubmit=${submit}>
    <div class="auth-brand"><${Avatar} a=${a} size=${64} /><h1>Hallo ${a.name}</h1></div>
    <${PinField} id="login-pin" label="PIN" value=${pin} onInput=${setPin} autoFocus=${true} />
    <${Remember} value=${remember} onChange=${setRemember} />
    ${err ? html`<p class="small error-text" role="alert">${err}</p>` : null}
    <button class="btn primary block" type="submit" disabled=${pin.length < 4}>Anmelden</button>
    <div class="row between">
      <button type="button" class="linkbtn" onClick=${() => authGo('recover', a.id)}>PIN vergessen?</button>
      <button type="button" class="linkbtn" onClick=${() => authGo('welcome')}>Anderes Konto</button>
    </div>
  </form>`;
}

function Recover() {
  const a = state.accounts.find((x) => x.id === state.authAccountId);
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [err, setErr] = useState(null);
  if (!a) return html`<${Welcome} />`;
  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (pin !== pin2) return setErr('Die beiden PINs stimmen nicht überein.');
    try {
      await recoverAccount(a.id, code, pin, true);
    } catch (x) {
      setErr(x.message);
    }
  };
  return html`<form class="auth-card stack" onSubmit=${submit}>
    <div class="auth-brand"><${Avatar} a=${a} size=${56} /><h1>Neue PIN für ${a.name}</h1></div>
    <label class="field-label" for="rec-code">Wiederherstellungscode
      <input id="rec-code" class="field mono" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" value=${code} onInput=${(e) => setCode(e.currentTarget.value)} />
    </label>
    <${PinField} id="rec-pin" label="Neue PIN (4 bis 8 Ziffern)" value=${pin} onInput=${setPin} />
    <${PinField} id="rec-pin2" label="Neue PIN wiederholen" value=${pin2} onInput=${setPin2} />
    ${err ? html`<p class="small error-text" role="alert">${err}</p>` : null}
    <button class="btn primary block" type="submit" disabled=${code.replace(/[^A-Za-z0-9]/g, '').length < 16 || pin.length < 4}>PIN zurücksetzen</button>
    <p class="tiny muted">Ohne PIN und ohne Code lassen sich die Daten nicht öffnen, auch nicht vom Entwickler. Dann bleibt nur, das Konto zu löschen und neu anzulegen.</p>
    <button type="button" class="linkbtn" style="justify-self:start" onClick=${() => authGo('login', a.id)}>Zurück</button>
  </form>`;
}

export function AuthView() {
  const step = state.authStep;
  return html`<main class="auth">
    ${step === 'create' ? html`<${Create} />` : step === 'login' ? html`<${Login} key=${state.authAccountId} />` : step === 'recover' ? html`<${Recover} />` : html`<${Welcome} />`}
  </main>`;
}

// ---------- Erste Schritte nach dem Anlegen ----------

function CodeStep() {
  const [saved, setSaved] = useState(false);
  const code = state.recoveryCode;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Code kopiert');
    } catch {
      toast('Kopieren nicht möglich. Bitte abschreiben oder Bildschirmfoto machen.', 'error');
    }
  };
  return html`<div class="auth-card stack">
    <div class="steps-dots" aria-hidden="true"><i class="on"></i><i></i><i></i></div>
    <h1 class="auth-title">Dein Wiederherstellungscode</h1>
    <p class="ink2">Brauchst du, wenn du die PIN vergisst. Bewahre ihn sicher auf, zum Beispiel im Passwort-Manager oder in der Notizen-App.</p>
    <div class="code-box" aria-label="Wiederherstellungscode">${code}</div>
    <button class="btn block" onClick=${copy}><${Icon} name="clipboard" size=${18} />Code kopieren</button>
    <label class="check-row"><input type="checkbox" checked=${saved} onChange=${(e) => setSaved(e.currentTarget.checked)} /> Ich habe den Code gesichert</label>
    <button class="btn primary block" disabled=${!saved} onClick=${() => finishOnboarding('code')}>Weiter</button>
  </div>`;
}

function LocationStep() {
  const [err, setErr] = useState(null);
  const allow = async () => {
    setErr(null);
    update({ busy: 'Standort wird abgefragt …' });
    try {
      await useCurrentLocation({ prompt: true });
      toast('Standort gespeichert, Umweltdaten werden geladen');
      finishOnboarding('location');
    } catch (e) {
      setErr(e.message);
    } finally {
      update({ busy: null });
    }
  };
  return html`<div class="auth-card stack">
    <div class="steps-dots" aria-hidden="true"><i class="on"></i><i class="on"></i><i></i></div>
    <h1 class="auth-title">Wetter, Luft und Pollen automatisch</h1>
    <p class="ink2">Mit deinem ungefähren Standort lädt Formkurve Temperatur, Luftfeuchte, Feinstaub und Pollen für deinen Ort. Die Einsichten prüfen dann, ob zum Beispiel warme Nächte deinen Schlaf verändern.</p>
    <ul class="bullets small ink2">
      <li>Gerundet auf etwa 1 km, gespeichert nur auf diesem Gerät.</li>
      <li>Für die Abfrage geht nur diese gerundete Koordinate an Open-Meteo.</li>
      <li>Bist du unterwegs, folgt der Ort automatisch.</li>
    </ul>
    ${err ? html`<p class="small error-text" role="alert">${err}</p>` : null}
    <button class="btn primary block" onClick=${allow}><${Icon} name="location" size=${18} />Standort erlauben</button>
    <button class="linkbtn" style="justify-self:center" onClick=${() => finishOnboarding('location')}>Später</button>
  </div>`;
}

const SEX = [
  { value: 'w', label: 'weiblich' },
  { value: 'm', label: 'männlich' },
  { value: 'd', label: 'divers' },
  { value: 'x', label: 'keine Angabe' },
];

export function ProfileFields({ profile, onChange }) {
  const year = new Date().getFullYear();
  const num = (v, min, max) => {
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  return html`<div class="stack">
    <label class="field-label" for="p-year">Geburtsjahr
      <input id="p-year" class="field" type="number" inputmode="numeric" min=${year - 100} max=${year - 14} placeholder="z. B. 1995" value=${profile.birthYear ?? ''}
        onChange=${(e) => onChange('birthYear', num(e.currentTarget.value, year - 100, year - 14))} />
    </label>
    <div class="field-label">Geschlecht
      <div class="chips" role="radiogroup" aria-label="Geschlecht" style="margin-top:6px">${SEX.map((s) => html`<button type="button" class="chip" aria-pressed=${(profile.sex ?? null) === s.value ? 'true' : 'false'} onClick=${() => onChange('sex', s.value)}>${s.label}</button>`)}</div>
    </div>
    <div class="row" style="gap:10px;align-items:flex-start">
      <label class="field-label grow" for="p-h">Größe (cm)
        <input id="p-h" class="field" type="number" inputmode="numeric" min="120" max="230" value=${profile.heightCm ?? ''} onChange=${(e) => onChange('heightCm', num(e.currentTarget.value, 120, 230))} />
      </label>
      <label class="field-label grow" for="p-w">Gewicht (kg)
        <input id="p-w" class="field" type="number" inputmode="decimal" min="30" max="250" step="0.1" value=${profile.weightKg ?? ''} onChange=${(e) => onChange('weightKg', num(e.currentTarget.value, 30, 250))} />
      </label>
    </div>
  </div>`;
}

function ProfileStep() {
  const [profile, setProfile] = useState({ ...state.repo.settings.profile });
  const save = async () => {
    await saveSettings({ ...state.repo.settings, profile: { ...state.repo.settings.profile, ...profile } });
    finishOnboarding('profile');
  };
  return html`<div class="auth-card stack">
    <div class="steps-dots" aria-hidden="true"><i class="on"></i><i class="on"></i><i class="on"></i></div>
    <h1 class="auth-title">Optional: über dich</h1>
    <p class="ink2">Damit vergleicht die App deine Werte mit passenden Normalwerten, etwa Schlafdauer nach Alter oder deinem Maximalpuls. Alles freiwillig und später unter Daten → Profil änderbar.</p>
    <${ProfileFields} profile=${profile} onChange=${(k, v) => setProfile({ ...profile, [k]: v })} />
    <button class="btn primary block" onClick=${save}>Speichern</button>
    <button class="linkbtn" style="justify-self:center" onClick=${() => finishOnboarding('profile')}>Überspringen</button>
  </div>`;
}

export function OnboardingView() {
  const step = state.onboarding;
  return html`<main class="auth">
    ${step === 'code' ? html`<${CodeStep} />` : step === 'location' ? html`<${LocationStep} />` : html`<${ProfileStep} />`}
  </main>`;
}

export { Avatar };
