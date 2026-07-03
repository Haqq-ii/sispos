import { User } from 'lucide-react'

export default function KaderProfilPage() {
  return (
    <div className="min-h-full bg-[#f9fafb] pb-8">
      <div className="bg-[#008236] px-5 py-6">
        <p className="text-[#7bf1a8] text-xs">Kader</p>
        <h1 className="text-white font-bold text-xl mt-1">Profil Kader</h1>
        <p className="text-[#b9f8cf] text-xs mt-1">Kelola data akun kader posyandu</p>
      </div>
      <div className="px-4 mt-8 flex flex-col items-center justify-center text-center">
        <User size={48} className="text-[#b9f8cf] mb-4" />
        <p className="text-[#6a7282] text-sm font-medium">Halaman sedang dikembangkan</p>
        <p className="text-[#99a1af] text-xs mt-1">Fitur pengelolaan profil kader segera hadir.</p>
      </div>
    </div>
  )
}
