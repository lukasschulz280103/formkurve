// Anmeldung, Konto anlegen, PIN vergessen und die ersten Schritte nach dem Anlegen.
import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { state, update, authGo, createAccount, signIn, recoverAccount, tryDemo, finishOnboarding, useCurrentLocation, saveSettings, toast, linkOnline, onlineSignIn, onlineUnlock, onlineFinish, onlineCancel, onlineResetPassword } from './state.js';
import { Icon } from './icons.js';
import { syncConfig } from '../sync/config.js';

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
  const online = Boolean(syncConfig());
  return html`<div class="auth-card stack">
    <${Brand} sub=${online ? 'Deine Tagesform aus dem Helio Strap. Verschlüsselt auf deinen Geräten.' : 'Deine Tagesform aus dem Helio Strap. Dein Konto und deine Daten bleiben auf diesem Gerät.'} />
    ${list.length ? html`<div class="stack">
      <div class="eyebrow">Konten auf diesem Gerät</div>
      ${list.map((a) => html`<button class="account-btn" onClick=${() => authGo('login', a.id)}><${Avatar} a=${a} />
        <span class="grow"><span class="acc-name">${a.name}</span>${a.cloud?.email ? html`<span class="acc-sub"><${Icon} name="cloud" size=${14} />${a.cloud.email}</span>` : null}</span><${Icon} name="right" size=${18} /></button>`)}
    </div>` : null}
    <button class=${`btn block ${list.length ? '' : 'primary'}`} onClick=${() => authGo('create', null)}><${Icon} name="plus" size=${18} />Neues Konto anlegen</button>
    ${online ? html`<button class="btn block" onClick=${() => authGo('online', null)}><${Icon} name="cloud" size=${18} />Mit Online-Konto anmelden</button>` : null}
    <button class="linkbtn" style="justify-self:center" onClick=${tryDemo}>Ohne Konto ausprobieren (Beispieldaten)</button>
    <p class="tiny muted center">${online
      ? 'Ein Online-Konto hält deine Daten auf iPhone, iPad und Mac gleich. Sie werden vorher auf dem Gerät verschlüsselt.'
      : html`Freunde öffnen denselben Link auf ihrem eigenen Gerät und legen dort ihr Konto an. Konten liegen nur auf dem jeweiligen Gerät, ohne <span class="nowrap">E-Mail-Adresse</span>.`}</p>
  </div>`;
}

function PasswordField({ id, label, value, onInput, autoComplete = 'current-password', autoFocus }) {
  const ref = useRef(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, []);
  return html`<label class="field-label" for=${id}>${label}
    <span class="pw-wrap"><input ref=${ref} id=${id} class="field" type=${show ? 'text' : 'password'} autocomplete=${autoComplete} value=${value} onInput=${(e) => onInput(e.currentTarget.value)} />
    <button type="button" class="linkbtn pw-toggle" aria-pressed=${show ? 'true' : 'false'} onClick=${() => setShow(!show)}>${show ? 'Verbergen' : 'Zeigen'}</button></span>
  </label>`;
}

const validEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e).trim());

function OnlineLogin() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    try {
      await onlineSignIn(email, pw);
    } catch (x) {
      setErr(x.message);
    }
  };
  const forgot = async () => {
    setErr(null);
    if (!validEmail(email)) return setErr('Bitte zuerst deine E-Mail-Adresse eingeben.');
    try {
      await onlineResetPassword(email);
      setInfo('Falls es zu dieser Adresse ein Online-Konto gibt, ist eine E-Mail zum Zurücksetzen unterwegs. Danach hier mit dem neuen Passwort anmelden; deine Daten bleiben erhalten.');
    } catch (x) {
      setErr(x.message);
    }
  };
  return html`<form class="auth-card stack" onSubmit=${submit}>
    <${Brand} sub="Mit deinem Online-Konto anmelden" />
    <label class="field-label" for="on-email">E-Mail
      <input id="on-email" class="field" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" value=${email} onInput=${(e) => setEmail(e.currentTarget.value)} />
    </label>
    <${PasswordField} id="on-pw" label="Passwort" value=${pw} onInput=${setPw} />
    ${err ? html`<p class="small error-text" role="alert">${err}</p>` : null}
    ${info ? html`<p class="small ink2" role="status">${info}</p>` : null}
    <button class="btn primary block" type="submit" disabled=${!validEmail(email) || pw.length < 6}>Anmelden</button>
    <p class="tiny muted">Danach brauchst du einmal deinen Wiederherstellungscode. Nur er entschlüsselt die Daten auf einem neuen Gerät; auch der Server kann sie nicht lesen.</p>
    <div class="row between">
      <button type="button" class="linkbtn" onClick=${forgot}>Passwort vergessen?</button>
      <button type="button" class="linkbtn" onClick=${onlineCancel}>Zurück</button>
    </div>
  </form>`;
}

function OnlineCode() {
  const [code, setCode] = useState('');
  const [err, setErr] = useState(null);
  const [help, setHelp] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      await onlineUnlock(code);
    } catch (x) {
      setErr(x.message);
    }
  };
  return html`<form class="auth-card stack" onSubmit=${submit}>
    <div class="steps-dots" aria-hidden="true"><i class="on"></i><i class="on"></i><i></i></div>
    <h1 class="auth-title">Wiederherstellungscode</h1>
    <p class="ink2">Angemeldet als <b>${state.online?.email}</b>. Der Code (16 Zeichen) entschlüsselt deine Daten auf diesem Gerät. Du hast ihn beim Anlegen des Kontos bekommen.</p>
    <label class="field-label" for="on-code">Code
      <input id="on-code" class="field mono" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" value=${code} onInput=${(e) => setCode(e.currentTarget.value)} />
    </label>
    ${err ? html`<p class="small error-text" role="alert">${err}</p>` : null}
    <button class="btn primary block" type="submit" disabled=${code.replace(/[^A-Za-z0-9]/g, '').length < 16}>Weiter</button>
    <button type="button" class="linkbtn" style="justify-self:start" aria-expanded=${help ? 'true' : 'false'} onClick=${() => setHelp(!help)}>Code nicht zur Hand?</button>
    ${help ? html`<p class="small ink2">Auf einem Gerät, auf dem du schon angemeldet bist: Profil → Konto → Neuer Wiederherstellungscode. Der neue Code gilt sofort auch hier. Ohne Code lassen sich die Daten nicht entschlüsseln, auch nicht vom Entwickler.</p>` : null}
    <button type="button" class="linkbtn" style="justify-self:start" onClick=${onlineCancel}>Abbrechen</button>
  </form>`;
}

function OnlinePin() {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (pin !== pin2) return setErr('Die beiden PINs stimmen nicht überein.');
    try {
      await onlineFinish(pin, remember);
    } catch (x) {
      setErr(x.message);
    }
  };
  return html`<form class="auth-card stack" onSubmit=${submit}>
    <div class="steps-dots" aria-hidden="true"><i class="on"></i><i class="on"></i><i class="on"></i></div>
    <h1 class="auth-title">PIN für dieses Gerät</h1>
    <p class="ink2">Hallo ${state.online?.name || ''}. Mit dieser PIN öffnest du Formkurve auf diesem Gerät. Sie gilt nur hier; jedes Gerät hat seine eigene.</p>
    <${PinField} id="on-pin" label="PIN (4 bis 8 Ziffern)" value=${pin} onInput=${setPin} autoFocus=${true} />
    <${PinField} id="on-pin2" label="PIN wiederholen" value=${pin2} onInput=${setPin2} />
    <${Remember} value=${remember} onChange=${setRemember} />
    ${err ? html`<p class="small error-text" role="alert">${err}</p>` : null}
    <button class="btn primary block" type="submit" disabled=${pin.length < 4 || pin2.length < 4}>Fertig, Daten laden</button>
  </form>`;
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

const AUTH_STEPS = { create: Create, recover: Recover, online: OnlineLogin, 'online-code': OnlineCode, 'online-pin': OnlinePin };

export function AuthView() {
  const step = state.authStep;
  const Step = AUTH_STEPS[step];
  return html`<main class="auth">
    ${step === 'login' ? html`<${Login} key=${state.authAccountId} />` : Step ? html`<${Step} />` : html`<${Welcome} />`}
  </main>`;
}

// ---------- Erste Schritte nach dem Anlegen ----------

function StepDots({ step }) {
  const steps = ['code', ...(syncConfig() ? ['online'] : []), 'location', 'profile'];
  const at = steps.indexOf(step);
  return html`<div class="steps-dots" aria-hidden="true">${steps.map((s, i) => html`<i class=${i <= at ? 'on' : ''}></i>`)}</div>`;
}

function OnlineStep() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (pw !== pw2) return setErr('Die beiden Passwörter stimmen nicht überein.');
    try {
      await linkOnline(email, pw);
      finishOnboarding('online');
    } catch (x) {
      setErr(x.message);
    }
  };
  return html`<form class="auth-card stack" onSubmit=${submit}>
    <${StepDots} step="online" />
    <h1 class="auth-title">Auf mehreren Geräten nutzen</h1>
    <p class="ink2">Mit E-Mail und Passwort hältst du iPhone, iPad und Mac auf demselben Stand, auch gleichzeitig. Optional; das geht auch später unter Profil → Konto.</p>
    <ul class="bullets small ink2">
      <li>Die Daten werden auf dem Gerät verschlüsselt. Der Server sieht nur unlesbare Blöcke.</li>
      <li>Neues Gerät: E-Mail, Passwort und einmal dein Wiederherstellungscode.</li>
      <li>Passwort vergessen: Es kommt eine E-Mail zum Zurücksetzen, die Daten bleiben.</li>
    </ul>
    <label class="field-label" for="ln-email">E-Mail
      <input id="ln-email" class="field" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" value=${email} onInput=${(e) => setEmail(e.currentTarget.value)} />
    </label>
    <${PasswordField} id="ln-pw" label="Passwort (mindestens 8 Zeichen)" value=${pw} onInput=${setPw} autoComplete="new-password" />
    <${PasswordField} id="ln-pw2" label="Passwort wiederholen" value=${pw2} onInput=${setPw2} autoComplete="new-password" />
    ${err ? html`<p class="small error-text" role="alert">${err}</p>` : null}
    <button class="btn primary block" type="submit" disabled=${!validEmail(email) || pw.length < 8 || pw2.length < 8}><${Icon} name="cloud" size=${18} />Online-Konto anlegen</button>
    <button type="button" class="linkbtn" style="justify-self:center" onClick=${() => finishOnboarding('online')}>Später</button>
  </form>`;
}

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
    <${StepDots} step="code" />
    <h1 class="auth-title">Dein Wiederherstellungscode</h1>
    <p class="ink2">Brauchst du, wenn du die PIN vergisst${syncConfig() ? ' und wenn du ein weiteres Gerät verbindest' : ''}. Bewahre ihn sicher auf, zum Beispiel im Passwort-Manager oder in der Notizen-App.</p>
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
    <${StepDots} step="location" />
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
    <${StepDots} step="profile" />
    <h1 class="auth-title">Optional: über dich</h1>
    <p class="ink2">Damit vergleicht die App deine Werte mit passenden Normalwerten, etwa Schlafdauer nach Alter oder deinem Maximalpuls. Alles freiwillig und später unter Profil → Körperdaten änderbar.</p>
    <${ProfileFields} profile=${profile} onChange=${(k, v) => setProfile({ ...profile, [k]: v })} />
    <button class="btn primary block" onClick=${save}>Speichern</button>
    <button class="linkbtn" style="justify-self:center" onClick=${() => finishOnboarding('profile')}>Überspringen</button>
  </div>`;
}

export function OnboardingView() {
  const step = state.onboarding;
  const Step = { code: CodeStep, online: OnlineStep, location: LocationStep }[step] || ProfileStep;
  return html`<main class="auth"><${Step} /></main>`;
}

export { Avatar, PasswordField, validEmail };
