import AgregarProductoForm from "../components/AgregarProductoForm";

const AgregarProducto = () => {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 ">Agregar Nuevo Producto</h2>
      <p className="text-gray-600 text-sm mt-1 mb-4 border-b-2 border-gray-200 pb-3">
            Agrega un nuevo producto llenando el siguiente formulario.
          </p>
      <AgregarProductoForm />
    </div>
  );
};

export default AgregarProducto; //ñññññññ