import { getCompany } from "@/lib/company";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const company = getCompany();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-25"
        style={{
          background: `radial-gradient(ellipse at center, ${company.brandColor}, transparent 60%)`,
        }}
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-card/90 border border-border backdrop-blur-sm p-8 shadow-2xl">
        <div className="text-center mb-8">
          {company.logoUrl && (
            <img
              src={company.logoUrl}
              alt={company.name}
              className="mx-auto h-12 mb-4"
            />
          )}
          <h1 className="text-xl font-semibold">{company.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">HR Onboarding Portal</p>
        </div>
        <LoginForm />
        <p className="text-xs text-muted-foreground text-center mt-8">Demo environment</p>
      </div>
    </div>
  );
}
