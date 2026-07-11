import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, RotateCcw, Upload, LinkIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  getAllGalleryImages,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
  hideDefaultImage,
  unhideDefaultImage,
  getHiddenDefaultIds,
} from "@/lib/api/gallery.functions";
import g1 from "@/assets/clinic-1.jpg";
import g2 from "@/assets/clinic-2.jpg";
import g3 from "@/assets/clinic-3.jpg";
import g4 from "@/assets/clinic-4.jpg";

const DEFAULT_IMAGES = [
  { id: "default-1", url: g1, title: "Consultorio moderno" },
  { id: "default-2", url: g2, title: "Recepción" },
  { id: "default-3", url: g3, title: "Pasillos" },
  { id: "default-4", url: g4, title: "Pediatría" },
];

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.8;

function compressImage(file: File): Promise<{ dataUrl: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height / width) * MAX_DIMENSION);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width / height) * MAX_DIMENSION);
            height = MAX_DIMENSION;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        resolve({ dataUrl, size: Math.round(dataUrl.length * 0.75) });
      };
      img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

function getImageSrc(img: { url: string | null; fileData?: string | null }): string {
  return img.fileData || img.url || "";
}

export function GalleryTab() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [inputMode, setInputMode] = useState<"url" | "upload">("url");
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { data: hidden = [] } = useQuery({
    queryKey: ["gallery-hidden-defaults"],
    queryFn: () => getHiddenDefaultIds(),
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: dbImages } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => getAllGalleryImages(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteGalleryImage({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      toast.success("Imagen eliminada");
    },
  });

  const hideDefaultMut = useMutation({
    mutationFn: (params: { defaultId: string; url: string; title: string }) =>
      hideDefaultImage({ data: params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-hidden-defaults"] });
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
    },
  });

  const unhideDefaultMut = useMutation({
    mutationFn: (defaultId: string) => unhideDefaultImage({ data: { defaultId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-hidden-defaults"] });
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
    },
  });

  const isDefault = (id: string) => id.startsWith("default-");
  const visibleDefaults = DEFAULT_IMAGES.filter((d) => !hidden.includes(d.id));
  const allImages = [...(dbImages ?? []), ...visibleDefaults];

  const resetDialog = useCallback(() => {
    setEditingId(null);
    setEditingUrl("");
    setEditingTitle("");
    setInputMode("url");
    setFileData(null);
    setFileSize(null);
    setFilePreview(null);
  }, []);

  const handleAdd = () => {
    resetDialog();
    setEditOpen(true);
  };

  const handleEdit = (img: {
    id: string;
    url: string | null;
    title: string | null;
    imageType?: string | null;
    fileData?: string | null;
  }) => {
    setEditingId(img.id);
    setEditingTitle(img.title ?? "");
    if (img.imageType === "upload" && img.fileData) {
      setInputMode("upload");
      setFileData(img.fileData);
      setFilePreview(img.fileData);
      setFileSize(null);
      setEditingUrl("");
    } else {
      setInputMode("url");
      setEditingUrl(img.url ?? "");
      setFileData(null);
      setFilePreview(null);
      setFileSize(null);
    }
    setEditOpen(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten archivos de imagen");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("La imagen no puede superar 2MB");
      return;
    }
    try {
      const { dataUrl, size } = await compressImage(file);
      setFileData(dataUrl);
      setFileSize(size);
      setFilePreview(dataUrl);
      setEditingUrl("");
    } catch {
      toast.error("Error al procesar la imagen");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearFile = () => {
    setFileData(null);
    setFileSize(null);
    setFilePreview(null);
  };

  const canSubmit = inputMode === "url" ? !!editingUrl.trim() : !!fileData;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const isUpdate = editingId && !isDefault(editingId);
      if (isUpdate) {
        await updateGalleryImage({
          data: {
            id: editingId,
            url: inputMode === "url" ? editingUrl.trim() : undefined,
            title: editingTitle.trim() || undefined,
            sortOrder: 0,
            imageType: inputMode,
            fileData: inputMode === "upload" ? fileData! : undefined,
            fileSize: inputMode === "upload" ? fileSize! : undefined,
          },
        });
        toast.success("Imagen actualizada");
      } else {
        await createGalleryImage({
          data: {
            url: inputMode === "url" ? editingUrl.trim() : undefined,
            title: editingTitle.trim() || undefined,
            sortOrder: (dbImages?.length ?? 0) + 1,
            imageType: inputMode,
            fileData: inputMode === "upload" ? fileData! : undefined,
            fileSize: inputMode === "upload" ? fileSize! : undefined,
          },
        });
        if (editingId && isDefault(editingId)) {
          const defaultImg = DEFAULT_IMAGES.find((d) => d.id === editingId);
          if (defaultImg) {
            await hideDefaultImage({
              data: {
                defaultId: defaultImg.id,
                url: defaultImg.url,
                title: defaultImg.title,
              },
            });
          }
        }
        toast.success(
          editingId && isDefault(editingId) ? "Imagen de stock reemplazada" : "Imagen agregada",
        );
      }
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      setEditOpen(false);
      resetDialog();
    } catch {
      toast.error("Error al guardar imagen");
    }
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    if (isDefault(id)) {
      const defaultImg = DEFAULT_IMAGES.find((d) => d.id === id);
      if (defaultImg) {
        hideDefaultMut.mutate({
          defaultId: defaultImg.id,
          url: defaultImg.url,
          title: defaultImg.title,
        });
      }
      toast.success("Imagen de stock ocultada");
    } else {
      setDeleteConfirm(id);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" /> Agregar imagen
        </Button>
      </div>
      {allImages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No hay imágenes en la galería.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {allImages.map((img) => (
            <div
              key={img.id}
              className="group relative overflow-hidden rounded-2xl border border-border"
            >
              <img
                src={getImageSrc(img)}
                alt={img.title ?? ""}
                className="aspect-square w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-primary/60 opacity-0 transition-opacity group-hover:opacity-100 opacity-100 md:opacity-0">
                <Button size="sm" variant="outline" onClick={() => handleEdit(img)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(img.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {img.title && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="text-xs text-white">{img.title}</p>
                </div>
              )}
              {isDefault(img.id) && (
                <div className="absolute right-2 top-2 rounded-full bg-amber-500/80 px-2 py-0.5 text-[10px] font-medium text-white">
                  Stock
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hidden.length > 0 && (
        <div className="rounded-xl border border-dashed border-border p-4">
          <p className="mb-2 text-sm text-muted-foreground">Imágenes de stock ocultas:</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_IMAGES.filter((d) => hidden.includes(d.id)).map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs"
              >
                <span className="text-muted-foreground">{d.title}</span>
                <button
                  onClick={() => {
                    unhideDefaultMut.mutate(d.id);
                  }}
                  className="text-primary hover:text-primary/80"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditOpen(false);
            resetDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId && !isDefault(editingId)
                ? "Editar imagen"
                : editingId && isDefault(editingId)
                  ? "Reemplazar imagen de stock"
                  : "Agregar imagen"}
            </DialogTitle>
            <DialogDescription>
              {editingId && isDefault(editingId)
                ? "Subí una imagen o ingresá una URL. La imagen de stock se ocultará automáticamente."
                : editingId
                  ? "Actualizá la imagen y el título"
                  : "Agregá una nueva imagen a la galería"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={inputMode === "upload" ? "default" : "outline"}
                size="sm"
                onClick={() => setInputMode("upload")}
                className="flex-1"
              >
                <Upload className="mr-2 h-4 w-4" /> Subir imagen
              </Button>
              <Button
                type="button"
                variant={inputMode === "url" ? "default" : "outline"}
                size="sm"
                onClick={() => setInputMode("url")}
                className="flex-1"
              >
                <LinkIcon className="mr-2 h-4 w-4" /> Pegar URL
              </Button>
            </div>

            {inputMode === "upload" ? (
              <div className="space-y-3">
                {filePreview ? (
                  <div className="relative">
                    <img
                      src={filePreview}
                      alt="Vista previa"
                      className="w-full rounded-lg object-cover"
                      style={{ maxHeight: 200 }}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute right-2 top-2 h-6 w-6"
                      onClick={clearFile}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    {fileSize && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tamaño: {(fileSize / 1024).toFixed(0)} KB
                      </p>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 transition-colors hover:border-primary/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click para seleccionar una imagen
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">JPG, PNG — máximo 2MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div>
                <Label>URL de la imagen</Label>
                <Input
                  value={editingUrl}
                  onChange={(e) => setEditingUrl(e.target.value)}
                  placeholder="https://ejemplo.com/imagen.jpg"
                />
              </div>
            )}

            <div>
              <Label>Título (opcional)</Label>
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                placeholder="Ej: Sala de espera"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                resetDialog();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !canSubmit}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <AlertDialogTrigger asChild />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar imagen</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La imagen se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) remove.mutate(deleteConfirm);
                setDeleteConfirm(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
