import { Link } from "wouter";
import { Navbar } from "./navbar";
import { useContent } from "@/lib/use-content";

const PRODUCT_LINKS = [
  { href: "/english-guru",       label: "English Guru" },
  { href: "/interview-ace",      label: "Interview Ace" },
  { href: "/rozgar-samachar",    label: "Rozgar Samachar" },
  { href: "/learning-journey",   label: "My Journey" },
  { href: "/resume-intelligence", label: "Resume Intelligence" },
  { href: "/tools-pro",          label: "Tools Pro" },
];

function Footer() {
  const tagline = useContent(
    "footer.tagline",
    "Empowering India's next generation with AI-driven learning tools for English fluency, interview preparation, and career growth.",
  );
  const contactEmail = useContent("footer.contact.email", "support@edubharat.in");

  return (
    <footer className="bg-secondary text-secondary-foreground mt-auto">
      <div className="container mx-auto px-4 py-12">
        {/* 4-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link href="/" className="block font-display font-bold text-xl mb-3 text-primary hover:opacity-80 transition-opacity">
              EduBharat
            </Link>
            <p className="text-secondary-foreground/60 text-sm leading-relaxed max-w-xs">{tagline}</p>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary-foreground/40 mb-3">Products</h3>
            <ul className="space-y-2">
              {PRODUCT_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary-foreground/40 mb-3">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about-us" className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact-us" className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/credits" className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors">
                  Buy Credits
                </Link>
              </li>
              <li>
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors"
                >
                  {contactEmail}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary-foreground/40 mb-3">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/terms" className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/shipping-refund" className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors">
                  Shipping &amp; Refund
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-secondary-foreground/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-secondary-foreground/40">
          <p>© {new Date().getFullYear()} EduBharat. All rights reserved.</p>
          <p>Made with ❤️ in India 🇮🇳</p>
        </div>
      </div>
    </footer>
  );
}

export function Layout({
  children,
  compact = false,
  showFooter = true,
}: {
  children: React.ReactNode;
  compact?: boolean;
  showFooter?: boolean;
}) {
  return (
    <div className={compact ? "h-[100dvh] flex flex-col overflow-hidden bg-background" : "min-h-[100dvh] flex flex-col"}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:outline-hidden focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <Navbar />
      <main
        id="main-content"
        className={
          compact
            ? "flex-1 min-h-0 flex flex-col overflow-y-auto animate-in fade-in duration-300"
            : "flex-1 flex flex-col animate-in fade-in duration-300"
        }
      >
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
}
