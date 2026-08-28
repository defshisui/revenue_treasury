import type { FC } from 'react';

export const UnifiedFooter: FC = () => {
  return (
    <footer className="w-full bg-blue-950 text-slate-300 text-xs py-4 px-6 border-t border-blue-900 mt-12">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-4">
          <span className="font-bold">FOLLOW US</span>
          <div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center text-[10px] font-bold cursor-pointer">f</div>
          <div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center text-[10px] font-bold cursor-pointer">x</div>
        </div>
        <div className="flex items-center gap-6 text-[11px]">
          <span>📞 122</span>
          <span>✉️ helpdesk@domain.gov.ph</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="hover:underline cursor-pointer">TERMS OF SERVICE</span>
          <span className="hover:underline cursor-pointer">FAQS</span>
          <span className="hover:underline cursor-pointer">PRIVACY POLICY</span>
        </div>
      </div>
      <div className="max-w-7xl mx-auto text-center text-[10px] text-slate-400 mt-3 pt-3 border-t border-blue-900/50">
        © 2026 Local Government. All rights reserved.
      </div>
    </footer>
  );
};

export default UnifiedFooter;
