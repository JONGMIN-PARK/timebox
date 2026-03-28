import { useState, useCallback } from "react";
import {
  Calendar,
  CheckSquare,
  Clock,
  MessageCircle,
  Rocket,
  Sparkles,
} from "lucide-react";

interface OnboardingGuideProps {
  onComplete: () => void;
}

const steps = [
  {
    icon: Sparkles,
    title: "환영합니다!",
    description:
      "TimeBox에 오신 것을 환영합니다.\n일정, 할일, 시간 관리를 한 곳에서 해보세요.",
    gradient: "from-violet-500 to-indigo-500",
    iconBg: "bg-violet-100 dark:bg-violet-900/40",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    icon: Calendar,
    title: "캘린더",
    description: "일정을 한눈에 관리하세요.\n월간, 주간, 일간 뷰로 쉽게 확인할 수 있습니다.",
    gradient: "from-blue-500 to-cyan-500",
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    icon: CheckSquare,
    title: "할일 관리",
    description:
      "우선순위와 카테고리로 정리하세요.\n중요한 일부터 차근차근 완료해 나갈 수 있습니다.",
    gradient: "from-emerald-500 to-teal-500",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: Clock,
    title: "타임박스",
    description:
      "시간 블록으로 하루를 디자인하세요.\n집중 시간과 휴식을 효율적으로 배분할 수 있습니다.",
    gradient: "from-amber-500 to-orange-500",
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    icon: MessageCircle,
    title: "채팅 & 협업",
    description:
      "팀과 실시간으로 소통하세요.\n프로젝트 단위로 채팅하고 파일을 공유할 수 있습니다.",
    gradient: "from-pink-500 to-rose-500",
    iconBg: "bg-pink-100 dark:bg-pink-900/40",
    iconColor: "text-pink-600 dark:text-pink-400",
  },
  {
    icon: Rocket,
    title: "준비 완료!",
    description:
      "모든 준비가 끝났습니다.\n지금 바로 TimeBox를 시작해보세요!",
    gradient: "from-indigo-500 to-purple-500",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/40",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
];

export default function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback(
    (next: number, dir: "left" | "right") => {
      if (animating) return;
      setDirection(dir);
      setAnimating(true);
      setTimeout(() => {
        setCurrentStep(next);
        setAnimating(false);
      }, 250);
    },
    [animating],
  );

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      goTo(currentStep + 1, "right");
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      goTo(currentStep - 1, "left");
    }
  };

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === steps.length - 1;

  const slideClass = animating
    ? direction === "right"
      ? "opacity-0 translate-x-8"
      : "opacity-0 -translate-x-8"
    : "opacity-100 translate-x-0";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {/* Card */}
      <div className="relative w-full max-w-md mx-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Gradient header */}
          <div
            className={`h-2 bg-gradient-to-r ${step.gradient} transition-all duration-500`}
          />

          {/* Content */}
          <div
            className={`p-8 text-center transition-all duration-250 ease-in-out ${slideClass}`}
          >
            {/* Icon */}
            <div
              className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl ${step.iconBg} mb-6`}
            >
              <Icon className={`w-10 h-10 ${step.iconColor}`} />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              {step.title}
            </h2>

            {/* Description */}
            <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 space-y-4">
            {/* Step dots */}
            <div className="flex items-center justify-center gap-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() =>
                    i !== currentStep &&
                    goTo(i, i > currentStep ? "right" : "left")
                  }
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? `w-6 bg-gradient-to-r ${step.gradient}`
                      : "w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500"
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={onComplete}
                className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                건너뛰기
              </button>

              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={handlePrev}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    이전
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className={`px-6 py-2 text-sm font-medium text-white rounded-lg bg-gradient-to-r ${step.gradient} hover:opacity-90 transition-opacity shadow-lg`}
                >
                  {isLast ? "시작하기" : "다음"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
