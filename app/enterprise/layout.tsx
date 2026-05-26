import EnterpriseNav from '@/components/enterprise/EnterpriseNav';
import Footer from '@/components/Footer';

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col">
      <main className="flex-1 max-w-6xl mx-auto px-6 sm:px-12 py-10 w-full">
        <EnterpriseNav />
        {children}
      </main>
      <Footer />
    </div>
  );
}
