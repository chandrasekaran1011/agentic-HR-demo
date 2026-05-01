import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mjml2html from "mjml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function templatesDir(): string {
  return process.env.EMAIL_TEMPLATES_DIR ?? path.join(__dirname, "templates");
}

/**
 * Render an MJML template with `{{var}}` substitution.
 * vars: flat record of string keys to string values.
 * Returns rendered HTML.
 */
export async function renderTemplate(name: string, vars: Record<string, string>): Promise<string> {
  const file = path.join(templatesDir(), `${name}.mjml`);
  let raw = await fs.readFile(file, "utf-8");
  for (const [k, v] of Object.entries(vars)) {
    raw = raw.replaceAll(`{{${k}}}`, escapeHtml(v));
  }
  // mjml v5 made mjml2html async — await it.
  const compiled = (await (mjml2html as unknown as (
    s: string,
    o?: unknown
  ) => Promise<{ html: string; errors?: { message?: string }[] }>)(raw, {
    validationLevel: "soft",
  }));
  if (compiled.errors && compiled.errors.length > 0) {
    console.warn(`[email/render] mjml warnings for ${name}:`, compiled.errors);
  }
  return compiled.html;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
