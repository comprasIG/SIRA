import VB_OCForm from "../components/VB_OCForm";

export default function VB_OC() {
  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-gray-800">Visto bueno OC extraordinaria</h1>
        <p className="text-sm text-gray-500">Revisa, aprueba o rechaza las órdenes extraordinarias manteniendo el estatus y la trazabilidad.</p>
      </div>
      <VB_OCForm />
    </div>
  );
}
