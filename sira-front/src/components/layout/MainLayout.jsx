// src/components/layout/MainLayout.jsx
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout({ children, userName }) {
  return (
    <div className="flex">
      <Sidebar />

      <div className="flex-1 ml-64">
        <Header userName={userName} />

        <main className="pt-16 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
