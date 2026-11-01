import { sound } from '../audio/soundFX.js';

export class GestureController {
  constructor(videoElement, canvasElement, atomEngine, quantumState) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.engine = atomEngine;
    this.state = quantumState;

    this.hands = null;
    this.camera = null;
    this.isTracking = false;
    this.cameraAvailable = false;

    // Previous landmarks cache for delta calculations
    this.prevHand1Pos = null;
    this.prevHand2Pos = null;
    this.prevTwoHandDist = null;
    this.prevPinchPos = null;
    this.pinchHoldFrames = 0;
    this.lastSwipeTime = 0;

    // Smoothing EMA
    this.smoothedRotX = 0;
    this.smoothedRotY = 0;

    this.initMediaPipe();
  }

  async initMediaPipe() {
    try {
      if (typeof window.Hands === 'undefined') {
        console.warn("MediaPipe Hands script loading or waiting for CDN...");
        // Wait up to 3 seconds for window.Hands
        let attempts = 0;
        while (typeof window.Hands === 'undefined' && attempts < 15) {
          await new Promise(r => setTimeout(r, 200));
          attempts++;
        }
      }

      if (typeof window.Hands === 'undefined') {
        console.warn("MediaPipe Hands not available on window. Falling back to mouse controls.");
        this.updateHUDStatus("MOUSE / TOUCH MODE (Webcam Inactive)");
        return;
      }

      this.hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.6
      });

      this.hands.onResults((results) => this.onResults(results));

      this.cameraAvailable = true;
    } catch (err) {
      console.warn("Failed to initialize MediaPipe Hands:", err);
      this.updateHUDStatus("MOUSE / TOUCH MODE");
    }
  }

  async startCamera() {
    if (!this.video) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      this.video.srcObject = stream;
      await this.video.play();
      this.isTracking = true;

      // Start processing frames via Camera utility or requestVideoFrameCallback
      if (typeof window.Camera !== 'undefined' && this.hands) {
        this.camera = new window.Camera(this.video, {
          onFrame: async () => {
            if (this.isTracking && this.hands) {
              await this.hands.send({ image: this.video });
            }
          },
          width: 640,
          height: 480
        });
        await this.camera.start();
      } else {
        // Fallback processing loop
        this.frameLoop();
      }

      this.updateHUDStatus("J.A.R.V.I.S. OPTICAL TRACKING ACTIVE");
      return true;
    } catch (e) {
      console.warn("Webcam access rejected or unavailable:", e);
      this.updateHUDStatus("WEBCAM OFFLINE - MOUSE ACTIVE");
      return false;
    }
  }

  stopCamera() {
    this.isTracking = false;
    if (this.video && this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(track => track.stop());
      this.video.srcObject = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.updateHUDStatus("OPTICAL SENSOR PAUSED");
  }

  async frameLoop() {
    if (!this.isTracking) return;
    if (this.hands && this.video.readyState >= 2) {
      await this.hands.send({ image: this.video });
    }
    requestAnimationFrame(() => this.frameLoop());
  }

  updateHUDStatus(statusText) {
    this.state.updateGestureState({ name: statusText });
  }

  /**
   * MediaPipe Hands Landmark Processor
   */
  onResults(results) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.save();
    this.ctx.clearRect(0, 0, width, height);

    // Draw video preview mirror
    this.ctx.drawImage(results.image, 0, 0, width, height);
    // Dark sci-fi overlay tint
    this.ctx.fillStyle = 'rgba(2, 8, 24, 0.65)';
    this.ctx.fillRect(0, 0, width, height);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.prevHand1Pos = null;
      this.prevHand2Pos = null;
      this.prevTwoHandDist = null;
      this.prevPinchPos = null;
      this.state.updateGestureState({
        active: false,
        name: "SEEKING HANDS...",
        handCount: 0,
        cursor: { isHovering: false }
      });
      this.ctx.restore();
      return;
    }

    const handCount = results.multiHandLandmarks.length;

    // Draw holographic neon wireframe skeleton for each hand
    for (const landmarks of results.multiHandLandmarks) {
      this.drawHoloSkeleton(landmarks, width, height);
    }

    // 1. TWO-HAND GESTURES: Dual-Hand Zoom & Deconstruct Expansion
    if (handCount >= 2) {
      const hand1 = results.multiHandLandmarks[0];
      const hand2 = results.multiHandLandmarks[1];

      // Distance between wrists (#0) or index fingertips (#8)
      const dist = Math.hypot(hand1[8].x - hand2[8].x, hand1[8].y - hand2[8].y);

      if (this.prevTwoHandDist !== null) {
        const deltaDist = dist - this.prevTwoHandDist;

        // Dynamic Zoom (moving hands closer or farther)
        if (Math.abs(deltaDist) > 0.004) {
          const zoomFactor = deltaDist > 0 ? 0.96 : 1.04;
          this.engine.zoomBy(zoomFactor);
          this.updateHUDStatus(`TWO-HAND ZOOM: ${dist > this.prevTwoHandDist ? 'IN' : 'OUT'}`);
        }

        // Two-handed Pull Apart: Deconstruct Atom Shells outward
        if (dist > 0.65) {
          const deconstructTarget = 1.0 + (dist - 0.65) * 6.0;
          this.state.setDeconstruct(deconstructTarget);
          sound.playGestureTick();
          this.updateHUDStatus("STARK EXPO DECONSTRUCT: SHELLS EXPANDED");
        } else if (dist < 0.45 && this.state.deconstructFactor > 1.0) {
          this.state.setDeconstruct(1.0);
        }
      }

      this.prevTwoHandDist = dist;
      this.state.updateGestureState({ active: true, handCount: 2 });
      this.ctx.restore();
      return;
    }

    // Reset two-hand distance tracking
    this.prevTwoHandDist = null;

    // 2. SINGLE-HAND GESTURES
    const hand = results.multiHandLandmarks[0];
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];
    const wrist = hand[0];

    // Compute Pinch Distance (Thumb Tip to Index Tip)
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y, (thumbTip.z || 0) - (indexTip.z || 0));
    const isPinching = pinchDist < 0.085;

    // Check Fist (all fingertips close to wrist/base of knuckles)
    const isFist = (
      Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) < 0.28 &&
      Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) < 0.28 &&
      Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) < 0.28 &&
      Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) < 0.28
    );

    // Check Index Pointing posture (Index extended, others curled)
    const isPointing = (
      indexTip.y < hand[6].y && // Index extended upward
      middleTip.y > hand[10].y && // Middle curled
      ringTip.y > hand[14].y // Ring curled
    );

    // Check Horizontal Hand Swipe (Element Next / Prev)
    const now = Date.now();
    if (this.prevHand1Pos && now - this.lastSwipeTime > 1200) {
      const deltaX = wrist.x - this.prevHand1Pos.x;
      if (deltaX > 0.18) {
        this.state.nextElement();
        this.lastSwipeTime = now;
        this.updateHUDStatus("SWIPE RIGHT: NEXT ELEMENT");
      } else if (deltaX < -0.18) {
        this.state.prevElement();
        this.lastSwipeTime = now;
        this.updateHUDStatus("SWIPE LEFT: PREVIOUS ELEMENT");
      }
    }
    this.prevHand1Pos = { x: wrist.x, y: wrist.y };

    // ACTION A: FIST -> QUANTUM FREEZE
    if (isFist) {
      if (!this.state.isFrozen) {
        this.state.toggleFreeze();
      }
      this.drawGestureIcon(width / 2, height / 2, "✊ QUANTUM LOCK");
      this.updateHUDStatus("FIST: QUANTUM TIME LOCKED");
      this.ctx.restore();
      return;
    }

    // ACTION B: PINCH & DRAG -> 3D ATOM ROTATION
    if (isPinching) {
      const pinchCenter = {
        x: (thumbTip.x + indexTip.x) / 2,
        y: (thumbTip.y + indexTip.y) / 2
      };

      if (this.prevPinchPos) {
        // Mirrored coordinate: moving hand left should rotate atom left
        const dx = -(pinchCenter.x - this.prevPinchPos.x);
        const dy = pinchCenter.y - this.prevPinchPos.y;

        this.engine.rotateAtomBy(dx * 4.5, dy * 4.5);
        this.updateHUDStatus("PINCH & DRAG: ROTATING ATOM");
      }

      this.prevPinchPos = pinchCenter;
      this.pinchHoldFrames++;

      // Draw pinch reticle on video canvas
      this.ctx.strokeStyle = '#ffe600';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(pinchCenter.x * width, pinchCenter.y * height, 16, 0, Math.PI * 2);
      this.ctx.stroke();

      // If pinch is held on an electron, select it!
      const screenX = (1 - pinchCenter.x) * window.innerWidth;
      const screenY = pinchCenter.y * window.innerHeight;
      if (this.pinchHoldFrames === 8) {
        this.engine.selectAtScreen(screenX, screenY);
      }

      this.ctx.restore();
      return;
    }

    this.prevPinchPos = null;
    this.pinchHoldFrames = 0;

    // ACTION C: INDEX POINTING -> TARGETING RETICLE & HOVER INSPECTOR
    if (isPointing) {
      // Map mirrored index tip coordinates to main browser viewport
      const screenX = (1 - indexTip.x) * window.innerWidth;
      const screenY = indexTip.y * window.innerHeight;

      // Draw holographic targeting crosshair on canvas PIP
      this.drawCrosshair(indexTip.x * width, indexTip.y * height);

      // Perform 3D raycast to test electron hit
      const hovered = this.engine.raycastScreen(screenX, screenY);
      if (hovered) {
        this.updateHUDStatus(`TARGET LOCK: ELECTRON ${hovered.subshell} (Shell ${hovered.shellName})`);
      } else {
        this.updateHUDStatus("LASER TARGETING ACTIVE");
      }

      this.state.updateGestureState({
        active: true,
        name: hovered ? "TARGET LOCKED" : "TARGETING",
        handCount: 1,
        cursor: { x: screenX, y: screenY, isHovering: !!hovered }
      });

      this.ctx.restore();
      return;
    }

    // ACTION D: OPEN PALM -> GENTLE TILT ORIENTATION
    const palmTiltX = (wrist.x - 0.5) * 0.04;
    const palmTiltY = (wrist.y - 0.5) * 0.04;
    this.engine.rotateAtomBy(-palmTiltX, palmTiltY);

    this.updateHUDStatus("PALM TRACKING: HOVER ORIENTATION");
    this.state.updateGestureState({ active: true, handCount: 1 });
    this.ctx.restore();
  }

  drawHoloSkeleton(landmarks, width, height) {
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [0, 9], [9, 10], [10, 11], [11, 12], // Middle
      [0, 13], [13, 14], [14, 15], [15, 16], // Ring
      [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [5, 9], [9, 13], [13, 17] // Palm bridge
    ];

    // Glowing cyan bones
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.75)';
    this.ctx.lineWidth = 2.2;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 8;

    for (const [i, j] of connections) {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x * width, p1.y * height);
      this.ctx.lineTo(p2.x * width, p2.y * height);
      this.ctx.stroke();
    }

    // Glowing gold joints & fingertips
    this.ctx.shadowBlur = 10;
    for (let i = 0; i < landmarks.length; i++) {
      const p = landmarks[i];
      const isTip = [4, 8, 12, 16, 20].includes(i);
      this.ctx.fillStyle = isTip ? '#ffe600' : '#00ffff';
      this.ctx.shadowColor = isTip ? '#ffe600' : '#00ffff';

      this.ctx.beginPath();
      this.ctx.arc(p.x * width, p.y * height, isTip ? 4 : 2.5, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawCrosshair(x, y) {
    this.ctx.strokeStyle = '#00ffff';
    this.ctx.lineWidth = 1.8;
    this.ctx.shadowColor = '#00ffff';
    this.ctx.shadowBlur = 10;

    // Crosshair rings
    this.ctx.beginPath();
    this.ctx.arc(x, y, 14, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(x - 20, y);
    this.ctx.lineTo(x + 20, y);
    this.ctx.moveTo(x, y - 20);
    this.ctx.lineTo(x, y + 20);
    this.ctx.stroke();
  }

  drawGestureIcon(x, y, text) {
    this.ctx.fillStyle = 'rgba(0, 240, 255, 0.9)';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(text, x, y);
  }
}
