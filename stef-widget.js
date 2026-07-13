// ============================================================
// STEF — Assistant 3D Falliero pour la page SAV
// Usage : <script type="module" src="stef-widget.js"></script>
// Requiert : stef.glb à la racine du site
// ============================================================

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

(function () {
  'use strict';

  const NAVY = '#16233F', YELLOW = '#E5B531';
  const IS_MOBILE = window.matchMedia('(max-width: 760px)').matches;

  // ---------- Conteneur (héros plein pied → médaillon) ----------
  const box = document.createElement('div');
  box.id = 'stef-box';
  const bubble = document.createElement('div');
  bubble.id = 'stef-bubble';
  bubble.innerHTML =
    '<div id="stef-bubble-text"></div>' +
    '<button id="stef-cta">Commencer ma demande SAV</button>';

  const style = document.createElement('style');
  style.textContent = `
    #stef-box {
      position: fixed; z-index: 9990; pointer-events: none;
      opacity: 0; transition: opacity .8s ease, all .7s cubic-bezier(.4,0,.2,1);
      right: 0; bottom: 0;
      width: ${IS_MOBILE ? '100vw' : '46vw'};
      height: ${IS_MOBILE ? '58vh' : '92vh'};
    }
    #stef-box.visible { opacity: 1; }
    #stef-box.mini {
      width: 120px; height: 120px;
      left: 18px; right: auto; bottom: 18px;
      border-radius: 50%; overflow: hidden;
      background: radial-gradient(circle at 50% 30%, #22365C, ${NAVY});
      border: 3px solid ${YELLOW};
      box-shadow: 0 6px 24px rgba(0,0,0,.45);
      pointer-events: auto; cursor: pointer;
    }
    #stef-box canvas { width: 100% !important; height: 100% !important; display: block; }
    #stef-bubble {
      position: fixed; z-index: 9991;
      ${IS_MOBILE
        ? 'left: 16px; right: 16px; top: 14px;'
        : 'right: 34vw; bottom: 46vh; max-width: 320px;'}
      background: #fff; color: ${NAVY};
      border-radius: 16px; border-bottom-right-radius: 4px;
      padding: 16px 18px; font-family: 'Segoe UI', sans-serif;
      font-size: 14.5px; line-height: 1.55;
      box-shadow: 0 10px 34px rgba(0,0,0,.35);
      opacity: 0; transform: translateY(12px);
      transition: opacity .5s ease .2s, transform .5s ease .2s;
      pointer-events: auto;
    }
    #stef-bubble.visible { opacity: 1; transform: translateY(0); }
    #stef-bubble.hidden { opacity: 0; pointer-events: none; transform: translateY(12px); }
    #stef-bubble::after {
      content: ''; position: absolute; bottom: -9px; right: 26px;
      border: 10px solid transparent; border-top-color: #fff;
      border-bottom: none; border-right: none;
    }
    #stef-cta {
      margin-top: 12px; width: 100%;
      background: ${YELLOW}; color: ${NAVY};
      border: none; border-radius: 10px;
      padding: 11px 14px; font-weight: 700; font-size: 14px;
      font-family: 'Segoe UI', sans-serif; cursor: pointer;
      transition: transform .15s ease, box-shadow .15s ease;
    }
    #stef-cta:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(229,181,49,.4); }
    @media (prefers-reduced-motion: reduce) {
      #stef-box, #stef-bubble { transition: none; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(box);
  document.body.appendChild(bubble);

  // ---------- Scène Three.js ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  box.appendChild(renderer.domElement);

  const scene = new THREE.Scene(); // fond transparent : Stef pose sur la page
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xBFCBE8, 0x2A3348, 1.25));
  const key = new THREE.DirectionalLight(0xFFF2DC, 1.7);
  key.position.set(3, 6, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0xE5B531, 10, 18);
  rim.position.set(-3, 3, -2.5);
  scene.add(rim);

  let mixer = null, actions = {}, current = null, model = null, modelH = 1;

  function sizeRenderer() {
    const w = box.clientWidth || 300, h = box.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frameFull() {   // cadrage plein pied
    camera.position.set(0, modelH * 0.52, modelH * 1.5);
    camera.lookAt(0, modelH * 0.5, 0);
  }
  function frameBust() {   // cadrage buste pour le médaillon
    camera.position.set(0, modelH * 0.78, modelH * 0.62);
    camera.lookAt(0, modelH * 0.74, 0);
  }

  // ---------- Animations ----------
  function play(name, { loop = true, fade = 0.35 } = {}) {
    const a = actions[name];
    if (!a || a === current) return;
    if (current) current.fadeOut(fade);
    a.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity).fadeIn(fade).play();
    a.clampWhenFinished = !loop;
    current = a;
  }

  let talkTimer = null;
  function talk(dur = 4000) {
    play('Stand_and_Chat');
    clearTimeout(talkTimer);
    talkTimer = setTimeout(() => play('Idle_3'), dur);
  }

  // ---------- Bulle de présentation (machine à écrire) ----------
  const INTRO = "Bonjour, je suis Stef \u{1F44B} votre conseiller SAV Falliero. Une fen\u00EAtre qui coince, un vitrage \u00E0 remplacer, un r\u00E9glage \u00E0 faire ? Je vous guide, \u00E7a prend 2 minutes.";
  function typeIntro() {
    bubble.classList.add('visible');
    const el = bubble.querySelector('#stef-bubble-text');
    let i = 0;
    (function tick() {
      el.textContent = INTRO.slice(0, ++i);
      if (i < INTRO.length) setTimeout(tick, 22);
    })();
  }

  // ---------- Réduction en médaillon ----------
  let mini = false;
  function minimize() {
    if (mini || !model) return;
    mini = true;
    bubble.classList.add('hidden');
    box.classList.add('mini');
    setTimeout(() => { sizeRenderer(); frameBust(); play('Idle_3'); }, 720);
  }

  // Clic sur le médaillon : Stef réagit
  box.addEventListener('click', () => { if (mini) talk(3000); });

  // Bouton de la bulle → ouvre le widget SAV existant
  bubble.querySelector('#stef-cta').addEventListener('click', () => {
    if (typeof window.toggleWidget === 'function') window.toggleWidget();
    else minimize();
  });

  // ---------- Greffes non intrusives sur la page ----------
  // 1) Quand le client ouvre le chat (bouton existant), Stef passe en médaillon
  const origToggle = window.toggleWidget;
  if (typeof origToggle === 'function') {
    window.toggleWidget = function () {
      origToggle.apply(this, arguments);
      minimize();
    };
  }
  // 2) Quand Iko affiche une réponse, Stef "parle" (observation du chat)
  const root = document.getElementById('root');
  if (root && 'MutationObserver' in window) {
    let cooldown = 0;
    new MutationObserver(() => {
      const now = Date.now();
      if (mini && now - cooldown > 2500) { cooldown = now; talk(3500); }
    }).observe(root, { childList: true, subtree: true });
  }

  // ---------- Chargement du modèle ----------
  new GLTFLoader().load(
    './stef.glb',
    (gltf) => {
      model = gltf.scene;
      const bb = new THREE.Box3().setFromObject(model);
      const size = bb.getSize(new THREE.Vector3());
      const scale = 2.0 / size.y;
      model.scale.setScalar(scale);
      bb.setFromObject(model);
      const c = bb.getCenter(new THREE.Vector3());
      model.position.set(-c.x, -bb.min.y, -c.z);
      modelH = 2.0;
      scene.add(model);

      mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => { actions[clip.name] = mixer.clipAction(clip); });

      sizeRenderer();
      frameFull();
      box.classList.add('visible');

      // Séquence d'accueil : il parle, puis repos
      talk(6500);
      typeIntro();

      // Relance discrète toutes les ~14 s tant qu'on est en accueil
      setInterval(() => { if (!mini) talk(4000); }, 14000);
    },
    undefined,
    (err) => { console.warn('Stef indisponible :', err); box.remove(); bubble.remove(); }
  );

  // ---------- Boucle de rendu ----------
  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    const dt = clock.getDelta();
    if (mixer) mixer.update(dt);
    if (model && !mini) model.rotation.y = Math.sin(clock.elapsedTime * 0.4) * 0.07;
    renderer.render(scene, camera);
  })();

  window.addEventListener('resize', () => { sizeRenderer(); mini ? frameBust() : frameFull(); });

  // API publique si besoin plus tard (dashboard, technicien…)
  window.Stef = { talk, minimize, play };
})();
