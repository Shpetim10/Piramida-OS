import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to THIS app directory. Without it, Turbopack sees the
  // parent folder's package-lock.json and infers the wrong root, which breaks the
  // React Client Manifest module resolution (e.g. the organizer page) and emits
  // the multiple-lockfiles warning.
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      // Safety net: the approvals screen lives at /admin/organizer-approvals.
      // Redirect the shorter legacy path so it never 404/500s.
      {
        source: "/admin/organizer",
        destination: "/admin/organizer-approvals",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
