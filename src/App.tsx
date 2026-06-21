import React, { useState, useEffect } from "react";
import { rhythms } from "./data/ecgPresets";
import { ECGParameters, RhythmPreset } from "./types";
import ECGVisualizer from "./components/ECGVisualizer";
import EducationalGuide from "./components/EducationalGuide";
import { 
  Heart, 
  Sliders, 
  Activity, 
  AlertCircle, 
  Info, 
  BookOpen, 
  RotateCcw, 
  Check, 
  Clipboard,
  ShieldAlert,
  Flame,
  UserPlus,
  Clock,
  Calendar
} from "lucide-react";

export default function App() {
  // Selected preset rhythm (defaults to Normal Sinus Rhythm)
  const [selectedPresetId, setSelectedPresetId] = useState<string>("nsr");
  
  // Custom interactive parameters (initialized with NSR)
  const [customParams, setCustomParams] = useState<ECGParameters>({
    bpm: 75,
    pAmplitude: 1.0,
    prInterval: 0.16,
    qrsDuration: 0.08,
    tAmplitude: 1.2,
    stLevel: 0.0,
    qtInterval: 0.40,
    noiseLevel: 0.05,
    isIrregular: false
  });

  // Modal and clock states
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Keep slider parameters in sync when selecting a preset
  const selectPreset = (preset: RhythmPreset) => {
    setSelectedPresetId(preset.id);
    setCustomParams({
      qtInterval: 0.40,
      ...preset.parameters
    });
  };

  const selectedPreset = rhythms.find(r => r.id === selectedPresetId) || rhythms[0];

  // Detect dynamic pathologic features on current slider states
  const getFarsiInterpretations = () => {
    const alerts: { title: string; color: string; desc: string }[] = [];
    const p = customParams;

    if (p.bpm === 0) {
      alerts.push({
        title: "ایست قلبی کامل (خط صاف)",
        color: "bg-red-50 border-red-200 text-red-800",
        desc: "عدم ثبت هرگونه فعالیت مکانیکی یا الکتریکی منظم در بطن‌ها. مرگبار!"
      });
      return alerts;
    }

    if (selectedPresetId === "aflutter") {
      const flutterPeriod = 1.0 / 5.3;
      const targetPeriod = 60 / p.bpm;
      const ratio = Math.max(2, Math.min(8, Math.round(targetPeriod / flutterPeriod)));
      const actualVentricularBpm = Math.round(60 / (ratio * flutterPeriod));
      alerts.push({
        title: `انتقال هدایت گره دهلیزی-بطنی با نسبت ${ratio}:1 (AV Block)`,
        color: "bg-indigo-50 border-indigo-250 text-indigo-950 font-bold",
        desc: `گره AV به علت فرکانس بالای کانون فلاتر (۳۱۸ ضربه در دقیقه فلاتر موج F دندانه اره‌ای)، به عنوان دروازه‌بان فیلترکننده عمل کرده و از هر ${ratio} تحریک دهلیزی، فقط ۱ مورد را منتقل کرده و ضربان بطنی واقعی ${actualVentricularBpm}bpm را تولید می‌کند.`
      });
    }

    if (p.pAmplitude === 0 && p.isIrregular) {
      alerts.push({
        title: "فیبریلاسیون دهلیزی (AFib)",
        color: "bg-amber-50 border-amber-200 text-amber-800",
        desc: "موج P حذف شده و ریتم کاملاً نامنظم است؛ لرزش دهلیزها جایگزین ضربان منظم شده است."
      });
    }

    if (selectedPresetId === "afib") {
      alerts.push({
        title: "پدیده اشمن (Ashman Phenomenon)",
        color: "bg-indigo-50 border-indigo-200 text-indigo-900 font-bold",
        desc: "شبیه‌سازی پدیده اشمن فعال است! در ریتم AFib، توالی یک سیکل بلند و متعاقباً یک سیکل کوتاه (Long-Short sequence)، باعث افزایش فرجه تحریک‌ناپذیری مسیر هیس‌-پورکنژ شده و کمپلکس بعدی پهن و بدشکل (با سیمای aberrant RBBB) منتقل می‌شود که به آن بیت اشمن (Ashman Beat) می‌گویند."
      });
    }

    if (p.bpm < 60 && p.bpm > 0) {
      alerts.push({
        title: "برادی‌کاردی (کندی ضربان)",
        color: "bg-blue-50 border-blue-200 text-blue-800",
        desc: "ضربان قلب کمتر از ۶۰ بار در دقیقه است که می‌تواند فیزیولوژیک یا ناشی از تنبلی گره سازنده باشد."
      });
    } else if (p.bpm > 100) {
      if (p.qrsDuration >= 0.15 && !p.isIrregular) {
        alerts.push({
          title: "احتمال تاکی‌کاردی بطنی (V-Tach)",
          color: "bg-red-50 border-red-200 text-red-800",
          desc: "ریتم تند بطنی همراه با عرض غیرطبیعی QRS. وضعیت ناپایدار همودینامیک حاد."
        });
      } else {
        alerts.push({
          title: "تاکی‌کاردی (تندی ضربان)",
          color: "bg-amber-50 border-amber-200 text-amber-800",
          desc: "ضربان قلب بالای ۱۰۰ بار در دقیقه است که پاسخ طبیعی بدن به فعالیت، تب یا استرس است."
        });
      }
    }

    if (p.prInterval > 0.20) {
      alerts.push({
        title: "تاخیر انتقال PR (بلوک قلبی درجه یک)",
        color: "bg-indigo-50 border-indigo-200 text-indigo-805",
        desc: "زمان انتقال امواج از دهلیز به بطن بیش از حد نرمال (۰.۲۰ ثانیه) طول می‌کشد."
      });
    }

    if (p.qrsDuration > 0.11 && !isPresetVTOrVF()) {
      alerts.push({
        title: "عرض غیرطبیعی کمپلکس (QRS Prolonged)",
        color: "bg-purple-50 border-purple-200 text-purple-800",
        desc: "تاخیر در هدایت سیگنال داخل دیواره‌های بطنی (مانند بلوک شاخه‌ای چپ LBBB یا راست RBBB)."
      });
    }

    if (p.stLevel > 1.5) {
      alerts.push({
        title: "افزایش قطعه ST (سکته قلبی حاد - STEMI)",
        color: "bg-red-100 border-red-250 text-red-850",
        desc: "نشان‌دهنده انسداد کامل سرخرگ کرونری قلب و آسیب شدید زنده ماندن عضله قلب است. اورژانس مطلق!"
      });
    } else if (p.stLevel < -1.0) {
      alerts.push({
        title: "کاهش قطعه ST (ایسکمی و کم‌خونی قلبی)",
        color: "bg-orange-50 border-orange-200 text-orange-800",
        desc: "عدم دریافت خون کافی توسط عضلات منقبض‌کننده قلب در اثر تنگی جزئی عروق تغذیه‌کننده."
      });
    }

    if (p.tAmplitude < 0) {
      alerts.push({
        title: "موج T معکوس (T-Wave Inversion)",
        color: "bg-yellow-50 border-yellow-200 text-yellow-850",
        desc: "رپلاریزاسیون معکوس بطن‌ها که نشانه مهمی از ایسکمی عروق کرونر یا تغییرات لود بطنی است."
      });
    }

    if (p.qtInterval !== undefined) {
      if (p.qtInterval > 0.44) {
        alerts.push({
          title: "فاصله QT طولانی (Prolonged QT)",
          color: "bg-[#fff1f2] border-rose-200 text-rose-800",
          desc: "تاخیر خطرناک در بازسازی ولتاژ بطن‌ها. مستعدکننده بیمار به بیماری و تپش قلب‌های طوفانی مرگبار (Torsades de Pointes)."
        });
      } else if (p.qtInterval < 0.33) {
        alerts.push({
          title: "فاصله QT کوتاه (Short QT)",
          color: "bg-[#fffbeb] border-amber-200 text-amber-800",
          desc: "کوتاه بودن غیرطبیعی کل زمان انقباض و استراحت بطنی. این حالت می‌تواند زمینه‌ساز فیبریلاسیون بطنی ناگهانی باشد."
        });
      }
    }

    if (p.noiseLevel > 0.6) {
      alerts.push({
        title: "سیگنال مخدوش (الکترود شل / آرتیفکت)",
        color: "bg-slate-50 border-slate-200 text-slate-700",
        desc: "نویز شدید محیطی یا لرزش عضلانی حرکت بیمار که تفسیر دقیق نوارقلب را دشوار می‌کند."
      });
    }

    // Default clean bill of health
    if (alerts.length === 0) {
      alerts.push({
        title: "ریتم الکتریکی فاقد آسیب حاد واضح",
        color: "bg-emerald-50 border-emerald-200 text-emerald-800",
        desc: "ابعاد و فواصل هندسی امواج در محدوده فیزیولوژیک متعادل قرار دارند."
      });
    }

    return alerts;
  };

  const isPresetVTOrVF = () => {
    return selectedPresetId === "vtach" || selectedPresetId === "vfib" || selectedPresetId === "vfib_fine";
  };

  // Reset custom sliders back to default NSR values
  const handleResetSliders = () => {
    const nsrPreset = rhythms.find(r => r.id === "nsr")!;
    selectPreset(nsrPreset);
  };

  // Handle slider changes and break the highlighted preset button connection if values diverge
  const updateParam = (key: keyof ECGParameters, value: number | boolean) => {
    setCustomParams(prev => {
      const updated = { ...prev, [key]: value };
      
      // If bpm is zero, automatically shut off other waves as physical consequence
      if (key === "bpm" && value === 0) {
        updated.pAmplitude = 0;
        updated.tAmplitude = 0;
        updated.stLevel = 0;
      }
      
      // If the currently selected preset is a specialized pathological rhythm, keep it!
      // This prevents losing the specialized pathology (like Atrial Flutter, STEMI, VT, SVT, LBBB, etc.) 
      // just because the user adjusted the BPM or other parameters.
      if (selectedPresetId !== "nsr" && selectedPresetId !== "custom") {
        // Keep selectedPresetId
      } else {
        // Detect if it still matches any preset exactly
        let matchedId = "custom";
        for (const r of rhythms) {
          const p = r.parameters;
          if (
            Math.abs(updated.bpm - p.bpm) < 1 &&
            Math.abs(updated.pAmplitude - p.pAmplitude) < 0.05 &&
            Math.abs(updated.prInterval - p.prInterval) < 0.01 &&
            Math.abs(updated.qrsDuration - p.qrsDuration) < 0.01 &&
            Math.abs(updated.tAmplitude - p.tAmplitude) < 0.05 &&
            Math.abs(updated.stLevel - p.stLevel) < 0.1 &&
            updated.isIrregular === p.isIrregular &&
            Math.abs((updated.qtInterval ?? 0.40) - (p.qtInterval ?? 0.40)) < 0.02
          ) {
            matchedId = r.id;
            break;
          }
        }
        setSelectedPresetId(matchedId);
      }
      return updated;
    });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      
      {/* Visual Header */}
      <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 border-b-4 border-indigo-400 py-6 px-4 sm:px-6 md:px-8 shadow-md" id="app-main-header">
        <div className="max-w-7xl mx-auto flex flex-row justify-between items-center gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-lg flex items-center justify-center border-2 border-white/60 shadow-sm">
              <Activity className="w-8 h-8 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white drop-shadow font-sans">
                آموزش تفسیر نوار قلب
              </h1>
            </div>
          </div>

          {/* About Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAboutOpen(true)}
              id="header-about-button"
              className="flex items-center gap-2.5 px-6 py-3.5 bg-white/25 hover:bg-white/40 border-2 border-white/80 text-white placeholder-amber-50 rounded-lg shadow transition-all text-sm sm:text-base md:text-lg font-sans cursor-pointer font-black"
            >
              <Info size={22} className="text-white" />
              <span>درباره برنامه</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: ECG Monitor and Sliders (Colspan 8) */}
        <section className="col-span-1 lg:col-span-8 space-y-5 flex flex-col">
          
          {/* Live Monitor component */}
          <ECGVisualizer 
            parameters={customParams} 
            rhythmName={selectedPreset?.nameFarsi || "ریتم دلخواه دستی"}
            rhythmNameEnglish={selectedPreset?.nameEnglish || "Manual Calibration"}
            rhythmId={selectedPresetId}
          />

          {/* Dynamic Diagnosis alert box based on sliders */}
          <div className="bg-[#f0fdf4] border-2 border-emerald-300 p-5 rounded-xl shadow-sm">
            <h4 className="text-emerald-900 text-sm sm:text-base font-extrabold font-sans mb-3 flex items-center gap-1.5">
              <ShieldAlert className="text-emerald-600 animate-pulse" size={18} /> 
              تحلیل آنی الگو (تفسیر هندسی پارامترها):
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="live-diagnosis-box">
              {getFarsiInterpretations().map((alert, index) => (
                <div key={index} className={`p-4 rounded-lg border-2 flex items-start gap-3 shadow-sm bg-white ${alert.color.replace('bg-emerald-50', 'bg-emerald-50/80').replace('bg-red-50', 'bg-red-50/80').replace('bg-amber-50', 'bg-amber-50/80')}`}>
                  <AlertCircle className="shrink-0 mt-0.5" size={20} />
                  <div>
                    <h5 className="font-black text-sm sm:text-base font-sans">{alert.title}</h5>
                    <p className="text-xs sm:text-sm mt-1 leading-relaxed font-bold font-sans opacity-95">{alert.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Parameters Sliders Section */}
          <div className="bg-[#faf5ff] border-2 border-purple-300 rounded-xl p-6 shadow-sm relative">
            <div className="flex flex-wrap justify-between items-center gap-3 border-b border-purple-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="text-purple-600 animate-pulse" size={18} />
                <h3 className="text-purple-950 font-extrabold text-sm sm:text-base md:text-lg font-sans">کنترل دستی اجزا و لایه‌های موج الکتریکی</h3>
              </div>
              <button
                id="btn-reset-sliders"
                onClick={handleResetSliders}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-bold font-sans flex items-center gap-1 transition-all border border-slate-300 cursor-pointer shadow-sm"
              >
                <RotateCcw size={12} className="text-red-500" /> بازنشانی به ریتم طبیعی
              </button>
            </div>

            {/* Grid of Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4" id="sliders-panel">
              
              {/* Slider 1: Heart Rate */}
              <div className="flex flex-col gap-1.5" id="slider-container-bpm">
                <div className="flex justify-between text-sm sm:text-base font-extrabold font-sans">
                  <span className="text-slate-700 font-bold">ضربان قلب (Heart Rate):</span>
                  <span className="text-blue-600 font-mono font-bold">{customParams.bpm} bpm</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="220" 
                  step="1"
                  value={customParams.bpm}
                  onChange={(e) => updateParam("bpm", parseInt(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                />
                <span className="text-xs sm:text-sm text-slate-700 font-bold font-sans leading-relaxed">افزایش سرعت، فواصل چرخه‌ها را کوتاه می‌کند. رنج بحرانی بالای ۱۵۰ یا زیر ۴۰ است.</span>
              </div>

              {/* Slider 2: P-Wave Amplitude */}
              <div className="flex flex-col gap-1.5" id="slider-container-p-amp">
                <div className="flex justify-between text-sm sm:text-base font-extrabold font-sans">
                  <span className="text-slate-700 font-bold">ارتفاع موج P (انقباض دهلیزی):</span>
                  <span className="text-[#ec4899] font-mono font-bold">{(customParams.pAmplitude * 0.1).toFixed(2)} mV</span>
                </div>
                <input 
                  type="range" 
                  min="0.0" 
                  max="2.5" 
                  step="0.1"
                  value={customParams.pAmplitude}
                  disabled={customParams.bpm === 0}
                  onChange={(e) => updateParam("pAmplitude", parseFloat(e.target.value))}
                  className="w-full accent-[#ec4899] h-1.5 bg-slate-100 rounded-lg cursor-pointer disabled:opacity-30"
                />
                <span className="text-xs sm:text-sm text-slate-700 font-bold font-sans leading-relaxed">موج دهلیزی. در فیبریلاسیون دهلیزی (AFib)، این موج صفر شده و خط مخدوش می‌شود.</span>
              </div>

              {/* Slider 3: PR Interval */}
              <div className="flex flex-col gap-1.5" id="slider-container-pr">
                <div className="flex justify-between text-sm sm:text-base font-extrabold font-sans">
                  <span className="text-slate-700 font-bold">فاصله هدایت PR:</span>
                  <span className="text-purple-600 font-mono font-bold">{customParams.prInterval.toFixed(2)} ثانیه</span>
                </div>
                <input 
                  type="range" 
                  min="0.10" 
                  max="0.40" 
                  step="0.01"
                  value={customParams.prInterval}
                  disabled={customParams.bpm === 0}
                  onChange={(e) => updateParam("prInterval", parseFloat(e.target.value))}
                  className="w-full accent-purple-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer disabled:opacity-30"
                />
                <span className="text-xs sm:text-sm text-slate-700 font-bold font-sans leading-relaxed">زمان انتقال دهلیز به بطن. طولانی شدن آن (بیش از ۰.۲۰ ثانیه) نشانه بلوک قلبی اول است.</span>
              </div>

              {/* Slider 4: QRS Duration */}
              <div className="flex flex-col gap-1.5" id="slider-container-qrs">
                <div className="flex justify-between text-sm sm:text-base font-extrabold font-sans">
                  <span className="text-slate-700 font-bold">عرض کمپلکس QRS (بطن‌ها):</span>
                  <span className="text-blue-600 font-mono font-bold">{customParams.qrsDuration.toFixed(2)} ثانیه</span>
                </div>
                <input 
                  type="range" 
                  min="0.04" 
                  max="0.25" 
                  step="0.01"
                  value={customParams.qrsDuration}
                  disabled={customParams.bpm === 0}
                  onChange={(e) => updateParam("qrsDuration", parseFloat(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer disabled:opacity-30"
                />
                <span className="text-xs sm:text-sm text-slate-700 font-bold font-sans leading-relaxed">انقباض بطنی. عریض بودن نشانه اختلال مسیر‌های پائین بطنی مانند PVC یا VT است.</span>
              </div>

              {/* Slider 5: ST Segment Elevation/Depression */}
              <div className="flex flex-col gap-1.5" id="slider-container-st">
                <div className="flex justify-between text-sm sm:text-base font-extrabold font-sans">
                  <span className="text-slate-700 font-bold">تغییر تراز قطعه ST (شاخص سکته):</span>
                  <span className={`font-mono font-bold ${customParams.stLevel > 1.5 ? 'text-red-500' : customParams.stLevel < -1 ? 'text-orange-500' : 'text-[#ec4899]'}`}>
                    {customParams.stLevel > 0 ? "+" : ""}{customParams.stLevel.toFixed(1)} mm
                  </span>
                </div>
                <input 
                  type="range" 
                  min="-5.0" 
                  max="8.0" 
                  step="0.5"
                  value={customParams.stLevel}
                  disabled={customParams.bpm === 0}
                  onChange={(e) => updateParam("stLevel", parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg cursor-pointer disabled:opacity-30"
                  style={{
                    accentColor: customParams.stLevel > 1.5 ? "#ef4444" : customParams.stLevel < -1.0 ? "#f97316" : "#ec4899"
                  }}
                />
                <span className="text-xs sm:text-sm text-slate-700 font-bold font-sans leading-relaxed">افزایش شدید (STEMI) نشانه سکته حاد مسدودکننده است. کاهش شدید نشانه ایسکمی و تنگی عروق است.</span>
              </div>

              {/* Slider 6: T-Wave Amplitude */}
              <div className="flex flex-col gap-1.5" id="slider-container-t-amp">
                <div className="flex justify-between text-sm sm:text-base font-extrabold font-sans">
                  <span className="text-slate-700 font-bold">ارتفاع موج T (رپلاریزاسیون بطنی):</span>
                  <span className="text-purple-600 font-mono font-bold">{(customParams.tAmplitude * 0.1).toFixed(2)} mV</span>
                </div>
                <input 
                  type="range" 
                  min="-1.5" 
                  max="2.5" 
                  step="0.1"
                  value={customParams.tAmplitude}
                  disabled={customParams.bpm === 0}
                  onChange={(e) => updateParam("tAmplitude", parseFloat(e.target.value))}
                  className="w-full accent-purple-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer disabled:opacity-30"
                />
                <span className="text-xs sm:text-sm text-slate-700 font-bold font-sans leading-relaxed">بازگشت و استراحت عضلانی بطن‌ها. منفی یا معکوس شدن آن نشانه ایسکمی دیواره قلب است.</span>
              </div>

              {/* Slider 7: QT Interval */}
              <div className="flex flex-col gap-1.5" id="slider-container-qt">
                <div className="flex justify-between text-sm sm:text-base font-extrabold font-sans">
                  <span className="text-slate-700 font-bold">بازه و فاصله کلی QT:</span>
                  <span className="text-orange-600 font-mono font-bold">{(customParams.qtInterval ?? 0.40).toFixed(2)} ثانیه</span>
                </div>
                <input 
                  type="range" 
                  min="0.25" 
                  max="0.65" 
                  step="0.01"
                  value={customParams.qtInterval ?? 0.40}
                  disabled={customParams.bpm === 0}
                  onChange={(e) => updateParam("qtInterval", parseFloat(e.target.value))}
                  className="w-full accent-orange-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer disabled:opacity-30"
                />
                <span className="text-xs sm:text-sm text-slate-700 font-bold font-sans leading-relaxed">زمان کل دپولاریزاسیون و رپلاریزاسیون بطنی. زمان کوتاه (کمتر از ۰.۳۳) یا طولانی (بیش از ۰.۴۴) نشانه شرایط بحرانی قلبی است.</span>
              </div>

              {/* Slider 8: Tremor Noise Level */}
              <div className="flex flex-col gap-1.5" id="slider-container-noise">
                <div className="flex justify-between text-sm sm:text-base font-extrabold font-sans">
                  <span className="text-slate-700 font-bold">سطح نویز آرتیفکت / نویز لرزش عضلانی:</span>
                  <span className="text-indigo-600 font-mono font-bold">{(customParams.noiseLevel * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.00" 
                  max="1.00" 
                  step="0.05"
                  value={customParams.noiseLevel}
                  onChange={(e) => updateParam("noiseLevel", parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                />
                <span className="text-xs sm:text-sm text-slate-700 font-bold font-sans leading-relaxed">شبیه‌ساز ارتعاشات عضلانی بیمار، لرز خودکار الکترود یا آرتیفکت تکان خوردن همراه بیمار.</span>
              </div>

              {/* Checkbox 9: Irregular Heart rate */}
              <div className="flex justify-between items-center bg-slate-50 p-3 px-4 border border-slate-200 rounded-lg" id="control-container-irregular">
                <div className="flex flex-col">
                  <span className="text-slate-850 text-sm sm:text-base font-extrabold font-sans">تولید فواصل نامنظم (Irregular rhythm):</span>
                  <span className="text-xs sm:text-sm text-slate-700 font-bold mt-0.5 font-sans">جهت شبیه‌سازی دقیق ریتم های نامنظم مثل AFib</span>
                </div>
                <input 
                  type="checkbox"
                  checked={customParams.isIrregular}
                  disabled={customParams.bpm === 0}
                  onChange={(e) => updateParam("isIrregular", e.target.checked)}
                  className="w-4.5 h-4.5 text-blue-600 border-slate-300 bg-white rounded focus:ring-blue-500 cursor-pointer disabled:opacity-30"
                />
              </div>

            </div>
          </div>

        </section>

        {/* Right Column: Preset Selection & Interactive Tabs (Colspan 4) */}
        <section className="col-span-1 lg:col-span-4 flex flex-col gap-5">
          
          {/* Preset Rhythms Sidebar Card */}
          <div className="bg-[#f0f7ff] border-2 border-sky-300 rounded-xl p-5 shadow-sm" id="preset-selectors-card">
            <h3 className="text-sky-900 font-extrabold text-sm sm:text-base md:text-lg font-sans pb-3 border-b border-sky-200 mb-4 flex items-center gap-2">
              <Activity className="text-blue-600 animate-pulse" size={18} />
              ریتم‌های پیش‌فرض بالینی و بیماری‌ها
            </h3>

            <p className="text-slate-600 text-sm leading-relaxed mb-4 font-sans font-semibold">
              برای دیدن سریع و شبیه‌سازی الگوهای پاتولوژیک کلاسیک روی دکمه‌های زیر کلیک کنید:
            </p>

            {/* List of presets with beautiful styles */}
            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1" id="presets-list-scroll">
              {rhythms.map((preset) => {
                const isActive = selectedPresetId === preset.id;
                
                // Color mapping for rhythm severity status bar
                let statusColor = "bg-indigo-500";
                if (preset.id === "stemi_anterior" || preset.id === "stemi_inferior" || preset.id === "stemi_lateral" || preset.id === "stemi_posterior_isolated" || preset.id === "stemi_posterior_inferior" || preset.id === "vtach" || preset.id === "vfib" || preset.id === "vfib_fine") {
                  statusColor = "bg-red-500 animate-pulse";
                } else if (preset.id === "afib" || preset.id === "t_wave_inversion" || preset.id === "first_degree_block") {
                  statusColor = "bg-amber-500";
                } else if (preset.id === "bradycardia" || preset.id === "tachycardia" || preset.id === "nsr") {
                  statusColor = "bg-blue-500";
                }

                return (
                  <button
                    key={preset.id}
                    id={`preset-btn-${preset.id}`}
                    onClick={() => selectPreset(preset)}
                    className={`w-full text-right p-3.5 rounded-lg border transition-all text-xs sm:text-sm flex flex-col gap-1 cursor-pointer ${
                      isActive 
                        ? "border-blue-500 bg-blue-100/90 text-blue-900 shadow-sm" 
                        : "border-slate-350 bg-white/70 text-slate-700 hover:bg-white hover:text-slate-950 hover:shadow-xs"
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                        <span className={`font-bold font-sans ${isActive ? 'text-blue-950' : 'text-slate-800'}`}>{preset.nameFarsi}</span>
                      </div>
                      {isActive && <Check size={14} className="text-blue-600 block" />}
                    </div>

                    <span className="text-xs font-bold font-mono text-slate-500 leading-none mr-3.5 uppercase">{preset.nameEnglish}</span>
                    <p className="text-xs sm:text-[13px] text-slate-700 leading-normal mr-3.5 mt-1 line-clamp-2 font-sans font-semibold">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick interactive parameters checker / clinical details block */}
          {selectedPreset && (
            <div className="bg-[#faf5ff] border-2 border-purple-300 rounded-xl p-6 shadow-sm flex-1 flex flex-col" id="rhythm-details-card">
              <h4 className="text-purple-900 text-sm sm:text-base font-extrabold font-sans flex items-center gap-1.5 border-b border-purple-200 pb-2 mb-4">
                <Clipboard size={18} className="text-[#ec4899]" />
                شناسنامه و تفسیر دقیق ریتم: {selectedPreset.nameFarsi}
              </h4>
              
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  {/* Detailed Description */}
                  <div className="mb-3.5 bg-white p-3.5 rounded-lg border border-slate-200">
                    <h5 className="text-[#ec4899] text-xs sm:text-sm font-extrabold font-sans mb-1 flex items-center gap-1">
                      📄 معرفی و نمای فیزیولوژیک ریتم:
                    </h5>
                    <p className="text-xs sm:text-[13px] leading-relaxed text-slate-700 font-sans font-semibold">
                      {selectedPreset.description}
                    </p>
                  </div>

                  {/* Cause / Etiology */}
                  {selectedPreset.causeFarsi && (
                    <div className="mb-3.5 bg-amber-50 p-3.5 rounded-lg border border-amber-300">
                      <h5 className="text-amber-800 text-xs sm:text-sm font-bold font-sans mb-1 flex items-center gap-1">
                        ⚡ علت اصلی ایجاد و بروز (Causes / Etiology):
                      </h5>
                      <p className="text-xs sm:text-[13px] leading-relaxed text-amber-950 font-sans font-bold">
                        {selectedPreset.causeFarsi}
                      </p>
                    </div>
                  )}

                  {/* Diagnostic Criteria */}
                  <div className="mb-3.5 bg-white p-3.5 rounded-lg border border-slate-205">
                    <h5 className="text-blue-700 text-xs sm:text-sm font-bold font-sans mb-1 flex items-center gap-1">
                      🔍 معیارهای قطعی تشخیص در نوار قلب (ECG Criteria):
                    </h5>
                    <ul className="space-y-1.5 text-xs sm:text-[13px] text-slate-700 font-sans list-inside list-disc">
                      {selectedPreset.criteria.map((c, i) => (
                        <li key={i} className="leading-relaxed font-bold">{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Clinical Significance */}
                <div className="pt-3 bg-red-50 p-3.5 rounded-lg border border-red-350">
                  <h5 className="text-red-700 text-xs sm:text-sm font-bold font-sans flex items-center gap-1 mb-1">
                    <ShieldAlert size={14} className="text-red-650" /> اهمیت بالینی و درمان (Clinical Action):
                  </h5>
                  <p className="text-xs sm:text-[13px] leading-relaxed text-red-950 font-sans font-bold">{selectedPreset.clinicalSignificance}</p>
                </div>
              </div>
            </div>
          )}

        </section>

      </main>

      {/* Double Column interactive features tab lower section */}
      <section className="max-w-7xl w-full mx-auto p-4 sm:p-5 pt-0">
        <div className="transition-all duration-200">
          <EducationalGuide />
        </div>
      </section>

      {/* Educational Caution Ribbon */}
      <footer className="bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 py-3.5 flex items-center justify-center text-white text-xs sm:text-sm font-black tracking-wide text-center px-4 shadow">
        هشدار: این ابزار صرفاً برای اهداف آموزشی طراحی شده است و نباید برای تشخیص پزشکی واقعی استفاده شود.
      </footer>

      {/* Main Footer Info */}
      <footer className="bg-slate-200 border-t border-slate-350 py-8 text-slate-800 font-sans" id="app-main-footer">
        <div className="max-w-7xl mx-auto px-5 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex flex-col sm:items-start gap-2 text-center sm:text-right">
            <span className="text-slate-700 font-extrabold text-sm sm:text-base flex items-center gap-2 justify-center sm:justify-start">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse border border-blue-200"></span>
              ساعت و تاریخ امروز سیستم:
            </span>
            <div className="flex flex-wrap gap-3 justify-center sm:justify-start" id="footer-live-clock">
              {/* Date Block */}
              <div className="flex items-center gap-2 bg-[#f1f5f9] border border-slate-400 px-4 py-2.5 rounded-lg shadow-sm">
                <Calendar size={18} className="text-blue-650" />
                <span className="text-slate-800 font-black text-sm sm:text-base leading-none">
                  {currentTime.toLocaleDateString("fa-IR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              {/* Time Block */}
              <div className="flex items-center gap-2 bg-[#f1f5f9] border border-slate-400 px-4 py-2.5 rounded-lg shadow-sm">
                <Clock size={18} className="text-[#ec4899]" />
                <span className="text-slate-800 font-black text-sm sm:text-base font-mono tracking-wider leading-none">
                  {currentTime.toLocaleTimeString("fa-IR")}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-center sm:items-end gap-2">
            <div className="flex items-center gap-2 bg-purple-50/90 border-2 border-purple-400 px-5 py-3.5 rounded-xl shadow-md hover:border-purple-600 hover:bg-purple-100/80 transition-all hover:scale-105 duration-300" id="designer-signature-badge">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-ping"></span>
              <span className="font-signature text-transparent bg-clip-text bg-gradient-to-r from-purple-700 via-fuchsia-600 to-indigo-700 font-extrabold text-sm sm:text-base md:text-lg tracking-wider leading-none">
                Hossein Nassari ART
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* About Modal overlay */}
      {isAboutOpen && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300" id="about-modal-overlay">
          <div className="bg-[#f1f5f9] border border-slate-400 rounded-xl w-full max-w-lg overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-200 px-5 py-4 border-b border-slate-350 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Info size={18} className="text-[#ec4899]" />
                <h3 className="font-extrabold text-slate-800 font-sans text-sm sm:text-base">راهنما و درباره برنامه</h3>
              </div>
              <button 
                onClick={() => setIsAboutOpen(false)}
                className="text-slate-705 hover:text-slate-900 transition-colors cursor-pointer text-xs font-extrabold px-3 py-1.5 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200"
              >
                بستن (✕)
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto text-slate-700 space-y-4 text-xs sm:text-sm md:text-[14px] leading-relaxed font-sans font-semibold">
              
              <div>
                <h4 className="font-extrabold text-blue-650 mb-1.5 flex items-center gap-1.5 text-xs sm:text-sm md:text-[14.5px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ec4899]"></span>
                  درباره برنامه:
                </h4>
                <p className="text-slate-600 leading-relaxed font-medium">
                  این نرم‌افزار یک شبیه‌ساز زنده و جامع پیشرفته برای یادگیری و تحلیل علائم الکتروکاردیوگرام (ECG) است. این پلتفرم به کاربران حوزه پزشکی، پرستاری و پیراپزشکی کمک می‌کند متغیرهای کلیدی قلب از جمله ضربان، امواج P و T، فواصل PR، عرض کمپلکس QRS و تغییرات قطعه ST (سکته قلبی) را تغییر داده و خروجی زنده را بررسی کنند. همچنین می‌توانید با انتخاب از میان آریتمی و عوارض قلبی مختلف از کاتالوگ، ویژگی‌های هر یک را به همراه تفسیر بالینی و معیارها مطالعه نمایید.
                </p>
              </div>

              <div>
                <h4 className="font-extrabold text-blue-650 mb-1.5 flex items-center gap-1.5 text-xs sm:text-sm md:text-[14.5px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ec4899]"></span>
                  نحوه استفاده از برنامه:
                </h4>
                <ul className="list-decimal list-inside space-y-2 text-slate-600 mr-1 list-none font-medium">
                  <li>
                    <span className="text-[#ec4899] font-bold ml-1">•</span> <strong className="text-slate-800">موج‌نگار پیشرفته:</strong> نوار قلب فرضی را به شکل نوسان‌نمای دیجیتال یا نوار کاغذی استاندارد تماشا کنید.
                  </li>
                  <li>
                    <span className="text-[#ec4899] font-bold ml-1">•</span> <strong className="text-slate-800">تغییر زنده لیدها:</strong> با استفاده از نوار انتخاب لید در زیر مانیتور، لیدهای <span className="font-mono text-[#ec4899] font-bold">I, II, III, aVR, aVL, aVF</span> و لیدهای سینه‌ای <span className="font-mono text-[#ec4899] font-bold">V1 تا V6</span> را تغییر داده تا نحوه ثبت سیگنال در زوایای مختلف لید را ببینید.
                  </li>
                  <li>
                    <span className="text-[#ec4899] font-bold ml-1">•</span> <strong className="text-slate-800">کالیبراتور پارامترها:</strong> از ستون تنظیمات، مقادیری مانند تعداد ضربان (BPM)، شکل موج دهلیزی، فواصل هدایتی و تغییرات قطعه ST (سکته قلبی) را دستکاری کرده و تحلیل الگویی خودکار را ببینید.
                  </li>
                  <li>
                    <span className="text-[#ec4899] font-bold ml-1">•</span> <strong className="text-slate-800">اطلس آریتمی‌ها:</strong> با کلیک روی کارت‌های انتهای صفحه، نحوه کارکرد، ویژگی‌ها، معیارها و اقدامات درمانی هر الگوی آریتمی یا بیماری را بخوانید.
                  </li>
                </ul>
              </div>

              {/* Creator Section */}
              <div className="pt-4 border-t border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-mono font-bold">Developer & Creator</span>
                <p className="text-blue-700 font-extrabold text-base sm:text-lg font-sans mt-0.5">
                  سازنده: حسین نصاری
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setIsAboutOpen(false)}
                className="px-5 py-2.5 bg-[#ec4899] hover:bg-pink-650 text-white font-extrabold rounded-lg transition-all text-xs sm:text-sm cursor-pointer shadow"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
