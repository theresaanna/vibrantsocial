"use client";

interface ReadReceiptIndicatorProps {
  status: "sent" | "delivered" | "read";
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

export function ReadReceiptIndicator({ status }: ReadReceiptIndicatorProps) {
  if (status === "sent") {
    return (
      <span className="inline-flex text-zinc-400" aria-label="Sent">
        <CheckIcon />
      </span>
    );
  }

  const colorClass =
    status === "read" ? "text-blue-500" : "text-zinc-400";

  return (
    <span className={`inline-flex -space-x-1.5 ${colorClass}`} aria-label={status === "read" ? "Read" : "Delivered"}>
      <CheckIcon />
      <CheckIcon />
    </span>
  );
}
