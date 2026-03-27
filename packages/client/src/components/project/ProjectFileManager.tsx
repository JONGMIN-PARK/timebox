import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Upload, Download, Trash2, FileText, Image, Film, Music, File, Folder, FolderPlus, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/useI18n";

interface ProjectFile {
  id: number;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  folder: string;
  uploaderId: number;
  uploaderName: string;
  createdAt: string;
}

interface ProjectFileManagerProps {
  projectId: number;
}

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

export default function ProjectFileManager({ projectId }: ProjectFileManagerProps) {
  const { t } = useI18n();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [currentPath, setCurrentPath] = useState("/");
  const [uploading, setUploading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    const res = await api.get<ProjectFile[]>(`/projects/${projectId}/files?folder=${encodeURIComponent(currentPath)}`);
    if (res.success && res.data) setFiles(res.data);
  };

  useEffect(() => { fetchFiles(); }, [projectId, currentPath]);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", currentPath);
      const token = localStorage.getItem("timebox_token");
      await fetch(`/api/projects/${projectId}/files/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
    }
    setUploading(false);
    fetchFiles();
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("files.deleteConfirm"))) return;
    await api.delete(`/projects/${projectId}/files/${id}`);
    fetchFiles();
  };

  const handleDownload = (id: number, name: string) => {
    const token = localStorage.getItem("timebox_token");
    fetch(`/api/projects/${projectId}/files/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const folderPath = currentPath === "/" ? `/${newFolderName.trim()}` : `${currentPath}/${newFolderName.trim()}`;
    setCurrentPath(folderPath);
    setNewFolderName("");
    setShowNewFolder(false);
  };

  // Derive folders from file list
  const folders = [...new Set(
    files
      .map((f) => f.folder)
      .filter((f) => f !== currentPath && f.startsWith(currentPath))
      .map((f) => {
        const relative = f.slice(currentPath === "/" ? 1 : currentPath.length + 1);
        return relative.split("/")[0];
      })
      .filter(Boolean)
  )];

  const currentFiles = files.filter((f) => f.folder === currentPath);

  // Breadcrumb segments
  const pathSegments = currentPath === "/" ? [] : currentPath.split("/").filter(Boolean);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-[15px] text-slate-900 dark:text-white tracking-tight">
            {t("files.shared")}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewFolder(!showNewFolder)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl btn-ghost text-xs text-slate-600 dark:text-slate-300"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              {t("files.folder")}
            </button>
            <button
              onClick={() => fileInput.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl btn-primary text-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              {t("files.upload")}
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-[12px] text-slate-500 dark:text-slate-400 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setCurrentPath("/")}
            className={cn(
              "hover:text-blue-500 transition-colors whitespace-nowrap",
              currentPath === "/" && "text-blue-600 font-medium"
            )}
          >
            {t("files.root")}
          </button>
          {pathSegments.map((seg, i) => {
            const segPath = "/" + pathSegments.slice(0, i + 1).join("/");
            return (
              <span key={segPath} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-slate-300" />
                <button
                  onClick={() => setCurrentPath(segPath)}
                  className={cn(
                    "hover:text-blue-500 transition-colors whitespace-nowrap",
                    segPath === currentPath && "text-blue-600 font-medium"
                  )}
                >
                  {seg}
                </button>
              </span>
            );
          })}
        </div>

        {/* New folder input */}
        {showNewFolder && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              placeholder={t("files.folder")}
              className="input-base flex-1 text-xs"
              autoFocus
            />
            <button
              onClick={handleCreateFolder}
              className="px-3 py-1.5 rounded-lg btn-primary text-xs"
            >
              {t("common.add")}
            </button>
            <button
              onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}
              className="px-3 py-1.5 rounded-lg btn-ghost text-xs"
            >
              {t("common.cancel")}
            </button>
          </div>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {uploading && (
          <div className="px-4 py-3 flex items-center gap-2 text-sm text-blue-500">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            {t("files.uploading")}
          </div>
        )}

        <div className="divide-y divide-slate-100/80 dark:divide-slate-700/40">
          {/* Folders */}
          {folders.map((folder) => (
            <div
              key={folder}
              onClick={() => setCurrentPath(currentPath === "/" ? `/${folder}` : `${currentPath}/${folder}`)}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-700/20 transition-colors cursor-pointer stagger-item"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Folder className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-900 dark:text-white truncate">{folder}</p>
                <span className="text-[11px] text-slate-400">{t("files.folder")}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          ))}

          {/* Files */}
          {currentFiles.map((file) => (
            <div
              key={file.id}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-700/20 transition-colors stagger-item"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                {fileIcon(file.mimeType)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-900 dark:text-white truncate">{file.originalName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-slate-400 tabular-nums">{formatSize(file.size)}</span>
                  <span className="text-[11px] text-slate-400">{file.uploaderName}</span>
                  <span className="text-[11px] text-slate-400">{file.createdAt.slice(0, 10)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDownload(file.id, file.originalName)}
                  className="w-7 h-7 rounded-lg btn-ghost flex items-center justify-center"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <button
                  onClick={() => handleDelete(file.id)}
                  className="w-7 h-7 rounded-lg btn-ghost flex items-center justify-center"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {folders.length === 0 && currentFiles.length === 0 && !uploading && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mb-3">
              <Folder className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-sm font-medium">{t("files.noFiles")}</p>
            <p className="text-xs mt-1">{t("files.dragOrUpload")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
