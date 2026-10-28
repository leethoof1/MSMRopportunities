import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function Modal({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const onCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    element.addEventListener("cancel", onCancel);
    return () => {
      element.removeEventListener("cancel", onCancel);
      element.close();
    };
  }, [onClose]);
  return (
    <dialog
      ref={dialog}
      className={`modal ${className}`}
      aria-labelledby="modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-top">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Закрыть окно"
        >
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
