// src/pages/Dashboard.jsx

export default function Dashboard({ user }) {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="text-xl mb-4">Bienvenido, {user.displayName}</p>
    </div>
  );
}
