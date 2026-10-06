import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { IconArrowLeft } from "@/components/icons";

export default function TopBar({
  title,
  back = false,
  right,
}: {
  title: string;
  back?: boolean;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="safe-top sticky top-0 z-10 border-b border-border bg-ink/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-md items-center px-4">
        {back ? (
          <button
            onClick={() => navigate(-1)}
            className="-ml-2 flex h-9 w-9 items-center justify-center text-text"
            aria-label="Back"
          >
            <IconArrowLeft />
          </button>
        ) : (
          <div className="w-9" />
        )}
        <h1 className="flex-1 text-center text-base font-bold text-text">{title}</h1>
        <div className="flex w-9 justify-end">{right}</div>
      </div>
    </div>
  );
}
