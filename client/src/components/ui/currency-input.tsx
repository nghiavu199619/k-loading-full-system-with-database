import React from "react";
import { Input } from "./input";
import { rawToUI, uiToRaw } from '../../../../packages/data-center/src/index';

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CurrencyInput({ value, onChange, placeholder, disabled, className }: CurrencyInputProps) {
  // ✅ USE DATA-CENTER: Unified Vietnamese formatting
  const formatNumber = (num: string) => {
    const parsed = uiToRaw(num, { returnNumber: true });
    return typeof parsed === 'number' ? rawToUI(parsed, { decimals: 0 }) : '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formatted = formatNumber(inputValue);
    onChange(formatted);
  };

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        maxLength={25} // Allow for digits plus commas
        autoComplete="off"
      />
      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
        VNĐ
      </span>
    </div>
  );
}