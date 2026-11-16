/* =========================================================
   Carnet de sport — base d'exercices de départ
   Chaque exercice : id, nom, type (push/pull/legs), muscle,
   formes proposées, prises/positions proposées, desc facultative.
   Un exercice suivi = mouvement + forme + prise : deux formes
   ou deux prises différentes ont chacune leur historique.
   ========================================================= */

const MUSCLES = {
  pectoraux:   { nom: 'Pectoraux',         vue: 'face' },
  epaules:     { nom: 'Épaules (avant)',   vue: 'face' },
  epaules_lat: { nom: 'Épaules (côté)',    vue: 'face' },
  epaules_post:{ nom: "Arrière d'épaule",  vue: 'dos'  },
  trapezes:    { nom: 'Trapèzes',          vue: 'dos'  },
  dos:         { nom: 'Dorsaux',           vue: 'dos'  },
  lombaires:   { nom: 'Lombaires',         vue: 'dos'  },
  biceps:      { nom: 'Biceps',            vue: 'face' },
  triceps:     { nom: 'Triceps',           vue: 'dos'  },
  avant_bras:  { nom: 'Avant-bras',        vue: 'face' },
  abdos:       { nom: 'Abdominaux',        vue: 'face' },
  quadriceps:  { nom: 'Quadriceps',        vue: 'face' },
  ischios:     { nom: 'Ischio-jambiers',   vue: 'dos'  },
  fessiers:    { nom: 'Fessiers',          vue: 'dos'  },
  adducteurs:  { nom: 'Adducteurs',        vue: 'face' },
  mollets:     { nom: 'Mollets',           vue: 'dos'  }
};

const FORMES = ['Barre', 'Haltères', 'Machine guidée', 'Smith machine', 'Poulie', 'Poids du corps', 'Kettlebell'];

const TYPES = {
  push: { nom: 'Push', desc: 'Pectoraux, épaules, triceps' },
  pull: { nom: 'Pull', desc: 'Dos, trapèzes, biceps' },
  legs: { nom: 'Legs', desc: 'Jambes, fessiers, mollets' }
};

const CARDIO_TYPES = ['Vélo', 'Tapis de course', 'Rameur', 'Elliptique', 'Escalier', 'Corde à sauter'];

const CATALOGUE = [
  /* ---------- PUSH ---------- */
  { id: 'dev_couche', nom: 'Développé couché', type: 'push', muscle: 'pectoraux',
    formes: ['Barre', 'Haltères', 'Machine guidée', 'Smith machine'], prises: ['Prise serrée', 'Prise large'] },
  { id: 'dev_incline', nom: 'Développé incliné', type: 'push', muscle: 'pectoraux',
    formes: ['Barre', 'Haltères', 'Machine guidée', 'Smith machine'], prises: ['Prise serrée', 'Prise large'] },
  { id: 'ecarte', nom: 'Écarté (pec fly)', type: 'push', muscle: 'pectoraux',
    formes: ['Machine guidée', 'Poulie', 'Haltères'], prises: ['Poulies hautes', 'Poulies mi-hauteur', 'Poulies basses'] },
  { id: 'dips', nom: 'Dips', type: 'push', muscle: 'pectoraux',
    formes: ['Poids du corps', 'Machine guidée'], prises: ['Buste penché (pecs)', 'Buste droit (triceps)'] },
  { id: 'dev_militaire', nom: 'Développé militaire', type: 'push', muscle: 'epaules',
    formes: ['Haltères', 'Smith machine', 'Barre', 'Machine guidée'], prises: ['Debout', 'Assis'] },
  { id: 'elev_lat', nom: 'Élévations latérales', type: 'push', muscle: 'epaules_lat',
    formes: ['Haltères', 'Poulie', 'Machine guidée'], prises: ['Bilatéral', 'Unilatéral', 'Assis'] },
  { id: 'skullcrusher', nom: 'Skullcrusher', type: 'push', muscle: 'triceps',
    formes: ['Barre', 'Haltères', 'Poulie'], prises: ['Barre droite', 'Barre EZ'] },
  { id: 'ext_tri_poulie', nom: 'Extension triceps à la poulie', type: 'push', muscle: 'triceps',
    formes: ['Poulie'], prises: ['Barre droite', 'Barre en V', 'Corde', 'Poignée simple', 'Prise inversée'] },
  { id: 'ext_tri_tete', nom: 'Extension triceps au-dessus de la tête', type: 'push', muscle: 'triceps',
    formes: ['Poulie', 'Haltères', 'Machine guidée'], prises: ['Corde', 'Barre droite', 'Barre EZ', 'Haltère à deux mains'] },

  /* ---------- PULL ---------- */
  { id: 'tractions', nom: 'Tractions', type: 'pull', muscle: 'dos',
    formes: ['Poids du corps', 'Machine guidée'], prises: ['Pronation large', 'Pronation serrée', 'Supination', 'Neutre'] },
  { id: 'tirage_vert', nom: 'Tirage vertical', type: 'pull', muscle: 'dos',
    formes: ['Poulie', 'Machine guidée'], prises: ['Barre large pronation', 'Triangle (neutre serré)', 'Supination', 'Unilatéral'] },
  { id: 'iliac_pulldown', nom: 'Iliac pulldown', type: 'pull', muscle: 'dos',
    formes: ['Poulie', 'Machine guidée'], prises: ['Unilatéral', 'Poignée simple'], desc: 'Tirage du coude vers la hanche' },
  { id: 'tirage_horiz_serre', nom: 'Tirage horizontal coudes serrés', type: 'pull', muscle: 'dos',
    formes: ['Poulie', 'Machine guidée'], prises: ['Triangle (neutre)', 'Barre en V', 'Poignée simple'], desc: 'Coudes près du corps, dorsaux' },
  { id: 'tirage_horiz_ecarte', nom: 'Tirage horizontal coudes écartés', type: 'pull', muscle: 'trapezes',
    formes: ['Poulie', 'Machine guidée'], prises: ['Barre large pronation', 'Corde'], desc: 'Coudes ouverts, trapèzes et haut du dos' },
  { id: 'rowing', nom: 'Rowing', type: 'pull', muscle: 'dos',
    formes: ['Barre', 'Haltères', 'Machine guidée', 'Smith machine'], prises: ['Pronation', 'Supination', 'Unilatéral', 'Sur banc incliné'] },
  { id: 'pullover', nom: 'Pull-over à la poulie', type: 'pull', muscle: 'dos',
    formes: ['Poulie'], prises: ['Barre droite', 'Corde'] },
  { id: 'face_pull', nom: 'Face pull', type: 'pull', muscle: 'epaules_post',
    formes: ['Poulie'], prises: ['Corde'] },
  { id: 'oiseau', nom: 'Oiseau', type: 'pull', muscle: 'epaules_post',
    formes: ['Haltères', 'Machine guidée', 'Poulie'], prises: ['Buste penché', 'Assis'] },
  { id: 'curl', nom: 'Curl biceps', type: 'pull', muscle: 'biceps',
    formes: ['Barre', 'Haltères', 'Poulie', 'Machine guidée'], prises: ['Barre droite', 'Barre EZ', 'Alterné', 'Simultané'] },
  { id: 'curl_incline', nom: 'Curl banc incliné', type: 'pull', muscle: 'biceps',
    formes: ['Haltères'], prises: ['Simultané', 'Alterné'], desc: 'Portion longue du biceps' },
  { id: 'curl_marteau', nom: 'Curl marteau', type: 'pull', muscle: 'biceps',
    formes: ['Haltères', 'Poulie'], prises: ['Neutre', 'Corde'] },
  { id: 'curl_pupitre', nom: 'Curl pupitre', type: 'pull', muscle: 'biceps',
    formes: ['Barre', 'Haltères', 'Machine guidée'], prises: ['Barre EZ', 'Unilatéral'] },
  { id: 'shrugs', nom: 'Shrugs', type: 'pull', muscle: 'trapezes',
    formes: ['Barre', 'Haltères', 'Smith machine', 'Machine guidée'], prises: [] },

  /* ---------- LEGS ---------- */
  { id: 'squat', nom: 'Squat', type: 'legs', muscle: 'quadriceps',
    formes: ['Barre', 'Smith machine', 'Haltères', 'Machine guidée'], prises: ['Barre haute', 'Barre basse', 'Goblet', 'Hack squat'] },
  { id: 'presse', nom: 'Presse à cuisses', type: 'legs', muscle: 'quadriceps',
    formes: ['Machine guidée'], prises: ['Pieds bas', 'Pieds hauts', 'Unilatéral'] },
  { id: 'fentes', nom: 'Fentes', type: 'legs', muscle: 'quadriceps',
    formes: ['Haltères', 'Barre', 'Smith machine', 'Poids du corps'], prises: ['Avant', 'Arrière', 'Bulgares'] },
  { id: 'sdt_roumain', nom: 'Soulevé de terre roumain', type: 'legs', muscle: 'ischios',
    formes: ['Barre', 'Haltères', 'Smith machine'], prises: [] },
  { id: 'leg_ext', nom: 'Leg extension', type: 'legs', muscle: 'quadriceps',
    formes: ['Machine guidée'], prises: ['Bilatéral', 'Unilatéral'] },
  { id: 'leg_curl', nom: 'Leg curl', type: 'legs', muscle: 'ischios',
    formes: ['Machine guidée'], prises: ['Assis', 'Allongé', 'Unilatéral'] },
  { id: 'hip_thrust', nom: 'Hip thrust', type: 'legs', muscle: 'fessiers',
    formes: ['Barre', 'Machine guidée', 'Smith machine'], prises: [] },
  { id: 'mollets', nom: 'Mollets', type: 'legs', muscle: 'mollets',
    formes: ['Machine guidée', 'Smith machine', 'Poids du corps'], prises: ['Debout', 'Assis', 'À la presse'] },
  { id: 'adducteurs', nom: 'Adducteurs', type: 'legs', muscle: 'adducteurs',
    formes: ['Machine guidée'], prises: [] },
  { id: 'abducteurs', nom: 'Abducteurs', type: 'legs', muscle: 'fessiers',
    formes: ['Machine guidée'], prises: [] }
];
