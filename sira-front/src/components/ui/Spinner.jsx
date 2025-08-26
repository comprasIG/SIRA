// /src/components/ui/Spinner.jsx

import React from "react";

export default function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-500 border-t-transparent"
        role="status"
        aria-label="cargando"
      ></div>
    </div>
  );
}