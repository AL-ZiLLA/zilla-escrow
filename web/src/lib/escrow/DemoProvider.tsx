'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { sample, type Role } from './model';
const Context = createContext<{
  role: Role; setRole: (role: Role) => void;
  released: boolean; setReleased: (value: boolean) => void;
  funded: boolean; setFunded: (value: boolean) => void;
} | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('client');
  const [released, setReleased] = useState(false);
  const [funded, setFunded] = useState(false);
  return <Context value={{role,setRole,released,setReleased,funded,setFunded}}>{children}</Context>;
}
export function useDemo() {
  const context = useContext(Context);
  if (!context) throw new Error('DemoProvider is required');
  const milestones = sample.escrow.milestones.map(m => context.released && m.index === 1 ? {...m,status:'Released',funded:0,released:m.amount} : context.funded && m.index === 3 ? {...m,status:'Funded',funded:m.amount} : m);
  const totals = {...sample.escrow.totals,
    escrow_balance: sample.escrow.totals.escrow_balance - (context.released ? 3500000000 : 0) + (context.funded ? 1800000000 : 0),
    released: sample.escrow.totals.released + (context.released ? 3500000000 : 0),
    unfunded: context.funded ? 0 : sample.escrow.totals.unfunded};
  return {...context,milestones,totals};
}
