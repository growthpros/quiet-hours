import { Link, useLocation } from "wouter";
import {
  Sun,
  Split,
  ListChecks,
  Quote,
  HeartHandshake,
  Waves,
  History as HistoryIcon,
  Moon,
  Settings as SettingsIcon,
  CheckSquare,
  CalendarDays,
  Cloud,
  Repeat,
  Landmark,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { BrandMark } from "@/components/brand-mark";
import { useTheme } from "@/components/theme-provider";

export const NAV_ITEMS = [
  { title: "Today", url: "/", icon: Sun },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Repeats", url: "/recurring", icon: Repeat },
  { title: "Brain dump", url: "/brain-dump", icon: Cloud },
  { title: "Delegation", url: "/delegation", icon: Split },
  { title: "Good Enough", url: "/good-enough", icon: ListChecks },
  { title: "Reframes", url: "/reframes", icon: Quote },
  { title: "Compassion", url: "/compassion", icon: HeartHandshake },
  { title: "Check-in", url: "/burnout", icon: Waves },
  { title: "History", url: "/history", icon: HistoryIcon },
] as const;

// The phone's bottom bar shows these five, plus More. More lists everything
// else, including pages the sidebar reaches another way (Foundation and Earn
// back from Today, Settings from the sidebar footer). nav.test.ts checks that
// every page is reachable on a phone.
export const PHONE_BAR_URLS = ["/", "/tasks", "/calendar", "/brain-dump", "/burnout"] as const;

export const MORE_EXTRAS = [
  { title: "Foundation", url: "/foundation", icon: Landmark },
  { title: "Earn back", url: "/earn-back", icon: Sparkles },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
] as const;

export function moreItems() {
  return [
    ...NAV_ITEMS.filter((i) => !(PHONE_BAR_URLS as readonly string[]).includes(i.url)),
    ...MORE_EXTRAS,
  ];
}

export function AppSidebar() {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-3">
          <span className="text-primary">
            <BrandMark />
          </span>
          <div className="flex flex-col leading-none">
            <span className="font-serif text-lg font-semibold text-foreground">
              Quiet Hours
            </span>
            <span className="text-xs text-muted-foreground">
              a gentler toolkit
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      data-testid={`link-nav-${item.title
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      <Link href={item.url}>
                        <item.icon strokeWidth={1.75} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/settings"}
              data-testid="link-nav-settings"
            >
              <Link href="/settings">
                <SettingsIcon strokeWidth={1.75} />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? (
                <Sun strokeWidth={1.75} />
              ) : (
                <Moon strokeWidth={1.75} />
              )}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
