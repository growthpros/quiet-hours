// The phone's bottom bar: five pages plus More. More opens a panel with
// every other page, Settings and the light or dark switch, so nothing is
// out of reach on a phone. The computer keeps the full sidebar.

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MoreHorizontal, Moon, Sun } from "lucide-react";
import { NAV_ITEMS, PHONE_BAR_URLS, moreItems } from "@/components/app-sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

function slug(title: string): string {
  return title.toLowerCase().replace(/\s+/g, "-");
}

export function BottomNav() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const bar = PHONE_BAR_URLS.map((url) => NAV_ITEMS.find((i) => i.url === url)!);
  const more = moreItems();
  const onMorePage = more.some((i) => i.url === location);

  const cell = (active: boolean) =>
    cn(
      "flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-2.5 text-[10px]",
      active ? "text-primary" : "text-muted-foreground hover-elevate",
    );

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      data-testid="nav-bottom"
    >
      <div className="grid grid-cols-6">
        {bar.map((item) => (
          <Link
            key={item.url}
            href={item.url}
            className={cell(location === item.url)}
            aria-current={location === item.url ? "page" : undefined}
            data-testid={`link-bottomnav-${slug(item.title)}`}
          >
            <item.icon className="h-5 w-5" strokeWidth={1.75} />
            <span className="w-full truncate text-center leading-none">{item.title}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cell(onMorePage)}
          aria-label="More pages"
          aria-expanded={open}
          data-testid="button-bottomnav-more"
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
          <span className="leading-none">More</span>
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl pb-8" data-testid="sheet-more">
          <SheetHeader>
            <SheetTitle className="font-serif text-left">More</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {more.map((item) => (
              <Link
                key={item.url}
                href={item.url}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center text-xs",
                  location === item.url ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground hover:bg-muted",
                )}
                data-testid={`link-more-${slug(item.title)}`}
              >
                <item.icon className="h-5 w-5" strokeWidth={1.75} />
                <span className="leading-tight">{item.title}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border p-3 text-center text-xs text-foreground hover:bg-muted"
              data-testid="button-more-theme"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" strokeWidth={1.75} /> : <Moon className="h-5 w-5" strokeWidth={1.75} />}
              <span className="leading-tight">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
