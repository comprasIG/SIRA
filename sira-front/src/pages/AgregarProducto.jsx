import AgregarProductoForm from "../components/AgregarProductoForm";

const AgregarProducto = () => {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-left text-gray-800 mb-4 border-b-2 border-gray-200 pb-3">Agregar Nuevo Producto</h2>
      <AgregarProductoForm />
    </div>
  );
};

export default AgregarProducto;