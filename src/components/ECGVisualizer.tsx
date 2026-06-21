import React, { useRef, useEffect, useState } from "react";
import { ECGParameters } from "../types";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Eye, Grid } from "lucide-react";

const cosineInterpolate = (y1: number, y2: number, mu: number): number => {
  const mu2 = (1 - Math.cos(mu * Math.PI)) / 2;
  return y1 * (1 - mu2) + y2 * mu2;
};

const linearInterpolate = (y1: number, y2: number, mu: number): number => {
  return y1 * (1 - mu) + y2 * mu;
};

interface HistoricBeat {
  time: number;
  bpm: number;
  isPVC: boolean;
  isDropped: boolean;
  cycleIndex: number;
  prInterval: number;
  noPWave?: boolean;
  isEscape?: boolean;
  isAshman?: boolean;
}

interface ECGVisualizerProps {
  parameters: ECGParameters;
  rhythmName: string;
  rhythmNameEnglish: string;
  rhythmId?: string;
}

export default function ECGVisualizer({ parameters, rhythmName, rhythmNameEnglish, rhythmId }: ECGVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Simulation controls
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [useOscilloscopeTheme, setUseOscilloscopeTheme] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [selectedLead, setSelectedLead] = useState<string>("II");
  const [gain, setGain] = useState<number>(1.0); // Options: 0.5 (5mm/mV), 1.0 (10mm/mV), 2.0 (20mm/mV)
  const [sweepSpeed, setSweepSpeed] = useState<number>(25.0); // Options: 12.5, 25.0, 50.0
  const [aberrancyType, setAberrancyType] = useState<"none" | "rbbb" | "lbbb">("none");
  const [axisDeviation, setAxisDeviation] = useState<"normal" | "lad" | "rad" | "erad">("normal");
  const [qWaveMimicMI, setQWaveMimicMI] = useState<boolean>(false);

  // Displayed dynamic heart rate on monitor
  const displayedBpmRef = useRef<number>(parameters.bpm);
  const lastVFibHrUpdateTimeRef = useRef<number>(0);

  // Reset rolling history on lead, rhythm or aberrancy/axis/MI change for natural sweep restart
  useEffect(() => {
    pointsRef.current = [];
    displayedBpmRef.current = parameters.bpm;
    lastVFibHrUpdateTimeRef.current = 0;
    lastBeepTimeRef.current = 0;
  }, [selectedLead, rhythmId, parameters.bpm, aberrancyType, axisDeviation, qWaveMimicMI]);

  // Simulation states
  const timeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const nextBeatTimeRef = useRef<number>(0);
  const beatTimesHistoryRef = useRef<HistoricBeat[]>([]);
  const beatCounterRef = useRef<number>(0);
  const lastBeepTimeRef = useRef<number>(0);

  // Store rolling data points for smooth scroll
  const pointsRef = useRef<{ x: number; y: number; label?: string }[]>([]);

  // Sound generator
  const beep = () => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // Pitch of patient monitor (A5)
      
      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn("Audio Context error:", e);
    }
  };

  // Resize canvas to match its container dynamically with high-DPI (Retina) support
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const dpr = window.devicePixelRatio || 1;
        const width = container.clientWidth;
        const height = 380;
        
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        
        pointsRef.current = []; // Reset history to match new domain
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Main canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;

    const render = (timestamp: number) => {
      if (!isPlaying) {
        // Just keep drawing grid and static line
        drawStatic();
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTime = (timestamp - lastTimeRef.current) / 1000; // in seconds
      lastTimeRef.current = timestamp;

      // Unreasonable delay (e.g. tab backgrounding) should be capped
      const dt = Math.min(deltaTime, 0.1);
      timeRef.current += dt;

      const dpr = window.devicePixelRatio || 1;
      const logicalWidth = canvas.width / dpr;
      const logicalHeight = canvas.height / dpr;

      // Advance and generate ECG points
      generateECGPoints(dt, logicalWidth, logicalHeight);

      // Draw the screen
      drawScreen(ctx, logicalWidth, logicalHeight);

      animationFrameId = requestAnimationFrame(render);
    };

    const drawStatic = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      drawScreen(ctx, canvas.width / dpr, canvas.height / dpr);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, parameters, useOscilloscopeTheme, soundEnabled, showLabels, selectedLead, gain, sweepSpeed, rhythmId, aberrancyType, axisDeviation, qWaveMimicMI]);

  // Generate ECG points
  const generateECGPoints = (dt: number, width: number, height: number) => {
    const bpm = parameters.bpm;
    const isVFib = rhythmId === "vfib" || rhythmId === "vfib_fine" || bpm === 0 || parameters.noiseLevel >= 0.9;
    const isVTach = rhythmId === "vtach" || (bpm > 140 && parameters.qrsDuration >= 0.15 && !parameters.isIrregular);
    const isPolymorphicVT = rhythmId === "polymorphic_vt";

    // Dextrocardia Lead Mapping
    const leadToUse = rhythmId === "dextrocardia"
      ? (selectedLead === "II" ? "III" :
         selectedLead === "III" ? "II" :
         selectedLead === "aVR" ? "aVL" :
         selectedLead === "aVL" ? "aVR" :
         selectedLead === "V1" ? "V6" :
         selectedLead === "V2" ? "V5" :
         selectedLead === "V3" ? "V4" :
         selectedLead === "V4" ? "V3" :
         selectedLead === "V5" ? "V2" :
         selectedLead === "V6" ? "V1" : selectedLead)
      : selectedLead;

    const pointsPerSecond = 500; 
    const step = dt * pointsPerSecond;
    const pointsToGen = Math.max(1, Math.floor(step));

    // Dynamic lead factors
    let pAmpMult = 1.0;
    let qrsAmpMult = 1.0;
    let qrsSign = 1.0;
    let tAmpMult = 1.0;
    let stModifier = 1.0;
    
    let isV1V2RBBB = false;
    let isLateralRBBB = false;
    let isLBBBLateral = false;
    let isLBBBRightPrecordial = false;
    let isLVHLateral = false;
    let isLVHRightPrecordial = false;
    let isRVHRightAxis = false;
    let isRVHLateral = false;
    let isLADInferior = false;
    let isRADLateral = false;
    let isERADNegative = false;

    switch (leadToUse) {
      case "I": pAmpMult = 0.8; qrsAmpMult = 0.85; qrsSign = 1.0; tAmpMult = 0.8; stModifier = 0.5; break;
      case "II": pAmpMult = 1.1; qrsAmpMult = 1.0; qrsSign = 1.0; tAmpMult = 1.0; stModifier = 1.0; break;
      case "III": pAmpMult = 0.7; qrsAmpMult = 0.75; qrsSign = 1.0; tAmpMult = 0.7; stModifier = 1.0; break;
      case "aVR": pAmpMult = -1.0; qrsAmpMult = 0.9; qrsSign = -1.0; tAmpMult = -1.0; stModifier = -0.5; break;
      case "aVL": pAmpMult = 0.5; qrsAmpMult = 0.6; qrsSign = 1.0; tAmpMult = 0.5; stModifier = 0.5; break;
      case "aVF": pAmpMult = 0.9; qrsAmpMult = 0.95; qrsSign = 1.0; tAmpMult = 0.9; stModifier = 1.0; break;
      case "V1": pAmpMult = -0.2; qrsAmpMult = 1.1; qrsSign = -1.0; tAmpMult = -0.3; stModifier = 1.0; break;
      case "V2": pAmpMult = 0.2; qrsAmpMult = 1.3; qrsSign = -0.8; tAmpMult = 0.8; stModifier = 1.2; break;
      case "V3": pAmpMult = 0.5; qrsAmpMult = 1.4; qrsSign = 0.2; tAmpMult = 1.0; stModifier = 1.2; break;
      case "V4": pAmpMult = 0.8; qrsAmpMult = 1.45; qrsSign = 1.0; tAmpMult = 1.1; stModifier = 1.2; break;
      case "V5": pAmpMult = 0.9; qrsAmpMult = 1.65; qrsSign = 1.0; tAmpMult = 1.0; stModifier = 1.0; break;
      case "V6": pAmpMult = 0.8; qrsAmpMult = 1.20; qrsSign = 1.0; tAmpMult = 0.85; stModifier = 0.8; break;
    }

    // Lead I inversion in Dextrocardia
    if (rhythmId === "dextrocardia" && selectedLead === "I") {
      pAmpMult = -pAmpMult;
      qrsSign = -qrsSign;
      tAmpMult = -tAmpMult;
      stModifier = -stModifier;
    }

    // Axis Deviation overrides
    if (axisDeviation === "lad") {
      // Left Axis Deviation: I is positive, II is negative, III is negative, aVF is negative, aVL is positive, aVR is negative
      if (selectedLead === "I") {
        qrsSign = 1.0;
        qrsAmpMult = qrsAmpMult * 1.15; 
      } else if (selectedLead === "II") {
        qrsSign = -1.0;
        qrsAmpMult = qrsAmpMult * 0.95;
        isLADInferior = true;
      } else if (selectedLead === "III") {
        qrsSign = -1.0;
        qrsAmpMult = qrsAmpMult * 1.25;
        isLADInferior = true;
      } else if (selectedLead === "aVF") {
        qrsSign = -1.0;
        qrsAmpMult = qrsAmpMult * 1.15;
        isLADInferior = true;
      } else if (selectedLead === "aVL") {
        qrsSign = 1.0;
        qrsAmpMult = qrsAmpMult * 1.2;
      } else if (selectedLead === "aVR") {
        qrsSign = -1.0;
      }
    } else if (axisDeviation === "rad") {
      // Right Axis Deviation: I is negative, II is positive, III is very positive, aVF is positive, aVL is negative, aVR is positive/flat (often positive or mixed)
      if (selectedLead === "I") {
        qrsSign = -1.0;
        qrsAmpMult = qrsAmpMult * 1.15;
        isRADLateral = true;
      } else if (selectedLead === "II") {
        qrsSign = 1.0;
        qrsAmpMult = qrsAmpMult * 0.8;
      } else if (selectedLead === "III") {
        qrsSign = 1.0;
        qrsAmpMult = qrsAmpMult * 1.4;
      } else if (selectedLead === "aVF") {
        qrsSign = 1.0;
        qrsAmpMult = qrsAmpMult * 1.25;
      } else if (selectedLead === "aVL") {
        qrsSign = -1.0;
        qrsAmpMult = qrsAmpMult * 1.1;
        isRADLateral = true;
      } else if (selectedLead === "aVR") {
        qrsSign = 0.5; // less negative or slightly positive
        qrsAmpMult = qrsAmpMult * 0.85;
      }
    } else if (axisDeviation === "erad") {
      // Extreme Right Axis Deviation (Extreme RAD / No man's land): Both I and aVF are negative, II and III negative, aVR is positive
      if (selectedLead === "I") {
        qrsSign = -1.0;
        qrsAmpMult = qrsAmpMult * 1.2;
        isERADNegative = true;
      } else if (selectedLead === "II") {
        qrsSign = -1.0;
        qrsAmpMult = qrsAmpMult * 1.15;
        isERADNegative = true;
      } else if (selectedLead === "III") {
        qrsSign = -1.0;
        qrsAmpMult = qrsAmpMult * 1.1;
        isERADNegative = true;
      } else if (selectedLead === "aVF") {
        qrsSign = -1.0;
        qrsAmpMult = qrsAmpMult * 1.2;
        isERADNegative = true;
      } else if (selectedLead === "aVL") {
        qrsSign = -1.0;
        qrsAmpMult = qrsAmpMult * 0.9;
        isERADNegative = true;
      } else if (selectedLead === "aVR") {
        qrsSign = 1.0; // fully upright in aVR is the classic hallmark of extreme axis deviation
        qrsAmpMult = qrsAmpMult * 1.35;
      }
    }

    // Overrides
    if (rhythmId === "stemi_anterior") {
      if (["V1", "V2", "V3", "V4"].includes(selectedLead)) {
        stModifier = 1.5; tAmpMult = 1.8;
      } else if (["II", "III", "aVF"].includes(selectedLead)) {
        stModifier = -0.8; tAmpMult = -0.5;
      } else {
        stModifier = 0.2;
      }
    } else if (rhythmId === "stemi_inferior") {
      if (["II", "III", "aVF"].includes(selectedLead)) {
        stModifier = 1.5; tAmpMult = 1.4;
      } else if (["I", "aVL", "V1", "V2", "V3"].includes(selectedLead)) {
        stModifier = -0.7; tAmpMult = -0.4;
      } else {
        stModifier = 0.1;
      }
    } else if (rhythmId === "stemi_lateral") {
      if (["I", "aVL", "V5", "V6"].includes(selectedLead)) {
        stModifier = 1.4; tAmpMult = 1.3;
      } else if (["II", "III", "aVF"].includes(selectedLead)) {
        stModifier = -0.6;
      } else {
        stModifier = 0.0;
      }
    } else if (rhythmId === "stemi_posterior_isolated") {
      if (["V1", "V2", "V3"].includes(selectedLead)) {
        // Since stLevel for stemi_posterior_isolated is -3.5, a positive modifier yields clinical ST depression.
        // Also exhibits a tall, broad R-wave (qrsSign = 1.2, qrsAmpMult = 1.6) and upright/tall T-wave (tAmpMult = 1.5).
        stModifier = 1.4; tAmpMult = 1.5; qrsSign = 1.2; qrsAmpMult = 1.6;
      } else {
        stModifier = 0.0;
      }
    } else if (rhythmId === "stemi_posterior_inferior") {
      if (["II", "III", "aVF"].includes(selectedLead)) {
        // Since stLevel for stemi_posterior_inferior is 3.0, a positive modifier yields ST elevation (3.0 * 1.5 = +4.5).
        stModifier = 1.5; tAmpMult = 1.4;
      } else if (["V1", "V2", "V3"].includes(selectedLead)) {
        // Reciprocal ST depression in anterior leads due to posterior STEMI (3.0 * -1.2 = -3.6 depression).
        // Features tall, broad R-waves (qrsSign = 1.2, qrsAmpMult = 1.6) and tall upright T-waves.
        stModifier = -1.2; tAmpMult = 1.5; qrsSign = 1.2; qrsAmpMult = 1.6;
      } else if (["I", "aVL"].includes(selectedLead)) {
        // Reciprocal ST depression in lateral leads
        stModifier = -0.7; tAmpMult = -0.4;
      } else {
        stModifier = 0.1;
      }
    } else if (rhythmId === "lvh") {
      if (["V1", "V2", "V3"].includes(selectedLead)) {
        isLVHRightPrecordial = true;
      } else if (["I", "aVL", "V5", "V6"].includes(selectedLead)) {
        isLVHLateral = true;
      }
    } else if (rhythmId === "rvh") {
      if (["V1", "V2"].includes(selectedLead)) {
        isRVHRightAxis = true;
      } else if (["I", "aVL", "V5", "V6"].includes(selectedLead)) {
        isRVHLateral = true;
      } else if (["III", "aVF"].includes(selectedLead)) {
        qrsSign = 1.3; qrsAmpMult = 1.35;
      }
    } else if (rhythmId === "lae") {
      if (["V1", "V2"].includes(selectedLead)) {
        pAmpMult = 1.2;
      } else if (["II", "III", "aVF"].includes(selectedLead)) {
        pAmpMult = 1.4;
      } else {
        pAmpMult = 1.1;
      }
    } else if (rhythmId === "rae") {
      if (["II", "III", "aVF"].includes(selectedLead)) {
        pAmpMult = 2.4;
      } else if (["V1", "V2"].includes(selectedLead)) {
        pAmpMult = 1.8;
      } else if (selectedLead === "aVR") {
        pAmpMult = -2.0;
      } else {
        pAmpMult = 1.2;
      }
    } else if (rhythmId === "rbbb" || aberrancyType === "rbbb") {
      if (["V1", "V2", "V3"].includes(selectedLead)) {
        isV1V2RBBB = true;
      } else {
        isLateralRBBB = true;
      }
    } else if (rhythmId === "lbbb" || aberrancyType === "lbbb") {
      if (["V1", "V2", "V3", "aVR"].includes(selectedLead)) {
        isLBBBRightPrecordial = true;
      } else {
        isLBBBLateral = true;
      }
    }

    const sssBeatCycleTimes = [0.3, 0.72, 1.18, 1.58, 2.05, 2.48, 2.95, 3.38, 3.82, 4.30, 4.75, 5.22, 5.70, 6.18, 10.2, 12.3, 13.9, 15.5, 17.1, 18.7];

    for (let i = 0; i < pointsToGen; i++) {
      const t = timeRef.current - dt + (i / pointsToGen) * dt;
      let yVal = 0;
      let label = "";

      if (isVFib) {
        if (rhythmId === "vfib_fine") {
          // Fine V-Fib (فیبریلاسیون بطنی نرم):
          // High-frequency, low-amplitude, frantic but exhausted quivers (8Hz - 18Hz) with minor baseline drift.
          const tScale1 = t * 9.2;
          const tScale2 = t * 13.5;
          const tScale3 = t * 16.8;
          
          let wave = (
            Math.sin(tScale1 * Math.PI * 2) * 0.44 +
            Math.sin(tScale2 * Math.PI * 2 + 1.2) * 0.33 +
            Math.cos(tScale3 * Math.PI * 2 + 0.5) * 0.18
          );
          
          // Rapid biological micro-tremors (noise) that depict fine quivering cardiac tissue
          wave += (Math.random() - 0.5) * 0.16;
          
          // Subtle waxing/waning amplitude envelope
          const env = 0.82 + 0.18 * Math.sin(t * 3.5);
          const wander = Math.sin(t * 1.2) * 0.045; // slight slow drift
          
          let leadScale = qrsAmpMult * 0.22; // very small fine amplitude (~2mm)
          if (selectedLead === "aVR") {
            leadScale = -0.18;
          } else if (["V1", "V2"].includes(selectedLead)) {
            leadScale = qrsAmpMult * 0.32; // slightly more pronounced in right precordial
          }
          
          yVal = (wave * env + wander) * leadScale * 75;
        } else {
          // Coarse V-Fib (فیبریلاسیون بطنی خشن):
          // Robust, highly erratic, larger waves (3Hz - 8Hz) following a winding path.
          const tScale1 = t * 4.4;
          const tScale2 = t * 6.3;
          const tScale3 = t * 3.1;
          
          // Chaotic phase walk
          const phaseWalk = Math.sin(t * 2.45) * 1.4;
          
          let wave = (
            Math.sin(tScale1 * Math.PI * 2 + phaseWalk) * 0.52 +
            Math.sin(tScale2 * Math.PI * 2 + 0.8) * 0.36 +
            Math.cos(tScale3 * Math.PI * 2 - 0.4) * 0.24
          );
          
          // Small biological micro-quivers overlay
          wave += Math.sin(t * Math.PI * 2 * 11.5) * 0.07;
          
          // Smooth saturation to model real physical limits of cardiac cells
          wave = Math.max(-1.4, Math.min(1.4, wave));
          
          // Distinct waxing/waning envelope typical for Coarse V-Fib
          const env = 0.88 + 0.38 * Math.sin(t * 1.12) * Math.cos(t * 0.42);
          const wander = Math.sin(t * 0.85) * 0.11; // moderate baseline sway
          
          // High-frequency trace jitter (extremely realistic on phospher screens/LEDs)
          const traceJitter = (Math.random() - 0.5) * 0.05;
          
          let leadScale = qrsAmpMult * 1.25; // coarse and prominent visual heights
          if (selectedLead === "aVR") {
            leadScale = -0.85;
          } else if (["V1", "V2", "V3"].includes(selectedLead)) {
            leadScale = qrsAmpMult * 1.65; // very prominent coarseness in anterior leads
          } else if (["I", "aVL", "V5", "V6"].includes(selectedLead)) {
            leadScale = qrsAmpMult * 1.05;
          }
          
          yVal = (wave * env + wander + traceJitter) * leadScale * 75;
        }
      } 
      else if (isVTach) {
        const freq = (bpm / 60);
        const cycleLen = 1.0 / freq;
        const p = (t % cycleLen) / cycleLen; // 0 to 1 progressive phase
        
        let rawWave = 0;
        // In VT, ventricular depolarisation occupies about 45% of the cycle duration
        const qrsSplit = 0.45;
        if (p < qrsSplit) {
          const qrsPhase = p / qrsSplit; // 0 to 1 inside QRS
          // Deep wide notched complex simulating slowed intraventricular activation
          rawWave = Math.sin(qrsPhase * Math.PI) * 1.45 - 
                    0.28 * Math.sin(qrsPhase * Math.PI * 3) + 
                    0.10 * Math.sin(qrsPhase * Math.PI * 5);
          
          // Add a classic ventricular conduction delayed slurred notch
          rawWave += 0.14 * Math.sin(qrsPhase * Math.PI * 2) * Math.sin(qrsPhase * Math.PI * 4);
        } else {
          const tPhase = (p - qrsSplit) / (1.0 - qrsSplit); // 0 to 1 inside discordant T-wave
          // Highly discordant, slower, wide T-wave opposite in polarity to the QRS
          rawWave = -0.52 * Math.sin(tPhase * Math.PI) - 
                    0.08 * Math.sin(tPhase * Math.PI * 2);
        }
        
        // Apply directional lead sign (V1-V3 are typically deep QS / LBBB-type, aVR inverted, II positive, etc.)
        const polarity = qrsSign >= 0 ? 1.0 : -1.0;
        const wander = Math.sin(t * 0.6) * 0.08; // subtle baseline wander
        const traceJitter = (Math.random() - 0.5) * 0.03; // authentic oscilloscope jitter
        
        // VT is tall, dominant, and wide, so lead-based scaling factor is applied:
        let vtScale = qrsAmpMult * 1.35;
        if (["V1", "V2", "V3"].includes(selectedLead)) {
          vtScale = qrsAmpMult * 1.5; // very prominent and giant anterior complexes
        } else if (["I", "aVL", "V5", "V6"].includes(selectedLead)) {
          vtScale = qrsAmpMult * 1.1;
        }
        
        yVal = (rawWave * polarity * vtScale + wander + traceJitter) * 65;
      } 
      else if (isPolymorphicVT) {
        const freq = 3.2; 
        const baseWave = Math.sin(t * Math.PI * 2 * freq) * 0.8 + Math.sin(t * Math.PI * 4 * freq) * 0.25;
        const modulation = 0.15 + 0.85 * Math.sin(t * Math.PI * 2 / 4.5);
        yVal = baseWave * modulation * 75;
      }
      else {
        // Atrial Flutter Sawtooth (F-waves)
        let flutterY = 0;
        if (rhythmId === "aflutter") {
          // Atrial frequency typically 250-350 bpm. Here 5.3 Hz is ~318 bpm.
          const fFreq = 5.3; 
          const phase = t * Math.PI * 2 * fFreq;
          
          // Smooth biological sawtooth wave using Fourier harmonics sum
          const sawVal = Math.sin(phase) + 0.42 * Math.sin(2 * phase) + 0.2 * Math.sin(3 * phase) + 0.08 * Math.sin(4 * phase);
          
          // Sawtooth leads polarity: inverted in inferior (II, III, aVF) and standard limb leads (I),
          // positive (upright) in right-precordial leads (V1, V2).
          let flutterPol = -1.0;
          if (["V1", "V2", "V3"].includes(selectedLead)) {
            flutterPol = 1.0;
          } else if (["I", "aVL"].includes(selectedLead)) {
            flutterPol = 0.35; // flatter amplitude
          }
          
          flutterY = sawVal * 0.65 * flutterPol * parameters.pAmplitude * 0.18 * 70;

          // Define label F at the peak of each flutter wave
          // The peak of sawVal occurs roughly at cyclePos = (t * fFreq) % 1.0 around 0.19.
          const cyclePos = (t * fFreq) % 1.0;
          if (Math.abs(cyclePos - 0.19) < 0.007) {
            label = "F";
          }
        }

        // Complete Heart Block Atrial P waves (independent AV dissociation)
        let dissociatedP = 0;
        if (rhythmId === "complete_block") {
          const aDur = 0.75; // constant independent atrial beat around 80 bpm
          const uA = t % aDur;
          const pWidth = 0.08;
          if (uA >= 0.04 && uA < 0.04 + pWidth) {
            const ratio = (uA - 0.04) / pWidth;
            dissociatedP = 0.18 * parameters.pAmplitude * pAmpMult * Math.pow(Math.sin(Math.PI * ratio), 1.25) * 70;
            if (uA - 0.04 < 0.02) label = "P";
          }
        }

        // Continuous atrial fibrillation f-waves
        let afibFWaves = 0;
        const isSSSAFibPhase = (rhythmId === "sss" && (t % 20.0 < 6.5));
        if (rhythmId === "afib" || isSSSAFibPhase || (parameters.pAmplitude === 0 && parameters.isIrregular)) {
          // A-Fib: Rapid, disorganized quivering baseline (f-waves). No discernable P waves.
          // It must look like fine "parasite" noise style, very rapid oscillations (12Hz - 25Hz).
          let afibScale = 0.22; // default fine quivers
          if (["V1", "V2"].includes(selectedLead)) {
            afibScale = 0.48; // slightly coarser in V1/V2, but still small and fast
          } else if (["I", "aVL", "V5", "V6"].includes(selectedLead)) {
            afibScale = 0.14; // extremely fine (microscopic parasite-like)
          }

          // Super high frequency biological quivers to form the parasite-like baseline
          const f_af1 = 14.5 + 4.5 * Math.sin(t * 2.2);
          const f_af2 = 21.0 + 6.2 * Math.cos(t * 3.4);
          const f_af3 = 28.5;
          const f_af4 = 37.0;

          const rawQuiver = (
            Math.sin(t * Math.PI * 2 * f_af1) * 0.42 +
            Math.sin(t * Math.PI * 2 * f_af2 + 1.5) * 0.32 +
            Math.cos(t * Math.PI * 2 * f_af3) * 0.18 +
            Math.sin(t * Math.PI * 2 * f_af4) * 0.10 +
            (Math.random() - 0.5) * 0.22
          );

          // Slow fluctuating envelope for amplitude quivering realism
          const env = 0.85 + 0.30 * Math.sin(t * 1.5) * Math.cos(t * 0.6);
          
          afibFWaves = rawQuiver * env * afibScale * 25; // beautiful, fine, clinical parasite quivers
        }

        // TRIGGER NEW VENTRICULAR BEAT
        if (rhythmId === "sss" && (nextBeatTimeRef.current === t || nextBeatTimeRef.current === 0)) {
          const currentCycleNum = Math.floor(t / 20.0);
          const cycleTime = t - currentCycleNum * 20.0;
          let nextLocalBeatTime = sssBeatCycleTimes[0];
          for (const bt of sssBeatCycleTimes) {
            if (bt >= cycleTime) {
              nextLocalBeatTime = bt;
              break;
            }
          }
          nextBeatTimeRef.current = currentCycleNum * 20.0 + nextLocalBeatTime;
        } else if (nextBeatTimeRef.current === 0) {
          nextBeatTimeRef.current = t; // trigger immediately
        }

        const shouldTriggerBeat = t >= nextBeatTimeRef.current;

        if (shouldTriggerBeat) {
          const cycleIndex = beatCounterRef.current + 1;
          beatCounterRef.current = cycleIndex;

          let isDropped = false;
          let isPVC = false;
          let isAshman = false;
          let prInterval = parameters.prInterval;
          let noPWave = false;
          let isEscape = false;
          let sssBpm = bpm;

          if (rhythmId === "sss") {
            const beatCycleTime = nextBeatTimeRef.current % 20.0;
            let matchedIndex = 0;
            let minDiff = 999;
            for (let idx = 0; idx < sssBeatCycleTimes.length; idx++) {
              const diff = Math.abs(sssBeatCycleTimes[idx] - beatCycleTime);
              if (diff < minDiff) {
                minDiff = diff;
                matchedIndex = idx;
              }
            }

            const matchedLocalTime = sssBeatCycleTimes[matchedIndex];
            if (matchedLocalTime === 10.2) {
              // Junctional Escape Beat: no P wave, slow rate characteristics
              isEscape = true;
              noPWave = true;
              sssBpm = 40;
            } else if (matchedLocalTime <= 6.18) {
              // Tachycardia phase
              noPWave = true;
              sssBpm = 125;
            } else {
              // Bradycardia phase
              noPWave = false;
              sssBpm = 40;
            }
          } else {
            if (rhythmId === "mobitz_1") {
              const stepIndex = cycleIndex % 4;
              if (stepIndex === 3) {
                isDropped = true;
              } else {
                prInterval = parameters.prInterval + stepIndex * 0.05;
              }
            } else if (rhythmId === "mobitz_2") {
              if (cycleIndex % 2 === 1) {
                isDropped = true;
              }
            } else if (rhythmId === "pvc") {
              if (cycleIndex % 4 === 3) {
                isPVC = true;
              }
            }
          }

          // Base beat duration
          const baseDuration = 60 / bpm;
          let actualDuration = baseDuration;

          if (rhythmId === "afib") {
            const step = cycleIndex % 8;
            if (step === 2) {
              // Long interval (R-R before Ashman beat is prolonged)
              actualDuration = baseDuration * 1.55;
            } else if (step === 3) {
              // Short interval (R-R right before Ashman beat is short)
              actualDuration = baseDuration * 0.52;
            } else if (step === 4) {
              // This beat at the end of the short cycle is aberrantly conducted (Ashman phenomenon)
              isAshman = true;
              const randFactor = 0.6 + Math.random() * 0.4;
              actualDuration = baseDuration * randFactor;
            } else {
              const randFactor = 0.58 + Math.random() * 0.82; 
              actualDuration = baseDuration * randFactor;
            }
          } else if (rhythmId === "aflutter") {
            const flutterPeriod = 1.0 / 5.3; 
            const targetPeriod = 60 / bpm;
            const ratio = Math.max(2, Math.min(8, Math.round(targetPeriod / flutterPeriod)));
            actualDuration = ratio * flutterPeriod;
          } else if (parameters.isIrregular) {
            const randomVariance = (Math.random() - 0.45) * 0.45;
            actualDuration = baseDuration * (1 + randomVariance);
          } else if (rhythmId === "pvc") {
            const nextCycleIndex = cycleIndex + 1;
            if (nextCycleIndex % 4 === 3) {
              actualDuration = baseDuration * 0.70;
            } else if (cycleIndex % 4 === 3) {
              actualDuration = baseDuration * 1.30;
            }
          }

          // Advance scheduling
          if (rhythmId === "sss") {
            const beatCycleTime = nextBeatTimeRef.current % 20.0;
            let matchedIndex = 0;
            let minDiff = 999;
            for (let idx = 0; idx < sssBeatCycleTimes.length; idx++) {
              const diff = Math.abs(sssBeatCycleTimes[idx] - beatCycleTime);
              if (diff < minDiff) {
                minDiff = diff;
                matchedIndex = idx;
              }
            }

            const currentCycleNum = Math.floor(nextBeatTimeRef.current / 20.0);
            if (matchedIndex < sssBeatCycleTimes.length - 1) {
              nextBeatTimeRef.current = currentCycleNum * 20.0 + sssBeatCycleTimes[matchedIndex + 1];
            } else {
              nextBeatTimeRef.current = (currentCycleNum + 1) * 20.0 + sssBeatCycleTimes[0];
            }
          } else {
            nextBeatTimeRef.current = t + actualDuration;
          }

          beatTimesHistoryRef.current.push({
            time: (rhythmId === "sss") ? (t - (t % 0.001)) : t,
            bpm: (rhythmId === "sss") ? sssBpm : bpm,
            isPVC,
            isDropped,
            cycleIndex,
            prInterval,
            noPWave,
            isEscape,
            isAshman
          });

          if (beatTimesHistoryRef.current.length > 8) {
            beatTimesHistoryRef.current.shift();
          }

          if (!isDropped && t - lastBeepTimeRef.current > 0.20) {
            beep();
            if (lastBeepTimeRef.current > 0) {
              const rr = t - lastBeepTimeRef.current;
              // Ensure reasonable biological range (e.g. 15 to 400 bpm)
              if (rr > 0.15 && rr < 5.0) {
                const instantBpm = Math.round(60 / rr);
                const isIrreg = parameters.isIrregular || 
                                rhythmId === "afib" || 
                                rhythmId === "sss" || 
                                rhythmId === "pvc" || 
                                rhythmId === "complete_block" || 
                                rhythmId === "mobitz_1" || 
                                rhythmId === "mobitz_2" || 
                                rhythmId === "aflutter";

                if (isIrreg) {
                  // Weighted moving average for soft physical filtering (like real patient monitor logs)
                  displayedBpmRef.current = Math.round(displayedBpmRef.current * 0.5 + instantBpm * 0.5);
                } else {
                  displayedBpmRef.current = bpm;
                }
              }
            } else {
              displayedBpmRef.current = bpm;
            }
            lastBeepTimeRef.current = t;
          }
        }

        // Calculate combined deflection from active beats in history
        let beatDeflections = 0;
        for (const beat of beatTimesHistoryRef.current) {
          const u = t - beat.time;
          if (u >= 0 && u < 1.5) {
            // General wave sequencing parameters
            const rt = Math.sqrt(60 / beat.bpm);
            
            if (rhythmId === "sinewave") {
              const waveStart = 0.08 * rt;
              const waveDur = 0.58 * rt;
              if (u >= waveStart && u < waveStart + waveDur) {
                const ratio = (u - waveStart) / waveDur;
                
                // Clinically realistic 12-lead vector differences for severe hyperkalemia sine wave
                let sinewaveMult = 1.0;
                let sinewaveSign = 1.0;
                
                switch (leadToUse) {
                  case "I": sinewaveMult = 0.75; sinewaveSign = 1.0; break;
                  case "II": sinewaveMult = 1.25; sinewaveSign = 1.0; break;
                  case "III": sinewaveMult = 0.85; sinewaveSign = 1.0; break;
                  case "aVR": sinewaveMult = 1.10; sinewaveSign = -1.0; break; // inverted
                  case "aVL": sinewaveMult = 0.55; sinewaveSign = 1.0; break; // low voltage
                  case "aVF": sinewaveMult = 1.15; sinewaveSign = 1.0; break;
                  case "V1": sinewaveMult = 1.00; sinewaveSign = -1.0; break; // inverted
                  case "V2": sinewaveMult = 1.55; sinewaveSign = -0.6; break; // transitional, mostly negative
                  case "V3": sinewaveMult = 1.85; sinewaveSign = 0.5; break;  // transitional, hybrid
                  case "V4": sinewaveMult = 1.95; sinewaveSign = 1.0; break;  // maximum amplitude
                  case "V5": sinewaveMult = 1.50; sinewaveSign = 1.0; break;
                  case "V6": sinewaveMult = 1.10; sinewaveSign = 1.0; break;
                  default: sinewaveMult = 1.00; sinewaveSign = 1.0;
                }

                // Inversion does not apply since "sinewave" and "dextrocardia" are separate presets.

                beatDeflections += Math.sin(2 * Math.PI * ratio) * 1.62 * sinewaveSign * sinewaveMult * 70;
                if (ratio < 0.45) {
                  label = "QRS";
                } else {
                  label = "T";
                }
              }
              continue;
            }
            
            let pWidth = 0.08 * rt;
            if (rhythmId === "lae") {
              if (selectedLead === "V1" || selectedLead === "V2") {
                pWidth = 0.11 * rt;
              } else {
                pWidth = 0.14 * rt;
              }
            } else if (rhythmId === "rae") {
              pWidth = 0.082 * rt;
            }

            const scaledPr = beat.prInterval * Math.sqrt(rt);
            const qrsStart = 0.05 + scaledPr;
            
            const isBeatAshman = !!beat.isAshman;
            const isBeatV1V2RBBB = isV1V2RBBB || (isBeatAshman && ["V1", "V2"].includes(selectedLead));
            const isBeatLateralRBBB = isLateralRBBB || (isBeatAshman && !["V1", "V2"].includes(selectedLead));

            let customQrsDuration = beat.isPVC ? 0.16 : (rhythmId === "hyperkalemia" ? 0.13 : parameters.qrsDuration);
            if (isBeatAshman) {
              customQrsDuration = 0.185; // Widened QRS for Ashman aberrant beat
            } else if (aberrancyType === "rbbb" || aberrancyType === "lbbb") {
              customQrsDuration = 0.145; // Widened QRS for manual aberrancy
            }
            
            let customStLevel = parameters.stLevel;
            let customTVolume = beat.isPVC ? -1.5 : (rhythmId === "hyperkalemia" ? 2.4 : parameters.tAmplitude * tAmpMult);

            if (rhythmId === "lvh") {
              if (isLVHRightPrecordial) {
                customStLevel = 0.8;
                customTVolume = 1.2 * tAmpMult;
              } else if (isLVHLateral) {
                customStLevel = -1.5;
                customTVolume = -1.4 * tAmpMult;
              } else {
                customStLevel = 0.0;
                customTVolume = 0.8 * tAmpMult;
              }
            } else if (rhythmId === "rvh") {
              if (isRVHRightAxis) {
                customStLevel = -1.2;
                customTVolume = -1.1 * tAmpMult;
              } else {
                customStLevel = 0.0;
                customTVolume = 0.8 * tAmpMult;
              }
            } else if (rhythmId === "rbbb" || aberrancyType === "rbbb") {
              if (isV1V2RBBB) {
                customStLevel = -0.5;
                customTVolume = -0.8 * tAmpMult;
              } else if (isLateralRBBB) {
                customStLevel = 0.0;
                customTVolume = 0.8 * tAmpMult;
              }
            } else if (rhythmId === "lbbb" || aberrancyType === "lbbb") {
              if (isLBBBLateral) {
                customStLevel = -1.3;
                customTVolume = -1.2 * tAmpMult;
              } else if (isLBBBRightPrecordial) {
                customStLevel = 1.1;
                customTVolume = 1.3 * tAmpMult;
              }
            }

            const qrsDur = customQrsDuration;
            const qrsEnd = qrsStart + qrsDur;

            let remainingST_T = (parameters.qtInterval !== undefined ? (parameters.qtInterval - qrsDur) : 0.26);
            if (remainingST_T < 0.05) remainingST_T = 0.05;

            let stDur = (parameters.qtInterval !== undefined ? remainingST_T * 0.30 : 0.08) * rt;
            if (rhythmId === "hypercalcemia") {
              stDur = 0.01;
            } else if (rhythmId === "hypocalcemia") {
              stDur = 0.20;
            }

            const tStart = qrsEnd + stDur;
            const tDur = (rhythmId === "hyperkalemia" 
              ? 0.12 
              : (parameters.qtInterval !== undefined ? remainingST_T * 0.70 : 0.18)) * rt;
            const tEnd = tStart + tDur;

            let pMorphology = 1.0;
            if (rhythmId === "mat") {
              pMorphology = Math.sin(beat.cycleIndex * 2.3);
            } else if (rhythmId === "wap") {
              pMorphology = Math.sin(beat.cycleIndex * 1.5);
            } else if (rhythmId === "junctional_escape" || rhythmId === "acc_junctional" || rhythmId === "junctional_tachy") {
              pMorphology = -0.6;
            } else if (rhythmId === "hyperkalemia") {
              pMorphology = 0.2;
            }

            // QRS Label Setup
            if (u >= qrsStart && u < qrsEnd) {
              label = beat.isAshman 
                ? "Ashman Beat (بیت اشمن)" 
                : (beat.isPVC ? "PVC (ضربان زودرس بطنی)" : (rhythmId === "wpw" ? "Delta / QRS" : "QRS"));
            }

            // 1. P Wave
            const isAFlutterOrAFibOrComplete = (rhythmId === "aflutter" || rhythmId === "afib" || rhythmId === "complete_block");
            if (u >= 0.05 && u < 0.05 + pWidth && !beat.isPVC && parameters.pAmplitude > 0 && !isAFlutterOrAFibOrComplete && !beat.noPWave) {
              const ratio = (u - 0.05) / pWidth;
              const pBase = 0.18 * parameters.pAmplitude * pAmpMult * pMorphology;
              if (rhythmId === "lae") {
                if (selectedLead === "V1" || selectedLead === "V2") {
                  let biphasicVal = 0;
                  if (ratio < 0.4) {
                    biphasicVal = 0.75 * Math.sin(Math.PI * (ratio / 0.4));
                  } else {
                    biphasicVal = -1.75 * Math.sin(Math.PI * ((ratio - 0.4) / 0.6));
                  }
                  beatDeflections += 0.18 * parameters.pAmplitude * biphasicVal * 70;
                } else {
                  const notchedVal = Math.sin(Math.PI * ratio) + 0.3 * Math.sin(3 * Math.PI * ratio);
                  beatDeflections += pBase * notchedVal * 70;
                }
              } else if (rhythmId === "rae") {
                const peakedVal = Math.pow(Math.sin(Math.PI * ratio), 1.7);
                beatDeflections += pBase * peakedVal * 70;
              } else {
                beatDeflections += pBase * Math.pow(Math.sin(Math.PI * ratio), 1.25) * 70;
              }
              if (rhythmId === "wap" || rhythmId === "mat") {
                const focus = beat.cycleIndex % 3;
                if (focus === 1) {
                  label = "P'";
                } else if (focus === 2) {
                  label = "P''";
                } else {
                  label = "P";
                }
              } else {
                label = "P";
              }
            }
            // 2. PR Delta Segment (WPW)
            else if (rhythmId === "wpw" && u >= (qrsStart - 0.04) && u < qrsStart) {
              const deltaRatio = (u - (qrsStart - 0.04)) / 0.04;
              beatDeflections += deltaRatio * 0.20 * qrsSign * 70;
              label = "Delta Wave";
            }
            // 3. QRS Complex
            else if (u >= qrsStart && u < qrsEnd) {
              if (!beat.isDropped) {
                const d = u - qrsStart;
                const L = qrsDur;
                let qrsWave = 0;

                if (beat.isPVC) {
                  const r1 = -1.8;
                  const r2 = 0.4;
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (d < L * 0.5) {
                    qrsWave = linearInterpolate(0, r1, d / (L * 0.5));
                  } else if (d < L * 0.8) {
                    qrsWave = linearInterpolate(r1, r2, (d - L * 0.5) / (L * 0.3));
                  } else {
                    qrsWave = linearInterpolate(r2, jVal, (d - L * 0.8) / (L * 0.2));
                  }
                } 
                else if (isBeatV1V2RBBB) {
                  const r1 = 0.45 * qrsAmpMult;  
                  const s1 = -0.25 * qrsAmpMult; 
                  const r2 = 1.15 * qrsAmpMult;  
                  const jVal = customStLevel * 0.08 * stModifier;
                  
                  if (d < L * 0.25) {
                    qrsWave = linearInterpolate(0, r1, d / (L * 0.25));
                  } else if (d < L * 0.45) {
                    qrsWave = linearInterpolate(r1, s1, (d - L * 0.25) / (L * 0.20));
                  } else if (d < L * 0.75) {
                    qrsWave = linearInterpolate(s1, r2, (d - L * 0.45) / (L * 0.30));
                  } else {
                    qrsWave = linearInterpolate(r2, jVal, (d - L * 0.75) / (L * 0.25));
                  }
                }
                else if (isBeatLateralRBBB) {
                  const qVal = -0.1 * qrsAmpMult;
                  const rVal = 1.45 * qrsAmpMult;
                  const sVal = -0.6 * qrsAmpMult; 
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (d < L * 0.12) {
                    qrsWave = linearInterpolate(0, qVal, d / (L * 0.12));
                  } else if (d < L * 0.38) {
                    qrsWave = linearInterpolate(qVal, rVal, (d - L * 0.12) / (L * 0.26));
                  } else if (d < L * 0.65) {
                    qrsWave = linearInterpolate(rVal, sVal, (d - L * 0.38) / (L * 0.27));
                  } else {
                    qrsWave = linearInterpolate(sVal, jVal, (d - L * 0.65) / (L * 0.35));
                  }
                }
                else if (isLBBBLateral) {
                  const r1 = 1.3 * qrsAmpMult;
                  const r2 = 1.5 * qrsAmpMult;
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (d < L * 0.32) {
                    qrsWave = cosineInterpolate(0, r1, d / (L * 0.32));
                  } else if (d < L * 0.65) {
                    qrsWave = cosineInterpolate(r1, r2, (d - L * 0.32) / (L * 0.33));
                  } else {
                    qrsWave = cosineInterpolate(r2, jVal, (d - L * 0.65) / (L * 0.35));
                  }
                }
                else if (isLBBBRightPrecordial) {
                  const rVal = 0.1 * qrsAmpMult;
                  const sVal = -1.8 * qrsAmpMult;
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (d < L * 0.15) {
                    qrsWave = linearInterpolate(0, rVal, d / (L * 0.15));
                  } else if (d < L * 0.52) {
                    qrsWave = linearInterpolate(rVal, sVal, (d - L * 0.15) / (L * 0.37));
                  } else {
                    qrsWave = linearInterpolate(sVal, jVal, (d - L * 0.52) / (L * 0.48));
                  }
                }
                else if (isLVHRightPrecordial) {
                  const qVal = -0.15;
                  const rVal = 0.25; 
                  const sVal = -3.1 * qrsAmpMult; 
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (d < L * 0.1) {
                    qrsWave = linearInterpolate(0, qVal, d / (L * 0.1));
                  } else if (d < L * 0.3) {
                    qrsWave = linearInterpolate(qVal, rVal, (d - L * 0.1) / (L * 0.2));
                  } else if (d < L * 0.65) {
                    qrsWave = linearInterpolate(rVal, sVal, (d - L * 0.3) / (L * 0.35));
                  } else {
                    qrsWave = linearInterpolate(sVal, jVal, (d - L * 0.65) / (L * 0.35));
                  }
                }
                else if (isLVHLateral) {
                  const qVal = -0.18 * qrsAmpMult;
                  const rVal = 3.0 * qrsAmpMult; 
                  const sVal = -0.1 * qrsAmpMult;
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (d < L * 0.12) {
                    qrsWave = linearInterpolate(0, qVal, d / (L * 0.12));
                  } else if (d < L * 0.4) {
                    qrsWave = linearInterpolate(qVal, rVal, (d - L * 0.12) / (L * 0.28));
                  } else if (d < L * 0.72) {
                    qrsWave = linearInterpolate(rVal, sVal, (d - L * 0.4) / (L * 0.32));
                  } else {
                    qrsWave = linearInterpolate(sVal, jVal, (d - L * 0.72) / (L * 0.28));
                  }
                }
                else if (isRVHRightAxis) {
                  const qVal = -0.15;
                  const rVal = 2.4 * qrsAmpMult; 
                  const sVal = -0.1;
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (d < L * 0.12) {
                    qrsWave = linearInterpolate(0, qVal, d / (L * 0.12));
                  } else if (d < L * 0.45) {
                    qrsWave = linearInterpolate(qVal, rVal, (d - L * 0.12) / (L * 0.33));
                  } else if (d < L * 0.75) {
                    qrsWave = linearInterpolate(rVal, sVal, (d - L * 0.45) / (L * 0.3));
                  } else {
                    qrsWave = linearInterpolate(sVal, jVal, (d - L * 0.75) / (L * 0.25));
                  }
                }
                else if (isRVHLateral) {
                  const rVal = 0.45 * qrsAmpMult;
                  const sVal = -1.9 * qrsAmpMult;
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (d < L * 0.20) {
                    qrsWave = linearInterpolate(0, rVal, d / (L * 0.20));
                  } else if (d < L * 0.65) {
                    qrsWave = linearInterpolate(rVal, sVal, (d - L * 0.20) / (L * 0.45));
                  } else {
                    qrsWave = linearInterpolate(sVal, jVal, (d - L * 0.65) / (L * 0.35));
                  }
                }
                else if (rhythmId === "lafb") {
                  const rVal = 0.25 * qrsAmpMult;
                  const sVal = -1.2 * qrsAmpMult;
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (d < L * 0.15) {
                    qrsWave = linearInterpolate(0, rVal, d / (L * 0.15));
                  } else if (d < L * 0.65) {
                    qrsWave = linearInterpolate(rVal, sVal, (d - L * 0.15) / (L * 0.5));
                  } else {
                    qrsWave = linearInterpolate(sVal, jVal, (d - L * 0.65) / (L * 0.35));
                  }
                }
                else if (rhythmId === "wpw") {
                  const dVal = 0.45 * qrsAmpMult * qrsSign; 
                  const rVal = 1.45 * qrsAmpMult * qrsSign; 
                  const sVal = -0.35 * qrsAmpMult * qrsSign; 
                  const jVal = customStLevel * 0.08 * stModifier;
                  
                  if (d < L * 0.4) {
                    qrsWave = linearInterpolate(0, dVal, d / (L * 0.4));
                  } else if (d < L * 0.62) {
                    qrsWave = linearInterpolate(dVal, rVal, (d - L * 0.4) / (L * 0.22));
                  } else if (d < L * 0.82) {
                    qrsWave = linearInterpolate(rVal, sVal, (d - L * 0.62) / (L * 0.20));
                  } else {
                    qrsWave = linearInterpolate(sVal, jVal, (d - L * 0.82) / (L * 0.18));
                  }
                }
                else if (isLADInferior || isRADLateral || isERADNegative) {
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (qWaveMimicMI) {
                    // QS pattern: pathological Q wave, mimicking MI, suddenly plunges negative
                    const sDeepVal = -1.8 * qrsAmpMult;
                    if (d < L * 0.45) {
                      qrsWave = linearInterpolate(0, sDeepVal, d / (L * 0.45));
                    } else {
                      qrsWave = linearInterpolate(sDeepVal, jVal, (d - L * 0.45) / (L * 0.55));
                    }
                  } else {
                    // rS pattern: normal axis deviation - small initial positive r wave, then deep negative S wave
                    const rSmallVal = 0.25 * qrsAmpMult;
                    const sDeepVal = -1.5 * qrsAmpMult;
                    if (d < L * 0.15) {
                      qrsWave = linearInterpolate(0, rSmallVal, d / (L * 0.15));
                    } else if (d < L * 0.55) {
                      qrsWave = linearInterpolate(rSmallVal, sDeepVal, (d - L * 0.15) / (L * 0.40));
                    } else {
                      qrsWave = linearInterpolate(sDeepVal, jVal, (d - L * 0.55) / (L * 0.45));
                    }
                  }
                }
                else if (leadToUse === "V1") {
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (qWaveMimicMI) {
                    // Pathological QS pattern (simulating MI / anterior Q waves)
                    const sDeepVal = -1.65 * qrsAmpMult;
                    if (d < L * 0.42) {
                      qrsWave = linearInterpolate(0, sDeepVal, d / (L * 0.42));
                    } else {
                      qrsWave = linearInterpolate(sDeepVal, jVal, (d - L * 0.42) / (L * 0.58));
                    }
                  } else {
                    // Classic V1 rS pattern with a small initial positive 'r' deflection
                    const rSmallVal = 0.16 * qrsAmpMult;
                    const sDeepVal = -1.55 * qrsAmpMult;
                    if (d < L * 0.12) {
                      qrsWave = linearInterpolate(0, rSmallVal, d / (L * 0.12));
                    } else if (d < L * 0.45) {
                      qrsWave = linearInterpolate(rSmallVal, sDeepVal, (d - L * 0.12) / (L * 0.33));
                    } else {
                      qrsWave = linearInterpolate(sDeepVal, jVal, (d - L * 0.45) / (L * 0.55));
                    }
                  }
                }
                else if (leadToUse === "V2") {
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (qWaveMimicMI) {
                    // Pathological QS pattern
                    const sDeepVal = -1.9 * qrsAmpMult;
                    if (d < L * 0.42) {
                      qrsWave = linearInterpolate(0, sDeepVal, d / (L * 0.42));
                    } else {
                      qrsWave = linearInterpolate(sDeepVal, jVal, (d - L * 0.42) / (L * 0.58));
                    }
                  } else {
                    // Classic V2 rS pattern with a slightly more prominent initial positive 'r' than V1
                    const rSmallVal = 0.38 * qrsAmpMult;
                    const sDeepVal = -1.85 * qrsAmpMult;
                    if (d < L * 0.13) {
                      qrsWave = linearInterpolate(0, rSmallVal, d / (L * 0.13));
                    } else if (d < L * 0.45) {
                      qrsWave = linearInterpolate(rSmallVal, sDeepVal, (d - L * 0.13) / (L * 0.32));
                    } else {
                      qrsWave = linearInterpolate(sDeepVal, jVal, (d - L * 0.45) / (L * 0.55));
                    }
                  }
                }
                else if (leadToUse === "V3") {
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (qWaveMimicMI) {
                    // Pathological anterior Q/QS pattern
                    const sDeepVal = -1.6 * qrsAmpMult;
                    if (d < L * 0.45) {
                      qrsWave = linearInterpolate(0, sDeepVal, d / (L * 0.45));
                    } else {
                      qrsWave = linearInterpolate(sDeepVal, jVal, (d - L * 0.45) / (L * 0.55));
                    }
                  } else {
                    // Transition zone RS pattern: balanced, robust R wave with a moderate S wave
                    const rSmallVal = 0.85 * qrsAmpMult;
                    const sDeepVal = -1.15 * qrsAmpMult;
                    if (d < L * 0.18) {
                      qrsWave = linearInterpolate(0, rSmallVal, d / (L * 0.18));
                    } else if (d < L * 0.50) {
                      qrsWave = linearInterpolate(rSmallVal, sDeepVal, (d - L * 0.18) / (L * 0.32));
                    } else {
                      qrsWave = linearInterpolate(sDeepVal, jVal, (d - L * 0.50) / (L * 0.50));
                    }
                  }
                }
                else if (leadToUse === "V4") {
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (qWaveMimicMI) {
                    // Pathological lateral QS pattern
                    const sDeepVal = -1.5 * qrsAmpMult;
                    if (d < L * 0.45) {
                      qrsWave = linearInterpolate(0, sDeepVal, d / (L * 0.45));
                    } else {
                      qrsWave = linearInterpolate(sDeepVal, jVal, (d - L * 0.45) / (L * 0.55));
                    }
                  } else {
                    // Classic V4 Rs pattern: very tall, maximal amplitude R wave with a small S wave
                    const qVal = -0.08 * qrsAmpMult;
                    const rVal = 1.85 * qrsAmpMult;
                    const sVal = -0.28 * qrsAmpMult;
                    if (d < L * 0.11) {
                      qrsWave = linearInterpolate(0, qVal, d / (L * 0.11));
                    } else if (d < L * 0.42) {
                      qrsWave = linearInterpolate(qVal, rVal, (d - L * 0.11) / (L * 0.31));
                    } else if (d < L * 0.72) {
                      qrsWave = linearInterpolate(rVal, sVal, (d - L * 0.42) / (L * 0.30));
                    } else {
                      qrsWave = linearInterpolate(sVal, jVal, (d - L * 0.72) / (L * 0.28));
                    }
                  }
                }
                else if (leadToUse === "V5") {
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (qWaveMimicMI) {
                    // Pathological lateral QS/Q pattern
                    const sDeepVal = -1.3 * qrsAmpMult;
                    if (d < L * 0.45) {
                      qrsWave = linearInterpolate(0, sDeepVal, d / (L * 0.45));
                    } else {
                      qrsWave = linearInterpolate(sDeepVal, jVal, (d - L * 0.45) / (L * 0.55));
                    }
                  } else {
                    // Classic V5 qRs pattern: very tall, narrow R wave with a distinct septal Q wave and tiny S wave (absolute maximal R height)
                    const qVal = -0.16 * qrsAmpMult;
                    const rVal = 1.95 * qrsAmpMult;
                    const sVal = -0.10 * qrsAmpMult;
                    if (d < L * 0.12) {
                      qrsWave = linearInterpolate(0, qVal, d / (L * 0.12));
                    } else if (d < L * 0.42) {
                      qrsWave = linearInterpolate(qVal, rVal, (d - L * 0.12) / (L * 0.30));
                    } else if (d < L * 0.70) {
                      qrsWave = linearInterpolate(rVal, sVal, (d - L * 0.42) / (L * 0.28));
                    } else {
                      qrsWave = linearInterpolate(sVal, jVal, (d - L * 0.70) / (L * 0.30));
                    }
                  }
                }
                else if (leadToUse === "V6") {
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (qWaveMimicMI) {
                    // Pathological lateral QS/Q pattern
                    const sDeepVal = -1.1 * qrsAmpMult;
                    if (d < L * 0.45) {
                      qrsWave = linearInterpolate(0, sDeepVal, d / (L * 0.45));
                    } else {
                      qrsWave = linearInterpolate(sDeepVal, jVal, (d - L * 0.45) / (L * 0.55));
                    }
                  } else {
                    // Classic V6 qR pattern: narrow, robust R wave (slightly smaller than V5) with a clear septal Q wave, no real S wave
                    const qVal = -0.22 * qrsAmpMult;
                    const rVal = 1.45 * qrsAmpMult;
                    const sVal = -0.02 * qrsAmpMult; // extremely small
                    if (d < L * 0.13) {
                      qrsWave = linearInterpolate(0, qVal, d / (L * 0.13));
                    } else if (d < L * 0.44) {
                      qrsWave = linearInterpolate(qVal, rVal, (d - L * 0.13) / (L * 0.31));
                    } else if (d < L * 0.75) {
                      qrsWave = linearInterpolate(rVal, sVal, (d - L * 0.44) / (L * 0.31));
                    } else {
                      qrsWave = linearInterpolate(sVal, jVal, (d - L * 0.75) / (L * 0.25));
                    }
                  }
                }
                else {
                  const qVal = -0.15 * qrsAmpMult;
                  const rVal = 1.8 * qrsAmpMult * qrsSign;
                  const sVal = -0.45 * qrsAmpMult * qrsSign;
                  const jVal = customStLevel * 0.08 * stModifier;
                  if (d < L * 0.12) {
                    qrsWave = linearInterpolate(0, qVal, d / (L * 0.12));
                  } else if (d < L * 0.42) {
                    qrsWave = linearInterpolate(qVal, rVal, (d - L * 0.12) / (L * 0.30));
                  } else if (d < L * 0.75) {
                    qrsWave = linearInterpolate(rVal, sVal, (d - L * 0.42) / (L * 0.33));
                  } else {
                    qrsWave = linearInterpolate(sVal, jVal, (d - L * 0.75) / (L * 0.25));
                  }
                }
                beatDeflections += qrsWave * 70;
              }
            }
            // 4. ST Segment
            else if (u >= qrsEnd && u < tStart) {
              if (!beat.isDropped) {
                beatDeflections += customStLevel * 0.08 * stModifier * 70;
                label = "ST";
              }
            }
            // 5. T Wave
            else if (u >= tStart && u < tEnd) {
              if (!beat.isDropped) {
                const ratio = (u - tStart) / tDur;
                const baseSt_mV = customStLevel * 0.08 * stModifier;
                const scalePeak = (rhythmId === "hyperkalemia" ? 2.5 : 1.0);
                const tPeak_mV = customTVolume * 0.25 * scalePeak;
                let tWave = 0;
                if (rhythmId === "hyperkalemia") {
                  tWave = baseSt_mV + (tPeak_mV - baseSt_mV) * Math.sin(Math.PI * ratio);
                } else {
                  tWave = baseSt_mV + (tPeak_mV - baseSt_mV) * Math.pow(Math.sin(Math.PI * ratio), 1.5);
                }
                beatDeflections += tWave * 70;
                label = "T";
              }
            }
            // 6. Hypokalemia U wave
            else if (rhythmId === "hypokalemia" && u >= tEnd && u < (tEnd + 0.12 * rt)) {
              if (!beat.isDropped) {
                const ratio = (u - tEnd) / (0.12 * rt);
                beatDeflections += 0.12 * Math.sin(Math.PI * ratio) * 70;
                label = "U";
              }
            }
          }
        }

        yVal = flutterY + dissociatedP + afibFWaves + beatDeflections;
      }

      // Smooth jitter and electrical noise
      if (parameters.noiseLevel > 0) {
        const noise = (Math.sin(t * 110) * 0.3 + Math.cos(t * 260) * 0.2 + (Math.random() - 0.5) * 0.5) * parameters.noiseLevel * 12;
        yVal += noise;
      }

      pointsRef.current.push({
        x: t,
        y: yVal,
        label: label || undefined
      });
    }

    const pixelsPerSecond = 125 * (sweepSpeed / 25.0);
    const windowSeconds = width / pixelsPerSecond;
    const minTime = timeRef.current - windowSeconds - 0.5;

    pointsRef.current = pointsRef.current.filter(p => p.x >= minTime);
  };

  // Draw the ECG view (grid + line chart + labels)
  const drawScreen = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Dynamic erratic HR update for V-Fib / Flatline
    const isVF = rhythmId === "vfib" || rhythmId === "vfib_fine";
    const tNow = timeRef.current;
    if (isVF) {
      if (tNow - lastVFibHrUpdateTimeRef.current > 0.4) {
        displayedBpmRef.current = Math.floor(290 + Math.random() * 120);
        lastVFibHrUpdateTimeRef.current = tNow;
      }
    } else if (parameters.bpm === 0) {
      displayedBpmRef.current = 0;
    }

    const dpr = window.devicePixelRatio || 1;
    // Clear full backing size first
    ctx.clearRect(0, 0, width * dpr, height * dpr);

    ctx.save();
    ctx.scale(dpr, dpr);

    // Apply colors based on theme
    const theme = useOscilloscopeTheme 
      ? {
          bg: "#08140c", // Deep forest black
          majorGrid: "#1b3320", // Neon green major
          minorGrid: "#0e2013", // Neon green minor
          glow: "#39ff14", // Bright neon green wave
          wave: "#4eff24", // Bright neon green active waveform trace
          text: "#10b981", // Emerald green text
        }
      : {
          bg: "#fff8f5", // Light grid medical paper off-white
          majorGrid: "#ffcbc4", // Salmon pink major
          minorGrid: "#ffe8e6", // Salmon pink minor
          glow: "transparent",
          wave: "#dd1c24", // Deep clinical red
          text: "#b91c1c", // Red
        };

    // Draw background
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    // Draw Grid representing standard ECG paper (Highly Calibrated Square Grid)
    // Horizontally: 1mm (tiny grid) is 0.04s. 5mm (large grid) is 0.2s.
    // At standard 25mm/s speed, 1 second = 25 small blocks = 125 pixels.
    // Thus base small block size is 5 pixels (both horizontally and vertically),
    // and base large block size is 25 pixels.
    // This perfectly centers 1mV = 10 small blocks = 50 pixels dynamic calibration.
    const pixelsPerSecond = 125 * (sweepSpeed / 25.0);
    const centerY = height / 2 - (parameters.stLevel * 2.5); // centered baseline shift

    ctx.lineWidth = 0.5;

    // Tiny Grid lines (minor)
    ctx.strokeStyle = theme.minorGrid;
    ctx.beginPath();
    // vertical minor lines
    for (let x = 0; x < width; x += 5) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    // horizontal minor lines centered on centerY
    for (let y = centerY; y < height; y += 5) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    for (let y = centerY; y >= 0; y -= 5) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Large Grid lines (major)
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = theme.majorGrid;
    ctx.beginPath();
    // vertical major lines
    for (let x = 0; x < width; x += 25) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    // horizontal major lines centered on centerY
    for (let y = centerY; y < height; y += 25) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    for (let y = centerY; y >= 0; y -= 25) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Plot ECG rolling wave
    const points = pointsRef.current;
    if (points.length < 2) {
      ctx.restore();
      return;
    }

    const latestX = timeRef.current;

    ctx.save();
    
    // Wave style
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = theme.wave;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    // Glow effect for monitor theme
    if (useOscilloscopeTheme) {
      ctx.shadowColor = theme.glow;
      ctx.shadowBlur = 10;
    }

    ctx.beginPath();
    
    const getScreenCoords = (timeVal: number, yVal: number) => {
      const rightPadding = 15;
      const x = width - rightPadding - (latestX - timeVal) * pixelsPerSecond;
      // yVal is generated at a base scale of 70 pixels/mV. To calibrate to the 50 pixels/mV grid,
      // we scale it by (50 / 70) = 0.71428.
      const y = centerY - (yVal * (50.0 / 70.0)) * gain;
      return { x, y };
    };

    let first = true;
    for (let index = 0; index < points.length; index++) {
      const p = points[index];
      const coords = getScreenCoords(p.x, p.y);
      if (coords.x >= 0 && coords.x <= width) {
        if (first) {
          ctx.moveTo(coords.x, coords.y);
          first = false;
        } else {
          ctx.lineTo(coords.x, coords.y);
        }
      }
    }
    ctx.stroke();
    ctx.restore();

    // Draw clinical Labels for P, QRS, T (ONLY when isPlaying is false - i.e. monitor is frozen)
    if (showLabels && !isPlaying && (rhythmId === "aflutter" || rhythmId === "afib" || rhythmId === "mat" || rhythmId === "wap" || (!parameters.isIrregular && parameters.bpm > 0 && parameters.bpm < 140))) {
      ctx.fillStyle = useOscilloscopeTheme ? "#10b981" : "#b91c1c";
      ctx.font = "bold 11px system-ui, Vazirmatn";
      ctx.textAlign = "center";

      // Loop through points to put markers without cluttering, tracking spacing per wave category
      const lastLabeledTimeOf: { [key: string]: number } = {};
      for (let i = 10; i < points.length; i++) {
        const p = points[i];
        if (!p) continue;
        const labelStr = p.label || "";
        if (!labelStr || labelStr === "ST") continue;

        // Group related label types together to manage spacing properly
        let labelKey = labelStr;
        if (labelStr.includes("Ashman")) {
          labelKey = "Ashman";
        } else if (labelStr.includes("PVC")) {
          labelKey = "PVC";
        } else if (labelStr.includes("Delta") || labelStr.includes("QRS")) {
          labelKey = "QRS";
        } else if (labelStr === "P" || labelStr === "P'" || labelStr === "P''") {
          labelKey = "P";
        }

        const lastTime = lastLabeledTimeOf[labelKey] || 0;
        const minSpacing = labelStr === "F" ? 0.16 : (labelKey === "Ashman" ? 0.25 : 0.45);

        if (p.x - lastTime > minSpacing) {
          // coordinate
          const coords = getScreenCoords(p.x, p.y);
          if (coords.x > 30 && coords.x < width - 30) {
            const isBelow = labelStr === "P" || labelStr === "P'" || labelStr === "P''" || labelStr === "U";
            const textY = isBelow ? coords.y + 23 : coords.y - 15;
            const lineY = isBelow ? coords.y + 12 : coords.y - 14;
            const rectY = isBelow ? coords.y + 13 : coords.y - 25;

            // Draw small dotted line down (or up) to wave
            ctx.strokeStyle = useOscilloscopeTheme ? "rgba(57, 255, 20, 0.25)" : "rgba(221, 28, 36, 0.2)";
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(coords.x, lineY);
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Text background blob
            ctx.fillStyle = theme.bg;
            const textWidth = ctx.measureText(p.label!).width;
            ctx.fillRect(coords.x - textWidth / 2 - 4, rectY, textWidth + 8, 12);

            // Draw label letter
            ctx.fillStyle = useOscilloscopeTheme ? "#6ee7b7" : "#ea580c";
            ctx.fillText(p.label!, coords.x, textY);
            lastLabeledTimeOf[labelKey] = p.x;
          }
        }
      }
    }

    // Draw Glowing patient lead connection state and HR display on the top-right
    ctx.fillStyle = useOscilloscopeTheme ? "rgba(16, 185, 129, 0.15)" : "rgba(0, 0, 0, 0.04)";
    ctx.fillRect(10, 10, 160, 50);
    ctx.strokeStyle = theme.majorGrid;
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 160, 50);

    ctx.fillStyle = useOscilloscopeTheme ? "#34d399" : "#1e293b";
    ctx.font = "bold 11px Inter, Vazirmatn";
    ctx.textAlign = "left";
    ctx.fillText(`Lead ${selectedLead}  •  پایش قلبی`, 18, 25);

    ctx.fillStyle = theme.wave;
    ctx.font = "bold 18px JetBrains Mono, monospace";
    ctx.fillText(displayedBpmRef.current === 0 ? "00 HR" : `${displayedBpmRef.current} HR`, 18, 48);

    // Green blip dot for pulse
    if (parameters.bpm > 0 || displayedBpmRef.current > 0) {
      const blipSize = (timestamp: number) => {
        const timeSinceBeep = (timeRef.current - lastBeepTimeRef.current);
        if (timeSinceBeep < 0.15) return 6;
        if (timeSinceBeep < 0.3) return 3 + (0.3 - timeSinceBeep) * 10;
        return 3;
      };
      
      const size = blipSize(timeRef.current);
      ctx.fillStyle = theme.wave;
      ctx.beginPath();
      ctx.arc(145, 38, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const handleReset = () => {
    timeRef.current = 0;
    pointsRef.current = [];
    nextBeatTimeRef.current = 0;
    beatTimesHistoryRef.current = [];
  };

  return (
    <div id="ecg-monitor-card" className="border-2 border-sky-300 bg-[#f0f7ff]/70 overflow-hidden shadow-md flex flex-col rounded-xl">
      {/* Top Monitor Info Bar */}
      <div className="bg-[#e0f2fe] p-3 px-4 border-b border-[#bae6fd] flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-pulse" id="monitor-active-pulse"></div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5">
            <h3 className="text-slate-800 text-sm sm:text-base font-black font-sans flex items-center gap-2">
              <span>صفحه مانیتور شبیه‌ساز:</span>
              <span className="text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg text-sm sm:text-base font-black shadow-sm select-all">
                {rhythmName}
              </span>
            </h3>
            <span className="text-slate-500 font-mono text-[11px] sm:text-xs">
              ({rhythmNameEnglish})
            </span>
          </div>
        </div>
        
        {/* Quick controls */}
        <div className="flex items-center gap-2">
          {/* Sounds trigger */}
          <button
            id="toggle-heart-beeps"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-md border transition-all flex items-center justify-center cursor-pointer ${
              soundEnabled 
                ? "bg-amber-500/10 border-amber-300 text-amber-700 hover:bg-amber-500/20" 
                : "bg-slate-150 text-slate-605 border-slate-300 hover:bg-slate-250 hover:text-slate-900"
            }`}
            title={soundEnabled ? "قطع صدای ضربان قلب" : "فعال‌سازی صدای ضربان قلب (Beep)"}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Grid theme trigger */}
          <button
            id="toggle-grid-theme"
            onClick={() => setUseOscilloscopeTheme(!useOscilloscopeTheme)}
            className={`p-2 border rounded-md hover:bg-slate-200 hover:text-slate-900 transition-all flex items-center justify-center cursor-pointer ${
              useOscilloscopeTheme
                ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                : "bg-slate-150 text-slate-605 border-slate-300"
            }`}
            title="تغییر تم مانیتور (کاغذ صورتی / صفحه سبز)"
          >
            <Grid size={16} />
          </button>

          {/* Labels trigger */}
          <button
            id="toggle-wave-labels"
            onClick={() => setShowLabels(!showLabels)}
            className={`p-2 rounded-md border transition-all flex items-center justify-center cursor-pointer ${
              showLabels 
                ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100/60" 
                : "bg-slate-150 text-slate-605 border-slate-300 hover:bg-slate-250 hover:text-slate-900"
            }`}
            title="نمایش/پنهان‌سازی برچسب و نام امواج (فقط در حالت توقف مانیتور فعال و نمایان می‌شود)"
          >
            <Eye size={16} />
          </button>
        </div>
      </div>

      {/* 12-Lead Selection Command Console */}
      <div className="bg-[#e0f2fe]/50 px-4 py-2.5 border-b border-[#bae6fd] flex flex-wrap items-center gap-3 justify-between" id="lead-select-ribbon">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-[#0369a1] font-sans">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          <span className="font-extrabold text-sky-950">انتخاب لید مانیتور (برای تحلیل دقیق‌تر سکته و آریتمی):</span>
        </div>
        <div className="flex flex-wrap gap-1.5" id="lead-buttons-container">
          {["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"].map((lead) => {
            const isActive = selectedLead === lead;
            return (
              <button
                key={lead}
                id={`btn-select-lead-${lead}`}
                onClick={() => setSelectedLead(lead)}
                className={`px-3.5 py-1.5 text-xs sm:text-[13px] font-black font-mono rounded transition-all cursor-pointer border ${
                  isActive
                    ? "bg-blue-600 border-blue-600 text-white font-extrabold shadow-sm scale-105"
                    : "bg-white border-slate-300 text-slate-700 hover:text-slate-950 hover:bg-white"
                }`}
              >
                {lead}
              </button>
            );
          })}
        </div>
      </div>

      {/* Monitor Display Screen */}
      <div 
        ref={containerRef} 
        id="ecg-canvas-container"
        className="relative bg-white w-full min-h-[380px] flex items-center justify-center border-b border-slate-300"
      >
        <canvas 
          ref={canvasRef} 
          id="ecg-monitor-canvas"
          className="w-full block font-sans"
        />
        {/* Grid paper calibration marker (Watermark) */}
        <div className="absolute bottom-2 left-3 flex gap-4 text-xs font-bold text-slate-700 bg-white/90 border border-slate-300 px-2 py-0.5 rounded backdrop-blur select-none pointer-events-none font-mono">
          <span>شبیه‌سازی سرعت: {sweepSpeed}mm/s</span>
          <span>دامنه کالیبره: {gain === 0.5 ? "5" : gain === 1.0 ? "10" : "20"}mm/mV</span>
        </div>
      </div>

      {/* Playback Controls (Positioned directly under monitor screen) */}
      <div className="bg-amber-50/50 p-3.5 px-4 flex flex-wrap justify-between items-center border-b border-slate-300 gap-2" id="play-pause-controls-ribbon">
        <div className="flex gap-2.5">
          <button
            id="play-pause-simulation"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-4 py-2 text-xs sm:text-[13px] font-black rounded-lg flex items-center gap-1.5 cursor-pointer transition-all border ${
              isPlaying 
                ? "bg-white hover:bg-slate-100 hover:text-slate-800 text-slate-700 border-slate-300 shadow-sm" 
                : "bg-blue-600 hover:bg-blue-500 text-white border-blue-600 shadow-md scale-102"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause size={14} className="fill-current" /> توقف حرکت
              </>
            ) : (
              <>
                <Play size={14} className="fill-current" /> شروع مجدد
              </>
            )}
          </button>

          <button
            id="reset-simulation-history"
            onClick={handleReset}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs sm:text-[13px] font-black rounded-lg flex items-center gap-1.5 cursor-pointer transition-all border border-slate-300 shadow-sm"
          >
            <RotateCcw size={14} /> بازنشانی مانیتور
          </button>
        </div>

        <div className="text-xs text-slate-700 font-bold font-sans">
          {isPlaying ? (
            <span className="hidden sm:inline">💡 نکته: با توقف مانیتور در ریتم AFib، پدیده اشمن (Ashman Beat) با برچسب روی مانیتور هویدا می‌شود.</span>
          ) : (
            <span className="text-indigo-700 font-extrabold animate-pulse">✨ برچسب امواج (P, QRS, T) و پدیده اشمن روی سیگنال متوقف‌شده نمایان است!</span>
          )}
        </div>
      </div>

      {/* Physical Monitor Calibration Controls */}
      <div className="bg-[#e0f2fe]/50 px-4 py-3 border-b border-[#bae6fd] flex flex-wrap items-center gap-4 justify-between" id="calibration-controls-ribbon">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {/* Voltage Selection */}
          <div className="flex items-center gap-2 font-sans">
            <span className="text-xs sm:text-[13px] text-sky-950 font-extrabold">دامنه یا ولتاژ پیکسل (Gain):</span>
            <div className="flex bg-slate-100/60 border border-slate-300 rounded p-0.5" id="gain-buttons-holder">
              {[
                { label: "5 mm/mV", value: 0.5 },
                { label: "10 mm/mV (N)", value: 1.0 },
                { label: "20 mm/mV (2N)", value: 2.0 }
              ].map((opt) => (
                <button
                  key={opt.value}
                  id={`btn-gain-${opt.value}`}
                  onClick={() => setGain(opt.value)}
                  className={`px-3 py-1 text-xs rounded font-mono font-bold transition-all cursor-pointer border ${
                    gain === opt.value
                      ? "bg-blue-600 border-blue-600 text-white font-black shadow-inner"
                      : "bg-white/70 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Speed Selection */}
          <div className="flex items-center gap-2 font-sans">
            <span className="text-xs sm:text-[13px] text-sky-950 font-extrabold">سرعت حرکت کاغذ (Speed):</span>
            <div className="flex bg-slate-100/60 border border-slate-300 rounded p-0.5" id="speed-buttons-holder">
              {[
                { label: "12.5 mm/s", value: 12.5 },
                { label: "25 mm/s (Std)", value: 25.0 },
                { label: "50 mm/s", value: 50.0 }
              ].map((opt) => (
                <button
                  key={opt.value}
                  id={`btn-speed-${opt.value}`}
                  onClick={() => setSweepSpeed(opt.value)}
                  className={`px-3 py-1 text-xs rounded font-mono font-bold transition-all cursor-pointer border ${
                    sweepSpeed === opt.value
                      ? "bg-blue-600 border-blue-600 text-white font-black shadow-inner"
                      : "bg-white/70 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-600 font-bold font-sans select-none hidden md:block">
          کالیبراسیون سخت‌افزاری سیگنال قلبی
        </div>
      </div>

      {/* Conduction Aberrancy & Axis Deviation Control Ribbon */}
      <div className="bg-[#f5f3ff] px-4 py-3 border-b border-[#ddd6fe] flex flex-col gap-4 animate-fade-in" id="simulation-enhancements-ribbon">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 font-sans">
              <span className="text-xs sm:text-[13px] text-[#4c1d95] font-extrabold">ابرنسی هدایتی (بلوک شاخه‌ای دستی):</span>
              <div className="flex bg-slate-100/65 border border-slate-300 rounded p-0.5" id="aberrancy-buttons-holder">
                {[
                  { label: "غیرفعال (None)", value: "none" },
                  { label: "بلوک راست (RBBB Aberrancy)", value: "rbbb" },
                  { label: "بلوک چپ (LBBB Aberrancy)", value: "lbbb" }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    id={`btn-aberrancy-${opt.value}`}
                    onClick={() => setAberrancyType(opt.value as any)}
                    className={`px-3.5 py-1 text-xs sm:text-[13px] rounded font-sans font-extrabold transition-all cursor-pointer border ${
                      aberrancyType === opt.value
                        ? "bg-purple-700 border-purple-700 text-white shadow-inner scale-105"
                        : "bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="text-xs text-purple-800 font-black font-sans select-none hidden md:block">
            اعمال بلوک شاخه راست/چپ روی کلیه ریتم‌های پایه فعال
          </div>
        </div>

        {/* Separator line inside ribbon */}
        <div className="h-[1px] bg-purple-200 w-full"></div>

        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 font-sans">
              <span className="text-xs sm:text-[13px] text-[#4c1d95] font-extrabold">انحراف محور قلبی (Axis Deviation):</span>
              <div className="flex bg-slate-100/65 border border-slate-300 rounded p-0.5" id="axis-deviation-buttons-holder">
                {[
                  { label: "نرمال (Normal Axis)", value: "normal" },
                  { label: "انحراف به چپ (LAD)", value: "lad" },
                  { label: "انحراف به راست (RAD)", value: "rad" },
                  { label: "انحراف شدید به راست (Extreme RAD)", value: "erad" }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    id={`btn-axis-${opt.value}`}
                    onClick={() => setAxisDeviation(opt.value as any)}
                    className={`px-3.5 py-1 text-xs sm:text-[13px] rounded font-sans font-extrabold transition-all cursor-pointer border ${
                      axisDeviation === opt.value
                        ? "bg-indigo-700 border-indigo-700 text-white shadow-inner scale-105"
                        : "bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="text-xs text-indigo-800 font-black font-sans select-none hidden md:block">
            تغییر جهت و دامنه موج QRS در لیدهای فرونتال (I, II, III, aVR, aVL, aVF)
          </div>
        </div>

        {/* Separator line inside ribbon */}
        <div className="h-[1px] bg-purple-200 w-full"></div>

        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 font-sans">
              <span className="text-xs sm:text-[13px] text-[#4c1d95] font-extrabold">موج Q پاتولوژیک / شبیه‌ساز MI:</span>
              <div className="flex bg-slate-100/65 border border-slate-300 rounded p-0.5" id="qwave-mimic-holder">
                {[
                  { label: "غیرفعال (موج rS نرمال با ناچ r)", value: false },
                  { label: "فعال (حذف ناچ r و شروع موج منفی / نمای QS پاتولوژیک)", value: true }
                ].map((opt) => (
                  <button
                    key={opt.value ? "true" : "false"}
                    id={`btn-qwave-mimic-${opt.value}`}
                    onClick={() => setQWaveMimicMI(opt.value)}
                    disabled={axisDeviation === "normal"}
                    className={`px-3.5 py-1 text-xs sm:text-[13px] rounded font-sans font-extrabold transition-all cursor-pointer border ${
                      axisDeviation === "normal"
                        ? "opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-none"
                        : qWaveMimicMI === opt.value
                        ? "bg-rose-700 border-rose-700 text-white shadow-inner scale-105"
                        : "bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="text-xs text-rose-800 font-black font-sans select-none hidden md:block">
            {axisDeviation === "normal"
              ? "جهت فعال‌سازی این گزینه، ابتدا یکی از انحراف محورهای قلبی را انتخاب کنید"
              : axisDeviation === "lad"
              ? "حذف ناچ r در لیدهای تحتانی (II, III, aVF) معادل موج QS و سکته تحتانی (Inferior MI) است"
              : axisDeviation === "rad"
              ? "حذف ناچ r در لیدهای لترال (I, aVL) معادل موج QS و سکته لترال (Lateral MI) است"
              : "حذف ناچ r در انحراف شدید به راست معادل موج QS سراسری در اکثر لیدهای فرونتال است"}
          </div>
        </div>
      </div>
    </div>
  );
}
