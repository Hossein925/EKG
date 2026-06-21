import React, { useState } from "react";
import { Info, BookOpen, Activity, AlertTriangle, CheckCircle } from "lucide-react";

export default function EducationalGuide() {
  const [activeSegment, setActiveSegment] = useState<string>("p");

  const segments = [
    {
      id: "p",
      name: "موج P (موج دهلیزی)",
      titleEnglish: "P-Wave",
      clinicalCode: "Atrial Depolarization",
      description: "موج P اولین موج در سیکل نوار قلب معمولی است. این موج نمایانگر دپولاریزاسیون دهلیزی (انقباض دهلیز چپ و راست) است تا خون را وارد بطن‌ها کنند.",
      duration: "طبیعی: کمتر از ۰.۱۲ ثانیه (کمتر از ۳ خانه کوچک)",
      amplitude: "طبیعی: کمتر از ۲.۵ میلی‌متر (۰.۲۵ میلی‌ولت)",
      pathology: "فقدان موج P در ریتم فیبریلاسیون دهلیزی (AFib) دیده می‌شود. نوک‌تیز بودن بیش از حد آن نشانه بزرگ شدن دهلیز راست (P pulmonale) و دوشاخه بودن آن نشانه مغایرت دهلیز چپ (P mitrale) است.",
      color: "border-blue-200 bg-blue-50/40 text-blue-900",
      iconColor: "text-blue-500",
    },
    {
      id: "pr",
      name: "بازه PR (زمان هدایت)",
      titleEnglish: "PR Interval",
      clinicalCode: "AV Node Delay",
      description: "بازه PR نشان‌دهنده زمان انتقال تکانه الکتریکی از گره سینوسی تا آغاز فعالیت الکتریکی بطن‌ها (عبور از گره AV) است.",
      duration: "طبیعی: ۰.۱۲ تا ۰.۲۰ ثانیه (۳ تا ۵ خانه کوچک)",
      amplitude: "ثابت روی خط ایزوالکتریک (خط مبنای صاف)",
      pathology: "طولانی شدن غیرطبیعی و ثابت فاصله PR نشان‌دهنده 'بلوک دهلیزی-بطنی درجه اول' است. کوتاه شدن این فاصله ممکن است به علت وجود راه‌های فرعی هدایتی (مانند سندرم WPW) باشد.",
      color: "border-purple-200 bg-purple-50/40 text-purple-900",
      iconColor: "text-purple-500",
    },
    {
      id: "qrs",
      name: "کمپلکس QRS (انقباض بطنی)",
      titleEnglish: "QRS Complex",
      clinicalCode: "Ventricular Depolarization",
      description: "بزرگ‌ترین و واضح‌ترین موج در نوار قلب که نشان‌دهنده انتشار موج الکترواکتیو در عضلات بطن‌ها (انقباض پرقدرت بطن راست و چپ) می‌باشد.",
      duration: "طبیعی: ۰.۰۶ تا ۰.۱۱ ثانیه (۱.۵ تا کمتر از ۳ خانه کوچک)",
      amplitude: "بسته به لید نوار قلب، معمولاً بین ۵ الی ۳۰ میلی‌متر است",
      pathology: "پهن شدن کمپلکس QRS (بیشتر از ۰.۱۲ ثانیه) نشانه تاخیر در انتقال بطنی است، مثلاً در بلوک‌های شاخه‌ای راست یا چپ و همچنین ضربان‌های بطنی زودرس (PVC) یا آریتمی بسیار خطرناک تاکی‌کاردی بطنی (VT).",
      color: "border-pink-200 bg-pink-50/40 text-pink-900",
      iconColor: "text-[#ec4899]",
    },
    {
      id: "st",
      name: "قطعه ST (نقطه بحرانی)",
      titleEnglish: "ST Segment",
      clinicalCode: "Early Repolarization",
      description: "قطعه از پایان کمپلکس QRS تا شروع موج T است. این قطعه نشان‌دهنده زمان بین پایان دپولاریزاسیون و شروع رپلاریزاسیون بطن‌ها است. وضعیت این قطعه مهم‌ترین فاکتور حاد در پایش سکته قلبی است.",
      duration: "بخش ثابت بدون تغییر زمان‌بندی جداگانه",
      amplitude: "باید کاملاً همتراز با خط زمینه باشد (تغییر مجاز کمتر از ۰.۵ میلی‌متر)",
      pathology: "بالا رفتن قطعه ST (ST Elevation) نشانه انفارکتوس حاد و تمام‌ضخامت دیواره قلب (STEMI) است. برعکس، افتادگی آن (ST Depression) می‌تواند نشانه ایسکمی و تنگی عروق قلبی باشد.",
      color: "border-indigo-200 bg-indigo-50/40 text-indigo-900",
      iconColor: "text-indigo-500",
    },
    {
      id: "t",
      name: "موج T (استراحت بطنی)",
      titleEnglish: "T-Wave",
      clinicalCode: "Ventricular Repolarization",
      description: "نشان‌دهنده بازگشت پتانسیل الکتریکی بطن‌ها به حالت استراحت یا رپلاریزاسیون سلول‌های عضلانی بطن چپ و راست است تا برای ضربان بعدی آماده شوند.",
      duration: "طبعاً متناسب با طول ضربان (بخشی از فاصله QT)",
      amplitude: "طبیعی: کمتر از ۵ میلی‌متر در لیدهای دست و پا و کمتر از ۱۰ میلی‌متر در لیدهای سینه",
      pathology: "موج T نوک‌تیز و بسیار بلند (Hyperacute T) در دقایق اولیه سکته قلبی یا افزایش خطرناک پتاسیم خون دیده می‌شود. معکوس شدن موج T تفسیری بر ایسکمی عروق کرونر یا لود بطنی دارد.",
      color: "border-teal-200 bg-teal-50/40 text-teal-900",
      iconColor: "text-teal-500",
    },
    {
      id: "qt",
      name: "فاصله QT (زمان کل بطن)",
      titleEnglish: "QT Interval",
      clinicalCode: "Total Ventricular Cycle",
      description: "فاصله QT نشان‌دهنده زمان کل هدایت الکتریکی و بازیافت (دپولاریزاسیون و رپلاریزاسیون) بطن‌ها است؛ یعنی کل زمان فعالیت بطن‌ها از شروع موج Q تا انتهای موج T.",
      duration: "طبیعی: متناسب با ضربان قلب؛ معمولاً بین ۰.۳۵ تا ۰.۴۴ ثانیه (براساس فرمول‌های اصلاحی مانند Bazett QTc < ۰.۴۴s)",
      amplitude: "شامل ولتاژ متغیر کمپلکس QRS و موج T است",
      pathology: "طولانی شدن غیرطبیعی فاصله QT (سندرم QT طولانی به علت داروها، کاهش کلسیم یا پتاسیم خون) به شدت خطرناک بوده و بیمار را مستعد آریتمی کشنده و طوفانی Torsades de Pointes (تاکی‌کاردی چندشکلی بطن) می‌کند. کوتاه شدن آن با افزایش کلسیم همراه است.",
      color: "border-orange-200 bg-orange-50/40 text-orange-950",
      iconColor: "text-orange-500",
    },
    {
      id: "u",
      name: "موج U (موج فرعی)",
      titleEnglish: "U-Wave",
      clinicalCode: "Purkinje Repolarization",
      description: "موج U یک موج کوچک و ملایم پس از موج T و پیش از موج P بعدی است. تفسیر فیزیولوژیک آن عمدتاً نشان‌دهنده نوسانات مربوط به رپلاریزاسیون سلول‌های سیستم پورکینج یا عضلات پاپیلاری است.",
      duration: "طبیعی: بسیار کوتاه (کمتر از ۰.۰۸ ثانیه)",
      amplitude: "طبیعی: بسیار کم‌ارتفاع (غالباً کمتر از ۱ میلی‌متر، حدود ۱۰٪ ارتفاع موج T)",
      pathology: "موج‌های U معکوس در برخی لیدها نشانه ایسکمی حاد قلب است. موج‌های U برجسته، بلند و واضح (بیشتر از ۲ میلی‌متر) نشانه کلاسیک هیپوکالمی (کمبود شدید پتاسیم خون) می‌باشند.",
      color: "border-emerald-200 bg-emerald-50/40 text-emerald-950",
      iconColor: "text-emerald-500",
    }
  ];

  return (
    <div id="educational-panel" className="bg-[#f0fdf4] border-2 border-emerald-300 rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-5 border-b border-emerald-200 pb-3">
        <BookOpen className="text-emerald-600" size={22} />
        <h2 className="text-emerald-950 font-extrabold text-base sm:text-lg font-sans">راهنمای آموزشی و تفسیر فیزیولوژیک اجزا</h2>
      </div>

      <p className="text-slate-600 text-xs sm:text-sm md:text-[14px] mb-5 leading-relaxed font-sans font-semibold">
        نوار قلب (ECG) نمای کلی ولتاژ سیستم هدایت الکتریکی قلب در طول زمان است. برای فهم اختلالات، باید قطعات مختلف یک ضربان قلب کامل را به خوبی بشناسیم. برای دیدن جزئیات علمی، روی هر موج در پایین کلیک کنید:
      </p>

      {/* Buttons Selection Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 mb-6" id="waves-tab-selector">
        {segments.map((seg) => (
          <button
            key={seg.id}
            onClick={() => setActiveSegment(seg.id)}
            className={`px-3 py-3 rounded-lg text-xs sm:text-sm font-extrabold font-sans transition-all cursor-pointer text-center flex flex-col justify-center items-center gap-1.5 border-2 ${
              activeSegment === seg.id 
                ? "border-blue-500 bg-blue-100 text-blue-900 shadow-sm" 
                : "border-slate-300 bg-white/70 text-slate-600 hover:bg-white hover:text-slate-950"
            }`}
          >
            <span className="text-[10px] font-mono opacity-80 uppercase tracking-wider">{seg.titleEnglish}</span>
            <span className="font-extrabold">{seg.name.split(" ")[0]} {seg.name.split(" ")[1]}</span>
          </button>
        ))}
      </div>

      {/* Wave details container */}
      {segments.map((seg) => {
        if (seg.id !== activeSegment) return null;
        return (
          <div 
            key={seg.id} 
            id={`guide-content-${seg.id}`}
            className={`border-2 rounded-xl p-6 transition-all duration-300 bg-white/95 ${seg.color}`}
          >
            <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
              <div>
                <span className="text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 uppercase">
                  {seg.titleEnglish}  •  {seg.clinicalCode}
                </span>
                <h3 className="text-slate-900 text-lg sm:text-xl font-extrabold mt-1.5 font-sans">{seg.name}</h3>
              </div>
              
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Activity className={seg.iconColor} size={20} />
              </div>
            </div>

            <p className="text-slate-800 text-xs sm:text-sm md:text-[14.5px] font-bold leading-relaxed mb-4 font-sans">
              {seg.description}
            </p>

            {/* Scientific Properties Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
              <div className="bg-white/90 p-3.5 rounded-lg border border-slate-300 shadow-sm">
                <span className="text-slate-500 text-xs font-bold font-sans">⏱️ بازه زمانی (Duration):</span>
                <p className="text-slate-800 text-sm font-extrabold mt-1 font-sans">{seg.duration}</p>
              </div>
              <div className="bg-white/90 p-3.5 rounded-lg border border-slate-300 shadow-sm">
                <span className="text-slate-500 text-xs font-bold font-sans">⚡ ولتاژ/دامنه (Amplitude):</span>
                <p className="text-slate-800 text-sm font-extrabold mt-1 font-sans">{seg.amplitude}</p>
              </div>
            </div>

            {/* Pathological Warning Panel */}
            <div className="bg-red-50 border border-red-300 p-4.5 rounded-lg flex gap-3">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5 text-xs sm:text-sm" size={20} />
              <div>
                <h4 className="text-red-850 text-xs sm:text-sm font-extrabold font-sans">چگونه تغییرات این بخش بیماری را نشان می‌دهد؟</h4>
                <p className="text-red-950 text-xs sm:text-[13.5px] mt-1.5 leading-relaxed font-bold font-sans">{seg.pathology}</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Calibration Guide Alert footer */}
      <div className="mt-5 border-t border-slate-300 pt-4 flex flex-col md:flex-row gap-3 justify-between text-slate-700 text-xs sm:text-[13px] font-sans font-semibold">
        <div id="calibration-info-box" className="flex items-center gap-1.5">
          <Info size={14} className="text-[#ec4899]" />
          <span>بر روی کاغذ شطرنجی نوار قلب استاندارد، هر خانه مربع کوچک نشان‌دهنده 0.04 ثانیه است.</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><CheckCircle size={12} className="text-[#ec4899]" /> استاندارد زمانی: 25mm/s</span>
          <span className="flex items-center gap-1"><CheckCircle size={12} className="text-[#ec4899]" /> استاندارد ولتاژ: 10mm/mV</span>
        </div>
      </div>
    </div>
  );
}
