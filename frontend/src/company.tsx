import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './auth';

const DEFAULT_LOGO = '/assets/rr-groups-logo.png';
const DEFAULT_NAME = 'RR Groups';

interface CompanyState {
  name: string;
  logoUrl: string;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyState>({
  name: DEFAULT_NAME,
  logoUrl: DEFAULT_LOGO,
  refresh: async () => { },
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [name, setName] = useState(DEFAULT_NAME);
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('settings').select('*').limit(1).maybeSingle();
    if (data) {
      setName((data.company_name ?? '').trim() || DEFAULT_NAME);
      setLogoUrl((data.logo_url ?? '').trim() || DEFAULT_LOGO);
    } else {
      setName(DEFAULT_NAME);
      setLogoUrl(DEFAULT_LOGO);
    }
  }, []);

  useEffect(() => {
    if (profile?.id) refresh();
  }, [profile?.id, refresh]);

  return (
    <CompanyContext.Provider value={{ name, logoUrl, refresh }}>
      {children}
    </CompanyContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCompany() {
  return useContext(CompanyContext);
}
