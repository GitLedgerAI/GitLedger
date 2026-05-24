import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  transpilePackages: [
    '@coinbase/onchainkit',
    '@reown/appkit',
    '@reown/appkit-controllers',
    '@walletconnect/ethereum-provider',
    '@walletconnect/universal-provider',
    '@walletconnect/utils',
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      viem: path.resolve(__dirname, 'node_modules/viem'),
      'pino-pretty': false,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
};

export default nextConfig;
