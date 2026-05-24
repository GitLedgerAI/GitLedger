import { createConfig, http } from 'wagmi';
import { base } from 'viem/chains';
import { coinbaseWallet, injected, metaMask } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    metaMask(),
    coinbaseWallet({ appName: 'GitLedger' }),
    injected(),
  ],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
  },
  ssr: true,
});
