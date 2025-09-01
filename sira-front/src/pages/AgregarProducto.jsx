import AgregarProductoForm from "../components/AgregarProductoForm";

const AgregarProducto = () => {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold">Agregar Nuevo Producto</h2>
      <AgregarProductoForm />
    </div>
  );
};

export default AgregarProducto;