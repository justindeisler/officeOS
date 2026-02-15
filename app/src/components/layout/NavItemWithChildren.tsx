import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface NavChild {
  name: string;
  href: string;
  icon?: LucideIcon;
}

interface NavItemWithChildrenProps {
  name: string;
  href: string;
  icon: LucideIcon;
  children: NavChild[];
  onNavigate?: () => void;
}

export function NavItemWithChildren({
  name,
  href,
  icon: Icon,
  children,
  onNavigate,
}: NavItemWithChildrenProps) {
  const location = useLocation();

  // Check if any child route is currently active
  const isChildActive = children.some((child) =>
    child.href === href
      ? location.pathname === child.href
      : location.pathname.startsWith(child.href)
  );

  // Auto-expand if current route matches parent prefix or any child
  const [isOpen, setIsOpen] = useState(() =>
    location.pathname.startsWith(href) || isChildActive
  );

  // Parent is active if route matches parent prefix or any child
  const isParentActive = location.pathname.startsWith(href) || isChildActive;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isParentActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1 text-left">{name}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-3">
          {children.map((child) => (
            <NavLink
              key={child.href}
              to={child.href}
              onClick={onNavigate}
              end={child.href === href}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )
              }
            >
              {child.icon && <child.icon className="h-3.5 w-3.5" />}
              {child.name}
            </NavLink>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
