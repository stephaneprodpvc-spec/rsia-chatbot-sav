/**
 * Iko Widget — mascotte 3D flottante RSIA
 * ------------------------------------------------------------
 * Charge un modele GLB anime (Three.js), le fait flotter dans un coin
 * de l'ecran, et propose deux types d'entree :
 *   - "tumble"  : capotage/atterrissage (impact + secousse d'ecran)
 *   - "float"   : arrivee posee (fondu + leger flottement)
 *
 * Usage (voir aussi le snippet HTML fourni a part) :
 *
 *   import { IkoWidget } from '/assets/iko/iko-widget.js';
 *   const iko = new IkoWidget('iko-container', {
 *     idleUrl: '/assets/iko/iko_idle_FINAL.glb',
 *     waveUrl: '/assets/iko/iko_wave_hello.glb',
 *   });
 *   await iko.init();
 *   iko.enterTumble();   // ou iko.enterFloat();
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';

function makeLoader() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

export class IkoWidget {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`IkoWidget: conteneur #${containerId} introuvable.`);
      return;
    }
    this.opts = Object.assign({
      idleUrl: '/assets/iko/iko_idle_FINAL.glb',
      waveUrl: '/assets/iko/iko_wave_hello.glb',
      size: 200,          // taille du widget en pixels (carre)
      restX: 0,            // position de repos relative au conteneur (px)
      restY: 0,
    }, options);

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.mixer = null;
    this.model = null;
    this.clock = new THREE.Clock();
    this.idleAction = null;
    this.waveAction = null;
    this.audioCtx = null;
    this.emissiveMaterials = [];
    this._pulseRAF = null;
  }

  async init() {
    this._buildScene();
    await this._loadModel(this.opts.idleUrl);
    this._animate();
    window.addEventListener('resize', () => this._onResize());
    return this;
  }

  _buildScene() {
    const { size } = this.opts;

    this.container.style.position = this.container.style.position || 'fixed';
    this.container.style.width = size + 'px';
    this.container.style.height = size + 'px';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = this.container.style.zIndex || '500';
    this.container.style.opacity = '0'; // invisible tant qu'on n'a pas joue l'entree

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 1.1, 4.2);
    this.camera.lookAt(0, 0.6, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(size, size);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // eclairage studio simple
    const hemi = new THREE.HemisphereLight(0xfff2e0, 0x201018, 1.1);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 3, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xff9142, 0.8);
    rim.position.set(-2, 1, -2);
    this.scene.add(rim);
  }

  _loadModel(url) {
    return new Promise((resolve, reject) => {
      const loader = makeLoader();
      loader.load(url, (gltf) => {
        this.model = gltf.scene;

        // recentre + met a l'echelle pour remplir le cadre proprement
        const box = new THREE.Box3().setFromObject(this.model);
        const sizeVec = new THREE.Vector3();
        box.getSize(sizeVec);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const scale = 2.2 / Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
        this.model.scale.setScalar(scale);
        this.model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

        this.scene.add(this.model);

        // reperage des materiaux "visiere" pour le pulse audio (fallback : tous)
        this.model.traverse((child) => {
          if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => {
              const name = (m.name || '').toLowerCase();
              if (name.includes('visor') || name.includes('visiere') || name.includes('glass') || name.includes('amber')) {
                m.emissive = m.emissive || new THREE.Color(0xffb066);
                m.emissiveIntensity = 0.15;
                this.emissiveMaterials.push(m);
              }
            });
          }
        });
        // fallback : si aucun materiau "visiere" detecte, on prend tous les materiaux
        if (this.emissiveMaterials.length === 0) {
          this.model.traverse((child) => {
            if (child.isMesh && child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((m) => {
                m.emissive = m.emissive || new THREE.Color(0xffb066);
                m.emissiveIntensity = 0.08;
                this.emissiveMaterials.push(m);
              });
            }
          });
        }

        this.mixer = new THREE.AnimationMixer(this.model);
        if (gltf.animations && gltf.animations.length) {
          this.idleAction = this.mixer.clipAction(gltf.animations[0]);
          this.idleAction.play();
        }
        resolve(gltf);
      }, undefined, reject);
    });
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const dt = this.clock.getDelta();
    if (this.mixer) this.mixer.update(dt);
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _onResize() {
    // widget a taille fixe en pixels : rien a faire, mais methode prete
    // si un jour la taille doit devenir responsive.
  }

  /* ---------------------------------------------------------------
   * ENTREES
   * ------------------------------------------------------------- */

  /** Entree "capotage" : tumbling + impact + secousse d'ecran. Reserve a controle.html */
  enterTumble() {
    const el = this.container;
    gsap.set(el, { opacity: 1, x: -window.innerWidth * 0.6, y: -260, rotation: -540, scale: 0.7 });

    const tl = gsap.timeline();
    tl.to(el, {
      x: this.opts.restX,
      y: this.opts.restY,
      rotation: 0,
      scale: 1,
      duration: 1.15,
      ease: 'bounce.out',
      onComplete: () => {
        this._playImpactSound();
        this._screenShake();
        this._pulseVisor(650);
        this._playWaveThenIdle();
      },
    });
    return tl;
  }

  /** Entree posee : fondu + leger flottement vers le haut. Pour systeme-iko.html */
  enterFloat() {
    const el = this.container;
    gsap.set(el, { opacity: 0, y: 40, scale: 0.92 });
    const tl = gsap.timeline();
    tl.to(el, {
      opacity: 1,
      y: this.opts.restY,
      scale: 1,
      duration: 1.4,
      ease: 'power2.out',
      onComplete: () => {
        this._pulseVisor(500);
        this._playWaveThenIdle();
      },
    });
    return tl;
  }

  _playWaveThenIdle() {
    if (!this.opts.waveUrl || !this.mixer) return;
    // charge et joue l'animation de salut une fois, puis revient a l'idle
    const loader = makeLoader();
    loader.load(this.opts.waveUrl, (gltf) => {
      if (!gltf.animations || !gltf.animations.length) return;
      const waveClip = gltf.animations[0];
      const waveAction = this.mixer.clipAction(waveClip, this.model);
      waveAction.setLoop(THREE.LoopOnce);
      waveAction.clampWhenFinished = true;
      if (this.idleAction) this.idleAction.fadeOut(0.2);
      waveAction.reset().fadeIn(0.2).play();
      this.mixer.addEventListener('finished', function onFinish(e) {
        if (e.action === waveAction) {
          waveAction.fadeOut(0.3);
          if (this.idleAction) this.idleAction.reset().fadeIn(0.3).play();
          this.mixer.removeEventListener('finished', onFinish);
        }
      }.bind(this));
    });
  }

  /* ---------------------------------------------------------------
   * SON D'IMPACT (synthetise, aucun fichier audio externe)
   * ------------------------------------------------------------- */
  _playImpactSound() {
    try {
      this.audioCtx = this.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // corps grave "bonk" (oscillateur qui chute rapidement)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.5, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(oscGain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);

      // petit "clic" plastique (bruit filtre, tres bref)
      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1200;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.25, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
      noise.start(now);
    } catch (e) {
      console.warn('IkoWidget: son d\'impact indisponible', e);
    }
  }

  _screenShake() {
    const body = document.body;
    gsap.timeline()
      .to(body, { x: 3, y: -2, duration: 0.04 })
      .to(body, { x: -3, y: 2, duration: 0.04 })
      .to(body, { x: 2, y: -1, duration: 0.04 })
      .to(body, { x: 0, y: 0, duration: 0.04 });
  }

  /* ---------------------------------------------------------------
   * PULSE VISIERE (indicateur "Iko parle")
   * ------------------------------------------------------------- */

  /** Pulse simple, duree fixe (utilise a l'entree). */
  _pulseVisor(durationMs) {
    const start = performance.now();
    const base = 0.15;
    const peak = 1.4;
    const step = (t) => {
      const elapsed = t - start;
      if (elapsed > durationMs) {
        this.emissiveMaterials.forEach((m) => (m.emissiveIntensity = base));
        return;
      }
      const v = base + (peak - base) * Math.abs(Math.sin(elapsed / 90));
      this.emissiveMaterials.forEach((m) => (m.emissiveIntensity = v));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /**
   * Pulse pilotee par un element <audio> reel (a utiliser une fois les
   * fichiers voix generes). Ex: iko.pulseVisorWithAudio(audioEl)
   */
  pulseVisorWithAudio(audioEl) {
    this.audioCtx = this.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = this.audioCtx;
    const source = ctx.createMediaElementSource(audioEl);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const base = 0.15;
    const loop = () => {
      if (audioEl.paused || audioEl.ended) {
        this.emissiveMaterials.forEach((m) => (m.emissiveIntensity = base));
        return;
      }
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const v = base + (avg / 255) * 1.6;
      this.emissiveMaterials.forEach((m) => (m.emissiveIntensity = v));
      requestAnimationFrame(loop);
    };
    audioEl.play();
    loop();
  }
}
