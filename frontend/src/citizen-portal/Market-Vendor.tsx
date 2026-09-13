import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FC } from 'react';

export interface MarketVendorsHubProps {
  isCollapsed?: boolean;
}

export const MarketVendorsHub: FC<MarketVendorsHubProps> = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/citizen-portal-stall', { replace: true });
  }, [navigate]);

  return null;
};

export default MarketVendorsHub;