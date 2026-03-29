import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { projectApi } from "@/lib/apiService";
import { useProjectStore } from "@/stores/projectStore";
import { useI18n } from "@/lib/useI18n";
import { showToast } from "@/components/ui/Toast";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const inviteAcceptStarted = new Set<string>();

export default function JoinProjectPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const { setActiveProject, fetchProjects } = useProjectStore();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  useEffect(() => {
    if (!token || token.length < 16) {
      setStatus("error");
      return;
    }
    if (inviteAcceptStarted.has(token)) return;
    inviteAcceptStarted.add(token);
    setStatus("loading");
    projectApi.acceptInvite(token).then((res) => {
      if (res.success && res.data?.projectId) {
        setStatus("done");
        showToast("success", t("join.success"));
        fetchProjects();
        setActiveProject(res.data.projectId);
        navigate("/app", { replace: true });
      } else {
        inviteAcceptStarted.delete(token);
        setStatus("error");
        showToast("error", res.error || t("join.invalid"));
      }
    }).catch(() => {
      inviteAcceptStarted.delete(token);
      setStatus("error");
      showToast("error", t("join.invalid"));
    });
  }, [token, t, navigate, setActiveProject, fetchProjects]);

  return (
    <div className="min-h-[50dvh] flex flex-col items-center justify-center p-6">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{t("join.title")}</h1>
      {status === "loading" && <LoadingSpinner />}
      {status === "error" && (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">{t("join.invalid")}</p>
      )}
    </div>
  );
}
