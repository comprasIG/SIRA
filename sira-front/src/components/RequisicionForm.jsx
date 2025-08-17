import React from "react";
import { useForm } from "react-hook-form";

function RequisicionForm() {
  // Inicializar React Hook Form
  const { register, handleSubmit, formState: { errors } } = useForm();

  // Función que se ejecuta al enviar el formulario
  const onSubmit = (data) => {
    console.log("Datos enviados:", data);
    // Aquí después haremos la petición al backend
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-xl font-bold mb-2">Nueva Requisición</h2>
      
      {/* Ejemplo: campo de prueba */}
      <div>
        <label htmlFor="prueba" className="block font-medium">Campo de prueba:</label>
        <input
          id="prueba"
          {...register("prueba", { required: "Este campo es obligatorio" })}
          className="border p-2 rounded w-full"
        />
        {errors.prueba && (
          <span className="text-red-500">{errors.prueba.message}</span>
        )}
      </div>

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Guardar requisición
      </button>
    </form>
  );
}

export default RequisicionForm;
