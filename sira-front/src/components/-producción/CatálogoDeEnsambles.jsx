import React, { useMemo, useRef, useState } from "react";
import Ensamble3DViewer from "./Ensamble3DViewer";

export default function CatalogoDeEnsambles() {
  const modelos = useMemo(
    () => [
      {
        label: "Carrito",
        url: "https://storage.googleapis.com/sira-ensambles-public/carrito.glb",
      },
      {
        label: "Ensamblaje riel final",
        url: "https://storage.googleapis.com/sira-ensambles-public/ensamblaje_riel_final.glb",
      },
    ],
    []
  );

  const [selectedUrl, setSelectedUrl] = useState(modelos[0].url);
  const [isWireframe, setIsWireframe] = useState(false);
  const [isTransparent, setIsTransparent] = useState(false);
  const [explodeT, setExplodeT] = useState(0);
  const [hasAnimations, setHasAnimations] = useState(false);

  const controlsRef = useRef(null);

  const setView = (view) => {
    const controls = controlsRef.current;
    if (!controls) return;

    controls.target.set(0, 0, 0);
    const cam = controls.object;
    const d = 4;

    if (view === "front") cam.position.set(0, 0, d);
    if (view === "top") cam.position.set(0, d, 0);
    if (view === "right") cam.position.set(d, 0, 0);
    if (view === "iso") cam.position.set(d, d * 0.8, d);

    cam.lookAt(0, 0, 0);
    controls.update();
  };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Catálogo de Ensambles (MVP)</h2>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <label style={{ fontSize: 14 }}>
          Modelo:&nbsp;
          <select
            value={selectedUrl}
            onChange={(e) => {
              setSelectedUrl(e.target.value);
              setExplodeT(0);
            }}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
          >
            {modelos.map((m) => (
              <option key={m.url} value={m.url}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <button onClick={() => setView("iso")} style={btnStyle}>Iso</button>
        <button onClick={() => setView("front")} style={btnStyle}>Front</button>
        <button onClick={() => setView("right")} style={btnStyle}>Right</button>
        <button onClick={() => setView("top")} style={btnStyle}>Top</button>

        <button
          onClick={() => setIsWireframe((v) => !v)}
          style={{ ...btnStyle, background: isWireframe ? "#2563eb" : "#f3f4f6", color: isWireframe ? "white" : "#111827" }}
        >
          Wireframe
        </button>

        <button
          onClick={() => setIsTransparent((v) => !v)}
          style={{ ...btnStyle, background: isTransparent ? "#2563eb" : "#f3f4f6", color: isTransparent ? "white" : "#111827" }}
        >
          Transparente
        </button>
      </div>

      <Ensamble3DViewer
        url={selectedUrl}
        isWireframe={isWireframe}
        isTransparent={isTransparent}
        explodeT={explodeT}
        onHasAnimations={setHasAnimations}
        controlsRef={controlsRef}
      />

      {hasAnimations && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>
            Explode (si el modelo trae animación)
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={explodeT}
            onChange={(e) => setExplodeT(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      )}
    </div>
  );
}

const btnStyle = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#f3f4f6",
  cursor: "pointer",
};