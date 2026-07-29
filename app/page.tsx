import AppShell from "@/components/AppShell";
import { isAuthConfigured } from "@/lib/auth";
import Gallery from "@/components/Gallery";
import ScreenPanel from "@/components/ScreenPanel";
import Settings from "@/components/Settings";
import UploadForm from "@/components/UploadForm";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <AppShell
      authConfigured={isAuthConfigured()}
      commit={
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"
      }
      ecran={<ScreenPanel />}
      bibliotheque={
        <div className="flex flex-col gap-8">
          <UploadForm />
          <Gallery />
        </div>
      }
      reglages={<Settings />}
    />
  );
}
