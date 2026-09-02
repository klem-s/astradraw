/**
 * Codraw Logo Component
 *
 * Renders the Codraw brand logo with icon and optional text.
 *
 * DESIGN SPECIFICATIONS:
 * - Icon: Stylized "C" letterform (thick rounded ring with a gap),
 *   coral→amber gradient
 * - Text: "Codraw" using Alexandria Google Font
 *   - "Co" = Bold (700 weight)
 *   - "draw" = Light (300 weight)
 *   - Letter spacing: 5% (0.05em)
 * - Brand colors: #FF6B5B (coral) → #FFB020 (amber) gradient
 *
 * USAGE:
 * <CodrawLogo size="large" withText />  // Full logo with text
 * <CodrawLogo size="small" />           // Icon only
 * <CodrawIcon />                        // Just the icon component
 *
 * SIZES:
 * - xs, small, normal, large, custom, mobile
 * - See CodrawLogo.module.scss for size values
 */
import styles from "./CodrawLogo.module.scss";

/**
 * Logo Icon - Stylized "C" letterform: a thick rounded ring with a gap
 * on the right, coral (#FF6B5B) to amber (#FFB020) gradient.
 */
const LogoIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    className={styles.icon}
    fill="none"
  >
    <circle
      cx="24"
      cy="24"
      r="15"
      stroke="url(#codraw-gradient)"
      strokeWidth="11"
      strokeLinecap="round"
      strokeDasharray="73.5 21"
      strokeDashoffset="-10.5"
    />
    <defs>
      <linearGradient
        id="codraw-gradient"
        x1="6"
        y1="6"
        x2="42"
        y2="42"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#FF6B5B" />
        <stop offset="1" stopColor="#FFB020" />
      </linearGradient>
    </defs>
  </svg>
);

/**
 * Logo Text - "Codraw" in Alexandria font
 * - "Co" in bold (700)
 * - "draw" in light (300)
 * - Centered using textAnchor="middle"
 */
const LogoText = () => (
  <svg
    viewBox="0 0 220 40"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    className={styles.text}
  >
    <text
      x="110"
      y="30"
      fill="currentColor"
      fontFamily="'Alexandria', sans-serif"
      fontSize="32"
      letterSpacing="0.05em"
      textAnchor="middle"
    >
      <tspan fontWeight="700">Co</tspan>
      <tspan fontWeight="300">draw</tspan>
    </text>
  </svg>
);

type LogoSize = "xs" | "small" | "normal" | "large" | "custom" | "mobile";

export interface CodrawLogoProps {
  size?: LogoSize;
  withText?: boolean;
  style?: React.CSSProperties;
}

const sizeClasses: Record<LogoSize, string> = {
  mobile: styles.mobile,
  xs: styles.xs,
  small: styles.small,
  normal: styles.normal,
  large: styles.large,
  custom: "",
};

export const CodrawLogo = ({
  style,
  size = "small",
  withText,
}: CodrawLogoProps) => {
  return (
    <div className={`${styles.logo} ${sizeClasses[size]}`} style={style}>
      <LogoIcon />
      {withText && <LogoText />}
    </div>
  );
};

// Also export the icon for use in other places (like menu items)
export const CodrawIcon = LogoIcon;
