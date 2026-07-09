import { ChevronDown } from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from 'react';

export type MultiStateActionButtonTone = 'accent' | 'neutral' | 'danger';

export type MultiStateActionButtonOption<Value extends string> = {
  value: Value;
  label: string;
  shortLabel: string;
  actionLabel: string;
  description: string;
  color?: string;
};

type MultiStateActionButtonProps<Value extends string> = {
  ariaLabel: string;
  disabled?: boolean;
  leadingIcon?: ReactNode;
  loadingLabel?: string;
  loading?: boolean;
  onAction: () => void;
  onValueChange: (value: Value) => void;
  options: readonly MultiStateActionButtonOption<Value>[];
  selectionDisabled?: boolean;
  tone?: MultiStateActionButtonTone;
  value: Value;
};

export const MultiStateActionButton = <Value extends string>({
  ariaLabel,
  disabled = false,
  leadingIcon,
  loading = false,
  loadingLabel,
  onAction,
  onValueChange,
  options,
  selectionDisabled = false,
  tone = 'accent',
  value,
}: MultiStateActionButtonProps<Value>): JSX.Element | null => {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options.at(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!selectedOption) {
    return null;
  }

  const selectedStyle = selectedOption.color
    ? ({ '--multi-state-selected-color': selectedOption.color } as CSSProperties)
    : undefined;

  return (
    <div
      ref={rootRef}
      className={`multi-state-action multi-state-action--${tone}`}
      style={selectedStyle}
    >
      <button
        type="button"
        className="multi-state-action-main"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onAction}
      >
        {leadingIcon}
        <span>{loading && loadingLabel ? loadingLabel : selectedOption.actionLabel}</span>
      </button>
      <button
        type="button"
        className="multi-state-action-selector"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Select ${ariaLabel} mode`}
        aria-controls={isOpen ? menuId : undefined}
        disabled={selectionDisabled || loading}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{selectedOption.shortLabel}</span>
        <ChevronDown size={14} strokeWidth={2.2} />
      </button>
      {isOpen ? (
        <div id={menuId} className="multi-state-action-menu" role="menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`multi-state-action-option${
                option.value === selectedOption.value ? ' multi-state-action-option--selected' : ''
              }`}
              role="menuitemradio"
              aria-checked={option.value === selectedOption.value}
              style={
                option.color
                  ? ({ '--multi-state-option-color': option.color } as CSSProperties)
                  : undefined
              }
              onClick={() => {
                onValueChange(option.value);
                setIsOpen(false);
              }}
            >
              <span className="multi-state-action-option-color" aria-hidden="true" />
              <span>
                <span className="multi-state-action-option-label">{option.label}</span>
                <span className="multi-state-action-option-description">{option.description}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
