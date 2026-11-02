import type { NextConfig } from 'next';

const nextConfig: NextConfig = {devIndicators: false, distDir: process.env.QC_PREVIEW_DIST || ".next"};

export default nextConfig;
