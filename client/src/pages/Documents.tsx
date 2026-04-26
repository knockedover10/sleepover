import { useMemo, useState } from "react";
import {
  useTripData,
  getTraveler,
  DOC_VIEW_TO_DB,
  type TravelDoc,
} from "@/lib/trip-data";
import { useDeleteDocument } from "@/lib/trip-queries";
import { supabase } from "@/lib/supabase";
import { PageContainer, Avatar } from "@/components/AppShell";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Lock,
  Users,
  IdCard,
  Stamp,
  Plane,
  Hotel,
  Ticket,
  ShieldCheck,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { set as idbSet, get as idbGet } from "idb-keyval";

const CAT_ICON: Record<TravelDoc["category"], React.ReactNode> = {
  Identity: <IdCard className="h-4 w-4" />,
  Visas: <Stamp className="h-4 w-4" />,
  Flights: <Plane className="h-4 w-4" />,
  Accommodation: <Hotel className="h-4 w-4" />,
  Activities: <Ticket className="h-4 w-4" />,
  Insurance: <ShieldCheck className="h-4 w-4" />,
};

const CAT_ORDER: TravelDoc["category"][] = [
  "Identity",
  "Visas",
  "Flights",
  "Accommodation",
  "Activities",
  "Insurance",
];

function formatSize(kb: number) {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function Documents() {
  const { documents, travelers, me, trip } = useTripData();
  const tripId = trip?.id || null;
  const deleteMut = useDeleteDocument(tripId);
  const { toast } = useToast();
  const [openDoc, setOpenDoc] = useState<TravelDoc | null>(null);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const visibleByCategory = useMemo(() => {
    const groups: Record<string, TravelDoc[]> = {};
    for (const c of CAT_ORDER) groups[c] = [];
    for (const d of documents) {
      groups[d.category]?.push(d);
    }
    return groups;
  }, [documents]);

  const openPreview = async (doc: TravelDoc) => {
    setOpenDoc(doc);
    setOpenUrl(null);
    // try cache first
    const cached = await idbGet<{ blobUrl: string; cachedAt: number }>(`doc:${doc.id}`).catch(
      () => null
    );
    if (cached?.blobUrl) {
      setOpenUrl(cached.blobUrl);
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.filePath, 3600);
      if (error) throw error;
      setOpenUrl(data.signedUrl);
      // fetch & cache
      try {
        const res = await fetch(data.signedUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        await idbSet(`doc:${doc.id}`, { blobUrl, cachedAt: Date.now() });
      } catch {
        /* ignore offline cache failure */
      }
    } catch (e: any) {
      toast({ title: "Could not open file", description: e?.message, variant: "destructive" });
    }
  };

  const remove = (doc: TravelDoc) => {
    if (!confirm("Delete this document?")) return;
    deleteMut.mutate(
      { id: doc.id, file_path: doc.filePath },
      {
        onSuccess: () => toast({ title: "Document deleted" }),
        onError: (e: any) =>
          toast({ title: "Delete failed", description: e?.message, variant: "destructive" }),
      }
    );
  };

  return (
    <PageContainer>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Documents</h1>
          <p className="text-xs text-muted-foreground">
            {documents.length} file{documents.length !== 1 ? "s" : ""} · stored in cloud
          </p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="ios-tap flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          data-testid="button-upload"
        >
          <Upload className="h-3.5 w-3.5" /> Upload
        </button>
      </div>

      <div className="space-y-4" data-testid="documents-list">
        {documents.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No documents yet. Upload tickets, hotel bookings, passport scans here.
          </div>
        ) : (
          CAT_ORDER.map((cat) => {
            const docs = visibleByCategory[cat];
            if (!docs.length) return null;
            return (
              <section key={cat}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {CAT_ICON[cat]} {cat}
                </h3>
                <div className="space-y-2">
                  {docs.map((doc) => {
                    const uploader = getTraveler(travelers, doc.uploaderId);
                    const isMine = me?.id === doc.uploaderId;
                    const isPrivate = doc.privacy === "Private";
                    const hidden = isPrivate && !isMine;
                    return (
                      <div
                        key={doc.id}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border bg-card p-3",
                          hidden && "opacity-60"
                        )}
                        data-testid={`doc-${doc.id}`}
                      >
                        <button
                          disabled={hidden}
                          onClick={() => openPreview(doc)}
                          className={cn(
                            "ios-tap flex flex-1 items-center gap-3 text-left",
                            hidden && "pointer-events-none"
                          )}
                        >
                          <div
                            className={cn(
                              "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                              doc.type === "pdf"
                                ? "bg-red-500/12 text-red-600 dark:text-red-400"
                                : "bg-blue-500/12 text-blue-600 dark:text-blue-400"
                            )}
                          >
                            {doc.type === "pdf" ? (
                              <FileText className="h-5 w-5" />
                            ) : (
                              <ImageIcon className="h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {hidden ? "Private to " + (uploader?.name || "?") : doc.filename}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span>{formatSize(doc.sizeKB)}</span>
                              <span>·</span>
                              {uploader && (
                                <span className="flex items-center gap-1">
                                  <Avatar {...uploader} size={14} />
                                  {uploader.name}
                                </span>
                              )}
                              <span>·</span>
                              <span className="flex items-center gap-0.5">
                                {isPrivate ? (
                                  <>
                                    <Lock className="h-3 w-3" /> Private
                                  </>
                                ) : (
                                  <>
                                    <Users className="h-3 w-3" /> Shared
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        </button>
                        {isMine && (
                          <button
                            onClick={() => remove(doc)}
                            aria-label="Delete document"
                            className="ios-tap grid h-8 w-8 place-items-center rounded-full hover-elevate"
                            data-testid={`button-delete-doc-${doc.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* Preview dialog */}
      <Dialog open={!!openDoc} onOpenChange={(o) => !o && (setOpenDoc(null), setOpenUrl(null))}>
        <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="truncate text-base">{openDoc?.filename}</DialogTitle>
          </DialogHeader>
          {!openUrl ? (
            <div className="grid h-48 place-items-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : openDoc?.type === "pdf" ? (
            <iframe
              src={openUrl}
              title={openDoc.filename}
              className="h-[60vh] w-full rounded-md border"
            />
          ) : (
            <img
              src={openUrl}
              alt={openDoc?.filename}
              className="max-h-[60vh] w-full rounded-md object-contain"
            />
          )}
          {openUrl && (
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block w-full rounded-full bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground"
            >
              Open in new tab
            </a>
          )}
        </DialogContent>
      </Dialog>

      {uploadOpen && <UploadSheet onClose={() => setUploadOpen(false)} />}
    </PageContainer>
  );
}

function UploadSheet({ onClose }: { onClose: () => void }) {
  const { trip, me } = useTripData();
  const tripId = trip?.id || null;
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState("");
  const [category, setCategory] = useState<TravelDoc["category"]>("Identity");
  const [shared, setShared] = useState(true);
  const [uploading, setUploading] = useState(false);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!filename) setFilename(f.name);
  };

  const submit = async () => {
    if (!tripId || !me) {
      toast({ title: "No trip context", variant: "destructive" });
      return;
    }
    if (!file) {
      toast({ title: "Pick a file first", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${tripId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("documents").insert({
        trip_id: tripId,
        filename: filename || file.name,
        file_path: path,
        file_size_bytes: file.size,
        mime_type: file.type || "application/octet-stream",
        category: DOC_VIEW_TO_DB[category],
        is_shared: shared,
        uploader_traveler_id: me.id,
      });
      if (insErr) throw insErr;
      toast({ title: "Uploaded" });
      onClose();
    } catch (e: any) {
      toast({
        title: "Upload failed",
        description: e?.message || "Bucket may not exist. Run migration.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t-0 max-w-md mx-auto max-h-[88vh] overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle>Upload document</SheetTitle>
          <SheetDescription>PDF, image, or any file. Max 25 MB.</SheetDescription>
        </SheetHeader>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="file">File</Label>
            <Input
              id="file"
              type="file"
              accept="application/pdf,image/*"
              onChange={onPick}
              data-testid="input-file"
            />
            {file && (
              <p className="text-[11px] text-muted-foreground">
                {file.name} · {formatSize(Math.round(file.size / 1024))}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dname">Display name</Label>
            <Input
              id="dname"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="e.g. Passport — Liew"
              data-testid="input-doc-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dcat">Category</Label>
            <select
              id="dcat"
              value={category}
              onChange={(e) => setCategory(e.target.value as TravelDoc["category"])}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="select-doc-category"
            >
              {CAT_ORDER.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between rounded-2xl border bg-card p-3">
            <div>
              <p className="text-sm font-semibold">Share with travelers</p>
              <p className="text-[11px] text-muted-foreground">
                Off = only you can see this file.
              </p>
            </div>
            <Switch
              checked={shared}
              onCheckedChange={setShared}
              data-testid="switch-share-doc"
            />
          </div>
          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={uploading || !file}
            data-testid="button-submit-upload"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
