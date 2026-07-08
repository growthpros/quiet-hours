import { Link, useLocation } from "wouter";
import { NAV_ITEMS } from "@/components/app-sidebar";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur md:hidden"
      data-testid="nav-bottom"
    >
      <div className="grid grid-cols-7">
        {NAV_ITEMS.map((item) => {
          const active = location === item.url;
          return (
            <Link
              key={item.title}
              href={item.url}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px]",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover-elevate",
              )}
              data-testid={`link-bottomnav-${item.title
                .toLowerCase()
                .replace(/\s+/g, "-")}`}
            >
              <item.icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="leading-none">{item.title.split(" ")[0]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
