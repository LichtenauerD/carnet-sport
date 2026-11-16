/* =========================================================
   Carnet de sport — application
   Sommaire
    1. Utilitaires
    2. Données locales
    3. Catalogue (base + ajouts perso)
    4. Calculs : séance précédente, meilleure série, progrès
    5. Navigation et feuilles
    6. Onglet Séance : démarrage et saisie
    7. Glisser-déposer des exercices
    8. Choix d'un exercice, variante, création
    9. Minuteur de repos
   10. Onglet Historique
   11. Onglet Évolution et graphiques
   12. Export CSV et copies de secours
   13. Onglet Réglages
   14. Sauvegarde GitHub
   15. Événements et démarrage
   ========================================================= */
'use strict';

const VERSION = '1.0.0';
const CLE_DB = 'carnetSport.db';
const CLE_CONF = 'carnetSport.conf';

/* ===================== 1. Utilitaires ===================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const uniq = a => [...new Set(a.filter(Boolean))];
const num = v => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
};
const fmtNum = n => n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ',');
const ordinal = n => n === 1 ? '1er' : n + 'e';
const normaliser = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const pad2 = n => String(n).padStart(2, '0');

function auj() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function decalerJours(iso, n) {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
/** Heure arrondie au quart d'heure inférieur : 10h10 → 10:00 */
function quartInf() {
  const d = new Date();
  return pad2(d.getHours()) + ':' + pad2(Math.floor(d.getMinutes() / 15) * 15);
}
function dateFR(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', opts);
}
const hFR = h => (h || '').replace(':', 'h');

const ICO = {
  poignee: '<svg width="14" height="22" viewBox="0 0 14 22" fill="currentColor"><circle cx="4" cy="4" r="1.8"/><circle cx="10" cy="4" r="1.8"/><circle cx="4" cy="11" r="1.8"/><circle cx="10" cy="11" r="1.8"/><circle cx="4" cy="18" r="1.8"/><circle cx="10" cy="18" r="1.8"/></svg>',
  croix: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  note: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>',
  export: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  chevron: '<svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1.5 1.5l6 6-6 6"/></svg>',
  cardio: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>'
};

function toast(t) {
  const el = $('#toast');
  el.textContent = t; el.classList.add('vu');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('vu'), 2800);
}

/* ===================== 2. Données locales ===================== */
function charger(cle, defaut) {
  try { const v = JSON.parse(localStorage.getItem(cle)); return v ? Object.assign(defaut, v) : defaut; }
  catch (e) { return defaut; }
}
let DB = charger(CLE_DB, { v: 1, seances: [], exosPerso: [], prisesPerso: {}, formesPerso: {}, maj: 0 });
const CONF = charger(CLE_CONF, { proprio: 'LichtenauerD', depot: 'carnet-sport-donnees', jeton: '', repos: 90, derniereSync: 0 });

function sauverConf() { localStorage.setItem(CLE_CONF, JSON.stringify(CONF)); }
function sauver(sync = true) {
  clearTimeout(sauverDiff.t);
  DB.maj = Date.now();
  localStorage.setItem(CLE_DB, JSON.stringify(DB));
  if (sync) planifierSync();
}
/** Sauvegarde différée pendant la saisie */
function sauverDiff() { clearTimeout(sauverDiff.t); sauverDiff.t = setTimeout(() => sauver(), 500); }
const toucher = s => { s.maj = Date.now(); };

const seancesValides = () => DB.seances.filter(s => !s.supprime);
const seanceEnCours = () => DB.seances.find(s => !s.supprime && s.statut === 'en_cours');
const quandCle = s => s.date + 'T' + (s.heure || '00:00');
/** Séances terminées, de la plus récente à la plus ancienne */
const terminees = () => seancesValides().filter(s => s.statut !== 'en_cours')
  .sort((a, b) => quandCle(b).localeCompare(quandCle(a)) || (b.cree || 0) - (a.cree || 0));

/* ===================== 3. Catalogue ===================== */
function exo(id) {
  return CATALOGUE.find(e => e.id === id) || DB.exosPerso.find(e => e.id === id)
    || { id, nom: 'Exercice supprimé', type: 'push', muscle: 'pectoraux', formes: FORMES, prises: [] };
}
const tousExos = () => [...CATALOGUE, ...DB.exosPerso.filter(e => !e.supprime)];
const formesDe = id => uniq([...(exo(id).formes || []), ...(DB.formesPerso[id] || [])]);
const prisesDe = id => uniq([...(exo(id).prises || []), ...(DB.prisesPerso[id] || [])]);
/** Un exercice suivi = mouvement + forme + prise */
const cleDe = x => x.ex + '|' + (x.forme || '') + '|' + (x.prise || '');
const libVariante = x => [x.forme, x.prise].filter(Boolean).join(' · ');

/* ===================== 4. Calculs ===================== */
const aDesValeurs = e => e.series.some(se => se.r !== '' || se.kg !== '');

/** Dernière fois que cet exercice précis (mouvement + forme + prise) a été fait avant la séance s */
function precedent(s, x) {
  const cle = cleDe(x), t = quandCle(s);
  let res = null;
  for (const o of seancesValides()) {
    if (o.id === s.id || o.sansDetail || o.statut === 'en_cours') continue;
    const to = quandCle(o);
    if (to > t || (to === t && (o.cree || 0) >= (s.cree || 0))) continue;
    const i = o.exos.findIndex(e => cleDe(e) === cle && aDesValeurs(e));
    if (i < 0) continue;
    if (!res || to > quandCle(res.s)) res = { s: o, e: o.exos[i], rang: i + 1 };
  }
  return res;
}
/** Dernière séance détaillée d'un type, pour pré-remplir */
const derniereDuType = type => terminees().find(s => s.type === type && !s.sansDetail && s.exos.length);
const derniereToutType = type => terminees().find(s => s.type === type);
/** Forme et prise utilisées la dernière fois pour un mouvement */
function derniereVariante(id) {
  for (const s of terminees()) {
    const e = s.exos.find(x => x.ex === id);
    if (e) return { forme: e.forme, prise: e.prise };
  }
  return { forme: formesDe(id)[0] || '', prise: '' };
}
/** Meilleure série : la plus lourde, puis le plus de reps à charge égale */
function meilleureSerie(e) {
  let b = null;
  for (const se of e.series) {
    const r = num(se.r), kg = num(se.kg) ?? 0;
    if (r == null || r <= 0) continue;
    if (!b || kg > b.kg || (kg === b.kg && r > b.r)) b = { kg, r };
  }
  return b;
}
/** Règle de progression : la charge d'abord, les reps ensuite. 1 = progrès, 0 = stable, -1 = baisse */
function comparer(a, b) {
  if (!a || !b) return 0;
  if (a.kg !== b.kg) return a.kg > b.kg ? 1 : -1;
  if (a.r !== b.r) return a.r > b.r ? 1 : -1;
  return 0;
}
const txtSerie = m => m.kg > 0 ? `${fmtNum(m.kg)} kg × ${m.r}` : `${m.r} reps`;
const resumeSeries = e => e.series.filter(se => se.r !== '' || se.kg !== '')
  .map(se => (se.kg !== '' ? fmtNum(num(se.kg)) : '0') + '×' + (se.r || '?')).join(' · ');

/** Points de progression par exercice suivi */
function pointsParCle(filtreType) {
  const m = new Map();
  for (const s of seancesValides()) {
    if (s.sansDetail || s.statut === 'en_cours') continue;
    s.exos.forEach((e, i) => {
      const d = exo(e.ex);
      if (filtreType && filtreType !== 'tous' && d.type !== filtreType) return;
      const best = meilleureSerie(e);
      if (!best) return;
      const k = cleDe(e);
      if (!m.has(k)) m.set(k, { cle: k, e, d, pts: [] });
      m.get(k).pts.push({ s, e, rang: i + 1, total: s.exos.length, m: best });
    });
  }
  for (const v of m.values()) v.pts.sort((a, b) => quandCle(a.s).localeCompare(quandCle(b.s)));
  return m;
}

/* ===================== 5. Navigation et feuilles ===================== */
const UI = { onglet: 'seance', evoType: 'push', editionId: null, snapshot: null, sel: null, vari: null, tokF: 0, notes: new Set() };
const courante = () => UI.editionId ? DB.seances.find(s => s.id === UI.editionId) : seanceEnCours();

function aller(o) { UI.onglet = o; rendre(); window.scrollTo(0, 0); }
function rendre() {
  $$('#onglets button').forEach(b => b.classList.toggle('actif', b.dataset.onglet === UI.onglet));
  const vues = { seance: vueSeance, historique: vueHistorique, evolution: vueEvolution, reglages: vueReglages };
  $('#vue').innerHTML = vues[UI.onglet]();
  majFab();
}
function entete(titre, sous = '') {
  return `<header class="entete"><div><h1>${titre}</h1>${sous ? `<div class="sous">${sous}</div>` : ''}</div>${pastilleSync()}</header>`;
}
function ouvrirFeuille(html) {
  const f = $('#feuille'), v = $('#voile');
  UI.tokF++;
  $('#toast').classList.remove('vu');
  f.innerHTML = '<div class="barre"></div>' + html;
  f.classList.remove('cache'); v.classList.remove('cache');
  requestAnimationFrame(() => { f.classList.add('ouvert'); v.classList.add('ouvert'); });
  f.scrollTop = 0;
}
function fermerFeuille() {
  const f = $('#feuille'), v = $('#voile'), tok = ++UI.tokF;
  f.classList.remove('ouvert'); v.classList.remove('ouvert');
  setTimeout(() => { if (tok !== UI.tokF) return; f.classList.add('cache'); v.classList.add('cache'); f.innerHTML = ''; }, 260);
}
const feuilleOuverte = () => !$('#feuille').classList.contains('cache') && $('#feuille').classList.contains('ouvert');

/* ===================== 6. Onglet Séance ===================== */
function optionsHeures(sel) {
  let o = '';
  for (let h = 5; h < 24; h++) for (let m = 0; m < 60; m += 15) {
    const v = pad2(h) + ':' + pad2(m);
    o += `<option value="${v}"${v === sel ? ' selected' : ''}>${hFR(v)}</option>`;
  }
  if (sel && !o.includes(`value="${sel}"`)) o = `<option value="${sel}" selected>${hFR(sel)}</option>` + o;
  return o;
}
function vueSeance() {
  const s = courante();
  return s ? vueEditeur(s) : vueDemarrage();
}
function vueDemarrage() {
  const figures = { push: ['pectoraux', 'triceps'], pull: ['dos', 'biceps'], legs: ['quadriceps', 'ischios'] };
  const cartes = Object.entries(TYPES).map(([k, t]) => {
    const d = derniereToutType(k);
    return `<button class="type-carte" style="--c:var(--${k})" data-a="commencer" data-type="${k}">
      <div><div class="nom">${t.nom}</div><div class="desc">${t.desc}</div>
      <div class="der">${d ? 'Dernière : ' + dateFR(d.date) : 'Pas encore de séance'}</div></div>
      <div class="mqs">${figures[k].map(m => MQ.svg(m, { taille: 72 })).join('')}</div></button>`;
  }).join('');
  return entete('Séance', dateFR(auj(), { weekday: 'long', day: 'numeric', month: 'long' })) + `<main>
    <div class="carte"><div class="duo">
      <label class="champ" style="margin:0"><span>Date</span><input type="date" id="dem-date" value="${auj()}"></label>
      <label class="champ" style="margin:0"><span>Début</span><select id="dem-heure">${optionsHeures(quartInf())}</select></label>
    </div></div>
    <div class="types">${cartes}</div>
    <div class="titre-section">Autre salle</div>
    <button class="carte" style="width:100%;text-align:left;display:block" data-a="sans-detail">
      <div class="ligne entre"><div><b>Ajouter une séance sans détail</b>
      <div class="muet petit">Date et type seulement, quand les charges ne sont pas comparables</div></div>${ICO.chevron}</div>
    </button>
  </main>`;
}
function commencer(type) {
  const date = $('#dem-date')?.value || auj(), heure = $('#dem-heure')?.value || quartInf();
  const prev = derniereDuType(type);
  const s = { id: uid(), cree: Date.now(), maj: Date.now(), date, heure, type, statut: 'en_cours', sansDetail: false, exos: [], cardio: [], note: '' };
  if (prev) s.exos = prev.exos.map(e => ({
    uid: uid(), ex: e.ex, forme: e.forme, prise: e.prise, note: '',
    series: Array.from({ length: Math.max(1, e.series.length) }, () => ({ r: '', kg: '' }))
  }));
  DB.seances.push(s); sauver(); rendre(); window.scrollTo(0, 0);
  toast(prev ? `Séance ${TYPES[type].nom} du ${dateFR(prev.date)} chargée` : 'Ajoute ton premier exercice avec +');
}
function vueEditeur(s) {
  const t = TYPES[s.type], ed = s.statut !== 'en_cours';
  return entete(ed ? 'Modifier la séance' : 'Séance ' + t.nom) + `<main>
    <div class="carte"><div class="seance-tete">
      <span class="badge" style="--c:var(--${s.type})">${t.nom}</span>
      <div class="quand"><input type="date" data-champ-s="date" value="${s.date}"><select data-champ-s="heure">${optionsHeures(s.heure)}</select></div>
    </div></div>
    <div class="liste-exos" id="liste-exos">${s.exos.map((e, i) => exoHTML(s, e, i)).join('')}</div>
    <button class="ajouter" data-a="ajouter-exo">+ Ajouter un exercice</button>
    ${s.cardio.length ? '<div class="titre-section">Bonus cardio</div>' + s.cardio.map(cardioHTML).join('') : ''}
    <button class="ajouter bonus" data-a="ajouter-cardio">${ICO.cardio} Bonus cardio</button>
    <label class="champ"><span>Note sur la séance</span><textarea data-champ-s="note" placeholder="Forme du jour, sommeil, etc.">${esc(s.note)}</textarea></label>
    <button class="btn plein large" data-a="terminer">${ed ? 'Enregistrer les modifications' : 'Terminer la séance'}</button>
    <div style="text-align:center;margin:18px 0 8px"><button class="lien" style="color:var(--rouge)" data-a="${ed ? 'annuler-edition' : 'abandonner'}">${ed ? 'Annuler les modifications' : 'Supprimer cette séance'}</button></div>
  </main>`;
}
function selectOptions(liste, sel, avecVide) {
  let o = avecVide ? `<option value=""${!sel ? ' selected' : ''}>Sans précision</option>` : '';
  o += liste.map(v => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
  return o + '<option value="__autre">+ Autre…</option>';
}
function exoHTML(s, e, i) {
  const d = exo(e.ex), pc = precedent(s, e);
  const pdc = e.forme === 'Poids du corps';
  const rang = i + 1;
  const rappel = pc
    ? `<div class="rappel">Dernière fois, ${dateFR(pc.s.date)} : exercice fait en <b>${ordinal(pc.rang)}</b>${pc.rang !== rang ? `, aujourd'hui en ${ordinal(rang)}` : ''}</div>`
    : `<div class="rappel nouveau">Première fois avec cette forme et cette prise</div>`;
  const lignes = e.series.map((se, k) => {
    const g = pc ? (pc.e.series[k] || pc.e.series[pc.e.series.length - 1]) : null;
    const phR = g && g.r !== '' ? g.r : 'reps';
    const phK = g && g.kg !== '' ? g.kg : (pdc ? '0' : 'kg');
    return `<tr><td class="num">${k + 1}</td>
      <td><input inputmode="numeric" data-serie="${k}" data-f="r" value="${esc(se.r)}" placeholder="${esc(phR)}" class="${se.r !== '' ? 'rempli' : ''}" aria-label="Répétitions série ${k + 1}"></td>
      <td><input inputmode="decimal" data-serie="${k}" data-f="kg" value="${esc(se.kg)}" placeholder="${esc(phK)}" class="${se.kg !== '' ? 'rempli' : ''}" aria-label="Charge série ${k + 1}"></td></tr>`;
  }).join('');
  const noteVisible = e.note || (pc && pc.e.note) || UI.notes.has(e.uid);
  return `<div class="exo" data-uid="${e.uid}">
    <div class="exo-tete">
      <div class="poignee" data-poignee aria-label="Déplacer">${ICO.poignee}</div>
      ${MQ.svg(d.muscle, { taille: 60 })}
      <div class="exo-nom"><span class="rang">${rang}</span><button class="nom" data-a="remplacer-exo">${esc(d.nom)}</button>
        <div class="desc">${MUSCLES[d.muscle]?.nom || ''}${d.desc ? ' · ' + esc(d.desc) : ''}</div></div>
      <button class="icone-btn" data-a="suppr-exo" aria-label="Retirer l'exercice">${ICO.croix}</button>
    </div>
    <div class="corps">
      <div class="selecteurs">
        <label><span>Forme</span><select data-sel="forme">${selectOptions(uniq([...formesDe(e.ex), e.forme]), e.forme, false)}</select></label>
        <label><span>Prise / position</span><select data-sel="prise">${selectOptions(uniq([...prisesDe(e.ex), e.prise]), e.prise, true)}</select></label>
      </div>
      ${rappel}
      <table class="series"><thead><tr><th></th><th>Reps</th><th>${pdc ? 'Lest (kg)' : 'Charge (kg)'}</th></tr></thead><tbody>${lignes}</tbody></table>
      <div class="exo-actions">
        <button class="btn fin" data-a="moins-serie">− Série</button>
        <button class="btn fin" data-a="plus-serie">+ Série</button>
        <span class="espace"></span>
        <button class="btn fin" data-a="note-exo">${ICO.note} Note</button>
      </div>
      <div class="note-exo ${noteVisible ? '' : 'cache'}"><textarea data-champ-e="note" rows="1" placeholder="${pc && pc.e.note ? esc(pc.e.note) : 'Ex. siège cran 4'}">${esc(e.note)}</textarea></div>
    </div>
  </div>`;
}
function cardioHTML(c) {
  const types = uniq([...CARDIO_TYPES, c.type]);
  return `<div class="carte" data-cardio="${c.uid}"><div class="cardio">
    <label class="champ"><span>Activité</span><select data-cardio-type>${types.map(t => `<option${t === c.type ? ' selected' : ''}>${esc(t)}</option>`).join('')}<option value="__autre">+ Autre…</option></select></label>
    <label class="champ"><span>Durée (min)</span><input inputmode="numeric" data-cf="duree" value="${esc(c.duree)}" placeholder="15"></label>
    <label class="champ"><span>Distance (km)</span><input inputmode="decimal" data-cf="dist" value="${esc(c.dist)}" placeholder="—"></label>
    <button class="icone-btn" data-a="suppr-cardio" aria-label="Retirer">${ICO.croix}</button>
  </div></div>`;
}
function exoDe(el) {
  const s = courante(); if (!s) return {};
  const id = el.closest('.exo')?.dataset.uid;
  return { s, e: s.exos.find(x => x.uid === id) };
}
function rendreListe() {
  const s = courante(), l = $('#liste-exos');
  if (s && l) l.innerHTML = s.exos.map((e, i) => exoHTML(s, e, i)).join('');
}
function rendreCarte(uidExo) {
  const s = courante(), i = s.exos.findIndex(x => x.uid === uidExo), el = $(`.exo[data-uid="${uidExo}"]`);
  if (i >= 0 && el) el.outerHTML = exoHTML(s, s.exos[i], i);
}
/** Retire les séries vides et les exercices sans aucune valeur */
function nettoyer(s) {
  s.exos = s.exos.filter(aDesValeurs);
  s.exos.forEach(e => { e.series = e.series.filter(se => se.r !== '' || se.kg !== ''); });
  s.cardio = s.cardio.filter(c => c.duree !== '' || c.dist !== '');
}
function terminer() {
  const s = courante(); if (!s) return;
  const vides = s.exos.filter(e => !aDesValeurs(e)).length;
  if (vides && !confirm(`${vides} exercice${vides > 1 ? 's' : ''} sans aucune série remplie ${vides > 1 ? 'seront retirés' : 'sera retiré'}. Terminer ?`)) return;
  nettoyer(s);
  if (!s.exos.length && !s.cardio.length && !confirm('Aucune donnée saisie. Enregistrer quand même la séance ?')) return;
  const edition = !!UI.editionId;
  s.statut = 'terminee'; toucher(s);
  UI.editionId = null; UI.snapshot = null;
  sauver();
  toast(edition ? 'Modifications enregistrées' : 'Séance enregistrée');
  aller('historique');
}
/** Une séance restée ouverte plus de 6 h est enregistrée automatiquement */
function autoCloture() {
  const s = seanceEnCours();
  if (s && Date.now() - (s.maj || 0) > 6 * 3600e3) {
    nettoyer(s); s.statut = 'terminee'; toucher(s); sauver();
    setTimeout(() => toast(`Séance du ${dateFR(s.date)} enregistrée automatiquement`), 400);
  }
}

function feuilleSansDetail() {
  ouvrirFeuille(`<div class="tete-feuille"><h2>Séance sans détail</h2><button class="icone-btn" data-a="fermer">${ICO.croix}</button></div>
    <p class="muet petit" style="margin-top:0">Pour une autre salle où les charges ne sont pas comparables. Elle apparaît dans l'historique et l'export, mais pas dans les courbes ni dans les charges proposées.</p>
    <div class="duo">
      <label class="champ"><span>Date</span><input type="date" id="sd-date" value="${auj()}"></label>
      <label class="champ"><span>Début</span><select id="sd-heure">${optionsHeures(quartInf())}</select></label>
    </div>
    <div class="champ"><span>Type de séance</span><div class="puces" id="sd-type">${Object.entries(TYPES).map(([k, t], i) =>
      `<button class="puce${i === 0 ? ' on' : ''}" data-a="puce-radio" data-v="${k}">${t.nom}</button>`).join('')}</div></div>
    <label class="champ"><span>Note (facultatif)</span><input id="sd-note" placeholder="Ex. salle d'un ami"></label>
    <button class="btn plein large" data-a="valider-sans-detail">Enregistrer</button>`);
}
function validerSansDetail() {
  const type = $('#sd-type .puce.on')?.dataset.v || 'push';
  DB.seances.push({
    id: uid(), cree: Date.now(), maj: Date.now(), date: $('#sd-date').value || auj(), heure: $('#sd-heure').value,
    type, statut: 'terminee', sansDetail: true, exos: [], cardio: [], note: $('#sd-note').value.trim()
  });
  sauver(); fermerFeuille(); toast('Séance sans détail enregistrée'); aller('historique');
}

/* ===================== 7. Glisser-déposer ===================== */
function demarrerGlisse(ev, poignee) {
  ev.preventDefault();
  const liste = $('#liste-exos'), carte = poignee.closest('.exo');
  if (!liste || !carte) return;
  const id = carte.dataset.uid;
  liste.classList.add('tri');               // cartes repliées pendant le tri
  carte.classList.add('glisse');
  const hauteur = carte.getBoundingClientRect().height;
  let y = ev.clientY, raf;

  const placer = () => {
    carte.style.transform = '';
    const nat = carte.getBoundingClientRect().top;
    const voulu = y - hauteur / 2;
    carte.style.transform = `translateY(${voulu - nat}px)`;
    return voulu + hauteur / 2;
  };
  const reordonner = () => {
    const centre = placer();
    let avant = null;
    for (const c of $$('.exo', liste)) {
      if (c === carte) continue;
      const r = c.getBoundingClientRect();
      if (centre < r.top + r.height / 2) { avant = c; break; }
    }
    if (avant) { if (carte.nextElementSibling !== avant) liste.insertBefore(carte, avant); }
    else if (liste.lastElementChild !== carte) liste.appendChild(carte);
    placer();
  };
  const boucle = () => {
    const marge = 80;
    if (y < marge) window.scrollBy(0, -12);
    else if (y > innerHeight - marge - 64) window.scrollBy(0, 12);
    reordonner();
    raf = requestAnimationFrame(boucle);
  };
  const bouge = e => { y = e.clientY; };
  const fin = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', bouge);
    window.removeEventListener('pointerup', fin);
    window.removeEventListener('pointercancel', fin);
    const ordre = $$('.exo', liste).map(c => c.dataset.uid);
    const s = courante();
    s.exos.sort((a, b) => ordre.indexOf(a.uid) - ordre.indexOf(b.uid));
    toucher(s); sauver();
    liste.classList.remove('tri');
    rendreListe();
    $(`.exo[data-uid="${id}"]`)?.scrollIntoView({ block: 'nearest' });
  };
  window.addEventListener('pointermove', bouge);
  window.addEventListener('pointerup', fin);
  window.addEventListener('pointercancel', fin);
  raf = requestAnimationFrame(boucle);
}

/* ===================== 8. Choix d'un exercice ===================== */
function ouvrirSelecteur(mode, uidExo) {
  UI.sel = { mode, uid: uidExo, filtre: courante()?.type || 'push', q: '' };
  const titre = mode === 'ajout' ? 'Ajouter un exercice' : "Changer d'exercice";
  ouvrirFeuille(`<div class="tete-feuille"><h2>${titre}</h2><button class="icone-btn" data-a="fermer">${ICO.croix}</button></div>
    <input class="saisie" id="sel-q" placeholder="Rechercher un exercice" autocomplete="off" style="margin-bottom:10px">
    <div class="segment" id="sel-seg">${segFiltre()}</div>
    <div class="liste-choix" id="sel-liste">${listeSelecteurHTML()}</div>
    <button class="btn large" data-a="creer-exo" style="margin-top:12px">+ Créer un nouvel exercice</button>`);
}
const segFiltre = () => ['push', 'pull', 'legs', 'tous'].map(k =>
  `<button class="${k === UI.sel.filtre ? 'on' : ''}" data-a="sel-filtre" data-v="${k}">${k === 'tous' ? 'Tous' : TYPES[k].nom}</button>`).join('');
function listeSelecteurHTML() {
  const f = UI.sel.filtre, q = normaliser(UI.sel.q);
  const liste = tousExos().filter(e => (f === 'tous' || e.type === f) && (!q || normaliser(e.nom).includes(q)));
  if (!liste.length) return '<div class="vide">Aucun exercice. Crée-le avec le bouton ci-dessous.</div>';
  let html = '';
  for (const m of Object.keys(MUSCLES)) {
    const g = liste.filter(e => e.muscle === m);
    if (!g.length) continue;
    html += `<div class="groupe">${MUSCLES[m].nom}</div>` + g.map(e =>
      `<button class="choix" data-a="choisir-exo" data-id="${e.id}">${MQ.svg(e.muscle, { taille: 46 })}
        <div><div class="t">${esc(e.nom)}</div><div class="d">${esc(e.desc || formesDe(e.id).join(', '))}</div></div></button>`).join('');
  }
  return html;
}
function feuilleVariante(id) {
  const dv = derniereVariante(id);
  UI.vari = { id, forme: dv.forme, prise: dv.prise };
  rendreVariante();
}
function rendreVariante() {
  const v = UI.vari, d = exo(v.id);
  const formes = uniq([...formesDe(v.id), v.forme]), prises = uniq([...prisesDe(v.id), v.prise]);
  const action = UI.sel?.mode === 'remplacer' ? 'Remplacer' : 'Ajouter à la séance';
  ouvrirFeuille(`<div class="tete-feuille"><h2>${esc(d.nom)}</h2><button class="icone-btn" data-a="fermer">${ICO.croix}</button></div>
    <div class="ligne" style="margin-bottom:6px">${MQ.svg(d.muscle, { taille: 80 })}<div class="muet petit">${MUSCLES[d.muscle]?.nom || ''}${d.desc ? '<br>' + esc(d.desc) : ''}</div></div>
    <div class="champ"><span>Forme</span><div class="puces">${formes.map(f =>
      `<button class="puce${f === v.forme ? ' on' : ''}" data-a="vari-forme" data-v="${esc(f)}">${esc(f)}</button>`).join('')}
      <button class="puce ajout" data-a="vari-autre" data-v="forme">+ Autre</button></div></div>
    <div class="champ"><span>Prise / position</span><div class="puces">
      <button class="puce${!v.prise ? ' on' : ''}" data-a="vari-prise" data-v="">Sans précision</button>${prises.map(p =>
      `<button class="puce${p === v.prise ? ' on' : ''}" data-a="vari-prise" data-v="${esc(p)}">${esc(p)}</button>`).join('')}
      <button class="puce ajout" data-a="vari-autre" data-v="prise">+ Autre</button></div></div>
    <button class="btn plein large" data-a="vari-ok">${action}</button>
    <div style="text-align:center;margin-top:12px"><button class="lien" data-a="ajouter-exo-retour">← Retour à la liste</button></div>`);
}
function ajouterPerso(champ, idExo) {
  const nom = (prompt(champ === 'forme' ? 'Nouvelle forme (ex. Landmine)' : 'Nouvelle prise ou position (ex. Prise neutre)') || '').trim();
  if (!nom) return null;
  const cible = champ === 'forme' ? DB.formesPerso : DB.prisesPerso;
  cible[idExo] = uniq([...(cible[idExo] || []), nom]);
  sauver();
  return nom;
}
function validerVariante() {
  const s = courante(), v = UI.vari;
  if (!s) return fermerFeuille();
  let cible;
  if (UI.sel?.mode === 'remplacer') {
    cible = s.exos.find(x => x.uid === UI.sel.uid);
    if (cible) Object.assign(cible, { ex: v.id, forme: v.forme, prise: v.prise });
  } else {
    const nouv = { uid: uid(), ex: v.id, forme: v.forme, prise: v.prise, note: '', series: [] };
    const pc = precedent(s, nouv);
    const n = pc ? Math.max(1, pc.e.series.length) : 4;
    nouv.series = Array.from({ length: n }, () => ({ r: '', kg: '' }));
    s.exos.push(nouv); cible = nouv;
  }
  toucher(s); sauver(); fermerFeuille(); rendreListe();
  if (cible) setTimeout(() => $(`.exo[data-uid="${cible.uid}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 280);
}
function feuilleCreation() {
  const type = UI.sel?.filtre && UI.sel.filtre !== 'tous' ? UI.sel.filtre : (courante()?.type || 'push');
  ouvrirFeuille(`<div class="tete-feuille"><h2>Nouvel exercice</h2><button class="icone-btn" data-a="fermer">${ICO.croix}</button></div>
    <label class="champ"><span>Nom du mouvement</span><input id="cr-nom" placeholder="Ex. Kickback triceps"></label>
    <div class="champ"><span>Type de séance</span><div class="puces" id="cr-type">${Object.entries(TYPES).map(([k, t]) =>
      `<button class="puce${k === type ? ' on' : ''}" data-a="puce-radio" data-v="${k}">${t.nom}</button>`).join('')}</div></div>
    <label class="champ"><span>Muscle principal</span><select id="cr-muscle">${Object.entries(MUSCLES).map(([k, m]) =>
      `<option value="${k}">${m.nom}</option>`).join('')}</select></label>
    <div class="champ"><span>Formes possibles</span><div class="puces" id="cr-formes">${FORMES.map(f =>
      `<button class="puce" data-a="puce-multi" data-v="${esc(f)}">${esc(f)}</button>`).join('')}</div></div>
    <label class="champ"><span>Prises ou positions (facultatif, séparées par des virgules)</span><input id="cr-prises" placeholder="Ex. Corde, Poignée simple"></label>
    <button class="btn plein large" data-a="valider-creation">Créer</button>`);
}
function validerCreation() {
  const nom = $('#cr-nom').value.trim();
  if (!nom) return toast('Donne un nom au mouvement');
  const formes = $$('#cr-formes .puce.on').map(b => b.dataset.v);
  const e = {
    id: 'p_' + uid(), nom, type: $('#cr-type .puce.on')?.dataset.v || 'push', muscle: $('#cr-muscle').value,
    formes: formes.length ? formes : ['Machine guidée'], prises: uniq($('#cr-prises').value.split(',').map(x => x.trim())), maj: Date.now()
  };
  DB.exosPerso.push(e); sauver();
  feuilleVariante(e.id);
}

/* ===================== 9. Minuteur ===================== */
const MIN = { fin: null, duree: CONF.repos || 90, iv: null, ctx: null };
const restant = () => MIN.fin ? Math.max(0, MIN.fin - Date.now()) : MIN.duree * 1000;
const fmtMin = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + pad2(s % 60); };
function feuilleMinuteur() {
  ouvrirFeuille(`<div class="tete-feuille"><h2>Minuteur de repos</h2><button class="icone-btn" data-a="fermer">${ICO.croix}</button></div>
    <div class="minuteur-gros" id="min-aff">${fmtMin(restant())}</div>
    <div class="puces" style="justify-content:center">${[60, 90, 120, 150, 180, 240].map(v =>
      `<button class="puce${v === MIN.duree ? ' on' : ''}" data-a="min-duree" data-v="${v}">${fmtMin(v * 1000)}</button>`).join('')}</div>
    <div class="duo" style="margin-top:16px"><button class="btn" data-a="min-ajuste" data-v="-15">− 15 s</button><button class="btn" data-a="min-ajuste" data-v="15">+ 15 s</button></div>
    <button class="btn plein large" style="margin-top:12px" data-a="min-go" id="min-go">${MIN.fin ? 'Arrêter' : 'Démarrer'}</button>
    <p class="muet petit" style="text-align:center">Un signal sonore retentit à la fin, si l'appli est ouverte à l'écran.</p>`);
}
function debloquerSon() {
  try {
    MIN.ctx = MIN.ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (MIN.ctx.state === 'suspended') MIN.ctx.resume();
    // son muet pour déverrouiller l'audio sur iPhone
    const o = MIN.ctx.createOscillator(), g = MIN.ctx.createGain(); g.gain.value = 0; o.connect(g).connect(MIN.ctx.destination); o.start(); o.stop(MIN.ctx.currentTime + 0.01);
  } catch (e) { /* pas de son disponible */ }
}
function bip() {
  try {
    const c = MIN.ctx; if (!c) return;
    [0, 0.35, 0.7].forEach(t => {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, c.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.5, c.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + 0.25);
      o.connect(g).connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.3);
    });
  } catch (e) { /* ignore */ }
}
function lancerMinuteur() {
  MIN.fin = Date.now() + MIN.duree * 1000;
  clearInterval(MIN.iv); MIN.iv = setInterval(tick, 250); tick();
}
function arreterMinuteur() { MIN.fin = null; clearInterval(MIN.iv); tick(); }
function tick() {
  const r = restant();
  const aff = $('#min-aff'); if (aff) aff.textContent = fmtMin(r);
  const go = $('#min-go'); if (go) go.textContent = MIN.fin ? 'Arrêter' : 'Démarrer';
  if (MIN.fin && r <= 0) {
    MIN.fin = null; clearInterval(MIN.iv);
    bip(); if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    document.body.classList.add('flash'); setTimeout(() => document.body.classList.remove('flash'), 2100);
    toast('Repos terminé');
    if (aff) aff.textContent = fmtMin(restant());
    if (go) go.textContent = 'Démarrer';
  }
  majFab();
}
function majFab() {
  const fab = $('#fab');
  const visible = MIN.fin || (UI.onglet === 'seance' && courante());
  fab.classList.toggle('cache', !visible);
  fab.classList.toggle('tourne', !!MIN.fin);
  $('#fab-txt').textContent = MIN.fin ? fmtMin(restant()) : '';
}

/* ===================== 10. Historique ===================== */
function vueHistorique() {
  const liste = terminees();
  if (!liste.length) return entete('Historique') + `<main><div class="vide">${MQ.svg('pectoraux', { taille: 120 })}<p>Aucune séance enregistrée pour l'instant.</p></div></main>`;
  let html = '', mois = '';
  for (const s of liste) {
    const m = dateFR(s.date, { month: 'long', year: 'numeric' });
    if (m !== mois) { html += `<div class="titre-section">${m}</div>`; mois = m; }
    const noms = s.sansDetail ? 'Séance sans détail' + (s.note ? ' · ' + esc(s.note) : '')
      : s.exos.map(e => esc(exo(e.ex).nom)).join(', ') || 'Aucun exercice';
    html += `<button class="histo" data-a="voir-seance" data-id="${s.id}">
      <div class="date"><b>${new Date(s.date + 'T12:00').getDate()}</b><span>${dateFR(s.date, { weekday: 'short' })}</span></div>
      <div class="info"><div class="ligne"><span class="badge" style="--c:var(--${s.type})">${TYPES[s.type].nom}</span>
        <span class="muet petit">${hFR(s.heure)}${s.cardio.length ? ' · ' + ICO.cardio + ' cardio' : ''}</span></div>
        <div class="l2">${noms}</div></div>${ICO.chevron}</button>`;
  }
  return entete('Historique', `${liste.length} séance${liste.length > 1 ? 's' : ''}`) +
    `<main><button class="btn large" data-a="export" style="margin-bottom:4px">${ICO.export} Exporter mes performances</button>${html}</main>`;
}
function feuilleSeance(id) {
  const s = DB.seances.find(x => x.id === id); if (!s) return;
  let corps = '';
  if (s.sansDetail) corps = `<p class="muet">Séance sans détail${s.note ? ' : ' + esc(s.note) : ''}.</p>`;
  else corps = s.exos.map((e, i) => {
    const d = exo(e.ex);
    return `<div class="detail-exo"><div class="ligne">${MQ.svg(d.muscle, { taille: 44 })}<div style="flex:1">
      <div><span class="rang">${i + 1}</span><b>${esc(d.nom)}</b></div>
      <div class="muet petit">${esc(libVariante(e)) || 'Sans précision'}</div>
      <div style="margin-top:3px">${esc(resumeSeries(e)) || '—'}</div>
      ${e.note ? `<div class="rappel" style="margin:4px 0 0">${esc(e.note)}</div>` : ''}</div></div></div>`;
  }).join('') || '<p class="muet">Aucun exercice.</p>';
  if (s.cardio.length) corps += '<div class="titre-section">Bonus cardio</div>' + s.cardio.map(c =>
    `<div>${esc(c.type)} : ${c.duree ? esc(c.duree) + ' min' : ''}${c.dist ? ' · ' + esc(c.dist) + ' km' : ''}</div>`).join('');
  if (s.note && !s.sansDetail) corps += `<div class="titre-section">Note</div><div>${esc(s.note)}</div>`;
  ouvrirFeuille(`<div class="tete-feuille"><h2>${TYPES[s.type].nom}, ${dateFR(s.date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2><button class="icone-btn" data-a="fermer">${ICO.croix}</button></div>
    <div class="muet petit" style="margin-bottom:6px">Début ${hFR(s.heure)}</div>
    <div class="carte">${corps}</div>
    <div class="duo"><button class="btn" data-a="modifier-seance" data-id="${s.id}">Modifier</button>
    <button class="btn danger" data-a="suppr-seance" data-id="${s.id}">Supprimer</button></div>`);
}
function modifierSeance(id) {
  if (seanceEnCours()) return toast("Termine d'abord la séance en cours");
  const s = DB.seances.find(x => x.id === id); if (!s) return;
  if (s.sansDetail) return feuilleModifSansDetail(s);
  UI.editionId = id; UI.snapshot = JSON.stringify(s);
  fermerFeuille(); aller('seance');
}
function feuilleModifSansDetail(s) {
  ouvrirFeuille(`<div class="tete-feuille"><h2>Séance sans détail</h2><button class="icone-btn" data-a="fermer">${ICO.croix}</button></div>
    <div class="duo"><label class="champ"><span>Date</span><input type="date" id="sd-date" value="${s.date}"></label>
    <label class="champ"><span>Début</span><select id="sd-heure">${optionsHeures(s.heure)}</select></label></div>
    <div class="champ"><span>Type</span><div class="puces" id="sd-type">${Object.entries(TYPES).map(([k, t]) =>
      `<button class="puce${k === s.type ? ' on' : ''}" data-a="puce-radio" data-v="${k}">${t.nom}</button>`).join('')}</div></div>
    <label class="champ"><span>Note</span><input id="sd-note" value="${esc(s.note)}"></label>
    <button class="btn plein large" data-a="valider-modif-sd" data-id="${s.id}">Enregistrer</button>`);
}

/* ===================== 11. Évolution ===================== */
function vueEvolution() {
  const f = UI.evoType;
  const seg = `<div class="segment">${['push', 'pull', 'legs', 'tous'].map(k =>
    `<button class="${k === f ? 'on' : ''}" data-a="evo-type" data-v="${k}">${k === 'tous' ? 'Tous' : TYPES[k].nom}</button>`).join('')}</div>`;
  const parCle = [...pointsParCle(f).values()];
  if (!parCle.length) return entete('Évolution') + `<main>${seg}<div class="vide">${MQ.svg('dos', { taille: 120 })}<p>Termine une séance pour voir tes courbes ici.</p></div></main>`;
  let html = '';
  for (const m of Object.keys(MUSCLES)) {
    const g = parCle.filter(v => v.d.muscle === m).sort((a, b) => a.d.nom.localeCompare(b.d.nom) || a.cle.localeCompare(b.cle));
    if (!g.length) continue;
    html += `<div class="muscle-tete">${MQ.svg(m, { taille: 46 })}<h3>${MUSCLES[m].nom}</h3></div>`;
    html += g.map(v => {
      const n = v.pts.length, der = v.pts[n - 1];
      const t = n > 1 ? comparer(der.m, v.pts[n - 2].m) : null;
      const badge = t === null ? '<span class="tendance stable">1re séance</span>'
        : `<span class="tendance ${t > 0 ? 'monte' : t < 0 ? 'baisse' : 'stable'}">${t > 0 ? '▲ Progrès' : t < 0 ? '▼ En baisse' : '= Stable'}</span>`;
      return `<button class="evo" data-a="voir-courbe" data-cle="${esc(v.cle)}">
        <div class="info"><div class="t">${esc(v.d.nom)}</div><div class="v">${esc(libVariante(v.e)) || 'Sans précision'}</div>
        <div class="v">Dernière : <b style="color:var(--texte)">${txtSerie(der.m)}</b></div>${badge}</div>
        ${graphe(v.pts, { w: 110, h: 44, mini: true })}</button>`;
    }).join('');
  }
  return entete('Évolution') + `<main>${seg}${html}</main>`;
}
/** Graphique SVG. mini = petite courbe sans axes */
function graphe(pts, o) {
  const parKg = pts.some(p => p.m.kg > 0);
  const val = p => parKg ? p.m.kg : p.m.r;
  const n = pts.length;
  const W = o.mini ? o.w : Math.max(o.w, n * 46), H = o.h;
  const pl = o.mini ? 4 : 34, pr = o.mini ? 6 : 16, pt = o.mini ? 6 : 24, pb = o.mini ? 6 : 26;
  const ys = pts.map(val);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= parKg ? 2 : 1; max += parKg ? 2 : 1; }
  const marge = (max - min) * 0.15; min -= marge; max += marge;
  if (min < 0 && Math.min(...ys) >= 0) min = 0;
  const X = i => n === 1 ? (pl + (W - pl - pr) / 2) : pl + i * (W - pl - pr) / (n - 1);
  const Y = v => pt + (1 - (v - min) / (max - min)) * (H - pt - pb);
  const classe = i => i === 0 ? 'p-premier' : { 1: 'p-monte', 0: 'p-stable', '-1': 'p-baisse' }[comparer(pts[i].m, pts[i - 1].m)];
  let s = `<svg class="graphe" viewBox="0 0 ${W} ${H}" ${o.mini ? `width="${W}" height="${H}" style="width:${W}px;flex:none"` : `style="min-width:${W}px"`}>`;
  if (!o.mini) {
    for (let k = 0; k <= 3; k++) {
      const v = min + (max - min) * k / 3, yy = Y(v);
      s += `<line class="grille" x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}"/><text class="axe" x="${pl - 6}" y="${yy + 3}" text-anchor="end">${fmtNum(Math.round(v * 2) / 2)}</text>`;
    }
    const pasDate = Math.max(1, Math.ceil(n / 6));
    pts.forEach((p, i) => {
      if (i % pasDate === 0 || i === n - 1) s += `<text class="axe" x="${X(i)}" y="${H - 8}" text-anchor="middle">${new Date(p.s.date + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })}</text>`;
    });
  }
  if (n > 1) s += `<path class="courbe" d="M${pts.map((p, i) => X(i).toFixed(1) + ',' + Y(val(p)).toFixed(1)).join(' L')}"/>`;
  pts.forEach((p, i) => {
    s += `<circle class="${classe(i)}" cx="${X(i).toFixed(1)}" cy="${Y(val(p)).toFixed(1)}" r="${o.mini ? (i === n - 1 ? 3.5 : 2.2) : 5}"/>`;
    if (!o.mini) s += `<text class="etiq" x="${X(i).toFixed(1)}" y="${(Y(val(p)) - 10).toFixed(1)}">${parKg ? fmtNum(p.m.kg) + '×' + p.m.r : p.m.r}</text>`;
  });
  return s + '</svg>';
}
function feuilleCourbe(cle) {
  const v = pointsParCle('tous').get(cle); if (!v) return;
  const parKg = v.pts.some(p => p.m.kg > 0);
  let record = v.pts[0];
  for (const p of v.pts) if (comparer(p.m, record.m) > 0) record = p;
  const lignes = [...v.pts].reverse().map((p, i, arr) => {
    const avant = arr[i + 1];
    const t = avant ? comparer(p.m, avant.m) : null;
    const pastille = t === null ? '' : `<span class="tendance ${t > 0 ? 'monte' : t < 0 ? 'baisse' : 'stable'}">${t > 0 ? '▲' : t < 0 ? '▼' : '='}</span>`;
    return `<tr><td>${dateFR(p.s.date, { day: 'numeric', month: 'short' })}<div class="muet petit">${ordinal(p.rang)} exo</div></td>
      <td><b>${txtSerie(p.m)}</b> ${pastille}<div class="muet petit">${esc(resumeSeries(p.e))}</div>${p.e.note ? `<div class="rappel" style="margin:2px 0 0">${esc(p.e.note)}</div>` : ''}</td></tr>`;
  }).join('');
  ouvrirFeuille(`<div class="tete-feuille"><h2>${esc(v.d.nom)}</h2><button class="icone-btn" data-a="fermer">${ICO.croix}</button></div>
    <div class="ligne" style="margin-bottom:8px">${MQ.svg(v.d.muscle, { taille: 64 })}<div><div><b>${esc(libVariante(v.e)) || 'Sans précision'}</b></div>
      <div class="muet petit">${MUSCLES[v.d.muscle]?.nom || ''} · ${v.pts.length} séance${v.pts.length > 1 ? 's' : ''}</div>
      <div class="petit" style="margin-top:3px">Record : <b>${txtSerie(record.m)}</b>, le ${dateFR(record.s.date, { day: 'numeric', month: 'short', year: 'numeric' })}</div></div></div>
    <div class="carte" style="overflow-x:auto;padding:10px 6px">${graphe(v.pts, { w: 330, h: 210 })}</div>
    <div class="legende"><span><i style="background:var(--vert)"></i>Progrès</span><span><i style="background:var(--gris)"></i>Stable</span><span><i style="background:var(--rouge)"></i>Baisse</span></div>
    <p class="muet petit">Chaque point est la meilleure série de la séance : ${parKg ? 'la charge compte d\'abord, puis les reps à charge égale' : 'nombre de reps (sans lest)'}.</p>
    <div class="carte"><table class="tab"><thead><tr><th>Date</th><th>Meilleure série et détail</th></tr></thead><tbody>${lignes}</tbody></table></div>`);
}

/* ===================== 12. Export CSV et copies ===================== */
function feuilleExport() {
  UI.exp = 30;
  ouvrirFeuille(`<div class="tete-feuille"><h2>Exporter mes performances</h2><button class="icone-btn" data-a="fermer">${ICO.croix}</button></div>
    <p class="muet petit" style="margin-top:0">Fichier CSV, une ligne par série. Tu peux le donner tel quel à ton assistant santé.</p>
    <div class="puces" id="exp-plage">${[[14, '2 semaines'], [30, '1 mois'], [61, '2 mois'], [91, '3 mois'], [0, 'Tout'], [-1, 'Dates au choix']].map(([v, l]) =>
      `<button class="puce${v === 30 ? ' on' : ''}" data-a="exp-plage" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="duo cache" id="exp-dates" style="margin-top:12px">
      <label class="champ"><span>Du</span><input type="date" id="exp-du" value="${decalerJours(auj(), -30)}"></label>
      <label class="champ"><span>Au</span><input type="date" id="exp-au" value="${auj()}"></label></div>
    <div class="muet petit" id="exp-info" style="margin:12px 2px"></div>
    <button class="btn plein large" data-a="exp-go">${ICO.export} Exporter</button>`);
  majInfoExport();
}
function plageExport() {
  const v = UI.exp;
  if (v === -1) return [$('#exp-du').value || '0000-01-01', $('#exp-au').value || auj()];
  if (v === 0) return ['0000-01-01', '9999-12-31'];
  return [decalerJours(auj(), -v), auj()];
}
function seancesPlage(du, au) {
  return terminees().filter(s => s.date >= du && s.date <= au).reverse();
}
function majInfoExport() {
  const [du, au] = plageExport();
  const n = seancesPlage(du, au).length;
  const el = $('#exp-info'); if (el) el.textContent = `${n} séance${n > 1 ? 's' : ''} dans cette période.`;
}
function csvCellule(v) {
  const s = v == null ? '' : String(v);
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exporterCSV() {
  const [du, au] = plageExport();
  const seances = seancesPlage(du, au);
  if (!seances.length) return toast('Aucune séance dans cette période');
  const L = [['date', 'heure_debut', 'type_seance', 'seance_sans_detail', 'ordre_exercice', 'exercice', 'forme', 'prise_position', 'muscle_principal',
    'serie', 'repetitions', 'charge_kg', 'duree_min', 'distance_km', 'note']];
  for (const s of seances) {
    const base = [s.date, s.heure, TYPES[s.type].nom];
    if (s.sansDetail) { L.push([...base, 'oui', '', '', '', '', '', '', '', '', '', '', s.note]); continue; }
    s.exos.forEach((e, i) => {
      const d = exo(e.ex);
      e.series.forEach((se, k) => {
        if (se.r === '' && se.kg === '') return;
        L.push([...base, 'non', i + 1, d.nom, e.forme, e.prise, MUSCLES[d.muscle]?.nom || '', k + 1,
          num(se.r) ?? '', e.forme === 'Poids du corps' && se.kg === '' ? 0 : (num(se.kg) ?? ''), '', '', k === 0 ? e.note : '']);
      });
    });
    s.cardio.forEach(c => L.push([...base, 'non', '', 'Cardio : ' + c.type, '', '', '', '', '', '', num(c.duree) ?? '', num(c.dist) ?? '', '']));
    if (s.note) L.push([...base, 'non', '', 'Note de séance', '', '', '', '', '', '', '', '', s.note]);
  }
  const csv = '﻿' + L.map(r => r.map(csvCellule).join(';')).join('\r\n');
  const nom = `carnet-sport_${du === '0000-01-01' ? seances[0].date : du}_${au === '9999-12-31' ? auj() : au}.csv`;
  partagerFichier(csv, nom, 'text/csv');
}
/** Partage iPhone (Fichiers, Mail, applis) ou téléchargement classique */
function partagerFichier(contenu, nom, type) {
  const f = new File([contenu], nom, { type });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    navigator.share({ files: [f], title: nom }).catch(e => { if (e.name !== 'AbortError') telecharger(f, nom); });
    return;
  }
  telecharger(f, nom);
}
function telecharger(f, nom) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(f); a.download = nom; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
function exporterCopie() {
  partagerFichier(JSON.stringify(DB), `carnet-sport-copie_${auj()}.json`, 'application/json');
}
function importerCopie(fichier) {
  const lecteur = new FileReader();
  lecteur.onload = () => {
    try {
      const d = JSON.parse(lecteur.result);
      if (!Array.isArray(d.seances)) throw new Error();
      DB = fusionner(DB, d); sauver(); rendre();
      toast('Copie importée et fusionnée');
    } catch (e) { toast("Ce fichier n'est pas une copie du carnet"); }
  };
  lecteur.readAsText(fichier);
}

/* ===================== 13. Réglages ===================== */
function vueReglages() {
  const der = CONF.derniereSync ? new Date(CONF.derniereSync).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'jamais';
  const perso = DB.exosPerso.filter(e => !e.supprime);
  const lienMinuteur = location.origin + location.pathname + '#minuteur';
  return entete('Réglages') + `<main>
    <div class="titre-section">Sauvegarde GitHub</div>
    <div class="carte">
      <p class="muet petit" style="margin-top:0">Tes séances sont envoyées dans un dépôt privé à chaque saisie. Sur un nouveau téléphone, il suffit de remettre ces trois champs pour tout récupérer.</p>
      <div class="duo"><label class="champ"><span>Compte</span><input id="cf-proprio" value="${esc(CONF.proprio)}" autocapitalize="off" autocorrect="off"></label>
      <label class="champ"><span>Dépôt privé</span><input id="cf-depot" value="${esc(CONF.depot)}" autocapitalize="off" autocorrect="off"></label></div>
      <label class="champ"><span>Jeton d'accès</span><input id="cf-jeton" type="password" value="${esc(CONF.jeton)}" placeholder="github_pat_…" autocapitalize="off" autocorrect="off"></label>
      <div class="duo"><button class="btn plein" data-a="cf-tester">Tester et enregistrer</button><button class="btn" data-a="sync">Synchroniser</button></div>
      <div class="muet petit" style="margin-top:10px">Dernière sauvegarde : <span id="cf-der">${der}</span>${SYNC.message ? ` · <span style="color:var(--rouge)">${esc(SYNC.message)}</span>` : ''}</div>
    </div>

    <div class="titre-section">Export</div>
    <div class="carte">
      <button class="btn large" data-a="export">${ICO.export} Exporter mes performances (CSV)</button>
      <div class="duo" style="margin-top:10px"><button class="btn fin" data-a="copie">Copie de secours</button><button class="btn fin" data-a="importer">Importer une copie</button></div>
      <input type="file" id="imp-fichier" accept=".json,application/json" class="cache">
    </div>

    <div class="titre-section">Minuteur</div>
    <div class="carte">
      <div class="muet petit" style="margin-bottom:8px">Durée proposée par défaut</div>
      <div class="puces">${[60, 90, 120, 150, 180].map(v => `<button class="puce${v === CONF.repos ? ' on' : ''}" data-a="cf-repos" data-v="${v}">${fmtMin(v * 1000)}</button>`).join('')}</div>
      <p class="muet petit">Raccourci iPhone (Toucher le dos) : action « Ouvrir les URL » avec<br><code style="word-break:break-all">${esc(lienMinuteur)}</code></p>
    </div>

    <div class="titre-section">Mes exercices créés</div>
    <div class="carte">${perso.length ? perso.map(e => `<div class="ligne entre" style="padding:6px 0">${MQ.svg(e.muscle, { taille: 40 })}<div style="flex:1"><b>${esc(e.nom)}</b><div class="muet petit">${TYPES[e.type].nom} · ${MUSCLES[e.muscle]?.nom}</div></div>
      <button class="icone-btn" data-a="suppr-perso" data-id="${e.id}" aria-label="Retirer">${ICO.croix}</button></div>`).join('')
      : '<div class="muet petit">Aucun pour l\'instant. Le bouton « Créer un nouvel exercice » est dans la liste des exercices.</div>'}</div>

    <p class="muet petit" style="text-align:center;margin:24px 0">Carnet sport · version ${VERSION}</p>
  </main>`;
}

/* ===================== 14. Sauvegarde GitHub ===================== */
const SYNC = { etat: '', minuterie: null, enCours: false, encore: false, message: '' };
function pastilleSync() {
  if (!CONF.jeton) return '<button class="sync-pastille" data-a="aller-reglages"><i></i>Local</button>';
  const txt = { ok: 'Sauvegardé', err: 'Erreur', encours: 'Envoi…' }[SYNC.etat] || 'GitHub';
  return `<button class="sync-pastille ${SYNC.etat}" data-a="sync"><i></i>${txt}</button>`;
}
function etatSync(etat, message = '') {
  SYNC.etat = etat; SYNC.message = etat === 'err' ? message : '';
  const p = $('.sync-pastille'); if (p) p.outerHTML = pastilleSync();
  const d = $('#cf-der');
  if (d && CONF.derniereSync) d.textContent = new Date(CONF.derniereSync).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function planifierSync() {
  if (!CONF.jeton) return;
  clearTimeout(SYNC.minuterie); SYNC.minuterie = setTimeout(() => synchroniser(false), 2500);
}
const urlFichier = () => `https://api.github.com/repos/${encodeURIComponent(CONF.proprio)}/${encodeURIComponent(CONF.depot)}/contents/donnees.json`;
const enTetes = brut => ({
  Authorization: 'Bearer ' + CONF.jeton,
  Accept: brut ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
});
const b64enc = s => {
  const o = new TextEncoder().encode(s); let bin = '';
  for (let i = 0; i < o.length; i += 0x8000) bin += String.fromCharCode.apply(null, o.subarray(i, i + 0x8000));
  return btoa(bin);
};
const b64dec = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, '')), c => c.charCodeAt(0)));

async function lireDistant() {
  const r = await fetch(urlFichier(), { headers: enTetes(false), cache: 'no-store' });
  if (r.status === 404) return { sha: null, db: null };
  if (r.status === 401 || r.status === 403) throw new Error('jeton refusé');
  if (!r.ok) throw new Error('GitHub ' + r.status);
  const j = await r.json();
  let txt = j.content ? b64dec(j.content) : '';
  if (!txt && j.size > 0) {                       // fichier de plus de 1 Mo : lecture brute
    const r2 = await fetch(urlFichier(), { headers: enTetes(true), cache: 'no-store' });
    txt = await r2.text();
  }
  return { sha: j.sha, db: txt ? JSON.parse(txt) : null };
}
async function ecrireDistant(db, sha) {
  const corps = { message: 'Carnet sport ' + new Date().toISOString().slice(0, 16).replace('T', ' '), content: b64enc(JSON.stringify(db)) };
  if (sha) corps.sha = sha;
  const r = await fetch(urlFichier(), { method: 'PUT', headers: { ...enTetes(false), 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
  if (r.status === 409 || r.status === 422) { const e = new Error('conflit'); e.conflit = true; throw e; }
  if (r.status === 401 || r.status === 403) throw new Error('jeton refusé');
  if (r.status === 404) throw new Error('dépôt introuvable');
  if (!r.ok) throw new Error('GitHub ' + r.status);
}
/** Fusion de deux états : pour chaque séance, la version modifiée le plus récemment l'emporte */
function fusionner(a, b) {
  const parId = (la, lb) => {
    const m = new Map();
    for (const x of [...(la || []), ...(lb || [])]) {
      const y = m.get(x.id);
      if (!y || (x.maj || 0) > (y.maj || 0)) m.set(x.id, x);
    }
    return [...m.values()].sort((x, y) => (x.id < y.id ? -1 : 1));
  };
  const union = (oa = {}, ob = {}) => {
    const r = {};
    for (const k of [...new Set([...Object.keys(oa), ...Object.keys(ob)])].sort()) r[k] = uniq([...(oa[k] || []), ...(ob[k] || [])]);
    return r;
  };
  return {
    v: 1, seances: parId(a.seances, b.seances), exosPerso: parId(a.exosPerso, b.exosPerso),
    prisesPerso: union(a.prisesPerso, b.prisesPerso), formesPerso: union(a.formesPerso, b.formesPerso),
    maj: Math.max(a.maj || 0, b.maj || 0)
  };
}
const canon = d => { const f = fusionner(d, {}); f.maj = 0; return JSON.stringify(f); };

async function synchroniser(manuel) {
  if (!CONF.jeton) { if (manuel) toast('Renseigne le jeton dans les réglages'); return; }
  if (SYNC.enCours) { SYNC.encore = true; return; }
  SYNC.enCours = true; etatSync('encours');
  try {
    for (let essai = 0; essai < 3; essai++) {
      const { sha, db } = await lireDistant();
      const avant = canon(DB);
      const fus = db ? fusionner(DB, db) : fusionner(DB, {});
      if (canon(fus) !== avant) {               // des données sont arrivées d'ailleurs
        DB = fus; localStorage.setItem(CLE_DB, JSON.stringify(DB));
        const saisie = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        if (!saisie && !feuilleOuverte()) rendre();
      }
      if (!db || canon(db) !== canon(DB)) {
        try { await ecrireDistant(DB, sha); }
        catch (e) { if (e.conflit) continue; throw e; }
      }
      break;
    }
    CONF.derniereSync = Date.now(); sauverConf();
    etatSync('ok');
    if (manuel) toast('Sauvegarde GitHub à jour');
  } catch (e) {
    etatSync('err', e.message === 'Failed to fetch' ? 'pas de connexion' : e.message);
    if (manuel) toast('Sauvegarde impossible : ' + SYNC.message);
  } finally {
    SYNC.enCours = false;
    if (SYNC.encore) { SYNC.encore = false; planifierSync(); }
  }
}
async function testerConfig() {
  CONF.proprio = $('#cf-proprio').value.trim();
  CONF.depot = $('#cf-depot').value.trim();
  CONF.jeton = $('#cf-jeton').value.trim();
  sauverConf();
  if (!CONF.jeton) { etatSync(''); return toast('Jeton retiré, sauvegarde locale seulement'); }
  try {
    const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(CONF.proprio)}/${encodeURIComponent(CONF.depot)}`, { headers: enTetes(false), cache: 'no-store' });
    if (r.status === 401) return toast('Jeton refusé par GitHub');
    if (r.status === 404 || r.status === 403) return toast("Dépôt introuvable, ou le jeton n'y a pas accès");
    if (!r.ok) return toast('GitHub répond ' + r.status);
    const j = await r.json();
    if (!j.private) toast('Attention : ce dépôt est public');
  } catch (e) { return toast('Pas de connexion'); }
  await synchroniser(true);
  rendre();
}

/* ===================== 15. Événements et démarrage ===================== */
const ACTIONS = {
  'fermer': () => fermerFeuille(),
  'aller-reglages': () => aller('reglages'),
  'commencer': b => commencer(b.dataset.type),
  'sans-detail': () => feuilleSansDetail(),
  'valider-sans-detail': () => validerSansDetail(),
  'puce-radio': b => { $$('.puce', b.parentElement).forEach(p => p.classList.toggle('on', p === b)); },
  'puce-multi': b => b.classList.toggle('on'),
  'ajouter-exo': () => ouvrirSelecteur('ajout'),
  'ajouter-exo-retour': () => ouvrirSelecteur(UI.sel?.mode || 'ajout', UI.sel?.uid),
  'remplacer-exo': b => ouvrirSelecteur('remplacer', b.closest('.exo').dataset.uid),
  'suppr-exo': b => {
    const { s, e } = exoDe(b); if (!e) return;
    if (aDesValeurs(e) && !confirm(`Retirer « ${exo(e.ex).nom} » de la séance ?`)) return;
    s.exos = s.exos.filter(x => x !== e); toucher(s); sauver(); rendreListe();
  },
  'plus-serie': b => { const { s, e } = exoDe(b); e.series.push({ r: '', kg: '' }); toucher(s); sauver(); rendreCarte(e.uid); },
  'moins-serie': b => {
    const { s, e } = exoDe(b); if (e.series.length <= 1) return;
    const der = e.series[e.series.length - 1];
    if ((der.r !== '' || der.kg !== '') && !confirm('La dernière série contient des valeurs. La retirer ?')) return;
    e.series.pop(); toucher(s); sauver(); rendreCarte(e.uid);
  },
  'note-exo': b => {
    const zone = b.closest('.exo').querySelector('.note-exo');
    zone.classList.remove('cache'); UI.notes.add(b.closest('.exo').dataset.uid); zone.querySelector('textarea').focus();
  },
  'ajouter-cardio': () => {
    const s = courante(); s.cardio.push({ uid: uid(), type: CARDIO_TYPES[0], duree: '', dist: '' });
    toucher(s); sauver(); rendre();
    setTimeout(() => { const c = $$('[data-cardio]').pop(); c?.scrollIntoView({ block: 'center' }); c?.querySelector('[data-cf="duree"]')?.focus(); }, 50);
  },
  'suppr-cardio': b => { const s = courante(); s.cardio = s.cardio.filter(c => c.uid !== b.closest('[data-cardio]').dataset.cardio); toucher(s); sauver(); rendre(); },
  'terminer': () => terminer(),
  'abandonner': () => {
    const s = courante(); if (!s || !confirm('Supprimer définitivement cette séance ?')) return;
    s.supprime = true; toucher(s); sauver(); rendre(); toast('Séance supprimée');
  },
  'annuler-edition': () => {
    if (UI.snapshot) {
      const orig = JSON.parse(UI.snapshot); orig.maj = Date.now();
      DB.seances = DB.seances.map(s => s.id === orig.id ? orig : s);
    }
    UI.editionId = null; UI.snapshot = null; sauver(); aller('historique');
  },
  'sel-filtre': b => { UI.sel.filtre = b.dataset.v; $('#sel-seg').innerHTML = segFiltre(); $('#sel-liste').innerHTML = listeSelecteurHTML(); },
  'choisir-exo': b => feuilleVariante(b.dataset.id),
  'vari-forme': b => { UI.vari.forme = b.dataset.v; rendreVariante(); },
  'vari-prise': b => { UI.vari.prise = b.dataset.v; rendreVariante(); },
  'vari-autre': b => { const n = ajouterPerso(b.dataset.v, UI.vari.id); if (n) { UI.vari[b.dataset.v] = n; rendreVariante(); } },
  'vari-ok': () => validerVariante(),
  'creer-exo': () => feuilleCreation(),
  'valider-creation': () => validerCreation(),
  'minuteur': () => { debloquerSon(); feuilleMinuteur(); },
  'min-duree': b => {
    MIN.duree = +b.dataset.v; CONF.repos = MIN.duree; sauverConf();
    if (MIN.fin) lancerMinuteur();
    $$('[data-a="min-duree"]').forEach(p => p.classList.toggle('on', p === b)); tick();
  },
  'min-ajuste': b => {
    const d = +b.dataset.v;
    if (MIN.fin) MIN.fin = Math.max(Date.now() + 1000, MIN.fin + d * 1000);
    else MIN.duree = Math.max(15, MIN.duree + d);
    tick();
  },
  'min-go': () => { debloquerSon(); MIN.fin ? arreterMinuteur() : lancerMinuteur(); },
  'voir-seance': b => feuilleSeance(b.dataset.id),
  'modifier-seance': b => modifierSeance(b.dataset.id),
  'suppr-seance': b => {
    const s = DB.seances.find(x => x.id === b.dataset.id);
    if (!s || !confirm('Supprimer définitivement cette séance ?')) return;
    s.supprime = true; toucher(s); sauver(); fermerFeuille(); rendre(); toast('Séance supprimée');
  },
  'valider-modif-sd': b => {
    const s = DB.seances.find(x => x.id === b.dataset.id);
    Object.assign(s, { date: $('#sd-date').value, heure: $('#sd-heure').value, type: $('#sd-type .puce.on')?.dataset.v || s.type, note: $('#sd-note').value.trim() });
    toucher(s); sauver(); fermerFeuille(); rendre();
  },
  'evo-type': b => { UI.evoType = b.dataset.v; rendre(); },
  'voir-courbe': b => feuilleCourbe(b.dataset.cle),
  'export': () => feuilleExport(),
  'exp-plage': b => {
    UI.exp = +b.dataset.v;
    $$('#exp-plage .puce').forEach(p => p.classList.toggle('on', p === b));
    $('#exp-dates').classList.toggle('cache', UI.exp !== -1); majInfoExport();
  },
  'exp-go': () => exporterCSV(),
  'copie': () => exporterCopie(),
  'importer': () => $('#imp-fichier').click(),
  'cf-tester': () => testerConfig(),
  'cf-repos': b => { CONF.repos = +b.dataset.v; MIN.duree = CONF.repos; sauverConf(); rendre(); },
  'sync': () => synchroniser(true),
  'suppr-perso': b => {
    const e = DB.exosPerso.find(x => x.id === b.dataset.id);
    if (!e || !confirm(`Retirer « ${e.nom} » de la liste ? Son historique est conservé.`)) return;
    e.supprime = true; e.maj = Date.now(); sauver(); rendre();
  }
};

document.addEventListener('click', ev => {
  const o = ev.target.closest('[data-onglet]');
  if (o) { aller(o.dataset.onglet); return; }
  const b = ev.target.closest('[data-a]');
  if (b && ACTIONS[b.dataset.a]) { ev.preventDefault(); ACTIONS[b.dataset.a](b, ev); }
});
$('#voile').addEventListener('click', fermerFeuille);

document.addEventListener('pointerdown', ev => {
  const h = ev.target.closest('[data-poignee]');
  if (h) demarrerGlisse(ev, h);
});

document.addEventListener('input', ev => {
  const t = ev.target, s = courante();
  if (t.dataset.serie != null && s) {
    const { e } = exoDe(t); if (!e) return;
    const v = t.value.replace(/[^\d.,]/g, '');
    if (v !== t.value) t.value = v;
    e.series[+t.dataset.serie][t.dataset.f] = v;
    t.classList.toggle('rempli', v !== '');
    toucher(s); sauverDiff(); return;
  }
  if (t.dataset.champE === 'note' && s) { const { e } = exoDe(t); e.note = t.value; toucher(s); sauverDiff(); return; }
  if (t.dataset.champS === 'note' && s) { s.note = t.value; toucher(s); sauverDiff(); return; }
  if (t.dataset.cf && s) {
    const c = s.cardio.find(x => x.uid === t.closest('[data-cardio]').dataset.cardio);
    c[t.dataset.cf] = t.value.replace(/[^\d.,]/g, ''); toucher(s); sauverDiff(); return;
  }
  if (t.id === 'sel-q') { UI.sel.q = t.value; $('#sel-liste').innerHTML = listeSelecteurHTML(); return; }
  if (t.id === 'exp-du' || t.id === 'exp-au') majInfoExport();
});

document.addEventListener('change', ev => {
  const t = ev.target, s = courante();
  if ((t.dataset.champS === 'date' || t.dataset.champS === 'heure') && s) {
    s[t.dataset.champS] = t.value || s[t.dataset.champS]; toucher(s); sauver(); rendreListe(); return;
  }
  if (t.dataset.sel && s) {
    const { e } = exoDe(t); if (!e) return;
    let v = t.value;
    if (v === '__autre') { v = ajouterPerso(t.dataset.sel, e.ex); if (!v) { rendreCarte(e.uid); return; } }
    e[t.dataset.sel] = v; toucher(s); sauver(); rendreCarte(e.uid); return;
  }
  if (t.hasAttribute('data-cardio-type') && s) {
    const c = s.cardio.find(x => x.uid === t.closest('[data-cardio]').dataset.cardio);
    let v = t.value;
    if (v === '__autre') v = (prompt('Activité (ex. Natation)') || '').trim() || c.type;
    c.type = v; toucher(s); sauver(); rendre(); return;
  }
  if (t.id === 'imp-fichier' && t.files[0]) importerCopie(t.files[0]);
});

function verifierHash() {
  const m = location.hash.match(/^#minuteur(?:-(\d+))?/);
  if (!m) return;
  history.replaceState(null, '', location.pathname);
  if (m[1]) { MIN.duree = Math.max(15, +m[1]); lancerMinuteur(); }
  feuilleMinuteur();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { if (sauverDiff.t) sauver(); }
  else { synchroniser(false); if (MIN.fin) tick(); }
});
window.addEventListener('pagehide', () => { if (sauverDiff.t) sauver(false); });
window.addEventListener('hashchange', verifierHash);
window.addEventListener('online', () => synchroniser(false));

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
autoCloture();
rendre();
verifierHash();
synchroniser(false);
