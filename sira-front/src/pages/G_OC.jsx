import G_OCForm from "../components/G_OCForm";

export default function G_OC() {
  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-gray-800">Generar OC extraordinaria</h1>
        <p className="text-sm text-gray-500">Captura y envía órdenes de compra fuera del flujo estándar reutilizando la experiencia de requisición y cotización.</p>
      </div>
      <G_OCForm />
    </div>
  );
}
