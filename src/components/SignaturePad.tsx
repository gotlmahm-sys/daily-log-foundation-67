import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function SignaturePad({
  onSave,
  onCancel,
}: {
  onSave: (dataUrl: string) => void;
  onCancel?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setDirty(true);
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setDirty(false);
  };

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="h-40 w-full touch-none rounded-lg border border-dashed border-border bg-card"
      />
      <p className="text-xs text-muted-foreground">وقّع بإصبعك أو الفأرة داخل المربع أعلاه</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!dirty}
          onClick={() => onSave(canvasRef.current!.toDataURL("image/png"))}
        >
          حفظ التوقيع
        </Button>
        <Button type="button" variant="outline" onClick={clear}>
          مسح
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            إلغاء
          </Button>
        )}
      </div>
    </div>
  );
}
