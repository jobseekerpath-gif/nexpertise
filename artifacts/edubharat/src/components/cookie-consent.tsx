import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { setConsent, getConsent, type Consent } from "@/lib/analytics";

export function CookieConsent() {
  const [consent, setLocalConsent] = useState<Consent>("pending");

  useEffect(() => {
    setLocalConsent(getConsent());
  }, []);

  if (consent !== "pending") return null;

  const choose = (value: Consent) => {
    setConsent(value);
    setLocalConsent(value);
  };

  return (
    <div
      role="dialog"
      aria-label="Privacy consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg"
    >
      <div className="container mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use anonymous analytics and Core Web Vitals to improve EduBharat. No personal data is shared with third parties.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => choose("denied")}>
            Decline
          </Button>
          <Button size="sm" onClick={() => choose("granted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
