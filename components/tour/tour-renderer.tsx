"use client";

import { useEffect, useRef } from "react";
import type { Property } from "@/types/property";

interface TourRendererProps {
  property: Property | null;
  veoVideoUrl: string | null;   // null while Veo is still generating
  shouldRecord: boolean;         // page flips this to true once Veo is ready
  onComplete: (videoUrl: string) => void;
  onPhase: (phase: string) => void;
}

export function TourRenderer({
  property,
  veoVideoUrl,
  shouldRecord,
  onComplete,
  onPhase,
}: TourRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Refs shared across effects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const threeRef      = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendererRef   = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneRef      = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cameraRef     = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const screenRef     = useRef<any>(null);  // Veo projection screen mesh
  const previewRafRef = useRef<number>(0);
  const recordRafRef  = useRef<number>(0);
  const recorderRef   = useRef<MediaRecorder | null>(null);
  const disposedRef   = useRef(false);

  // ── EFFECT 1: Build scene once, run preview loop ─────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    disposedRef.current = false;

    const beds    = property?.details.beds     ?? 3;
    const baths   = property?.details.baths    ?? 2;
    const sqft    = property?.details.sqft     ?? 2000;
    const pType   = property?.details.propertyType ?? "single_family";
    const address = property?.location.address ?? "";

    async function setup() {
      const THREE = await import("three");
      if (disposedRef.current || !canvas) return;
      threeRef.current = THREE;

      const W = 1280, H = 720;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x8ec8f0);
      scene.fog = new THREE.FogExp2(0xc0ddf5, 0.009);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 300);
      camera.position.set(8, 10, 28);
      camera.lookAt(0, 2, 0);
      cameraRef.current = camera;

      // Lights
      scene.add(new THREE.AmbientLight(0xfff0d0, 0.65));
      const sun = new THREE.DirectionalLight(0xfffaec, 2.2);
      sun.position.set(25, 45, 20);
      sun.castShadow = true;
      sun.shadow.mapSize.setScalar(2048);
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 130;
      const sc = sun.shadow.camera as { left: number; right: number; top: number; bottom: number };
      sc.left = sc.bottom = -40; sc.right = sc.top = 40;
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0x8ab8e8, 0.35);
      fill.position.set(-15, 10, -10);
      scene.add(fill);

      // Helpers
      function mat(color: number, opts: Record<string, unknown> = {}) {
        return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts });
      }
      function addBox(w: number, h: number, d: number, color: number, pos: [number,number,number], opts: Record<string,unknown> = {}) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
        m.position.set(...pos); m.castShadow = true; m.receiveShadow = true;
        scene.add(m); return m;
      }
      function addRoom(rw: number, rh: number, rd: number, pos: [number,number,number], wallCol: number, floorCol: number) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), mat(wallCol, { side: THREE.BackSide, roughness: 0.9 })));
        const flr = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd), mat(floorCol, { roughness: 1.0 }));
        flr.rotation.x = -Math.PI / 2; flr.position.y = -rh / 2 + 0.02; flr.receiveShadow = true;
        g.add(flr);
        const ceil = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd), mat(0xf8f6f0, { side: THREE.BackSide }));
        ceil.rotation.x = -Math.PI / 2; ceil.position.y = rh / 2 - 0.02;
        g.add(ceil);
        const pl = new THREE.PointLight(0xfff0c8, 0.9, 14, 1.5);
        pl.position.y = rh / 2 - 0.6; g.add(pl);
        g.position.set(...pos); scene.add(g);
      }

      // Ground + path + driveway
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat(0x3d6b35, { roughness: 1.0 }));
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
      addBox(2.2, 0.07, 10, 0xc2aa88, [0, 0.035, 11]);
      if (pType !== "condo") addBox(4, 0.06, 12, 0xb0a090, [6, 0.03, 11]);

      // House body + roof
      const isLarge = sqft > 2500 || beds > 3;
      const HW = isLarge ? 18 : 14;
      const HD = isLarge ? 15 : 12;
      addBox(HW, 5.2, HD, 0xf2ede4, [0, 2.6, 0]);
      const roofGeo = new THREE.CylinderGeometry(0, (HW / 2) * 1.18, 4.5, 4, 1);
      const roofMesh = new THREE.Mesh(roofGeo, mat(0x503520));
      roofMesh.position.set(0, 7.45, 0); roofMesh.rotation.y = Math.PI / 4;
      roofMesh.castShadow = true; scene.add(roofMesh);
      addBox(1.2, 3.5, 1.2, 0x8b7355, [HW / 2 - 2.5, 7.8, -1]);
      addBox(1.4, 2.4, 0.2, 0x3d2410, [0, 1.2, HD / 2 + 0.1]);
      addBox(1.9, 2.7, 0.1, 0xd4b896, [0, 1.35, HD / 2 + 0.05]);
      const winMat = mat(0x9fd4f5, { transparent: true, opacity: 0.5, roughness: 0.05, metalness: 0.15 });
      for (const wx of [-4.5, 4.5]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 0.12), winMat);
        win.position.set(wx, 2.8, HD / 2 + 0.06); scene.add(win);
        addBox(2.7, 1.9, 0.08, 0xd4c4a8, [wx, 2.8, HD / 2 + 0.04]);
      }

      // Trees
      for (const [tx, tz] of [[-HW/2-3, 9],[-HW/2-4, 3],[HW/2+3, 9],[HW/2+2, 3],[-2,-HD/2-4]] as [number,number][]) {
        const th = 4 + Math.random() * 3;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, th * 0.6, 7), mat(0x4a2f1a));
        trunk.position.set(tx, th * 0.3, tz); trunk.castShadow = true; scene.add(trunk);
        const leaves = new THREE.Mesh(new THREE.SphereGeometry(th * 0.42, 9, 8), mat(0x2d7030));
        leaves.position.set(tx, th * 0.3 + th * 0.42, tz); leaves.castShadow = true; scene.add(leaves);
      }

      // Interior rooms
      const RY = 2.6;
      // Living room — contains the Veo projection screen
      addRoom(10, 3.2, 7, [0, RY, 2], 0xf5f0e8, 0xb8874a);
      addBox(3.6, 0.85, 1.3, 0x8b7355, [-1.5, RY - 0.67, -0.7]);
      addBox(3.6, 0.42, 0.28, 0x7a6345, [-1.5, RY - 0.25, -1.3]);
      addBox(1.5, 0.38, 0.85, 0x5a3a1a, [-1.5, RY - 0.97, 0.7]);

      // ── Veo projection screen on back wall of living room ─────────
      const screenW = 5.5, screenH = screenW * (9 / 16);
      const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
      const screenMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.position.set(-0.5, RY + 0.3, -4.95); // back wall of living room
      scene.add(screen);
      screenRef.current = screen;
      // Screen bezel
      addBox(screenW + 0.3, screenH + 0.3, 0.12, 0x1a1a1a, [-0.5, RY + 0.3, -4.9]);

      // Kitchen
      addRoom(7, 3.2, 6.5, [-3, RY, -4.5], 0xe8e8e0, 0xccc4b0);
      addBox(6.5, 0.88, 0.7, 0xd8d0c0, [-3, RY - 0.66, -7.4]);
      addBox(0.7, 0.88, 6, 0xd8d0c0, [-6.65, RY - 0.66, -4.5]);
      addBox(2.4, 0.88, 1.3, 0x8b7355, [-3, RY - 0.66, -3.2]);

      // Bedroom
      const bRW = beds >= 4 ? 8 : 7;
      addRoom(bRW, 3.2, 7, [3.5, RY, -4.5], 0xeae0d5, 0xb09878);
      addBox(3.5, 0.5, 2.2, 0xf0e8e0, [3.5, RY - 1.06, -6.8]);
      addBox(3.5, 0.65, 0.3, 0x8b6f5e, [3.5, RY - 0.73, -7.75]);
      addBox(0.62, 0.52, 0.62, 0x6b4e38, [1.55, RY - 1.0, -6.8]);
      addBox(0.62, 0.52, 0.62, 0x6b4e38, [5.45, RY - 1.0, -6.8]);

      // Bathroom
      const bathW = baths >= 2 ? 5 : 4;
      addRoom(bathW, 3.2, 4.5, [5.5, RY, 1.5], 0xe5eff8, 0xccd8e5);
      addBox(1.9, 0.5, 0.9, 0xf5f5f8, [5.8, RY - 1.06, 2.4]);
      addBox(1.6, 0.8, 0.45, 0xddd5c8, [5.3, RY - 0.72, -0.2]);

      // ── Preview: slow orbit while Veo is loading ─────────────────
      onPhase(`Building 3D scene for ${address || "property"}…`);
      let angle = 0.5;
      function previewLoop() {
        if (disposedRef.current) return;
        angle += 0.006;
        camera.position.x = Math.sin(angle) * 22;
        camera.position.z = Math.cos(angle) * 22;
        camera.position.y = 9 + Math.sin(angle * 0.5) * 2;
        camera.lookAt(0, 2, 0);
        renderer.render(scene, camera);
        previewRafRef.current = requestAnimationFrame(previewLoop);
      }
      previewRafRef.current = requestAnimationFrame(previewLoop);
    }

    setup();

    return () => {
      disposedRef.current = true;
      cancelAnimationFrame(previewRafRef.current);
      cancelAnimationFrame(recordRafRef.current);
      if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
      rendererRef.current?.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── EFFECT 2: Apply Veo video as texture when it arrives ─────────
  useEffect(() => {
    if (!veoVideoUrl || !screenRef.current || !threeRef.current) return;

    const THREE = threeRef.current;
    const video = document.createElement("video");
    video.src = veoVideoUrl;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});

    const texture = new THREE.VideoTexture(video);
    screenRef.current.material = new THREE.MeshBasicMaterial({ map: texture });
  }, [veoVideoUrl]);

  // ── EFFECT 3: Start recording the merged scene when triggered ─────
  useEffect(() => {
    if (!shouldRecord) return;
    const THREE = threeRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const canvas = canvasRef.current;
    if (!THREE || !renderer || !scene || !camera || !canvas) return;

    // Stop preview orbit
    cancelAnimationFrame(previewRafRef.current);

    // Camera path through the scene, pausing to face the Veo screen
    const camPts = [
      new THREE.Vector3(0,  16, 32),
      new THREE.Vector3(-4, 10, 26),
      new THREE.Vector3(0,   5, 18),
      new THREE.Vector3(0, 2.5, 12),
      new THREE.Vector3(0, 2.5,  8),
      new THREE.Vector3(0, 2.5,  4.5),
      new THREE.Vector3(0, 2.7,  2),     // enter living room
      new THREE.Vector3(-1, 2.7,  0.5),  // face Veo screen
      new THREE.Vector3(-1, 2.7, -1.5),  // closer to screen
      new THREE.Vector3(-0.5, 2.7, -2.5),// centred on screen
      new THREE.Vector3(-1, 2.7, -3.2),  // close-up Veo screen
      new THREE.Vector3(-2, 2.7, -2),    // pull back left
      new THREE.Vector3(-3.5, 2.7, -3),  // kitchen
      new THREE.Vector3(-4.5, 2.7, -5),
      new THREE.Vector3(-2, 2.7, -5.5),
      new THREE.Vector3(1.5, 2.7, -3.5),
      new THREE.Vector3(3.5, 2.7, -4),   // bedroom
      new THREE.Vector3(3.5, 2.7, -5.5),
      new THREE.Vector3(4.2, 2.7, -7.2),
      new THREE.Vector3(2,   7,   -2),
      new THREE.Vector3(0,  13,    8),
      new THREE.Vector3(5,  18,   24),
    ];
    const lookPts = [
      new THREE.Vector3(0, 4, 12),
      new THREE.Vector3(0, 3, 8),
      new THREE.Vector3(0, 2, 5),
      new THREE.Vector3(0, 2, 2),
      new THREE.Vector3(0, 2, 0),
      new THREE.Vector3(0, 2, -2),
      new THREE.Vector3(-0.5, 2.7, -3),  // look at screen
      new THREE.Vector3(-0.5, 2.7, -4.5),
      new THREE.Vector3(-0.5, 2.7, -4.9),// dead-on Veo screen
      new THREE.Vector3(-0.5, 2.7, -4.9),
      new THREE.Vector3(-0.5, 2.7, -4.9),// hold on screen
      new THREE.Vector3(-1, 2.5, -4),
      new THREE.Vector3(-3, 2.5, -5),
      new THREE.Vector3(-3, 2.5, -6),
      new THREE.Vector3(-1.5, 2.5, -5),
      new THREE.Vector3(3.5, 2.5, -4),
      new THREE.Vector3(3.5, 2.5, -5.5),
      new THREE.Vector3(3.5, 2.5, -7),
      new THREE.Vector3(3.5, 2, -9),
      new THREE.Vector3(0, 2, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ];
    const camCurve  = new THREE.CatmullRomCurve3(camPts);
    const lookCurve = new THREE.CatmullRomCurve3(lookPts);

    const phases: [number, string][] = [
      [0.00, "Aerial approach…"],
      [0.15, "Arriving at the property…"],
      [0.26, "Entering the home…"],
      [0.33, "Touring the living room…"],
      [0.40, "Focusing on photorealistic view…"],
      [0.55, "Touring the kitchen…"],
      [0.72, "Entering the master bedroom…"],
      [0.88, "Rising to aerial overview…"],
    ];

    const mimeType =
      (["video/webm;codecs=vp9", "video/webm", "video/mp4"] as const)
        .find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
    const chunks: BlobPart[] = [];
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      onComplete(URL.createObjectURL(blob));
    };
    recorder.start(100);

    const DURATION = 15000;
    let startTs = 0;
    let lastPhase = -1;

    function recordLoop(ts: number) {
      if (disposedRef.current) return;
      if (!startTs) startTs = ts;
      const t = Math.min((ts - startTs) / DURATION, 1.0);

      for (let i = phases.length - 1; i >= 0; i--) {
        if (t >= phases[i][0] && i > lastPhase) {
          lastPhase = i;
          onPhase(phases[i][1]);
          break;
        }
      }

      camera.position.copy(camCurve.getPoint(t));
      camera.lookAt(lookCurve.getPoint(t));
      renderer.render(scene, camera);

      if (t < 1.0) {
        recordRafRef.current = requestAnimationFrame(recordLoop);
      } else {
        recorder.stop();
        renderer.dispose();
      }
    }
    recordRafRef.current = requestAnimationFrame(recordLoop);
  }, [shouldRecord]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-xl border border-border/30 shadow-2xl"
      style={{ aspectRatio: "16/9", maxWidth: "56rem" }}
    />
  );
}
