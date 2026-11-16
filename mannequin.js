/* =========================================================
   Mannequin : silhouette stylisée, vue de face ou de dos,
   le muscle ciblé ressort en couleur.
   Dessin original, coordonnées dans un repère 100 x 200.
   Les formes « gauche » sont dessinées une fois puis
   reflétées par symétrie (matrix -1 0 0 1 100 0).
   ========================================================= */

const MQ = (() => {
  const MIRROR = 'matrix(-1 0 0 1 100 0)';

  // Silhouette commune aux deux vues
  const silGauche = [
    '<ellipse cx="24" cy="52" rx="6.6" ry="15" transform="rotate(12 24 52)"/>',
    '<ellipse cx="18.6" cy="80" rx="5.6" ry="14" transform="rotate(8 18.6 80)"/>',
    '<ellipse cx="16" cy="98" rx="4" ry="5"/>',
    '<ellipse cx="41.5" cy="128" rx="9.6" ry="25" transform="rotate(3 41.5 128)"/>',
    '<ellipse cx="41" cy="166" rx="6.6" ry="19"/>',
    '<ellipse cx="39.5" cy="188" rx="6.2" ry="3.6"/>'
  ].join('');
  const silCentre = [
    '<ellipse cx="50" cy="15" rx="9" ry="10"/>',
    '<rect x="45" y="22" width="10" height="10" rx="3"/>',
    '<path d="M30,34 C38,30 62,30 70,34 C73,36 73,44 71,52 C69,62 66,72 65,84 C64,92 66,98 67,106 L33,106 C34,98 36,92 35,84 C34,72 31,62 29,52 C27,44 27,36 30,34 Z"/>'
  ].join('');

  // Muscles : pour chaque muscle, formes du côté gauche (+ centre éventuel)
  const FACE = {
    pectoraux:   { g: '<path d="M49,39 C43,37 35,38 32,42 C31,48 34,55 40,56 C45,57 49,54 49,50 Z"/>' },
    epaules:     { g: '<ellipse cx="30.6" cy="40.5" rx="4.6" ry="5.6"/>' },
    epaules_lat: { g: '<ellipse cx="26.4" cy="41.5" rx="3.4" ry="6.2" transform="rotate(10 26.4 41.5)"/>' },
    biceps:      { g: '<ellipse cx="23.6" cy="54" rx="4" ry="9.5" transform="rotate(12 23.6 54)"/>' },
    avant_bras:  { g: '<ellipse cx="18.8" cy="79" rx="3.8" ry="11" transform="rotate(8 18.8 79)"/>' },
    abdos:       { c: '<rect x="43.5" y="59" width="13" height="31" rx="5"/>' },
    quadriceps:  { g: '<ellipse cx="41" cy="127" rx="7.4" ry="20" transform="rotate(3 41 127)"/>' },
    adducteurs:  { g: '<ellipse cx="47.6" cy="117" rx="2.8" ry="9.5"/>' }
  };
  const DOS = {
    trapezes:     { c: '<path d="M42,29 C46,27 54,27 58,29 L68,36 C62,40 56,45 53,60 L47,60 C44,45 38,40 32,36 Z"/>' },
    epaules_post: { g: '<ellipse cx="29.6" cy="41" rx="4.8" ry="5.6"/>' },
    epaules_lat:  { g: '<ellipse cx="26.2" cy="42" rx="3.2" ry="6" transform="rotate(10 26.2 42)"/>' },
    dos:          { g: '<path d="M33,46 C36,44 42,46 46,50 L47,72 C44,78 40,80 38,78 C35,68 32,56 33,46 Z"/>' },
    lombaires:    { c: '<rect x="44.5" y="72" width="11" height="20" rx="4"/>' },
    triceps:      { g: '<ellipse cx="23.8" cy="53" rx="4.3" ry="10" transform="rotate(12 23.8 53)"/>' },
    avant_bras:   { g: '<ellipse cx="18.8" cy="79" rx="3.8" ry="11" transform="rotate(8 18.8 79)"/>' },
    fessiers:     { g: '<ellipse cx="42.5" cy="106" rx="8" ry="8.5"/>' },
    ischios:      { g: '<ellipse cx="41.8" cy="133" rx="7" ry="16" transform="rotate(3 41.8 133)"/>' },
    mollets:      { g: '<ellipse cx="41.3" cy="162" rx="5.3" ry="10"/>' }
  };

  function couche(def, cls) {
    let s = '';
    if (def.c) s += `<g class="${cls}">${def.c}</g>`;
    if (def.g) s += `<g class="${cls}">${def.g}</g><g class="${cls}" transform="${MIRROR}">${def.g}</g>`;
    return s;
  }

  function vueDe(muscle) {
    if (muscle && typeof MUSCLES !== 'undefined' && MUSCLES[muscle]) return MUSCLES[muscle].vue;
    return 'face';
  }

  /** svg(muscle, {vue, taille}) → chaîne SVG */
  function svg(muscle, opts = {}) {
    const vue = opts.vue || vueDe(muscle);
    const set = vue === 'dos' ? DOS : FACE;
    const h = opts.taille || 64;
    let muscles = '';
    for (const k in set) if (k !== muscle) muscles += couche(set[k], 'mq-mu');
    if (set[muscle]) muscles += couche(set[muscle], 'mq-on');
    // petites lignes des abdos pour la vue de face
    const details = vue === 'face'
      ? '<g class="mq-ligne"><path d="M50,60 V89 M44,67 H56 M44,75 H56 M44,82.5 H56"/></g>'
      : '<g class="mq-ligne"><path d="M50,30 V70"/></g>';
    return `<svg class="mq" viewBox="0 0 100 200" height="${h}" width="${h / 2}" aria-hidden="true">
      <g class="mq-sil">${silCentre}${silGauche}<g transform="${MIRROR}">${silGauche}</g></g>
      ${muscles}${details}
    </svg>`;
  }

  return { svg, vueDe };
})();
