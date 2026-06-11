import { Link, useLocation } from "wouter";

export function Navbar() {
  const [location] = useLocation();

  const links = [
    { href: "/english-guru", label: "English Guru" },
    { href: "/interview-ace", label: "Interview Ace" },
    { href: "/rozgar-samachar", label: "Rozgar Samachar" },
  ];

  return (
    <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-display font-extrabold text-2xl text-primary tracking-tight">
          EduBharat
        </Link>
        
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link 
              key={link.href} 
              href={link.href}
              className={`text-sm font-semibold transition-colors hover:text-primary ${
                location === link.href ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
