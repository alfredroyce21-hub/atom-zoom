import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { sound } from '../audio/soundFX.js';

export class AtomEngine {
  constructor(canvasContainer, quantumState) {
    this.container = canvasContainer;
    this.state = quantumState;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.controls = null;

    // Groups
    this.atomGroup = null;
    this.nucleusGroup = null;
    this.shellsGroup = null;
    this.electronsGroup = null;
    this.effectsGroup = null;
    this.laserBeamGroup = null;

    // Meshes cache
    this.electronMeshes = new Map(); // id -> { mesh, glowMesh, trail, data }
    this.shellRings = [];
    this.nucleusParticles = [];
    this.particleBursts = [];

    // Interaction & Raycasting
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
    this.selectedIndicator = null;
    this.hoverIndicator = null;

    this.clock = new THREE.Clock();
    this.isDeconstructing = false;
    this.currentDeconstruct = 1.0;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020813, 0.015);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 16, 38);

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.container.appendChild(this.renderer.domElement);

    // Orbit Controls (Mouse / Touch fallback)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 90;
    this.controls.minDistance = 6;
    this.controls.rotateSpeed = 0.8;

    // Post-Processing: Unreal Bloom
    try {
      this.composer = new EffectComposer(this.renderer);
      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        1.3, // Strength
        0.4, // Radius
        0.2  // Threshold
      );
      this.composer.addPass(bloomPass);
    } catch (e) {
      console.warn("Post-processing bloom fallback", e);
      this.composer = null;
    }

    // Lights
    this.setupLighting();

    // Scene Structure
    this.atomGroup = new THREE.Group();
    this.nucleusGroup = new THREE.Group();
    this.shellsGroup = new THREE.Group();
    this.electronsGroup = new THREE.Group();
    this.effectsGroup = new THREE.Group();
    this.laserBeamGroup = new THREE.Group();

    this.atomGroup.add(this.nucleusGroup);
    this.atomGroup.add(this.shellsGroup);
    this.atomGroup.add(this.electronsGroup);
    this.atomGroup.add(this.effectsGroup);
    this.atomGroup.add(this.laserBeamGroup);

    this.scene.add(this.atomGroup);

    // Holographic Environment Grid & Reticles
    this.setupHoloEnvironment();

    // Indicators
    this.setupIndicators();

    // Build Current Atom
    this.rebuildAtom();

    // Listen to QuantumState changes
    this.state.subscribe((type, payload) => this.handleStateChange(type, payload));

    // Resize handler
    window.addEventListener('resize', () => this.onResize());

    // Animation Loop
    this.animate();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x0f2b46, 1.2);
    this.scene.add(ambientLight);

    const coreLight = new THREE.PointLight(0x00f0ff, 3.5, 45, 1.2);
    coreLight.position.set(0, 0, 0);
    this.scene.add(coreLight);

    const rimLight1 = new THREE.DirectionalLight(0x38bdf8, 1.0);
    rimLight1.position.set(20, 30, 20);
    this.scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0xf59e0b, 0.8);
    rimLight2.position.set(-20, -20, -20);
    this.scene.add(rimLight2);
  }

  setupHoloEnvironment() {
    // Holographic floor grid
    const gridHelper = new THREE.GridHelper(60, 40, 0x00ffff, 0x003366);
    gridHelper.position.y = -18;
    gridHelper.material.opacity = 0.25;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);

    // Ambient floating quantum dust particles
    const dustCount = 400;
    const dustGeometry = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount * 3; i += 3) {
      dustPositions[i] = (Math.random() - 0.5) * 80;
      dustPositions[i + 1] = (Math.random() - 0.5) * 60;
      dustPositions[i + 2] = (Math.random() - 0.5) * 80;
    }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.18,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    this.dustParticles = new THREE.Points(dustGeometry, dustMaterial);
    this.scene.add(this.dustParticles);
  }

  setupIndicators() {
    // Ring indicator for selected electron
    const selGeom = new THREE.RingGeometry(0.55, 0.75, 32);
    const selMat = new THREE.MeshBasicMaterial({
      color: 0xffe600,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    this.selectedIndicator = new THREE.Mesh(selGeom, selMat);
    this.selectedIndicator.visible = false;
    this.scene.add(this.selectedIndicator);

    // Hover reticle
    const hovGeom = new THREE.RingGeometry(0.45, 0.58, 24);
    const hovMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    this.hoverIndicator = new THREE.Mesh(hovGeom, hovMat);
    this.hoverIndicator.visible = false;
    this.scene.add(this.hoverIndicator);
  }

  handleStateChange(type, payload) {
    if (type === 'ELEMENT_CHANGED' || type === 'ELECTRONS_REBUILT') {
      this.rebuildAtom();
    } else if (type === 'ELECTRON_IONIZED') {
      this.triggerIonizationBurst(payload.target);
      this.rebuildAtom();
    } else if (type === 'QUANTUM_JUMP') {
      this.triggerQuantumJumpShockwave(payload);
    } else if (type === 'NEW_ELEMENT_SYNTHESIZED') {
      this.triggerSynthesisLaserEffect();
    }
  }

  rebuildAtom() {
    this.clearGroup(this.nucleusGroup);
    this.clearGroup(this.shellsGroup);
    this.clearGroup(this.electronsGroup);
    this.electronMeshes.clear();
    this.shellRings = [];
    this.nucleusParticles = [];

    const element = this.state.currentElement;

    // 1. Build Nucleus (Protons + Neutrons or Stark Arc Reactor Core)
    this.buildNucleus(element);

    // 2. Build Orbital Shell Rings
    this.buildShellRings();

    // 3. Build Electrons with Trails
    this.buildElectrons();
  }

  clearGroup(group) {
    while (group.children.length > 0) {
      const child = group.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
      group.remove(child);
    }
  }

  buildNucleus(element) {
    const Z = element.atomicNumber;
    const mass = Math.round(element.atomicMass || Z * 2);
    const neutrons = Math.max(0, mass - Z);

    // If Tony's Synthesized Element (119) or custom element, give it the legendary Arc Reactor Tri-Core!
    if (element.isSynthesized || Z >= 119) {
      this.buildStarkArcCore();
      return;
    }

    const particleCount = Math.min(Z + neutrons, 160); // Cap visual particles for high performance
    const protonRatio = Z / (Z + neutrons || 1);
    const coreRadius = Math.max(1.0, Math.min(2.8, Math.cbrt(particleCount) * 0.45));

    const sphereGeom = new THREE.SphereGeometry(0.35, 12, 12);
    const protonMat = new THREE.MeshStandardMaterial({
      color: 0xff7700,
      emissive: 0xff4400,
      emissiveIntensity: 1.2,
      roughness: 0.3,
      metalness: 0.8
    });
    const neutronMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x0088cc,
      emissiveIntensity: 1.0,
      roughness: 0.3,
      metalness: 0.8
    });

    for (let i = 0; i < particleCount; i++) {
      // Golden Spiral / Fibonacci Sphere packing
      const phi = Math.acos(1 - 2 * (i + 0.5) / particleCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
      const r = coreRadius * (0.4 + 0.6 * Math.cbrt((i + 1) / particleCount));

      const isProton = (i / particleCount) <= protonRatio;
      const mesh = new THREE.Mesh(sphereGeom, isProton ? protonMat : neutronMat);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      mesh.position.set(x, y, z);
      mesh.userData = {
        basePos: new THREE.Vector3(x, y, z),
        phase: Math.random() * Math.PI * 2,
        jitterSpeed: 4.0 + Math.random() * 3.0,
        isProton: isProton
      };

      this.nucleusGroup.add(mesh);
      this.nucleusParticles.push(mesh);
    }

    // Glowing core aura sphere
    const auraGeom = new THREE.SphereGeometry(coreRadius * 1.35, 24, 24);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.22,
      wireframe: true,
      blending: THREE.AdditiveBlending
    });
    const auraMesh = new THREE.Mesh(auraGeom, auraMat);
    this.nucleusGroup.add(auraMesh);
  }

  buildStarkArcCore() {
    // Legendary Iron Man 2 Heavy Element Triangle Core
    const shape = new THREE.Shape();
    const s = 1.8;
    shape.moveTo(0, s);
    shape.lineTo(s * 0.866, -s * 0.5);
    shape.lineTo(-s * 0.866, -s * 0.5);
    shape.closePath();

    const extrudeSettings = { depth: 0.6, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.15, bevelThickness: 0.15 };
    const triGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    triGeom.center();

    const triMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00e5ff,
      emissiveIntensity: 2.5,
      roughness: 0.1,
      metalness: 0.95
    });

    const triMesh = new THREE.Mesh(triGeom, triMat);
    this.nucleusGroup.add(triMesh);

    // Inner glowing ring
    const ringGeom = new THREE.TorusGeometry(1.2, 0.18, 16, 48);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff8800,
      emissiveIntensity: 2.2,
      metalness: 0.9
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    this.nucleusGroup.add(ringMesh);
  }

  buildShellRings() {
    const baseRadii = [3.2, 5.2, 7.4, 9.8, 12.4, 15.2, 18.2, 21.4];

    this.state.shells.forEach((count, shellIdx) => {
      if (count === 0) return;
      const radius = baseRadii[shellIdx] || (3.2 + shellIdx * 2.4);

      // Create primary orbital ring
      const ringGeom = new THREE.TorusGeometry(radius, 0.035, 12, 100);
      const ringMat = new THREE.MeshBasicMaterial({
        color: this.state.getShellColor(shellIdx),
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);

      // Tilts to distinguish shells
      ringMesh.rotation.x = (Math.PI / 7) * (shellIdx % 4);
      ringMesh.rotation.y = (Math.PI / 5) * (shellIdx % 3);

      ringMesh.userData = {
        baseRadius: radius,
        shellIndex: shellIdx,
        baseRotation: ringMesh.rotation.clone()
      };

      this.shellsGroup.add(ringMesh);
      this.shellRings.push(ringMesh);
    });
  }

  buildElectrons() {
    const electronGeom = new THREE.SphereGeometry(0.38, 16, 16);
    const haloGeom = new THREE.SphereGeometry(0.65, 12, 12);

    this.state.electrons.forEach((elData) => {
      const color = elData.color;

      // Electron core sphere
      const elMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 2.4,
        roughness: 0.2,
        metalness: 0.5
      });
      const elMesh = new THREE.Mesh(electronGeom, elMat);

      // Glowing outer halo
      const haloMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
      });
      const haloMesh = new THREE.Mesh(haloGeom, haloMat);
      elMesh.add(haloMesh);

      elMesh.userData = { id: elData.id, electronData: elData };

      // Orbital Trail (history line)
      const maxTrailPoints = 30;
      const trailPositions = new Float32Array(maxTrailPoints * 3);
      const trailGeom = new THREE.BufferGeometry();
      trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
      const trailMat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
      });
      const trailLine = new THREE.Line(trailGeom, trailMat);
      this.effectsGroup.add(trailLine);

      this.electronsGroup.add(elMesh);
      this.electronMeshes.set(elData.id, {
        mesh: elMesh,
        halo: haloMesh,
        trail: trailLine,
        trailHistory: [],
        data: elData
      });
    });
  }

  /**
   * Exploded assembly mode: Pulls shells apart in 3D space
   */
  updateDeconstruct() {
    const target = this.state.deconstructFactor;
    // Smooth lerp
    this.currentDeconstruct += (target - this.currentDeconstruct) * 0.1;

    // Expand shell rings
    this.shellRings.forEach(ring => {
      const baseR = ring.userData.baseRadius;
      const factor = 1.0 + (this.currentDeconstruct - 1.0) * (0.3 + ring.userData.shellIndex * 0.25);
      ring.scale.set(factor, factor, factor);
    });

    // Expand electrons with their corresponding shells
    this.electronMeshes.forEach(item => {
      const shellIdx = item.data.shellIndex;
      const factor = 1.0 + (this.currentDeconstruct - 1.0) * (0.3 + shellIdx * 0.25);
      item.data.currentRadius = item.data.baseRadius * factor;
    });
  }

  triggerIonizationBurst(electronData) {
    // Blinding particle burst shooting out into space
    const burstCount = 50;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(burstCount * 3);
    const velocities = [];

    const origin = this.electronMeshes.get(electronData.id)?.mesh.position || new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < burstCount; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;

      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(0.4 + Math.random() * 0.8);
      velocities.push(v);
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x00ffff,
      size: 0.45,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending
    });
    const burst = new THREE.Points(geom, mat);
    this.effectsGroup.add(burst);

    this.particleBursts.push({
      mesh: burst,
      velocities: velocities,
      life: 1.0,
      decay: 0.025
    });
  }

  triggerQuantumJumpShockwave(payload) {
    // Expanding glowing wave ring
    const ringGeom = new THREE.RingGeometry(0.2, 0.6, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: payload.direction === 'up' ? 0x00f0ff : 0xffaa00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const wave = new THREE.Mesh(ringGeom, ringMat);
    wave.rotation.x = Math.PI / 2;
    this.effectsGroup.add(wave);

    this.particleBursts.push({
      mesh: wave,
      scaleRate: 1.15,
      life: 1.0,
      decay: 0.03
    });
  }

  triggerSynthesisLaserEffect() {
    // Iron Man 2 Particle Accelerator beam piercing through center
    const lineGeom = new THREE.CylinderGeometry(0.3, 0.3, 80, 16);
    lineGeom.rotateZ(Math.PI / 2);
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const beam = new THREE.Mesh(lineGeom, lineMat);
    beam.position.set(0, 0, 0);
    this.laserBeamGroup.add(beam);

    setTimeout(() => {
      this.clearGroup(this.laserBeamGroup);
    }, 1500);
  }

  /**
   * Raycast from screen coordinates (mouse or hand index pointer)
   */
  raycastScreen(screenX, screenY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.electronMeshes.values()).map(item => item.mesh);
    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const elData = hit.userData.electronData;
      this.state.setHoveredElectron(elData);
      return elData;
    } else {
      this.state.setHoveredElectron(null);
      return null;
    }
  }

  selectAtScreen(screenX, screenY) {
    const hit = this.raycastScreen(screenX, screenY);
    if (hit) {
      this.state.selectElectron(hit);
      return hit;
    }
    return null;
  }

  /**
   * Gesture Control API: Hand rotation and zoom
   */
  rotateAtomBy(deltaX, deltaY) {
    this.atomGroup.rotation.y += deltaX * 1.8;
    this.atomGroup.rotation.x += deltaY * 1.8;
  }

  zoomBy(factor) {
    // Dynamic camera dolly zoom
    const targetZ = this.camera.position.length() * factor;
    if (targetZ >= 6 && targetZ <= 90) {
      this.camera.position.multiplyScalar(factor);
    }
  }

  onResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.composer) this.composer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // Update Controls
    this.controls.update();

    // Expand/Contract Shells according to deconstruct slider/gesture
    this.updateDeconstruct();

    // Ambient dust drift
    if (this.dustParticles) {
      this.dustParticles.rotation.y += 0.0005;
      this.dustParticles.rotation.x += 0.0003;
    }

    // Jitter Nucleus Quarks (Strong Nuclear Force)
    if (!this.state.isFrozen) {
      this.nucleusParticles.forEach(particle => {
        const u = particle.userData;
        const j = 0.04 * Math.sin(time * u.jitterSpeed + u.phase);
        particle.position.x = u.basePos.x + j;
        particle.position.y = u.basePos.y + j * 0.8;
        particle.position.z = u.basePos.z + j * 1.2;
      });
      // Slow nucleus auto-spin
      this.nucleusGroup.rotation.y += 0.003;
    }

    // Rotate Orbital Shell rings slowly
    this.shellRings.forEach((ring, idx) => {
      ring.rotation.z += 0.001 * (idx % 2 === 0 ? 1 : -1);
    });

    // Orbit Electrons
    const speedMult = this.state.isFrozen ? 0 : this.state.speedMultiplier;

    this.electronMeshes.forEach(item => {
      const el = item.data;
      if (!this.state.isFrozen) {
        el.angle += el.speed * speedMult;
      }

      // 3D Orbital calculation with tilt/inclination
      const r = el.currentRadius;
      const x = r * Math.cos(el.angle);
      const z = r * Math.sin(el.angle);
      const y = Math.sin(el.angle) * r * Math.sin(el.inclination);

      item.mesh.position.set(x, y, z);

      // Spin halo pulse
      const pulse = 1.0 + 0.15 * Math.sin(time * 6 + el.spin * 10);
      item.halo.scale.set(pulse, pulse, pulse);

      // Update orbital trail
      if (this.state.showElectronTrails && !this.state.isFrozen) {
        item.trailHistory.unshift(new THREE.Vector3(x, y, z));
        if (item.trailHistory.length > 25) item.trailHistory.pop();

        const posAttr = item.trail.geometry.attributes.position;
        for (let i = 0; i < item.trailHistory.length; i++) {
          posAttr.setXYZ(i, item.trailHistory[i].x, item.trailHistory[i].y, item.trailHistory[i].z);
        }
        for (let i = item.trailHistory.length; i < 25; i++) {
          if (item.trailHistory.length > 0) {
            const last = item.trailHistory[item.trailHistory.length - 1];
            posAttr.setXYZ(i, last.x, last.y, last.z);
          }
        }
        posAttr.needsUpdate = true;
      }
    });

    // Update Particle Bursts & Shockwaves
    for (let i = this.particleBursts.length - 1; i >= 0; i--) {
      const burst = this.particleBursts[i];
      burst.life -= burst.decay;

      if (burst.velocities) {
        const posAttr = burst.mesh.geometry.attributes.position;
        for (let j = 0; j < burst.velocities.length; j++) {
          posAttr.setXYZ(
            j,
            posAttr.getX(j) + burst.velocities[j].x,
            posAttr.getY(j) + burst.velocities[j].y,
            posAttr.getZ(j) + burst.velocities[j].z
          );
        }
        posAttr.needsUpdate = true;
        burst.mesh.material.opacity = burst.life;
      } else if (burst.scaleRate) {
        burst.mesh.scale.multiplyScalar(burst.scaleRate);
        burst.mesh.material.opacity = burst.life;
      }

      if (burst.life <= 0) {
        this.effectsGroup.remove(burst.mesh);
        if (burst.mesh.geometry) burst.mesh.geometry.dispose();
        if (burst.mesh.material) burst.mesh.material.dispose();
        this.particleBursts.splice(i, 1);
      }
    }

    // Update Indicators (Selected & Hovered)
    const selected = this.state.selectedElectron;
    if (selected && this.electronMeshes.has(selected.id)) {
      const selMesh = this.electronMeshes.get(selected.id).mesh;
      this.selectedIndicator.visible = true;
      this.selectedIndicator.position.copy(selMesh.position);
      this.selectedIndicator.lookAt(this.camera.position);
      this.selectedIndicator.rotation.z += 0.03;
    } else {
      this.selectedIndicator.visible = false;
    }

    const hovered = this.state.hoveredElectron;
    if (hovered && this.electronMeshes.has(hovered.id) && hovered.id !== selected?.id) {
      const hovMesh = this.electronMeshes.get(hovered.id).mesh;
      this.hoverIndicator.visible = true;
      this.hoverIndicator.position.copy(hovMesh.position);
      this.hoverIndicator.lookAt(this.camera.position);
    } else {
      this.hoverIndicator.visible = false;
    }

    // Render with Bloom or Fallback
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
