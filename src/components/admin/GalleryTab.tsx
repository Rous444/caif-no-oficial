import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit } from "lucide-react";
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
import { toast } from "sonner";
import { getAllGalleryImages, deleteGalleryImage, updateGalleryImage } from "@/lib/api/gallery.functions";
import g1 from "@/assets/clinic-1.jpg";
import g2 from "@/assets/clinic-2.jpg";
import g3 from "@/assets/clinic-3.jpg";
import g4 from "@/assets/clinic-4.jpg";

const DEFAULT_IMAGES = [
  { id: "default-1", url: g1, title: "Consultorio moderno", sortOrder: 1 },
  { id: "default-2", url: g2, title: "Recepción", sortOrder: 2 },
  { id: "default-3", url: g3, title: "Pasillos", sortOrder: 3 },
  { id: "default-4", url: g4, title: "Pediatría", sortOrder: 4 },
];

export function GalleryTab() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<{ id?: string; url: string; title?: string; sortOrder: number } | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: dbImages } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => getAllGalleryImages(),
  });

  const dbMap = new Map((dbImages ?? []).map((img) => [img.url, img]));
  const images = DEFAULT_IMAGES.map((def) => {
    const dbImg = dbMap.get(def.url);
    return dbImg ? { ...def, id: dbImg.id, url: dbImg.url, title: dbImg.title ?? def.title } : { ...def };
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteGalleryImage({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      toast.success("Imagen eliminada");
    },
  });

  const handleReplace = (img: typeof DEFAULT_IMAGES[0]) => {
    setEditingImage(img);
    setEditUrl(img.url);
    setEditTitle(img.title ?? "");
    setEditOpen(true);
  };

  const handleAdd = () => {
    setEditingImage({ url: "", title: "", sortOrder: (dbImages?.length ?? 0) + 1 });
    setEditUrl("");
    setEditTitle("");
    setEditOpen(true);
  };

  const handleSubmit = async () => {
    if (!editUrl.trim()) return;
    setSaving(true);
    try {
      const isDefault = editingImage?.id?.toString().startsWith("default");
      const realId = isDefault ? undefined : editingImage?.id;
      const sortOrder = editingImage?.sortOrder ?? (dbImages?.length ?? 0) + 1;
      await updateGalleryImage({
        data: {
          id: realId,
          url: editUrl.trim(),
          title: editTitle.trim() || undefined,
          sortOrder,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      toast.success("Imagen guardada");
      setEditOpen(false);
      setEditingImage(null);
    } catch {
      toast.error("Error al guardar imagen");
    }
    setSaving(false);
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" /> Agregar imagen
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {images.map((img) => (
          <div key={img.id} className="group relative overflow-hidden rounded-2xl border border-border">
            <img src={img.url} alt={img.title ?? ""} className="aspect-square w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-primary/60 opacity-0 transition-opacity group-hover:opacity-100">
              <Button size="sm" variant="outline" onClick={() => handleReplace(img)}>
                <Edit className="h-4 w-4" />
              </Button>
              {img.id && !img.id.toString().startsWith("default") && (
                <Button size="sm" variant="destructive" onClick={() => remove.mutate(img.id!)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {img.title && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="text-xs text-white">{img.title}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingImage?.id?.toString().startsWith("default") === false && editingImage?.id ? "Editar imagen" : "Reemplazar imagen"}</DialogTitle>
            <DialogDescription>Cambia la URL y el título de esta imagen</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>URL de la imagen</Label>
              <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://ejemplo.com/imagen.jpg" />
            </div>
            <div>
              <Label>Título (opcional)</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Ej: Sala de espera" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving || !editUrl.trim()}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}