import { useEffect, useRef } from "react";
import { settingsTabs, type SettingsTab } from "./settingsTabs";

export function useSettingsScrollSpy({
  activeTab,
  onActiveTabChange,
}: {
  activeTab: SettingsTab;
  onActiveTabChange: (tab: SettingsTab) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabChangeSourceRef = useRef<"scroll" | null>(null);
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<number | undefined>(undefined);
  const lastExternalActiveTabRef = useRef<SettingsTab>(activeTab);

  useEffect(() => {
    if (activeTabChangeSourceRef.current === "scroll") {
      activeTabChangeSourceRef.current = null;
      return;
    }

    lastExternalActiveTabRef.current = activeTab;
    const container = scrollContainerRef.current;
    const element = document.getElementById(`settings-${activeTab}`);
    if (container && element) {
      const containerRect = container.getBoundingClientRect();
      const sectionRect = element.getBoundingClientRect();
      programmaticScrollRef.current = true;
      window.clearTimeout(programmaticScrollTimerRef.current);
      const top = container.scrollTop + sectionRect.top - containerRect.top - 48;
      container.scrollTo({ top, behavior: "auto" });
      programmaticScrollTimerRef.current = window.setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 700);
    }
  }, [activeTab]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let animationFrame = 0;

    const readActiveTabFromScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const anchorY = containerRect.top + Math.min(160, containerRect.height * 0.28);
      let nearestTab = settingsTabs[0]?.id;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const tab of settingsTabs) {
        const section = document.getElementById(`settings-${tab.id}`);
        if (!section) continue;

        const sectionRect = section.getBoundingClientRect();
        if (sectionRect.top <= anchorY && sectionRect.bottom > anchorY) {
          return tab.id;
        }

        if (sectionRect.bottom < containerRect.top || sectionRect.top > containerRect.bottom) {
          continue;
        }

        const distance = Math.abs(sectionRect.top - anchorY);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestTab = tab.id;
        }
      }

      return nearestTab;
    };

    const updateActiveTab = () => {
      animationFrame = 0;
      if (programmaticScrollRef.current) return;

      const nextTab = readActiveTabFromScroll();
      if (nextTab && nextTab !== activeTab && lastExternalActiveTabRef.current === activeTab) {
        const activeSection = document.getElementById(`settings-${activeTab}`);
        const containerRect = container.getBoundingClientRect();
        const activeRect = activeSection?.getBoundingClientRect();
        if (activeRect && activeRect.top < containerRect.bottom && activeRect.bottom > containerRect.top) {
          return;
        }
      }
      if (nextTab && nextTab !== activeTab) {
        activeTabChangeSourceRef.current = "scroll";
        onActiveTabChange(nextTab);
      }
    };

    const handleScroll = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateActiveTab);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    updateActiveTab();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [activeTab, onActiveTabChange]);

  useEffect(() => {
    return () => {
      window.clearTimeout(programmaticScrollTimerRef.current);
    };
  }, []);

  return scrollContainerRef;
}
