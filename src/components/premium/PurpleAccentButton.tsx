import type { ReactNode } from "react";

import GoldAccentButton from "@/components/premium/GoldAccentButton";
import type { ButtonProps } from "@/components/ui/button";

type PurpleAccentButtonProps = ButtonProps & {
  icon?: ReactNode;
};

export default function PurpleAccentButton({ className, icon, children, ...props }: PurpleAccentButtonProps) {
  return (
    <GoldAccentButton className={className} icon={icon} {...props}>
      {children}
    </GoldAccentButton>
  );
}
