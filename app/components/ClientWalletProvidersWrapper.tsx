'use client';

import dynamic from 'next/dynamic';

const ClientWalletProviders = dynamic(
  () => import('./ClientWalletProviders').then((m) => ({ default: m.ClientWalletProviders })),
  { ssr: false }
);

export default function ClientWalletProvidersWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientWalletProviders>{children}</ClientWalletProviders>;
}
