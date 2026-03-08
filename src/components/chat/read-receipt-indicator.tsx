"use client";

interface ReadReceiptIndicatorProps {
  status: "sent" | "delivered" | "read";
  hasCustomTheme?: boolean;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-3.5 w-3.5 ${className ?? ""}`}
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ReadReceiptIndicator({ status, hasCustomTheme }: ReadReceiptIndicatorProps) {
  if (status === "read") {
    // Read: match text color so checkmark is clearly visible
    return (
      <span
        className={`inline-flex ${hasCustomTheme ? "" : "text-white"}`}
        style={hasCustomTheme ? { color: "var(--chat-bubble-text)" } : undefined}
        aria-label="Read"
      >
        <CheckIcon />
      </span>
    );
  }

  // Sent/delivered: match bg color so checkmark is subtle
  return (
    <span
      className={`inline-flex ${hasCustomTheme ? "" : "text-blue-500"}`}
      style={hasCustomTheme ? { color: "var(--chat-bubble-bg)" } : undefined}
      aria-label={status === "delivered" ? "Delivered" : "Sent"}
    >
      <CheckIcon />
    </span>
  );
}
