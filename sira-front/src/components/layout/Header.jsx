// src/components/layout/Header.jsx
export default function Header({ userName = 'Usuario' }) {
  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white shadow flex items-center justify-between px-6">
      <h1 className="text-lg font-medium">Bienvenido, {userName}</h1>
      <button className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600">
        Logout
      </button>
    </header>
  );
}
