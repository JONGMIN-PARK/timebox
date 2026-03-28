import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = { sm: "w-5 h-5 text-[9px]", md: "w-7 h-7 text-[11px]", lg: "w-10 h-10 text-lg" };

export default function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <div className={cn("rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center font-semibold text-white shadow-sm", sizes[size], className)}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}
