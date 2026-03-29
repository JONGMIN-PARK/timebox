import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Upload, Download, Trash2, Search, Tag, FileText, Image, File, Film, Music, X, Eye, HardDrive } from "lucide-react";
import { useI18n } from "@/lib/useI18n";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/Toast";
import EmptyState from "@/components/ui/EmptyState";

interface FileItem {
  id: number; originalName: string; storedName: string; mimeType: string;
  size: number; tags: string; uploadedVia: string; createdAt: string;
}

interface StorageUsage { usedBytes: number; maxBytes: number; fileCount: number; }

const TAG_PRESETS = ["Work", "Personal", "Reference", "Archive", "Important"];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return <Image className="w-5 h-5 text-green-500" />;
  if (mime.startsWith("video/")) return <Film className="w-5 h-5 text-purple-500" />;
  if (mime.startsWith("audio/")) return <Music className="w-5 h-5 text-pink-500" />;
  if (mime.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  return <File className="w-5 h-5 text-blue-500" />;
}

export default function FileVault() {
  const { t } = useI18n();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<FileItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    const query = [search && `search=${search}`, tagFilter && `tag=${tagFilter}`].filter(Boolean).join("&");
    const res = await api.get<FileItem[]>(`/files${query ? `?${query}` : ""}`);
    if (res.success && res.data) setFiles(res.data);
  };

  const fetchUsage = async () => {
    const res = await api.get<StorageUsage>("/files/usage");
    if (res.success && res.data) setUsage(res.data);
  };

  useEffect(() => { fetchFiles(); fetchUsage(); }, [search, tagFilter]);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("tags", JSON.stringify([]));
        const token = localStorage.getItem("timebox_token");
        const resp = await fetch("/api/files/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!resp.ok) throw new Error("Upload failed");
      }
      showToast("success", t("files.uploadSuccess") ?? "File uploaded");
    } catch {
      showToast("error", t("files.uploadFailed") ?? "Upload failed");
    } finally {
      setUploading(false);
      fetchFiles();
      fetchUsage();
    }
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/files/${id}`);
    showToast("success", t("files.deleteSuccess") ?? "File deleted");
    fetchFiles();
    fetchUsage();
  };

  const handleDownload = (id: number, name: string) => {
    const token = localStorage.getItem("timebox_token");
    const a = document.createElement("a");
    a.href = `/api/files/${id}/download`;
    a.download = name;
    // Use fetch for auth
    fetch(`/api/files/${id}/download`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const handleTagToggle = async (fileId: number, currentTags: string, tag: string) => {
    const tags: string[] = JSON.parse(currentTags);
    const newTags = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    await api.put(`/files/${fileId}/tags`, { tags: newTags });
    fetchFiles();
  };

  const usagePercent = usage ? Math.round((usage.usedBytes / usage.maxBytes) * 100) : 0;

  const allTags = [...new Set(files.flatMap((f) => JSON.parse(f.tags) as string[]))];

  return (
    <div className="flex flex-col h-full"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}>

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[15px] text-slate-900 dark:text-white tracking-tight">{t("files.title")}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => fileInput.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl btn-primary text-xs disabled:opacity-50">
              {uploading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {uploading ? t("files.uploading") : t("files.upload")}
            </button>
            <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("files.searchPlaceholder")}
            className="input-base w-full pl-9" />
        </div>
      </div>

      {/* Tag filter */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100/80 dark:border-slate-700/40 overflow-x-auto scrollbar-hide">
        <button onClick={() => setTagFilter("")}
          className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all",
            !tagFilter ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50")}>
          {t("files.all")}
        </button>
        {[...TAG_PRESETS, ...allTags.filter((t) => !TAG_PRESETS.includes(t))].map((tag) => (
          <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
            className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all",
              tagFilter === tag ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50")}>
            {tag}
          </button>
        ))}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {dragOver && (
          <div className="m-4 p-8 border-2 border-dashed border-blue-400 rounded-2xl bg-blue-50/50 dark:bg-blue-500/5 flex items-center justify-center animate-in">
            <p className="text-sm text-blue-500 font-medium">{t("files.dropHere")}</p>
          </div>
        )}

        {uploading && (
          <div className="px-4 py-3 flex items-center gap-2 text-sm text-blue-500">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            {t("files.uploading")}
          </div>
        )}

        <div className="divide-y divide-slate-100/80 dark:divide-slate-700/40">
          {files.map((file) => {
            const tags: string[] = JSON.parse(file.tags);
            const isPreviewable = file.mimeType.startsWith("image/") || file.mimeType.includes("pdf");

            return (
              <div key={file.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-700/20 transition-colors stagger-item">
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                  {fileIcon(file.mimeType)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-900 dark:text-white truncate">{file.originalName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-400 tabular-nums">{formatSize(file.size)}</span>
                    <span className="text-[11px] text-slate-400">{file.createdAt.slice(0, 10)}</span>
                    {tags.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">{t}</span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  {isPreviewable && (
                    <button onClick={() => setPreview(file)} className="w-7 h-7 rounded-lg btn-ghost flex items-center justify-center" title="Preview">
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}
                  <button onClick={() => handleDownload(file.id, file.originalName)} className="w-7 h-7 rounded-lg btn-ghost flex items-center justify-center" title="Download">
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button onClick={() => setDeleteTarget(file.id)} className="w-7 h-7 rounded-lg btn-ghost flex items-center justify-center" title="Delete">
                    <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {files.length === 0 && !uploading && (
          <EmptyState
            icon={Upload}
            title={t("files.noFiles")}
            description={t("files.dragOrUpload")}
            action={{ label: t("files.upload"), onClick: () => fileInput.current?.click() }}
            className="py-16"
          />
        )}
      </div>

      {/* Storage bar */}
      {usage && (
        <div className="px-4 py-2.5 border-t border-slate-200/60 dark:border-slate-700/40 bg-white/50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>{formatSize(usage.usedBytes)} / {formatSize(usage.maxBytes)}</span>
            <span>{usage.fileCount} files · {usagePercent}%</span>
          </div>
          <div className="h-1.5 bg-slate-200/80 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-500", usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-amber-500" : "bg-blue-500")}
              style={{ width: `${usagePercent}%` }} />
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("files.deleteConfirm")}
        variant="danger"
        onConfirm={() => {
          if (deleteTarget !== null) {
            handleDelete(deleteTarget);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 animate-overlay p-4" onClick={() => setPreview(null)}>
          <div className="relative max-w-3xl max-h-[85vh] animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreview(null)} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white dark:bg-slate-700 shadow-lg flex items-center justify-center z-10">
              <X className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
            {preview.mimeType.startsWith("image/") ? (
              <img src={`/api/files/${preview.id}/preview`} alt={preview.originalName}
                className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain" />
            ) : (
              <iframe src={`/api/files/${preview.id}/preview`} title={preview.originalName}
                className="w-[700px] h-[80vh] rounded-2xl shadow-2xl bg-white" />
            )}
            <p className="text-center text-sm text-white/70 mt-2">{preview.originalName}</p>
          </div>
        </div>
      )}
    </div>
  );
}
