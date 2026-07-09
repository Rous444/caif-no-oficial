import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, RotateCcw } from "lucide-react";
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

function useHiddenDefaults() {
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("gallery_hidden_defaults") || "[]");
    } catch {
      return [];
    }
  });
  const toggle = (id: string) => {
    setHidden((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem("gallery_hidden_defaults", JSON.stringify(next));
      return next;
    });
  };
  const show = (id: string) => {
    setHidden((prev) => {
      const next = prev.filter((x) => x !== id);
      localStorage.setItem("gallery_hidden_defaults", JSON.stringify(next));
      return next;
    });
  };
  return { hidden, toggle, show };
}

export function GalleryTab() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { hidden, show: unhideDefault } = useHiddenDefaults();

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

  const isDefault = (id: string) => id.startsWith("default-");
  const visibleDefaults = DEFAULT_IMAGES.filter((d) => !hidden.includes(d.id));
  const allImages = [...(dbImages ?? []), ...visibleDefaults];

  const handleAdd = () => {
    setEditingId(null);
    setEditingUrl("");
    setEditingTitle("");
    setEditOpen(true);
  };

  const handleEdit = (img: { id: string; url: string; title: string | null }) => {
    setEditingId(img.id);
    setEditingUrl(img.url);
    setEditingTitle(img.title ?? "");
    setEditOpen(true);
  };

  const handleSubmit = async () => {
    if (!editingUrl.trim()) return;
    setSaving(true);
    try {
      if (editingId && !isDefault(editingId)) {
        await updateGalleryImage({
          data: {
            id: editingId,
            url: editingUrl.trim(),
            title: editingTitle.trim() || undefined,
            sortOrder: 0,
          },
        });
        toast.success("Imagen actualizada");
      } else {
        await createGalleryImage({
          data: {
            url: editingUrl.trim(),
            title: editingTitle.trim() || undefined,
            sortOrder: (dbImages?.length ?? 0) + 1,
          },
        });
        if (editingId && isDefault(editingId)) {
          const hs = JSON.parse(localStorage.getItem("gallery_hidden_defaults") || "[]");
          if (!hs.includes(editingId)) {
            hs.push(editingId);
            localStorage.setItem("gallery_hidden_defaults", JSON.stringify(hs));
          }
        }
        toast.success(editingId && isDefault(editingId) ? "Imagen de stock reemplazada" : "Imagen agregada");
      }
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      setEditOpen(false);
      setEditingId(null);
    } catch {
      toast.error("Error al guardar imagen");
    }
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    if (isDefault(id)) {
      const hs = JSON.parse(localStorage.getItem("gallery_hidden_defaults") || "[]");
      if (!hs.includes(id)) {
        hs.push(id);
        localStorage.setItem("gallery_hidden_defaults", JSON.stringify(hs));
      }
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
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
                src={img.url}
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
                    unhideDefault(d.id);
                    queryClient.invalidateQueries({ queryKey: ["gallery"] });
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
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
                ? "Ingresá una nueva URL. La imagen de stock se ocultará automáticamente."
                : editingId
                  ? "Actualizá la URL y el título"
                  : "Agregá una nueva imagen a la galería"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>URL de la imagen</Label>
              <Input
                value={editingUrl}
                onChange={(e) => setEditingUrl(e.target.value)}
                placeholder="https://ejemplo.com/imagen.jpg"
              />
            </div>
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
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !editingUrl.trim()}>
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
