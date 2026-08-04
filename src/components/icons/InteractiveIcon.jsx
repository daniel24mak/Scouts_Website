import {
  ArrowLeft, ArrowRight, Bell, CalendarDays, ChevronDown, ExternalLink, FileText,
  Home, Instagram, MapPin, Menu, Moon, PanelLeftClose, PanelLeftOpen, Plus,
  Search, Send, Settings, Sun, Upload, Users, X
} from "lucide-react";
import { motion, useAnimation, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { ArrowLeftIcon } from "./lucide-animated/arrow-left";
import { ArrowRightIcon } from "./lucide-animated/arrow-right";
import { BellIcon } from "./lucide-animated/bell";
import { CalendarDaysIcon } from "./lucide-animated/calendar-days";
import { ChevronDownIcon } from "./lucide-animated/chevron-down";
import { ExternalLinkIcon } from "./lucide-animated/external-link";
import { FileTextIcon } from "./lucide-animated/file-text";
import { HomeIcon } from "./lucide-animated/home";
import { InstagramIcon } from "./lucide-animated/instagram";
import { MapPinIcon } from "./lucide-animated/map-pin";
import { MenuIcon } from "./lucide-animated/menu";
import { MoonIcon } from "./lucide-animated/moon";
import { PanelLeftCloseIcon } from "./lucide-animated/panel-left-close";
import { PanelLeftOpenIcon } from "./lucide-animated/panel-left-open";
import { PlusIcon } from "./lucide-animated/plus";
import { SearchIcon } from "./lucide-animated/search";
import { SendIcon } from "./lucide-animated/send";
import { SettingsIcon } from "./lucide-animated/settings";
import { SunIcon } from "./lucide-animated/sun";
import { UploadIcon } from "./lucide-animated/upload";
import { UsersIcon } from "./lucide-animated/users";
import { XIcon } from "./lucide-animated/x";
import "./InteractiveIcon.css";

const animatedIcons = new Map([
  [ArrowLeft, ArrowLeftIcon], [ArrowRight, ArrowRightIcon], [Bell, BellIcon],
  [CalendarDays, CalendarDaysIcon], [ChevronDown, ChevronDownIcon],
  [ExternalLink, ExternalLinkIcon], [FileText, FileTextIcon], [Home, HomeIcon],
  [Instagram, InstagramIcon], [MapPin, MapPinIcon], [Menu, MenuIcon],
  [Moon, MoonIcon], [PanelLeftClose, PanelLeftCloseIcon],
  [PanelLeftOpen, PanelLeftOpenIcon], [Plus, PlusIcon], [Search, SearchIcon],
  [Send, SendIcon], [Settings, SettingsIcon], [Sun, SunIcon], [Upload, UploadIcon],
  [Users, UsersIcon], [X, XIcon]
]);

export default function InteractiveIcon({ icon: StaticIcon, size = 18, className = "", ...props }) {
  const hostRef = useRef(null);
  const animatedRef = useRef(null);
  const fallbackControls = useAnimation();
  const reduceMotion = useReducedMotion();
  const AnimatedIcon = animatedIcons.get(StaticIcon);

  useEffect(() => {
    const trigger = hostRef.current?.closest("button, a, [role='button'], label");
    if (!trigger || reduceMotion) return undefined;

    const start = () => {
      if (AnimatedIcon) animatedRef.current?.startAnimation();
      else fallbackControls.start({ scale: [1, 0.94, 1.04, 1], transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } });
    };
    const stop = () => {
      if (AnimatedIcon) animatedRef.current?.stopAnimation();
      else fallbackControls.start({ scale: 1, transition: { duration: 0.14 } });
    };

    trigger.addEventListener("pointerenter", start);
    trigger.addEventListener("pointerleave", stop);
    trigger.addEventListener("pointerdown", start);
    trigger.addEventListener("pointerup", stop);
    trigger.addEventListener("pointercancel", stop);
    return () => {
      trigger.removeEventListener("pointerenter", start);
      trigger.removeEventListener("pointerleave", stop);
      trigger.removeEventListener("pointerdown", start);
      trigger.removeEventListener("pointerup", stop);
      trigger.removeEventListener("pointercancel", stop);
    };
  }, [AnimatedIcon, fallbackControls, reduceMotion]);

  return (
    <span ref={hostRef} className={`interactive-icon ${className}`.trim()} aria-hidden="true">
      {AnimatedIcon && !reduceMotion ? (
        <AnimatedIcon ref={animatedRef} size={size} {...props} />
      ) : (
        <motion.span animate={fallbackControls}><StaticIcon size={size} {...props} /></motion.span>
      )}
    </span>
  );
}
